"use strict";

/** Chromium isolé : aucun compte, flux LIVE ni son, uniquement le vrai rendu Media.
 * Vérifie les images panoramiques/verticales et les redimensionnements d'une source.
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { app, BrowserWindow } = require("electron");
const os = require("node:os");
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "shenpulse-media-fit-"));
app.setPath("userData", path.join(temporary, "chromium"));
app.commandLine.appendSwitch("disable-background-networking");
app.commandLine.appendSwitch("host-resolver-rules", "MAP * ~NOTFOUND, EXCLUDE 127.0.0.1");
const outputArgument = process.argv.find(argument => argument.startsWith("--output="));
const output = outputArgument ? path.resolve(outputArgument.slice(9)) : temporary;
const captionsOnly = process.argv.includes("--captions-only");
fs.mkdirSync(output, { recursive: true });
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const dependencies = read("resources/overlays/runtime/dependencies.js");
const viewport = dependencies.slice(dependencies.indexOf("function configureNativeOverlayCanvas("), dependencies.indexOf("(function loadOverlayDependencies"));
const alerts = read("resources/overlays/runtime/alerts-feed.js");
const render = alerts.slice(alerts.indexOf("async function drainAlerts("), alerts.indexOf("const liveAudioQueue"));
const markup = alerts.slice(alerts.indexOf("function actionMediaMarkup("), alerts.indexOf("function renderGoals("));
let window;
const deadline = setTimeout(() => app.exit(2), 60000);

app.whenReady().then(async () => {
  window = new BrowserWindow({ show: false, width: 529, height: 398, useContentSize: true,
    webPreferences: { offscreen: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
  const css = read("resources/overlays/styles/core.css") + read("resources/overlays/styles/configuration.css");
  await window.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(`<html><head><style>${css}</style></head><body><main id="overlay-root"><section id="alerts-view" class="view active"><div id="alert-stage" class="alert-stage"></div></section></main></body></html>`));
  await window.webContents.executeJavaScript(`
    const parameters=new URLSearchParams(), overlayAnimation="none", overlaySoundEnabled=false, overlayPauseTime=0;
    const overlayDisplayTime=60, alertQueue=[], escapeHtml=value=>String(value).replaceAll('"','&quot;');
    let alertRunning=false;
    const timers=[], mediaTestTimer=resolve=>timers.push(resolve);
    ${viewport}\n${markup}\n${render.replaceAll("setTimeout(", "mediaTestTimer(")}
    configureNativeOverlayCanvas("alerts",document.getElementById("alerts-view"),{});
    globalThis.finishFixture=async()=>{
      timers.shift()?.();await Promise.resolve();timers.shift()?.();await Promise.resolve();
    };
    globalThis.showFixture=async(width,height)=>{
      const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'"><rect width="100%" height="100%" fill="#17436d"/><rect x="10" y="10" width="'+(width-20)+'" height="'+(height-20)+'" fill="none" stroke="#25ff89" stroke-width="20"/><text x="50%" y="50%" fill="white" text-anchor="middle" dominant-baseline="middle" font-size="'+Math.min(width,height)/14+'">MEDIA ENTIER</text></svg>';
      const src='data:image/svg+xml,'+encodeURIComponent(svg);
      if(!alertRunning){alertQueue.push({displayMode:'media-only',mediaUrl:src,durationMs:60000});void drainAlerts();}
      else document.querySelector('.alert-media-only img').src=src;
      const image=document.querySelector('.alert-media-only img');await image.decode();
    };
    globalThis.mediaBounds=()=>{
      const image=document.querySelector('.alert-media-only').firstElementChild,rect=image.getBoundingClientRect();
      const view=document.querySelector('#alerts-view').getBoundingClientRect();
      return {viewport:[innerWidth,innerHeight],view:{left:view.left,top:view.top,width:view.width,height:view.height},
        media:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,width:rect.width,height:rect.height},
        fit:getComputedStyle(image).objectFit,intrinsic:[image.naturalWidth||image.videoWidth,image.naturalHeight||image.videoHeight]};
    };
    void 0;
  `);
  const results = [];
  for (const size of [[529,398],[1080,1920],[1920,1080],[320,180],[640,640]]) {
    window.setContentSize(...size);
    // Le même document reste ouvert, comme une source redimensionnée dans Studio.
    for (const intrinsic of [[4800,3200],[3200,4800],[1000,1000],[8000,500]]) {
      await window.webContents.executeJavaScript(`showFixture(${intrinsic.join(",")})`);
      await new Promise(resolve => setTimeout(resolve, 70));
      const bounds = await window.webContents.executeJavaScript("mediaBounds()");
      results.push(bounds);
      if (size[0] === 529 && intrinsic[0] === 3200) {
        fs.writeFileSync(path.join(output, "portrait-529x398.png"), (await window.webContents.capturePage()).toPNG());
      }
    }
  }
  // Même source avec d'anciens réglages de zoom/décalage : aucun recadrage.
  await window.webContents.executeJavaScript(`
    document.documentElement.style.setProperty('--overlay-scale','2.5');
    document.documentElement.style.setProperty('--overlay-x','300px');
    document.documentElement.style.setProperty('--overlay-y','200px');
    showFixture(3200,4800);
    void 0;
  `);
  results.push(await window.webContents.executeJavaScript("mediaBounds()"));
  if (!captionsOnly) {
  // Une vraie vidéo WebM produite localement, sans réseau ni audio.
  await window.webContents.executeJavaScript(`
    globalThis.videoFixture=async()=>{
      const canvas=document.createElement('canvas');canvas.width=600;canvas.height=1000;
      const ctx=canvas.getContext('2d');ctx.fillStyle='#17436d';ctx.fillRect(0,0,600,1000);
      ctx.strokeStyle='#25ff89';ctx.lineWidth=10;ctx.strokeRect(5,5,590,990);
      const stream=canvas.captureStream(10),recorder=new MediaRecorder(stream,{mimeType:'video/webm'}),chunks=[];
      recorder.ondataavailable=event=>chunks.push(event.data);
      const stopped=new Promise(resolve=>{recorder.onstop=resolve;});recorder.start();
      for(let frame=0;frame<6;frame++){
        ctx.fillStyle='white';ctx.fillRect(100+frame*10,100,10,10);stream.getVideoTracks()[0].requestFrame?.();
        await new Promise(resolve=>setTimeout(resolve,100));
      }
      recorder.stop();await stopped;
      stream.getTracks().forEach(track=>track.stop());
      const url=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
      document.querySelector('.alert-media-only').innerHTML=actionMediaMarkup(url+'#fixture.webm');
      const video=document.querySelector('video');
      await new Promise((resolve,reject)=>{video.onloadeddata=resolve;video.onerror=()=>reject(new Error('Vidéo de test : '+video.error?.message));});
    };void 0;
  `);
  await window.webContents.executeJavaScript("videoFixture()");
  for (const size of [[529,398],[1080,1920],[1920,1080],[320,180],[640,640]]) {
    window.setContentSize(...size);
    await new Promise(resolve => setTimeout(resolve, 70));
    results.push(await window.webContents.executeJavaScript("mediaBounds()"));
  }
  await window.webContents.executeJavaScript(read("resources/overlays/vendor/lottie-player.js") + "\nvoid 0;");
  await window.webContents.executeJavaScript(`
    const animation={v:'5.7.4',fr:30,ip:0,op:60,w:600,h:1000,ddd:0,assets:[],layers:[
      {ddd:0,ind:1,ty:1,nm:'Cadre',sr:1,ks:{o:{a:0,k:100},r:{a:0,k:0},p:{a:0,k:[0,0,0]},a:{a:0,k:[0,0,0]},s:{a:0,k:[100,100,100]}},ao:0,sw:600,sh:1000,sc:'#17436d',ip:0,op:60,st:0,bm:0}
    ]};
    document.querySelector('.alert-media-only').innerHTML=actionMediaMarkup(URL.createObjectURL(new Blob([JSON.stringify(animation)],{type:'application/json'}))+'#fixture.json');
    const player=document.querySelector('lottie-player');
    new Promise((resolve,reject)=>{player.addEventListener('ready',()=>resolve(true),{once:true});player.addEventListener('error',()=>reject(new Error('Animation de test non chargée')),{once:true});});
  `);
  for (const size of [[529,398],[1080,1920],[1920,1080],[320,180],[640,640]]) {
    window.setContentSize(...size);
    await new Promise(resolve => setTimeout(resolve, 70));
    results.push(await window.webContents.executeJavaScript("mediaBounds()"));
  }
  }
  fs.writeFileSync(path.join(output,"bounds.json"),JSON.stringify(results,null,2));
  for (const {viewport:[width,height],media,view,fit,intrinsic} of results) {
    const detail=JSON.stringify({viewport:[width,height],intrinsic,media,view});
    assert.equal(fit,"contain");
    assert.ok(media.left>=-.5 && media.top>=-.5 && media.right<=width+.5 && media.bottom<=height+.5,detail);
    assert.ok(Math.abs(media.width-width)<1 && Math.abs(media.height-height)<1,"Le média doit utiliser tout le rectangle disponible : "+detail);
  }
  // Les alertes avec texte reprennent bien leur canevas natif après le média.
  await window.webContents.executeJavaScript("finishFixture()");
  const cleaned = await window.webContents.executeJavaScript(`({
    mediaView:document.getElementById('alerts-view').classList.contains('media-only-view'),
    mediaStage:document.getElementById('alert-stage').classList.contains('media-only-stage'),
    remaining:document.getElementById('alert-stage').childElementCount
  })`);
  assert.deepEqual(cleaned,{mediaView:false,mediaStage:false,remaining:0});
  const captions = [];
  for (const position of ["top", "bottom"]) for (const media of [true, false]) {
    await window.webContents.executeJavaScript(`
      globalThis.captionSrc='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="1600"><rect x="4" y="4" width="992" height="1592" fill="#17436d" stroke="#25ff89" stroke-width="8"/></svg>');
      alertQueue.push({displayMode:'media-only',mediaUrl:${media ? "captionSrc" : "''"},alert:{username:'Alice ♥',message:'Merci pour les roses !',color:'#22d3ee',font:'Georgia',strokeColor:'#112233',position:'${position}'}});
      void drainAlerts();void 0;
    `);
    if (media) await window.webContents.executeJavaScript("document.querySelector('.alert-media-only img').decode()");
    for (const size of [[529,398],[1080,1920],[320,180],[640,640]]) {
      window.setContentSize(...size);
      await new Promise(resolve => setTimeout(resolve, 100));
      const value = await window.webContents.executeJavaScript(`(()=>{
        const caption=document.querySelector('.action-alert-caption'),rect=caption.getBoundingClientRect();
        const image=document.querySelector('.alert-media-only img'),media=image?.getBoundingClientRect();
        return {viewport:[innerWidth,innerHeight],caption:{left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom},
          overflow:caption.scrollHeight>caption.clientHeight+1 || caption.scrollWidth>caption.clientWidth+1,
          media:media?{left:media.left,top:media.top,right:media.right,bottom:media.bottom}:null,
          color:getComputedStyle(caption.querySelector('span')).color,font:getComputedStyle(caption).fontFamily,
          stroke:getComputedStyle(caption.querySelector('span')).webkitTextStrokeColor};
      })()`);
      captions.push(value);
      assert.equal(value.overflow, false, JSON.stringify(value));
      assert.equal(value.color, "rgb(34, 211, 238)");
      assert.match(value.font, /Georgia/);
      assert.equal(value.stroke, "rgb(17, 34, 51)");
      const [width,height]=value.viewport;
      for (const rect of [value.caption,value.media].filter(Boolean)) {
        assert.ok(rect.left>=0 && rect.top>=0 && rect.right<=width+1 && rect.bottom<=height+1,JSON.stringify(value));
      }
      if (value.media) assert.ok(position === "top" ? value.caption.bottom<=value.media.top+1 : value.media.bottom<=value.caption.top+1, "Le texte ne doit pas recouvrir le média.");
      if (size[0]===529) fs.writeFileSync(path.join(output,`${media ? "media-caption" : "text-only"}-${position}.png`),(await window.webContents.capturePage()).toPNG());
    }
    await window.webContents.executeJavaScript("finishFixture()");
  }
  fs.writeFileSync(path.join(output,"captions.json"),JSON.stringify(captions,null,2));
  fs.writeFileSync(path.join(output,"result.json"),JSON.stringify({ok:true,cases:results.length,captionCases:captions.length}));
  clearTimeout(deadline);window.destroy();app.exit(0);
}).catch(error=>{
  fs.writeFileSync(path.join(output,"result.json"),JSON.stringify({ok:false,error:error.stack || String(error)},null,2));
  clearTimeout(deadline);window?.destroy();app.exit(1);
});
