import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {integrateAgencyPackBilling} from './integrate-billing.mjs';
const base=process.argv[2] || '.artifacts/agencies/baseline',stage=process.argv[3] || '.artifacts/agencies/stage',out=process.argv[4] || '.artifacts/agencies/deployment';
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const files=['payments.js','index.js'];
const manifest={preparedAt:new Date().toISOString(),activation:'NOT_DEPLOYED',commissionsEnabled:false,baseline:{},files:{}};
for(const name of files){
 const target=path.join(out,'server',name);fs.mkdirSync(path.dirname(target),{recursive:true});const source=fs.readFileSync(path.join(stage,name),'utf8');
 fs.writeFileSync(target,name==='payments.js'&&!source.includes('const agencyPackBilling =')?integrateAgencyPackBilling(source):source);
 manifest.baseline['server/'+name]=hash(path.join(base,name));manifest.files['server/'+name]=hash(target);
}
for(const name of ['service.mjs','routes.mjs','invitation.mjs','packs.mjs','pack-policy.mjs','billing.mjs','billing-policy.mjs','billing-lifecycle.mjs']){
 const target=path.join(out,'server/agencies',name);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(new URL(name,import.meta.url),target);
 manifest.files['server/agencies/'+name]=hash(target);
 const checked=spawnSync(process.execPath,['--check',target],{encoding:'utf8'});if(checked.status)throw Error(checked.stderr);
}
const stripeTarget=path.join(out,'server/stripe/service.mjs');fs.mkdirSync(path.dirname(stripeTarget),{recursive:true});fs.copyFileSync(new URL('../stripe/service.mjs',import.meta.url),stripeTarget);manifest.files['server/stripe/service.mjs']=hash(stripeTarget);
for(const name of files){const checked=spawnSync(process.execPath,['--check',path.join(out,'server',name)],{encoding:'utf8'});if(checked.status)throw Error(checked.stderr);}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(out,'catalog-prices.patch.json'),JSON.stringify({'site/commerceCatalog/subscriptions/pro/priceMonthly':14.99,'site/commerceCatalog/subscriptions/premium/priceMonthly':20.99},null,2)+'\n');
console.log('Paquet serveur préparé et empreintes SHA-256 enregistrées : '+out+'. Aucune publication.');
