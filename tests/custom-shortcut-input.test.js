"use strict";
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
function fixture(t){
 const dom=new JSDOM('<dialog open><div id="root"></div></dialog><input id="other">',{runScripts:'outside-only',pretendToBeVisual:true});t.after(()=>dom.window.close());
 for(const file of ['src/shared/custom-game-shortcuts.js','src/renderer/app/features/games/shortcut-input.js'])dom.window.eval(fs.readFileSync(path.resolve(__dirname,'..',file),'utf8'));
 const root=dom.window.document.querySelector('#root');root.innerHTML=dom.window.ShenPulseShortcutInput.render('espace','name="shortcut"');const input=root.querySelector('input'),saved=[];input.addEventListener('change',()=>saved.push(input.value));
 const key=(type,key,options={})=>{const event=new dom.window.KeyboardEvent(type,{key,bubbles:true,cancelable:true,...options});input.dispatchEvent(event);return event;};return {dom,root,input,saved,key};
}
test('click and press ESC records its label without letting the event dismiss a dialog',t=>{
 const f=fixture(t);let bubbled=0;f.dom.window.document.querySelector('dialog').addEventListener('keydown',()=>bubbled++);f.input.click();assert.equal(f.key('keydown','Escape').defaultPrevented,true);f.key('keyup','Escape');
 assert.deepEqual(f.saved,['ESC']);assert.equal(bubbled,0);assert.equal(f.input.readOnly,true);assert.equal(f.input.classList.contains('is-recording'),false);
});
test('modifier alone and combinations are committed once on release, with no repeated saves',t=>{
 const f=fixture(t);f.input.click();f.key('keydown','Shift',{shiftKey:true});assert.equal(f.saved.length,0);f.key('keyup','Shift');assert.deepEqual(f.saved,['SHIFT']);
 f.input.click();f.key('keydown','Control',{ctrlKey:true});f.key('keydown','e',{code:'KeyE',ctrlKey:true});f.key('keydown','e',{code:'KeyE',ctrlKey:true,repeat:true});f.key('keyup','e',{code:'KeyE',ctrlKey:true});assert.equal(f.saved.length,1);f.key('keyup','Control');assert.deepEqual(f.saved,['SHIFT','CTRL + E']);
});
test('AZERTY number row, numpad and letter identity are captured from the real key event',t=>{
 const f=fixture(t);for(const [key,code,label]of [['&','Digit1','1'],['1','Numpad1','NUM1'],['q','KeyA','Q'],[' ','Space','ESPACE'],['ArrowLeft','ArrowLeft','GAUCHE']]){f.input.click();f.key('keydown',key,{code});f.key('keyup',key,{code});assert.equal(f.saved.at(-1),label);}
});
test('text entry still accepts aliases and sequences; numeric controls are not intercepted',t=>{
 const f=fixture(t);f.root.querySelector('[data-shortcut-text]').click();assert.equal(f.input.readOnly,false);f.input.value='echap ; ctrl+r';f.key('keydown','Enter');assert.deepEqual(f.saved,['ESC ; CTRL + R']);
 const other=f.dom.window.document.querySelector('#other'),event=new f.dom.window.KeyboardEvent('keydown',{key:'1',code:'Digit1',bubbles:true,cancelable:true});other.dispatchEvent(event);assert.equal(event.defaultPrevented,false);
});
test('tab remains available for navigation until recording is deliberately armed; abandoning capture does not save',t=>{
 const f=fixture(t);f.input.focus();assert.equal(f.key('keydown','Tab').defaultPrevented,false);f.input.click();assert.equal(f.key('keydown','Tab').defaultPrevented,true);f.key('keyup','Tab');assert.deepEqual(f.saved,['TAB']);
 f.input.click();f.key('keydown','Control',{ctrlKey:true});f.dom.window.document.querySelector('#other').focus();assert.deepEqual(f.saved,['TAB']);assert.equal(f.input.value,'TAB');
});
