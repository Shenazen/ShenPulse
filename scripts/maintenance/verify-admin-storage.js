"use strict";
/** Lecture et téléchargement de qualification, sans écriture dans le profil utilisateur. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{createHash}=require('node:crypto');
const {AccountService}=require('../../src/main/account-service'),{AdminService}=require('../../src/main/admin-service'),{downloadStorageFile}=require('../../src/main/admin/storage');
const {cloneEncryptionProfile,removeSmokeProfile}=require('../smoke-media-upload'),{ownerMemoryStore,verifiedOwnerIdentity}=require('./restrict-owner-pages');
const hash=b=>createHash('sha256').update(b).digest('hex');
async function main(){
 const {app,safeStorage}=require('electron'),source=path.join(process.env.APPDATA,'ShenPulse'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'shenpulse-media-smoke-'));
 fs.writeFileSync(path.join(temporary,'.shenpulse-media-smoke-owned'),JSON.stringify({kind:'shenpulse-media-smoke-v1',pid:process.pid}),{flag:'wx'});cloneEncryptionProfile(source,temporary);
 app.setName('ShenPulseStorageQualification');app.setPath('userData',temporary);app.setPath('sessionData',temporary);app.disableHardwareAcceleration();await app.whenReady();
 let success=false;try{
  const files=['shenpulse-state.json','shenpulse-secrets.json'].map(name=>path.join(source,name)),before=files.map(file=>fs.readFileSync(file));
  const store=ownerMemoryStore(JSON.parse(before[0]),JSON.parse(before[1]),safeStorage),accountService=new AccountService({store});await verifiedOwnerIdentity(store,accountService);
  const service=new AdminService({store,accountService}),status=await service.status();if(!status.authorized)throw Error('OWNER_REQUIRED');
  const filesResult=await service.getStorageFiles({category:'imports',kind:'video'});if(!filesResult.ok)throw Error('LIST_FAILED');
  const row=[...filesResult.rows].filter(r=>r.size>0&&r.size<25*1024**2).sort((a,b)=>a.size-b.size)[0];if(!row)throw Error('TEST_VIDEO_MISSING');
  const preview=await service.getStorageFile(row.key,true);const response=await fetch(preview.url,{headers:{Range:'bytes=0-63'},redirect:'error'});if(!response.ok)throw Error('PREVIEW_FAILED');await response.arrayBuffer();
  const output=path.resolve(__dirname,'../../.artifacts/admin-backblaze/download-verification');fs.mkdirSync(output,{recursive:true});
  const download=await downloadStorageFile({getTicket:()=>service.getStorageFile(row.key),choosePath:async name=>({filePath:path.join(output,name),canceled:false}),assertOwner:async()=>{if(!(await service.status()).authorized)throw Error('OWNER_CHANGED');}});
  const bytes=fs.readFileSync(download.filePath);if(bytes.length!==row.size)throw Error('SIZE_FAILED');
  const report={authorized:true,inventoryTotal:filesResult.inventoryTotal,videos:filesResult.total,previewStatus:response.status,downloaded:true,bytes:bytes.length,sha256:hash(bytes),version:require('../../package.json').version,profileNotWrittenByHelper:true};
  fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));success=true;
 }catch(error){console.error(JSON.stringify({failed:true,code:['OWNER_REQUIRED','LIST_FAILED','PREVIEW_FAILED','SIZE_FAILED','TEST_VIDEO_MISSING'].includes(error.message)?error.message:'STORAGE_CHECK_FAILED'}));}
 finally{app.exit(success?0:1);}
}
main().catch(()=>{console.error('STORAGE_CHECK_FAILED');require('electron').app.exit(1);});
