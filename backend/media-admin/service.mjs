import {randomUUID} from 'node:crypto';
import {storageConfig,presign,parseList,mediaKind,previewType,downloadName,validateKey,readBoundedText} from './storage.mjs';
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
export function createAdminStorage({requireAdmin,env=process.env,fetchImpl=globalThis.fetch,clock=()=>Date.now()}){
 let cache=null,pending=null;
 async function storageFetch(config,options){let response;try{response=await fetchImpl(presign(config,options),{method:options.method||'GET',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(15000)});}catch{fail('Backblaze ne répond pas. Réessayez dans un instant.',502);}
  if(!response.ok){if(response.status===404)fail('Ce fichier n’existe plus dans Backblaze.',404);if(response.status===403)fail('La clé serveur Backblaze ne permet pas de lister ou lire ces fichiers.',503);fail('Lecture Backblaze impossible ('+response.status+').',502);}return response;
 }
 async function inventory(config,refresh){
  if(cache&&clock()-cache.at<120000&&!refresh)return cache;
  if(pending)return pending;
  if(cache&&refresh&&clock()-cache.at<5000)return cache;
  pending=(async()=>{
   let next='',complete=false;const rows=[],tokens=new Set(),started=clock();
   for(let page=0;page<50;page++){
    const response=await storageFetch(config,{query:{'list-type':'2','encoding-type':'url','max-keys':'1000',...(next?{'continuation-token':next}:{})}});
    const parsed=parseList(await readBoundedText(response));rows.push(...parsed.objects);
    if(!parsed.truncated){complete=true;break;}if(tokens.has(parsed.next))fail('Pagination du stockage invalide.',502);tokens.add(parsed.next);next=parsed.next;
    if(clock()-started>55000)break;
   }
   rows.sort((a,b)=>b.modified.localeCompare(a.modified)||a.key.localeCompare(b.key));
   cache={rows,at:clock(),complete,id:randomUUID()};return cache;
  })().finally(()=>{pending=null;});return pending;
 }
 function category(config,key){return key.startsWith(config.prefix+'/')?'imports':key.startsWith('installer-assets/')||key.startsWith('game-packs/')?'packs':'other';}
 function rowView(config,row){return {...row,name:downloadName(row.key),kind:mediaKind(row.key),category:category(config,row.key),folder:row.key.includes('/')?row.key.slice(0,row.key.lastIndexOf('/')):'',ownerUid:row.key.startsWith(config.prefix+'/')?row.key.slice(config.prefix.length+1).split('/')[0]:''};}
 return {
  async list(request,params={}){
   await requireAdmin(request,params.ownerId||'');const config=storageConfig(env);
   const query=String(params.query||'').trim().slice(0,160).toLocaleLowerCase('fr'),kind=['video','audio','image','other'].includes(params.kind)?params.kind:'all',group=['imports','packs','other'].includes(params.category)?params.category:'all';
   const requestedPage=Number(params.page||1);if(!Number.isSafeInteger(requestedPage)||requestedPage<1||requestedPage>100000)fail('Page invalide.');
   const data=await inventory(config,params.refresh===true||params.refresh==='1'),all=data.rows.map(row=>rowView(config,row));
   const filtered=all.filter(row=>(kind==='all'||row.kind===kind)&&(group==='all'||row.category===group)&&(!query||(row.key+' '+row.name).toLocaleLowerCase('fr').includes(query))),pageSize=48,pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)),page=Math.min(requestedPage,pageCount);
   return {ok:true,bucket:config.bucket,listedAt:new Date(data.at).toISOString(),complete:data.complete,page,pageSize,pageCount,total:filtered.length,totalBytes:filtered.reduce((n,r)=>n+r.size,0),inventoryTotal:all.length,counts:Object.fromEntries(['video','audio','image','other'].map(type=>[type,all.filter(row=>row.kind===type).length])),rows:filtered.slice((page-1)*pageSize,page*pageSize)};
  },
  async file(request,body={}){
   await requireAdmin(request,body.ownerId||'');const config=storageConfig(env),key=validateKey(body.key),response=await storageFetch(config,{key,method:'HEAD'});
   const declaredSize=response.headers.get('content-length'),size=Number(declaredSize),contentType=String(response.headers.get('content-type')||'application/octet-stream').split(';')[0];
   if(declaredSize===null||!Number.isSafeInteger(size)||size<0)fail('Taille du fichier indisponible.',502);
   const preview=body.preview===true,type=previewType(key,contentType);if(preview&&!type)fail('Ce format ne peut pas être prévisualisé. Utilisez Télécharger.',415);
   const name=downloadName(key),ttl=preview?600:300,url=presign(config,{key,ttl,query:{'response-content-disposition':(preview?'inline':'attachment')+'; filename="'+name.replace(/[^\x20-\x7e]/g,'_')+'"; filename*=UTF-8\'\''+encodeURIComponent(name),'response-content-type':preview?type:'application/octet-stream'}});
   return {ok:true,key,name,size,kind:mediaKind(key),contentType:type||contentType,url,expiresAt:new Date(clock()+ttl*1000).toISOString()};
  }
 };
}
