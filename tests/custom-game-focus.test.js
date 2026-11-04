"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {execFileSync}=require('node:child_process');
const {WindowsInputService}=require('../src/main/windows-input-service');

test('automatic focus stays in the per-game queue and rechecks access before activating',async()=>{
 const calls=[];let release,allowed=true;
 const input=new WindowsInputService({execute:async(...args)=>{calls.push(args);if(calls.length===1)await new Promise(resolve=>{release=resolve;});return {ok:true};}});
 const first=input.play('Game','k,0,32,0;k,40,32,1');
 await new Promise(resolve=>setImmediate(resolve));
 const queued=input.play('Game','k,0,69,0;k,40,69,1','wasd','scan-code',{activateBeforePlay:true,assertAccess(){if(!allowed)throw Error('Session arrêtée');}});
 const rejected=assert.rejects(queued,/Session arrêtée/);allowed=false;release();await first;await rejected;
 assert.equal(calls.length,1);assert.equal(calls[0][0],'play');
 await input.play('Game','k,0,69,0;k,40,69,1','wasd','scan-code',{activateBeforePlay:true});
 assert.equal(calls[1][0],'play-focus-foreground');assert.equal(typeof calls[1][4].assertAccess,'function');
 await input.play('Game','k,0,69,0;k,40,69,1','wasd','scan-code',{foregroundOnly:true});assert.equal(calls[2][0],'play-foreground');
});

// Execute the production sequence logic with a fake process and a fake native
// class. No user32 calls or real keyboard/window input can occur in this test.
function runSequence(scenario,operation='play-focus-foreground'){
 const source=fs.readFileSync(path.join(__dirname,'../src/main/windows-input-service.js'),'utf8');
 let script=vm.runInNewContext(source+'\n;WINDOWS_INPUT_SCRIPT',{require,module:{exports:{}},process,Buffer,setInterval,clearInterval});
 const nativeMock=`Add-Type -TypeDefinition @'
using System;
using System.IO;
using System.Collections.Generic;
public static class ShenPulseGameInput {
 public static List<string> Calls=new List<string>();
 static bool foreground=false;
 public static bool IsForeground(IntPtr window){return foreground;}
 public static IntPtr FindWindowForProcess(uint id){return new IntPtr(42);}
 public static bool Activate(IntPtr window){Calls.Add("activate:"+window);if(Environment.GetEnvironmentVariable("INPUT_SCENARIO")=="focus-failure")return false;foreground=true;return true;}
 public static void SendKey(IntPtr window,ushort key,bool up,bool scan,bool fallback){Calls.Add((up?"up:":"down:")+key);if(!up&&Environment.GetEnvironmentVariable("INPUT_SCENARIO")=="focus-lost")foreground=false;if(!up&&Environment.GetEnvironmentVariable("INPUT_SCENARIO")=="cancel-during")File.WriteAllText(Environment.GetEnvironmentVariable("SHENPULSE_INPUT_CANCEL_FILE"),"cancel");}
 public static void SendMouseButton(int button,bool up){throw new Exception("Unexpected mouse input");}
 public static void SendMouseMove(int x,int y){throw new Exception("Unexpected mouse input");}
}
'@`;
 script=script.replace(/Add-Type -TypeDefinition @'[\s\S]*?\r?\n'@/,nativeMock);
 assert.ok(!script.includes('DllImport'),'The test must never use native Windows automation');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-focus-test-')),cancelFile=path.join(directory,'cancel');
 if(scenario==='cancel-before')fs.writeFileSync(cancelFile,'cancel');
 const prelude=`$ProgressPreference='SilentlyContinue'\nfunction Get-Process { param($Name,$ErrorAction) if($env:INPUT_SCENARIO -eq 'closed'){return};$p=[pscustomobject]@{Id=123;ProcessName='TestGame';HasExited=$false;MainWindowHandle=[IntPtr]42};$p|Add-Member -MemberType ScriptMethod -Name Refresh -Value {} -PassThru }\nfunction Get-CimInstance {param($ClassName,$Filter,$ErrorAction)}\n`;
 const wrapped=prelude+`$failure='';try { & {\n`+script+`\n} } catch {$failure=$_.Exception.Message} finally {$trace=@();if('ShenPulseGameInput' -as [type]){$trace=@([ShenPulseGameInput]::Calls)};@{failure=$failure;trace=$trace}|ConvertTo-Json -Compress}\n`;
 try{
  const output=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(wrapped,'utf16le').toString('base64')],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...process.env,INPUT_SCENARIO:scenario,SHENPULSE_INPUT_OPERATION:operation,SHENPULSE_INPUT_PROCESS:'TestGame',SHENPULSE_INPUT_CANCEL_FILE:cancelFile,SHENPULSE_INPUT_KEYBOARD_MODE:'scan-code',SHENPULSE_INPUT_EVENTS:Buffer.from(JSON.stringify([{kind:'keyboard',keyCode:69,action:'down',delayMs:0},{kind:'keyboard',keyCode:69,action:'up',delayMs:50}])).toString('base64')}});
  return JSON.parse(output.trim().split(/\r?\n/).at(-1));
 }finally{fs.rmSync(directory,{recursive:true,force:true});}
}

test('keyboard sequences activate once, verify focus, and release keys on interruption',{skip:process.platform!=='win32'},()=>{
 const ok=runSequence('success');assert.equal(ok.failure,'');assert.deepEqual(ok.trace,['activate:42','down:69','up:69']);
 const closed=runSequence('closed');assert.match(closed.failure,/n'est pas ouvert/);assert.deepEqual(closed.trace,[]);
 const denied=runSequence('focus-failure');assert.match(denied.failure,/premier plan/);assert.deepEqual(denied.trace,['activate:42']);
 const lost=runSequence('focus-lost');assert.match(lost.failure,/Interaction arrêtée/);assert.deepEqual(lost.trace,['activate:42','down:69','up:69']);
 const canceled=runSequence('cancel-before');assert.match(canceled.failure,/session.*arrêtée/i);assert.deepEqual(canceled.trace,[]);
 const during=runSequence('cancel-during');assert.match(during.failure,/Interaction arrêtée/);assert.deepEqual(during.trace,['activate:42','down:69','up:69']);
 const strict=runSequence('success','play-foreground');assert.match(strict.failure,/premier plan/);assert.deepEqual(strict.trace,[]);
});
