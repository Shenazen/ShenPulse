import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {integrateAdminStorage} from './integrate.mjs';
export function prepareAdminStorage({input,output}){
 const before=fs.readFileSync(input,'utf8'),index=integrateAdminStorage(before),hash=data=>createHash('sha256').update(data).digest('hex');
 fs.mkdirSync(path.join(output,'media-admin'),{recursive:true});fs.writeFileSync(path.join(output,'index.js'),index);
 const files={};for(const name of ['storage.mjs','service.mjs']){const data=fs.readFileSync(new URL(name,import.meta.url));fs.writeFileSync(path.join(output,'media-admin',name),data);files['media-admin/'+name]=hash(data);}
 files['index.js']=hash(index);const manifest={version:1,sourceIndexSha256:hash(before),files};fs.writeFileSync(path.join(output,'manifest.json'),JSON.stringify(manifest,null,2));return manifest;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const input=process.argv.find(x=>x.startsWith('--input='))?.slice(8),output=process.argv.find(x=>x.startsWith('--output='))?.slice(9);if(!input||!output)throw Error('Fournir --input et --output.');console.log(JSON.stringify(prepareAdminStorage({input,output})));
}
