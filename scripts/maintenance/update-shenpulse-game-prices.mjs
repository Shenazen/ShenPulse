import fs from 'node:fs';import path from 'node:path';import {createRequire} from 'node:module';import {pathToFileURL} from 'node:url';import {createHash} from 'node:crypto';
export const TARGETS=Object.freeze(['tiklive-climb','clash-of-live','tiklive-cube-wars','tiklive-stack-tower','shenfarm','shenpaint','splash-bombes','shenkite']);
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export function patchPrices(site){
 const next=structuredClone(site),channels=[next?.commerceCatalog,next?.adminCommerce?.draft];
 for(const channel of channels){if(!channel?.products)throw Error('Catalogue incomplet');for(const id of TARGETS){const row=channel.products[id];if(row?.accessMode!=='purchase'||row.currency!=='EUR')throw Error('Produit incompatible : '+id);row.baseAmount='4.99';}}
 return next;
}
async function main(){
 const root=process.env.SHENPULSE_SERVER_ROOT||'/var/www/shenpulse/server';await import(pathToFileURL(path.join(root,'env.js')));
 const require=createRequire(path.join(root,'package.json')),{initializeApp,cert,applicationDefault,deleteApp}=require('firebase-admin/app'),{getDatabase}=require('firebase-admin/database');
 let raw=process.env.FIREBASE_SERVICE_ACCOUNT_BASE64?Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,'base64').toString('utf8'):process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
 const account=raw?JSON.parse(raw):null;if(account?.private_key)account.private_key=account.private_key.replace(/\\n/g,'\n');
 const app=initializeApp({credential:account?cert(account):applicationDefault(),databaseURL:process.env.FIREBASE_DATABASE_URL||'https://shenazenoverlay-default-rtdb.firebaseio.com'},'game-prices-maintenance');
 const ref=getDatabase(app).ref('site'),hold=()=>{};ref.on('value',hold);
 try{
 const before=(await ref.once('value')).val();patchPrices(before);const summary=value=>Object.fromEntries(TARGETS.map(id=>[id,value.products[id].baseAmount]));
 const report={prod:summary(before.commerceCatalog),draft:summary(before.adminCommerce.draft),draftPreserved:true,testHash:hash(before.commerceCatalogTest)};
 if(process.argv.includes('--apply')){
  const directory=path.resolve(root,'../.deployments/game-prices-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(directory,{recursive:true,mode:0o700});fs.writeFileSync(path.join(directory,'catalogs-before.json'),JSON.stringify({prod:before.commerceCatalog,draft:before.adminCommerce.draft,test:before.commerceCatalogTest,history:before.adminCommerce.history},null,2),{mode:0o600});
  let committedBase;const result=await ref.transaction(current=>{if(!current)throw Error('Catalogue absent');for(const channel of ['commerceCatalog','adminCommerce']){const original=channel==='adminCommerce'?before.adminCommerce.draft:before.commerceCatalog,live=channel==='adminCommerce'?current.adminCommerce?.draft:current.commerceCatalog;for(const id of TARGETS)if(hash(original.products[id])!==hash(live?.products?.[id]))throw Error('Prix modifié pendant la préparation');}committedBase=structuredClone(current);return patchPrices(current);});
  if(!result.committed)throw Error('Transaction interrompue');const after=result.snapshot.val();if(hash(after)!==hash(patchPrices(committedBase)))throw Error('État concurrent : relire le catalogue avant toute autre modification');
  Object.assign(report,{applied:true,prod:summary(after.commerceCatalog),draft:summary(after.adminCommerce.draft),backup:directory});
 }
 console.log(JSON.stringify(report));
 }finally{ref.off('value',hold);await deleteApp(app);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1;});
