"use strict";
const fs=require('node:fs'),path=require('node:path'),{rewriteLiterals,replaceEqualBytes}=require('./lib/unity-game-metadata');
const definitions=[['syncfarm','SyncFarm','shenfarm','ShenFarm'],['syncpaint','SyncPaint','shenpaint','ShenPaint'],['synckite','SyncKite','shenkite','ShenKite'],['splashbombes','SplashBombes','splash-bombes','Splash Bombes']];
const root=path.resolve('.artifacts/shen-games-20261026'),requested=process.argv.find(a=>a.startsWith('--game='))?.slice(7);
const sourceRoot=process.argv.find(a=>a.startsWith('--source-root='))?.slice(14)||path.join(process.env.LOCALAPPDATA,'SyncLive','jeux');
for(const [folder,original,id,title]of definitions.filter(d=>!requested||d[2]===requested)){
 const source=path.join(sourceRoot,folder),stage=path.join(root,id,'stage'),dataName=title+'_Data',exe=title+'.exe';
 if(!stage.startsWith(root+path.sep)||fs.existsSync(stage))throw Error('Zone de préparation invalide ou déjà présente : '+stage);fs.mkdirSync(stage,{recursive:true});fs.cpSync(source,stage,{recursive:true});
 fs.renameSync(path.join(stage,original+'.exe'),path.join(stage,exe));fs.renameSync(path.join(stage,original+'_Data'),path.join(stage,dataName));
 const metadataPath=dataName+'/il2cpp_data/Metadata/global-metadata.dat',metadata=fs.readFileSync(path.join(stage,metadataPath)),keyIndices=[];
 const replace=(value,index)=>{
  if(/^[a-f0-9]{64}$/i.test(value)){keyIndices.push(index);return '0'.repeat(64);}
  if(id==='shenpaint'&&value==='wss://synclive.fr/api/syncpaint/relais')return 'ws://127.0.0.1:58534/';
  if(/(?:https?|wss?):\/\/[^\s]*synclive/i.test(value))throw Error('Dépendance réseau à examiner : '+id);
  if(id==='shenkite'&&value==='SYNC')return 'SHEN';
  let next=value.replaceAll(original,title.replaceAll(' ','')).replaceAll(original.toUpperCase(),title.toUpperCase()).replaceAll(folder,id.replaceAll('-',''));
  if(/^[a-zA-Z_][\w.+\x60<>]*$/.test(next))next=next.replaceAll('SyncLive','ShenLive');
  else next=next.replaceAll('SyncLive','ShenPulse');
  return next.replaceAll('synclive','shenlink').replaceAll('SYNCLIVE','SHENLINK');
 };
 const result=rewriteLiterals(metadata,replace);if(keyIndices.length!==1)throw Error('La clé locale ne peut pas être identifiée sans ambiguïté : '+id);
 for(const buffer of [result.buffer])for(const [from,to]of [['SyncLive','ShenLive'],['synclive','shenlink'],['SYNCLIVE','SHENLINK'],[original,title.replaceAll(' ','')]])if(Buffer.byteLength(from)===Buffer.byteLength(to))replaceEqualBytes(buffer,from,to);
 fs.writeFileSync(path.join(stage,metadataPath),result.buffer);
 for(const file of [path.join(stage,'GameAssembly.dll'),path.join(stage,dataName,'resources.assets'),path.join(stage,dataName,'globalgamemanagers'),path.join(stage,dataName,'globalgamemanagers.assets'),path.join(stage,dataName,'Resources','unity_builtin_extra')]){
  const bytes=fs.readFileSync(file);for(const [from,to]of [['SyncLive','ShenLive'],['synclive','shenlink'],['SYNCLIVE','SHENLINK'],[original,title.replaceAll(' ','')]])if(Buffer.byteLength(from)===Buffer.byteLength(to))replaceEqualBytes(bytes,from,to);
  fs.writeFileSync(file,bytes);
 }
 const streaming=path.join(stage,dataName,'StreamingAssets');
 function texts(dir){if(!fs.existsSync(dir))return;for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const file=path.join(dir,entry.name);if(entry.isDirectory())texts(file);else if(/\.(json|txt)$/i.test(entry.name))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('SyncLive','ShenPulse').replaceAll(original,title).replaceAll('synclive','shenpulse'));}}
 texts(streaming);fs.writeFileSync(path.join(stage,dataName,'app.info'),'ShenPulse\n'+title+'\n');
 for(const file of fs.readdirSync(stage).filter(file=>/^LICENCE-/i.test(file)))fs.unlinkSync(path.join(stage,file));
 fs.writeFileSync(path.join(stage,'PARTNER-NOTICE.txt'),'Copyright 2025-2026 STREAMUP AGENCY. Adaptation et distribution ShenPulse sous accord du détenteur des droits. Les composants tiers conservent leurs licences.\n');
 fs.writeFileSync(path.join(stage,'shenpulse-game.json'),JSON.stringify({schemaVersion:1,id,title,version:'1.0.0',protocol:'shen-native-v1',gameId:id.replaceAll('-',''),executable:exe,metadataPath,keyOffset:result.positions[keyIndices[0]]},null,2));
 fs.writeFileSync(path.join(root,id,'prepare-report.json'),JSON.stringify({id,title,metadataLiterals:result.count,changedLiterals:result.changed,keyOffset:result.positions[keyIndices[0]],stage},null,2));
 console.log(JSON.stringify({id,stage,changedLiterals:result.changed}));
}
