"use strict";
const fs=require('node:fs'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {Readable,Transform}=require('node:stream'),{pipeline}=require('node:stream/promises');
function safeStorageName(value){return path.basename(String(value||'').replace(/\\/g,'/')).replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/[ .]+$/,'').replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i,'_$1').slice(0,200)||'fichier-shenpulse';}
function validateStorageTicket(ticket,key){
 const invalid=()=>{throw Error('Le serveur n’a pas fourni un lien de fichier valide.');};
 if(ticket?.ok!==true||ticket.key!==key||!Number.isSafeInteger(ticket.size)||ticket.size<0||ticket.size>100*1024**3||typeof ticket.name!=='string')invalid();
 let url;try{url=new URL(ticket.url);}catch{invalid();}
 if(url.protocol!=='https:'||url.username||url.password||url.port||url.hash||!/^([a-z0-9][a-z0-9.-]*\.)?s3\.[a-z0-9-]+\.backblazeb2\.com$/i.test(url.hostname))invalid();
 let remoteKey;try{remoteKey=decodeURIComponent(url.pathname.slice(1));}catch{invalid();}
 if(remoteKey!==key||!url.searchParams.get('X-Amz-Signature')||!Number.isFinite(Date.parse(ticket.expiresAt))||Date.parse(ticket.expiresAt)<=Date.now()||Date.parse(ticket.expiresAt)>Date.now()+16*60000)invalid();
 return {...ticket,name:safeStorageName(ticket.name),url:url.href};
}
async function downloadStorageFile({getTicket,choosePath,assertOwner,onProgress=()=>{},fetchImpl=globalThis.fetch}){
 await assertOwner();const initial=await getTicket();await assertOwner();
 const selected=await choosePath(initial.name);if(selected.canceled||!selected.filePath)return {canceled:true};await assertOwner();
 const ticket=await getTicket();await assertOwner();
 const destination=path.resolve(selected.filePath),temporary=path.join(path.dirname(destination),'.shenpulse-'+randomUUID()+'.part');
 let created=false,bytes=0,lastProgress=0;
 try{
  const response=await fetchImpl(ticket.url,{method:'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(30*60000)});
  if(!response.ok||!response.body)throw Error('Le fichier n’a pas pu être téléchargé ('+response.status+').');
  const declared=response.headers.get('content-length');if(declared!==null&&Number(declared)!==ticket.size)throw Error('Le fichier a changé. Actualisez la liste puis réessayez.');
  await assertOwner();
  // A partial file never replaces an existing destination. Only complete bytes are renamed.
  const file=await fs.promises.open(temporary,'wx',0o600);created=true;
  const output=file.createWriteStream();
  const meter=new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;if(bytes>ticket.size)return callback(Error('La taille reçue ne correspond pas au fichier.'));if(Date.now()-lastProgress>200){lastProgress=Date.now();onProgress({received:bytes,total:ticket.size});}callback(null,chunk);}});
  await pipeline(Readable.fromWeb(response.body),meter,output);
  if(bytes!==ticket.size)throw Error('Téléchargement incomplet. Réessayez.');
  await assertOwner();await fs.promises.rename(temporary,destination);created=false;onProgress({received:bytes,total:ticket.size});return {canceled:false,filePath:destination,size:bytes};
 }catch(error){if(error.name==='AbortError'||error.name==='TimeoutError')throw Error('Le téléchargement a expiré. Réessayez.');throw error;}
 finally{if(created)await fs.promises.unlink(temporary).catch(()=>{});}
}
module.exports={safeStorageName,validateStorageTicket,downloadStorageFile};
