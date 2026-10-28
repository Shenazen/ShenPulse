// Banc visuel local : service réel, base en mémoire, identités fictives. Aucun appel Firebase ou PayPal.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {createAgencyService,AGENCY_PATH} from '../backend/agencies/service.mjs';
import {handleAgencyRoute} from '../backend/agencies/routes.mjs';
const root=path.resolve(import.meta.dirname,'..'),port=Number(process.env.AGENCY_PREVIEW_PORT || 42081);
let state={agencies:{
 a:{id:'a',ownerUid:'director',name:'Studio Lumière',description:'Une équipe de créateurs qui partage ses conseils et accompagne vos LIVE interactifs.',status:'approved',code:'EXEMPLE-LUMIERE',language:'fr'},
 b:{id:'b',ownerUid:'other',name:'Nova LIVE',description:'Un collectif bienveillant pour progresser ensemble et préparer des émissions qui vous ressemblent.',status:'approved',code:'EXEMPLE-NOVA',language:'fr'},
 c:{id:'c',ownerUid:'new-director',contactEmail:'equipe@example.invalid',name:'Pixel Crew',description:'Une nouvelle équipe de passionnés demande à rejoindre les agences partenaires ShenPulse.',status:'pending',code:'EXEMPLE-PIXEL',language:'fr'}
},memberships:{member3:{agencyId:'a',agencyName:'Studio Lumière',email:'membre3@example.invalid',displayName:'Autre membre',status:'approved'},member4:{agencyId:'a',agencyName:'Studio Lumière',email:'membre4@example.invalid',displayName:'Dernier membre',status:'approved'},creator:{agencyId:'a',agencyName:'Studio Lumière',email:'createur@example.invalid',displayName:'Créateur exemple',status:'pending'},member2:{agencyId:'a',agencyName:'Studio Lumière',email:'membre@example.invalid',displayName:'Membre exemple',status:'approved'}},audit:{}};
const checkouts={};
const db={ref(p){return {on(){},off(){},async once(){return this.get();},get:async()=>({val:()=>structuredClone(p===AGENCY_PATH?state:checkouts[p] || null)}),transaction:async fn=>{const next=fn(structuredClone(state));if(next===undefined)return {committed:false};state=next;return {committed:true};},set:async v=>{checkouts[p]=v;}};}};
const identity=async r=>({uid:r.role,email:r.role+'@example.invalid',emailVerified:true});
const service=createAgencyService({db:()=>db,authenticate:identity,requireAdmin:async r=>{if(r.role!=='admin')throw Object.assign(new Error('Admin requis'),{statusCode:403});return identity(r);},subscription:async uid=>['member2','member3','member4'].includes(uid)?{status:'active',tier:'pro',priceMonthly:9.99,paymentProvider:'paypal',paypalSubscriptionId:'EXAMPLE'}:{}});
const client=role=>`
const previewRole=${JSON.stringify(role)};
let currentPage='agencies',creatorPrivateOperationGeneration=1;
const SUBSCRIPTION_PLANS=[{tier:'free',price:0},{tier:'pro',price:14.99},{tier:'premium',price:20.99}], ACTION_NOT_HANDLED=Symbol();
const isAccountAuthenticated=()=>true,creatorPrivateOperationUid=()=>previewRole,isVerifiedAdminSession=()=>previewRole==='admin';
const captureCreatorPrivateOperation=()=>({uid:previewRole}),assertCreatorPrivateOperation=()=>{};
const escapeHtml=v=>String(v??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
async function request(p,body){const r=await fetch(p,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Preview-Role':previewRole},...(body?{body:JSON.stringify(body)}:{})});const v=await r.json();if(!r.ok)throw Error(v.error);return v;}
const routes={save:'/api/agencies/save',join:'/api/agencies/join',leave:'/api/agencies/leave',reviewMember:'/api/agencies/members/review',reviewAgency:'/api/admin/agencies/review',adminReviewMember:'/api/admin/agencies/members/review'};
const api={agencies:{list:()=>request('/api/agencies'),dashboard:()=>request('/api/agencies/dashboard'),command:(c,b)=>request(routes[c],b)},admin:{agenciesDashboard:()=>request('/api/admin/agencies'),agenciesCommand:(c,b)=>request(routes[c],b)},copy:t=>navigator.clipboard.writeText(t),openExternal:u=>window.open(u,'_blank','noopener')};
const confirmAction=async m=>window.confirm(m),openAccountLogin=()=>{},syncMembershipPopup=()=>{};
const handlers=[];function registerActionHandler(set,handler){handlers.push(handler);}
function render(){document.getElementById('content').innerHTML=previewRole==='admin'?renderAdminAgencies():renderAgencies();}
function openEditor(o){const d=document.createElement('dialog');d.style.cssText='width:min(90vw,720px);background:#171125;color:white;border:1px solid #653780;border-radius:24px;padding:28px';d.innerHTML='<form><h2>'+escapeHtml(o.title)+'</h2>'+o.body+'<div style="display:flex;gap:12px;margin-top:24px"><button class="button primary" type="submit">'+escapeHtml(o.submitLabel || 'Enregistrer')+'</button><button class="button" type="button" data-close>Annuler</button></div><p role="alert"></p></form>';document.body.append(d);d.querySelector('[data-close]').onclick=()=>d.remove();d.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await o.onSubmit(new FormData(e.target));d.remove();}catch(error){d.querySelector('[role=alert]').textContent=error.message;}};d.showModal();}
document.addEventListener('input',rememberAgencyDraft);document.addEventListener('submit',async e=>{if(['agency-profile-form','agency-join-form'].includes(e.target.id)){e.preventDefault();await submitAgencyForm(e.target);}});
document.addEventListener('click',async e=>{const target=e.target.closest('[data-action]');if(target){try{await handleAgencyAction({action:target.dataset.action,target,id:target.dataset.id});}catch(error){alert(error.message);}}});
`;
const server=http.createServer(async(req,res)=>{
 try{
 const u=new URL(req.url,'http://127.0.0.1:'+port);req.role=['admin','director','creator','visitor'].includes(req.headers['x-preview-role'])?req.headers['x-preview-role']:'visitor';
 if(u.pathname.startsWith('/api/')){
 const payload=await handleAgencyRoute(service,req,u,async r=>{let text='';for await(const chunk of r)text+=chunk;return JSON.parse(text || '{}');});
 res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(payload));return;
 }
 if(u.pathname.startsWith('/src/') || u.pathname.startsWith('/node_modules/')){
 const file=path.resolve(root,'.'+u.pathname);if(!file.startsWith(root+path.sep))throw Error('Chemin refusé');
 const type=path.extname(file)==='.css'?'text/css':path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.woff2'?'font/woff2':'application/octet-stream';
 res.writeHead(200,{'Content-Type':type});res.end(fs.readFileSync(file));return;
 }
 const role=['admin','director','creator','visitor'].includes(u.searchParams.get('role'))?u.searchParams.get('role'):'visitor';
 res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
 res.end('<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/renderer/styles.css"><title>Agences ShenPulse · vérification locale</title><style>html{height:auto;overflow:auto}body{display:block;height:auto;overflow:auto}#content{padding:24px;overflow:visible;max-width:1600px;margin:auto}.testbar{display:flex;gap:18px;flex-wrap:wrap;padding:16px 24px;background:#221a35}.testbar a{color:#80e6ee}dialog::backdrop{background:#0009}</style></head><body><header class="testbar"><strong>APERÇU DE TEST · données fictives</strong><a href="/?role=visitor">Annuaire</a><a href="/?role=creator">Créateur</a><a href="/?role=director">Directeur</a><a href="/?role=admin">Administration</a></header><main id="content"></main><script>'+client(role)+'</script><script src="/src/renderer/app/features/agencies-layout.js"></script><script src="/src/renderer/app/features/agencies-forms.js"></script><script src="/src/renderer/app/features/agencies.js"></script><script>render();</script></body></html>');
 }catch(error){res.writeHead(error.statusCode || 500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});
server.listen(port,'127.0.0.1',()=>console.log('Aperçu Agences : http://127.0.0.1:'+port));
