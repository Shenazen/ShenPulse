"use strict";
/** Qualification du renderer réel, avec IPC fictif et réseau externe bloqué. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),assert=require('node:assert/strict');
const {app,BrowserWindow,ipcMain}=require('electron');
const {runSimulatedPurchase,evidence}=require('../tests/helpers/stripe-complete-client-simulation');
const root=path.resolve(process.argv.find(v=>v.startsWith('--app-root='))?.slice(11)||path.join(__dirname,'..'));
const output=path.resolve(process.argv.find(v=>v.startsWith('--output='))?.slice(9)||path.join(os.tmpdir(),'shenpulse-stripe-ui'));
fs.mkdirSync(output,{recursive:true});
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-stripe-chromium-')));
app.disableHardwareAcceleration();app.commandLine.appendSwitch('disable-background-networking');
const {createDefaultState}=require(path.join(root,'src/main/defaults'));
const state=createDefaultState(),calls=[],errors=[],pendingCheckouts=[],observations=[];
async function recordCheckout(kind,payload){calls.push({kind,...payload});const response=await runSimulatedPurchase(kind,payload,pending=>pendingCheckouts.push(pending),require(path.join(root,'src/main/account-service')).AccountService);Object.assign(state,response.state);return {result:response.result,snapshot:snapshot()};}
const account={uid:'user_test',email:'test@example.invalid',authenticated:true,emailVerified:true,displayName:'SIMULATION — aucun débit'};
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
let win;const deadline=setTimeout(()=>{console.error('Simulation complète expirée.');app.exit(1);},120000);
const js=source=>win.webContents.executeJavaScript(source,true);
async function until(source){for(let i=0;i<100;i++){if(await js(`Boolean(${source})`).catch(()=>false))return;await new Promise(r=>setTimeout(r,50));}throw Error('Condition absente : '+source);}
async function capture(name){await js("document.fonts.ready.then(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))");await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.join(output,name),(await win.webContents.capturePage()).toPNG());}
async function run(){
 win=new BrowserWindow({show:false,width:1440,height:1050,webPreferences:{preload:path.join(root,'src/main/preload.js'),contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest((details,callback)=>callback({cancel:/^(https?|wss?):/.test(details.url)}));
 win.webContents.on('console-message',event=>{if(/ReferenceError|SyntaxError|TypeError/.test(event.message||''))errors.push(event.message);});
 for(const paymentMethod of ['card','google_pay','apple_pay','link'])for(const kind of ['game','subscription']){
   Object.assign(state,createDefaultState());state.settings.account=account;state.settings.publicOverlayRelay.enabled=false;state.commerce.subscription={tier:'free',source:'free',status:'free'};
   await win.loadFile(path.join(root,'src/renderer/index.html'));
   await until("typeof accountSession !== 'undefined' && accountSession.authenticated");
   let field;
   if(kind==='subscription'){
     await js("currentPage='membership';render()");await until("agencyState().dashboard?.pricing && document.querySelector('[name=subscriptionPaymentProvider]')");
     field="document.querySelector('[name=subscriptionPaymentProvider]')";
   }else{await js('openGamePurchaseDialog(snapshot.packs[0])');field="document.querySelector('#editor-form [name=paymentProvider]')";}
   assert.equal(await js(field+'.value'),'paypal');await js(field+'.value='+JSON.stringify(paymentMethod));
   await js(kind==='subscription'?"document.querySelector('.tier-pro [data-action=subscription-checkout]').click()":"document.getElementById('editor-form').requestSubmit()");
   for(let n=0;n<100&&!pendingCheckouts.length;n++)await new Promise(r=>setTimeout(r,25));assert.equal(pendingCheckouts.length,1);
   assert.deepEqual(await js('({value:'+field+'.value,disabled:'+field+'.disabled})'),{value:paymentMethod,disabled:true});
   await capture(kind+'-'+paymentMethod+'-pending.png');
   await pendingCheckouts.shift().resolve();
   await until(kind==='subscription'?"!subscriptionCheckoutBusyTier":"!document.getElementById('editor-dialog').open && dialogSubmitHandler === null");
   if(kind==='subscription')assert.equal(state.commerce.subscription.tier,'pro');else assert.ok(state.commerce.gameEntitlements.some(entry=>entry.id==='coin-pusher'&&entry.status==='active'));
   await capture(kind+'-'+paymentMethod+'-completed.png');
   observations.push({kind,paymentMethod,selectionPreserved:true,checkoutCompleted:true,entitlementsSynchronized:true});
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:true,appRoot:root,simulationOnly:true,realMoneyMoved:false,externalStripeCalls:0,paypalTested:false,calls,observations,evidence,errors},null,2));
 console.log('Stripe renderer et IPC vérifiés : '+output);
}
app.whenReady().then(run).then(()=>{clearTimeout(deadline);win.destroy();app.exit(0);}).catch(error=>{clearTimeout(deadline);fs.writeFileSync(path.join(output,'failure.json'),JSON.stringify({error:error.stack,errors,calls},null,2));console.error(error.stack);win?.destroy();app.exit(1);});
