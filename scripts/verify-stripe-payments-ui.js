"use strict";
/** Qualification du renderer réel, avec IPC fictif et réseau externe bloqué. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {app,BrowserWindow,ipcMain}=require('electron');
const root=path.resolve(process.argv.find(v=>v.startsWith('--app-root='))?.slice(11)||path.join(__dirname,'..'));
const output=path.resolve(process.argv.find(v=>v.startsWith('--output='))?.slice(9)||path.join(os.tmpdir(),'shenpulse-stripe-ui'));
fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-stripe-chromium-')));
app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-background-networking');
const {createDefaultState}=require(path.join(root,'src/main/defaults'));
const state=createDefaultState(),calls=[],errors=[],pendingCheckouts=[],observations=[];
function recordCheckout(kind,payload){calls.push({kind,...payload});return new Promise((resolve,reject)=>pendingCheckouts.push({resolve:()=>resolve({result:{cancelled:true},snapshot:snapshot()}),reject}));}
const account={uid:'stripe-visual-fixture',email:'stripe-visual@example.invalid',authenticated:true,emailVerified:true,displayName:'Vérification paiements'};
state.settings.account=account;state.settings.publicOverlayRelay.enabled=false;
state.commerce.subscription={tier:'free',source:'free',status:'free'};
const pack={id:'coin-pusher',name:'Coin Pusher Live',description:'Un jeu interactif pour vos LIVE.',accessMode:'purchase',price:4.99,category:'liveinteractive',installed:true};
const snapshot=()=>({state,packs:[pack],appVersion:require('../package.json').version,soundCatalog:[],mediaCatalog:[],overlayUrls:{},localOverlayUrls:{},publicOverlayRelay:{},services:{},liveDirectory:{available:false,rows:[]}});
const handlers={
 'snapshot:get':snapshot,'account:status':()=>account,'account:sync-entitlements':()=>({snapshot:snapshot()}),
 'admin:status':()=>({...account,authorized:false}),'admin:visibility-public':()=>({schemaVersion:7,navigation:{},features:{},games:{},overlays:{}}),
 'account:game-cheat-access':()=>({allowed:false}),'catalog:gifts':()=>({gifts:[],total:0}),
 'startup:ready':()=>({ready:true}),'game:install-status':()=>null,'updates:check':()=>({available:false}),
 'agencies:list':()=>({agencies:[],prices:{public:{pro:14.99,premium:20.99},agency:{pro:9.99,premium:13.99}}}),
 'agencies:dashboard':()=>({pricing:{quoted:{pro:14.99,premium:20.99},group:'public'}}),
 'account:subscription-checkout':(_event,payload)=>recordCheckout('subscription',payload),
 'account:game-checkout':(_event,payload)=>recordCheckout('game',payload),
 'account:checkout-cancel':()=>({cancelled:true})
};
for(const[channel,handler]of Object.entries(handlers))ipcMain.handle(channel,handler);
let win;const deadline=setTimeout(()=>{console.error('Qualification Stripe UI expirée.');app.exit(1);},60000);
const js=source=>win.webContents.executeJavaScript(source,true);
async function until(source){for(let i=0;i<100;i++){if(await js(`Boolean(${source})`).catch(()=>false))return;await new Promise(r=>setTimeout(r,50));}throw Error('Condition absente : '+source);}
async function capture(name){await js("document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.join(output,name),(await win.webContents.capturePage()).toPNG());}
async function run(){
 win=new BrowserWindow({show:false,width:1440,height:1050,webPreferences:{preload:path.join(root,'src/main/preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^(https?|wss?):/.test(details.url)}));
 win.webContents.on('console-message',event=>{if(/ReferenceError|SyntaxError|TypeError/.test(event.message||''))errors.push(event.message);});
 await win.loadFile(path.join(root,'src/renderer/index.html'));
 await until("typeof accountSession !== 'undefined' && accountSession.authenticated");
 await js("currentPage='membership';render()");await until("document.querySelector('[name=subscriptionPaymentProvider]') && agencyState().dashboard?.pricing");
 assert.equal(await js("CSS.supports('appearance','base-select')"),true);
 const selectQuery="document.querySelector('[name=subscriptionPaymentProvider]')";
 assert.equal(await js(selectQuery+".options.length"),5);
 assert.equal(await js(selectQuery+".value"),'paypal');
 await until("Array.from(document.querySelectorAll('.checkout-payment-method option img')).every(img=>img.complete && img.naturalWidth>0)");
 assert.deepEqual(await js(selectQuery+".options && Array.from("+selectQuery+".options,o=>o.textContent.trim())"),['PayPal','Carte bancaire','Google Pay','Apple Pay','Link']);
 await capture('stripe-membership.png');
 await js(selectQuery+".showPicker()");await until(selectQuery+".matches(':open')");
 await capture('payment-methods-expanded.png');
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Escape'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Escape'});
 await until("!"+selectQuery+".matches(':open')");
 // Native keyboard selection remains usable with the branded picker.
 win.show();win.focus();win.webContents.focus();
 await js(selectQuery+".focus()");
 win.webContents.sendInputEvent({type:'keyDown',keyCode:'Down'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Down'});
 await until(selectQuery+".matches(':open') || "+selectQuery+".value === 'card'");
 if(await js(selectQuery+".matches(':open')")) {
   win.webContents.sendInputEvent({type:'keyDown',keyCode:'Down'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Down'});
   win.webContents.sendInputEvent({type:'keyDown',keyCode:'Enter'});win.webContents.sendInputEvent({type:'keyUp',keyCode:'Enter'});
 }
 await until(selectQuery+".value === 'card'");
 const methods=['paypal','card','google_pay','apple_pay','link'];
 const readField=query=>js("({value:"+query+".value,disabled:"+query+".disabled})");
 async function pending(){for(let n=0;n<100;n++){if(pendingCheckouts.length)return pendingCheckouts[0];await new Promise(r=>setTimeout(r,25));}throw Error('Checkout IPC absent');}
 function assertRoute(kind,paymentMethod){const call=calls.at(-1);assert.equal(call.kind,kind);assert.equal(call.paymentProvider||'paypal',paymentMethod==='paypal'?'paypal':'stripe');if(paymentMethod!=='paypal')assert.equal(call.paymentMethod,paymentMethod);}
 for(const surface of ['page','popup']){
   if(surface==='popup')await js('openMembershipPopup()');
   const scope=surface==='popup'?"document.getElementById('membership-popup-dialog')":"document.querySelector('.membership-workspace')";
   const field=scope+".querySelector('[name=subscriptionPaymentProvider]')";
   if(surface==='popup')assert.equal((await readField(field)).value,'paypal');
   for(const paymentMethod of methods){
     await js(field+".value="+JSON.stringify(paymentMethod));
     const count=calls.length;
     await js(scope+".querySelector('.tier-pro [data-action=subscription-checkout]').click()");
     assert.deepEqual(await readField(field),{value:paymentMethod,disabled:true});
     await pending();assert.equal(calls.length,count+1);assertRoute('subscription',paymentMethod);assert.equal(calls.at(-1).expectedPrice,14.99);
     await js('render();syncMembershipPopup()');
     assert.deepEqual(await readField(field),{value:paymentMethod,disabled:true});
     if(paymentMethod==='google_pay')await capture('subscription-'+surface+'-google-pay-pending.png');
     pendingCheckouts.shift().resolve();await until('!subscriptionCheckoutBusyTier');
     assert.deepEqual(await readField(field),{value:paymentMethod,disabled:false});
     observations.push({surface,paymentMethod,preservedDuringAndAfterCheckout:true});
   }
   if(surface==='popup')await js('closeMembershipPopup()');
 }
 const gameField="document.querySelector('#editor-form [name=paymentProvider]')";
 for(const surface of ['game','extension']){
   for(const paymentMethod of methods){
     const open=surface==='game'?"openGamePurchaseDialog(snapshot.packs[0])":"openThiercelieuxExtensionPurchaseDialog(snapshot.packs[0],{id:'thiercelieux-test-extension',packId:'nouvelle-lune',name:'Nouvelle Lune',price:4.99,includes:[]})";
     await js(open+";"+gameField+".value="+JSON.stringify(paymentMethod));
     assert.equal((await readField(gameField)).value,paymentMethod);
     const count=calls.length;
     await js("document.getElementById('editor-form').requestSubmit();document.getElementById('editor-form').requestSubmit()");
     await pending();assert.equal(calls.length,count+1);assertRoute('game',paymentMethod);
     assert.equal(calls.at(-1).productId,surface==='game'?'coin-pusher':'thiercelieux-test-extension');
     await js('render()');
     assert.deepEqual(await readField(gameField),{value:paymentMethod,disabled:true});
     if(paymentMethod==='google_pay')await capture(surface+'-google-pay-pending.png');
     pendingCheckouts.shift().resolve();await until("!document.getElementById('editor-dialog').open && dialogSubmitHandler === null");
     observations.push({surface,paymentMethod,preservedDuringCheckout:true,noDuplicatePayment:true});
   }
 }
 // A rejected checkout leaves the chosen method intact and allows a retry.
 await js("openGamePurchaseDialog(snapshot.packs[0]);"+gameField+".value='link';document.getElementById('editor-form').requestSubmit()");
 await pending();pendingCheckouts.shift().reject(new Error('Erreur réseau simulée'));
 await until("document.getElementById('editor-form').getAttribute('aria-busy') === 'false'");
 assert.equal(await js("document.getElementById('editor-dialog').open"),true);
 assert.deepEqual(await readField(gameField),{value:'link',disabled:false});
 await js("document.getElementById('editor-form').requestSubmit()");await pending();assertRoute('game','link');
 pendingCheckouts.shift().resolve();await until("!document.getElementById('editor-dialog').open && dialogSubmitHandler === null");
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,appRoot:root,calls,observations,errors},null,2));
 console.log('Stripe renderer et IPC vérifiés : '+output);
}
app.whenReady().then(run).then(()=>{clearTimeout(deadline);win.destroy();app.exit(0);}).catch(error=>{clearTimeout(deadline);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,errors,calls},null,2));console.error(error.stack);win?.destroy();app.exit(1);});
