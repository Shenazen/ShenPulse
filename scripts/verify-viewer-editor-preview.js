"use strict";
/** Essai Chromium isolé du bouton Tester et du vrai rendu d’alerte. */
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),os=require("node:os"),assert=require("node:assert/strict");
const {app,BrowserWindow}=require("electron");
const {actionEditorFixture}=require("../tests/helpers/action-editor-fixture");
const {readRendererStyles}=require("../tests/helpers/source-bundles");
const {ActionRunner}=require("../src/main/action-runner");
const {normalizeEvent}=require("../src/main/event-normalizer");
const root=path.resolve(__dirname,".."),out=path.join(root,".artifacts/viewer-size-visual");fs.mkdirSync(out,{recursive:true});
app.setPath("userData",fs.mkdtempSync(path.join(os.tmpdir(),"shenpulse-viewer-size-")));
app.commandLine.appendSwitch("disable-background-networking");
let server,win,source;const clients=new Set();const deadline=setTimeout(()=>app.exit(2),45000);
const published=[],notified=[],requests=[];
const runner=new ActionRunner({store:{getState:()=>({statistics:{likes:42}})},overlayServer:{publish:(channel,payload)=>{published.push([channel,payload]);for(const client of clients)client.write('event: '+channel+'\ndata: '+JSON.stringify({channel,payload})+'\n\n');}},notifyRenderer:(...args)=>notified.push(args)});
const event=normalizeEvent({type:"gift",data:{uniqueId:"TestViewer",nickname:"Viewer test",giftName:"Rose",repeatCount:1,diamondCount:1}});
app.whenReady().then(async()=>{
 const h=actionEditorFixture(null,{actions:[{id:"text",type:"overlay.text",config:{alert:{enabled:true,message:"{avatar} Merci {username} !",fontSize:96,strokeWidth:6,strokeColor:"#000000",screen:2}}}]});
 const body=h.form.innerHTML;h.dom.window.close();let html="";
 server=http.createServer(async(req,res)=>{
  const url=new URL(req.url,"http://local");
  if(url.pathname==="/events"){res.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache"});res.write(": ready\n\n");clients.add(res);req.on("close",()=>clients.delete(res));return;}
  if(url.pathname==="/api/state"){res.setHeader("Content-Type","application/json");return res.end(JSON.stringify({goals:[],timers:[],session:{},settings:{overlayConfigs:{}},overlaySession:{}}));}
  if(url.pathname==="/fixture.html"){res.setHeader("Content-Type","text/html");return res.end(html);}
  if(url.pathname==="/preview"){let raw="";for await(const chunk of req)raw+=chunk;const action=JSON.parse(raw);requests.push(action);res.setHeader("Content-Type","application/json");return res.end(JSON.stringify(await runner.run(action,{event})));}
  const base=url.pathname.startsWith("/app/")?path.join(root,"src/renderer",url.pathname.slice(5)):path.join(root,"resources/overlays",url.pathname==="/overlay/"?"index.html":url.pathname.replace(/^\/overlay\//,""));
  if(!path.resolve(base).startsWith(root+path.sep))return res.writeHead(403).end();
  try{res.setHeader("Content-Type",({".js":"text/javascript",".css":"text/css",".html":"text/html",".woff2":"font/woff2"})[path.extname(base)]||"application/octet-stream");res.end(fs.readFileSync(base));}catch{res.writeHead(404).end();}
 });await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const base="http://127.0.0.1:"+server.address().port;
 html=`<html><head><meta charset="utf-8"><style>${readRendererStyles()}body{margin:0;background:#080a14}</style></head><body><dialog id="editor-dialog"><form id="editor-form"><header><div><p id="kicker"></p><h2 id="title"></h2></div></header><div id="dialog-body" class="dialog-body"></div><footer><div id="error" hidden></div><div class="dialog-actions"><button type="button">Annuler</button><button id="submit" type="submit">Enregistrer</button></div></footer></form></dialog><script>
 Object.assign(window,{dialog:document.querySelector('dialog'),dialogForm:document.querySelector('form'),dialogBody:document.querySelector('#dialog-body'),dialogTitle:document.querySelector('#title'),dialogKicker:document.querySelector('#kicker'),dialogError:document.querySelector('#error'),dialogSubmitButton:document.querySelector('#submit'),dialogSessionId:0,dialogSubmitHandler:null,toast:()=>{},snapshot:{localOverlayUrls:{base:${JSON.stringify(base)}}},syncActionEditorVisibility:()=>{},escapeHtml:value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),bindOverlayRuntimeFrames:host=>host.querySelectorAll('[data-overlay-native-frame]').forEach(f=>f.style.setProperty('--overlay-render-scale',f.clientWidth/1920)),sendOverlayPreviewFrameEvent:(f,channel,payload)=>f.contentWindow.postMessage({source:'shenpulse-overlay-card',channel,payload},new URL(f.src).origin),api:{testAction:action=>fetch('/preview',{method:'POST',body:JSON.stringify(action)}).then(r=>r.json())}});
 </script><script src="/app/app/editors/core.js"></script><script src="/app/app/editors/alert-display.js"></script><script src="/app/app/editors/action-components.js"></script><script>
 const context={parts:[]};openEditor({title:'Viewer et/ou texte',body:${JSON.stringify(body)},variant:'wide',onSubmit:()=>{throw Error('Le test ne doit pas enregistrer')},onTest:()=>previewActionEditorViewer(context)});context.parts=[...document.querySelectorAll('[data-action-component]')].map(panel=>({type:'overlay.text',panels:new Map([['overlay.text',panel]])}));document.querySelector('[data-action-type-group]').open=true;
 </script></body></html>`;
 win=new BrowserWindow({show:false,width:1100,height:1000,useContentSize:true,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 source=new BrowserWindow({show:false,width:960,height:540,useContentSize:true,webPreferences:{offscreen:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 await source.loadURL(base+"/overlay/?view=alerts&screen=2");
 for(let i=0;i<100;i++){if(clients.size&&await source.webContents.executeJavaScript('typeof showAlert === "function" && !document.documentElement.classList.contains("overlay-booting")'))break;await new Promise(resolve=>setTimeout(resolve,50));}
 assert.equal(clients.size,1,"La source externe doit être connectée en SSE.");
 await win.loadURL(base+"/fixture.html");const results=[];
 for(const [fontSize,strokeWidth] of [[96,6],[32,0]]){
  await win.webContents.executeJavaScript(`document.querySelector('[name="alertFontSize"]').value='${fontSize}';document.querySelector('[name="alertStrokeWidth"]').value='${strokeWidth}';document.querySelector('[data-dialog-test]').click();`);
  let measured;
  for(let i=0;i<100;i++){
   measured=await source.webContents.executeJavaScript(`(()=>{const node=document.querySelector('.action-alert-caption');if(!node)return null;const s=getComputedStyle(node);return {fontSize:s.fontSize,strokeWidth:s.webkitTextStrokeWidth,text:node.textContent};})()`);
   if(measured?.fontSize===fontSize+'px')break;await new Promise(resolve=>setTimeout(resolve,80));
  }
  assert.equal(measured?.fontSize,fontSize+'px',JSON.stringify(measured));assert.equal(measured.strokeWidth,strokeWidth+'px');assert.match(measured.text,/Merci TestViewer/);assert.equal(await win.webContents.executeJavaScript("document.querySelectorAll('[data-viewer-draft-preview],iframe').length"),0);
  await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.join(out,`viewer-${fontSize}-${strokeWidth}.png`),(await source.webContents.capturePage()).toPNG());results.push(measured);
 }
 assert.equal(published.length,2);assert.equal(notified.length,2);assert.equal(requests.length,2);assert.ok(requests.every(action=>action.type==='overlay.text'&&!action.config.previewScope&&action.config.alert.screen===2));
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify({ok:true,results},null,2));console.log(JSON.stringify({ok:true,results}));clearTimeout(deadline);win.destroy();source.destroy();for(const client of clients)client.end();server.close();app.quit();
}).catch(error=>{console.error(error.stack);clearTimeout(deadline);win?.destroy();source?.destroy();for(const client of clients)client.end();server?.close();app.exit(1)});
