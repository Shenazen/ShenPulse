import {createHash, createHmac} from 'node:crypto';
const fail=(message,statusCode=400)=>{throw Object.assign(new Error(message),{statusCode});};
const enc=value=>encodeURIComponent(String(value)).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
export const encodeKey=key=>String(key).split('/').map(enc).join('/');
export function validateKey(value){
 if(typeof value!=='string'||!value||Buffer.byteLength(value)>1024||/[\\\x00-\x1f\x7f]/.test(value)||value.startsWith('/')||value.split('/').some(p=>p==='.'||p==='..'))fail('Chemin de fichier invalide.');
 return value;
}
export function storageConfig(env=process.env){
 const endpoint=String(env.B2_MEDIA_ENDPOINT||'').replace(/^https?:\/\//,'').replace(/\/+$/,'');
 const bucket=String(env.B2_MEDIA_BUCKET||''),region=String(env.B2_MEDIA_REGION||endpoint.match(/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/i)?.[1]||'');
 if(!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket)||!/^s3\.[a-z0-9-]+\.backblazeb2\.com$/i.test(endpoint)||!region||!env.B2_MEDIA_KEY_ID||!env.B2_MEDIA_APPLICATION_KEY)fail('Le stockage Backblaze est indisponible.',503);
 return {bucket,endpoint,region,keyId:env.B2_MEDIA_KEY_ID,secret:env.B2_MEDIA_APPLICATION_KEY,prefix:String(env.B2_MEDIA_PREFIX||'mediauploads').replace(/^\/+|\/+$/g,'')};
}
export function presign(config,{key='',method='GET',query={},now=new Date(),ttl=300}={}){
 if(key)validateKey(key);
 const host=config.bucket+'.'+config.endpoint,uri='/'+encodeKey(key),date=now.toISOString().replace(/[:-]|\.\d{3}/g,''),stamp=date.slice(0,8),scope=stamp+'/'+config.region+'/s3/aws4_request';
 const params={...query,'X-Amz-Algorithm':'AWS4-HMAC-SHA256','X-Amz-Credential':config.keyId+'/'+scope,'X-Amz-Date':date,'X-Amz-Expires':String(ttl),'X-Amz-SignedHeaders':'host'};
 const canonical=Object.entries(params).map(([k,v])=>[enc(k),enc(v)]).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,v])=>k+'='+v).join('&');
 const hash=s=>createHash('sha256').update(s).digest('hex'),hmac=(key,s)=>createHmac('sha256',key).update(s).digest();
 const keyDate=hmac('AWS4'+config.secret,stamp),keyRegion=hmac(keyDate,config.region),keyService=hmac(keyRegion,'s3'),keySigning=hmac(keyService,'aws4_request');
 const signature=createHmac('sha256',keySigning).update(['AWS4-HMAC-SHA256',date,scope,hash([method,uri,canonical,'host:'+host+'\n','host','UNSIGNED-PAYLOAD'].join('\n'))].join('\n')).digest('hex');
 return 'https://'+host+uri+'?'+canonical+'&X-Amz-Signature='+signature;
}
function decodeXml(s){return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>{if(v[0]==='#'){const n=v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1));if(n<1||n>0x10ffff||n>=0xd800&&n<=0xdfff)fail('Réponse du stockage invalide.',502);return String.fromCodePoint(n);}return {amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v.toLowerCase()];});}
function tag(xml,name){return decodeXml(xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>'))?.[1]||'');}
export function parseList(xml){
 if(typeof xml!=='string'||xml.length>4*1024*1024||/<!DOCTYPE|<!ENTITY/i.test(xml)||!/<ListBucketResult(?:\s|>)/.test(xml))fail('Réponse du stockage invalide.',502);
 const encoded=tag(xml,'EncodingType')==='url',objects=[];
 for(const [,row] of xml.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)){
  let key=tag(row,'Key');if(encoded)try{key=decodeURIComponent(key);}catch{fail('Réponse du stockage invalide.',502);}
  const size=Number(tag(row,'Size')),modified=tag(row,'LastModified');if(!key||!Number.isSafeInteger(size)||size<0||!Number.isFinite(Date.parse(modified)))fail('Réponse du stockage invalide.',502);
  if(!key.endsWith('/'))objects.push({key,size,modified:new Date(modified).toISOString()});
 }
 const truncated=tag(xml,'IsTruncated')==='true',next=tag(xml,'NextContinuationToken');if(truncated&&!next)fail('Pagination du stockage invalide.',502);
 return {objects,truncated,next};
}
export function mediaKind(key){const ext=String(key).split('.').pop().toLowerCase();return ['mp4','webm','mov','mkv','avi'].includes(ext)?'video':['mp3','wav','ogg','m4a','aac','flac'].includes(ext)?'audio':['png','jpg','jpeg','webp','gif','svg','avif'].includes(ext)?'image':'other';}
export function previewType(key,contentType=''){
 const allowed=new Set(['video/mp4','video/webm','audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/ogg','audio/mp4','audio/webm','audio/flac','image/png','image/jpeg','image/webp','image/gif','image/svg+xml','image/avif']);
 return allowed.has(String(contentType).split(';')[0].toLowerCase())?String(contentType).split(';')[0].toLowerCase():'';
}
export function downloadName(key){return key.split('/').pop().replace(/[<>:"/\\|?*\x00-\x1f\x7f]/g,'_').replace(/[ .]+$/,'').replace(/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?=\.|$)/i,'_$1').slice(0,200)||'fichier-shenpulse';}
export async function readBoundedText(response,max=4*1024*1024){
 if(!response.body)return '';
 const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.length;if(size>max)fail('Réponse du stockage trop volumineuse.',502);chunks.push(Buffer.from(chunk));}return Buffer.concat(chunks).toString('utf8');
}
