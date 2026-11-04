"use strict";
/** Chromium isolé, aucune session utilisateur ni jeu lancé. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),os=require('node:os'),assert=require('node:assert/strict');
const {app,BrowserWindow}=require('electron'),{JSDOM}=require('jsdom');
const {readRendererStyles}=require('../tests/helpers/source-bundles');
const root=path.resolve(__dirname,'..'),out=path.join(root,'.artifacts/viewer-box-visual');fs.mkdirSync(out,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-viewer-box-')));app.commandLine.appendSwitch('disable-background-networking');
let win,server;const deadline=setTimeout(()=>app.exit(2),240000);
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
app.whenReady().then(async()=>{
 server=http.createServer((req,res)=>{let name=decodeURIComponent(new URL(req.url,'http://local').pathname),base=name.startsWith('/renderer/')?'src'+name:'resources/overlays'+name;if(name==='/fixture.html'){res.setHeader('Content-Type','text/html');res.end(fixture);return;}if(name.endsWith('/'))base+='index.html';const target=path.resolve(root,base);if(!target.startsWith(root+path.sep)){res.writeHead(403).end();return;}try{const ext=path.extname(target);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'})[ext]||'application/octet-stream');res.end(fs.readFileSync(target));}catch{res.writeHead(404).end();}});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base='http://127.0.0.1:'+server.address().port;
 win=new BrowserWindow({show:false,width:560,height:900,useContentSize:true,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 const report={screens:[],layouts:[]},errors=[];win.webContents.on('console-message',(_e,level,message)=>{if(level===3&&!/404|font|firebase|ERR_/i.test(message))errors.push(message)});
 for(let screen=1;screen<=8;screen++){
  await win.loadURL(base+'/index.html?view=alerts&screen='+screen+'&preview=animated');
  for(let i=0;i<120;i++){if(await win.webContents.executeJavaScript('typeof showAlert === "function" && typeof overlayChannels !== "undefined" && !document.documentElement.classList.contains("overlay-booting")'))break;await new Promise(r=>setTimeout(r,50));}
  assert.equal(await win.webContents.executeJavaScript('document.documentElement.classList.contains("overlay-booting")'),false,'source prête même hors premier plan');
  await win.webContents.insertCSS('#overlay-root,.view,.alert{transition:none!important}.alert{animation:none!important;opacity:1!important}');
  const result=await win.webContents.executeJavaScript(`(async()=>{
    alertRunning=false;alertQueue.length=0;document.getElementById('alert-stage').replaceChildren();
    const target=${screen};for(let n=1;n<=8;n++){const payload={screen:n,displayMode:'media-only',alert:{username:'',message:'Viewer écran '+n,parts:[{type:'avatar',url:'',label:'Alice'},{type:'text',text:' Merci viewer-'+n+' !'}],position:'top'},durationMs:5000};if(currentViewAcceptsChannel('alert',payload))showAlert(payload);}
    await new Promise(r=>setTimeout(r,80));
    const message=document.querySelector('.action-alert-message')?.textContent;let played=0;
    HTMLMediaElement.prototype.play=function(){played++;queueMicrotask(()=>this.dispatchEvent(new Event('ended')));return Promise.resolve()};
    for(const channel of ['audio','tts'])for(let n=1;n<=8;n++){const payload={screen:n,url:location.origin+'/example.wav',audioUrl:location.origin+'/example.wav',playbackId:channel+n};if(currentViewAcceptsChannel(channel,payload))overlayChannels[channel](payload);}
    await new Promise(r=>setTimeout(r,80));return {screen:target,message,played,avatars:document.querySelectorAll('.action-alert-avatar').length,visibility:Array.from(document.querySelectorAll('#overlay-root,#alerts-view,#alert-stage,.alert,.action-alert-caption')).map(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect();return {id:n.id||n.className,display:s.display,visibility:s.visibility,opacity:s.opacity,width:r.width,height:r.height,x:r.x,y:r.y,hidden:n.hidden}})};
  })()`);
  assert.match(result.message,new RegExp('viewer-'+screen));assert.equal(result.played,2);assert.equal(result.avatars,1);assert.equal(result.visibility[0].opacity,'1');report.screens.push(result);
  if(screen===2){await new Promise(r=>setTimeout(r,200));fs.writeFileSync(path.join(out,'screen-2.png'),(await win.webContents.capturePage()).toPNG());}
 }
 if(process.argv.includes('--screens-only')){console.log(JSON.stringify(report));clearTimeout(deadline);win.destroy();server.close();app.quit();return;}
 const dom=new JSDOM('<main/>',{runScripts:'outside-only'});const w=dom.window;w.ShenPulseGamePackLayout=require('../resources/overlays/game-pack-layout');w.ShenPulseGameWorkspacePolicy=require('../src/shared/game-workspace-policy');
 for(const name of ['core','preview'])w.eval(read('src/renderer/app/features/games/workspace/'+name+'.js'));
 const C=w.ShenPulseGameWorkspace,packId='minecraft-box-cyber';
 const gift=base+'/media/game-wins/reset.svg';
 const state={enabled:true,packId,profileId:'p',cards:Array.from({length:12},(_,i)=>({id:'card'+i,title:(i<6?'Aide ':'Piège ')+(i%6+1),column:i<6?'help':'trap',triggerType:'gift',giftImageUrl:gift,giftName:'Rose',giftCost:1})),wins:{showCounter:true,showMultiplier:true,current:5,target:20,positive:[1,3,20,45].map((amount,i)=>({id:'p'+i,giftName:'Rose',giftImageUrl:gift,amount})),negative:[1,3,20,45].map((amount,i)=>({id:'n'+i,giftName:'Rose',giftImageUrl:gift,amount:-amount})),reset:{id:'reset',giftImageUrl:gift},presentation:{counterModel:1,multiplierModel:1}}};
 for(const cardPlacement of ['bottom','sides'])for(const cameraPlacement of ['top','bottom'])for(const rowOrder of ['help-first','trap-first'])for(const cardSize of Array.from({length:17},(_,i)=>80+i*5))for(const motion of ['animated','fixed']){
  const presentation={model:1,configured:true,cardPlacement,cameraPlacement,rowOrder,cardSize,motion};state.presentation=presentation;
  const ctx={pack:{id:packId,name:'Minecraft Box Cyber'},preview:{presentation,models:[{id:1,supportsMotion:true}],camera:{src:base+'/renderer/assets/games/market-webcam-preview.jpg'},game:{src:base+'/renderer/assets/games/covers/minecraft-box-cyber.png'},sourceUrl:base+'/game-pack.html?jeu='+packId+'&profile=p&layout=compact',winsSourceUrl:base+'/game-wins.html?jeu='+packId+'&profile=p&preview=1'}};
  fixture='<html><head><base href="'+base+'/renderer/"><style>'+readRendererStyles()+' body{margin:0;padding:16px;background:#151022}.game-pack-phone{--game-pack-phone-width:460px;margin:auto}</style></head><body>'+C.renderPhoneScreen(ctx)+'</body></html>';
  await win.loadURL(base+'/fixture.html');
  for(let i=0;i<80;i++){if(await win.webContents.executeJavaScript('Array.from(document.querySelectorAll("iframe")).every(f=>f.contentWindow.ShenPulseGamePack||f.contentWindow.ShenPulseGameWins)'))break;await new Promise(r=>setTimeout(r,30));}
  const result=await win.webContents.executeJavaScript(`(()=>{
    const state=${JSON.stringify(state)};for(const frame of document.querySelectorAll('iframe')){const api=frame.contentWindow.ShenPulseGamePack||frame.contentWindow.ShenPulseGameWins;api.render(state);}
    const f=document.querySelector('.game-pack-phone-source iframe'),d=f.contentDocument,screen=document.querySelector('.game-pack-phone-screen').getBoundingClientRect(),camera=document.querySelector('.game-pack-camera-preview').getBoundingClientRect(),game=document.querySelector('.game-pack-phone-game').getBoundingClientRect();
    const bounds=Array.from(d.querySelectorAll('.pack-page.is-current .gift-card')).map(card=>{const r=card.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}});
    return {camera:[camera.top-screen.top,camera.height],game:[game.top-screen.top,game.height],screen:[screen.width,screen.height],cards:bounds,viewport:[f.clientWidth,f.clientHeight],pages:d.getElementById('cards').dataset.pages};
  })()`);
  assert.ok(result.cards.length>0);for(const b of result.cards){assert.ok(b.x>=-1&&b.y>=-1,JSON.stringify({presentation,b,result}));assert.ok(b.x+b.w<=result.viewport[0]+2&&b.y+b.h<=result.viewport[1]+2,JSON.stringify({presentation,b,result}));}
  const key=[cardPlacement,cameraPlacement,rowOrder,cardSize,motion].join('-');report.layouts.push({key,...result});
  if(cardSize===100&&motion==='fixed'){await new Promise(r=>setTimeout(r,200));fs.writeFileSync(path.join(out,key+'.png'),(await win.webContents.capturePage()).toPNG());}
 }
 dom.window.close();report.errors=errors;assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({screens:report.screens.length,layouts:report.layouts.length,output:out}));clearTimeout(deadline);win.destroy();server.close();app.quit();
}).catch(error=>{console.error(error.stack);clearTimeout(deadline);server?.close();app.exit(1)});
let fixture='';
