import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const fail=(code,status=503)=>Object.assign(new Error('Le service de messages TikTok est indisponible.'),{code,statusCode:status});
const BOT_FILE=process.env.SHENPULSE_TIKTOK_BOT_FILE||'/var/lib/shenpulse/tiktok-bot.json';
const signature=c=>JSON.stringify([c.enabled,c.apiKey,c.accessToken,c.refreshToken,c.clientId,c.clientSecret,c.botUsername,c.expiresAt,c.scopes]);

/** Les identifiants du bot ne quittent jamais le serveur. Un propriétaire
 * connecte ce compte une fois ; les créateurs utilisent leur session ShenPulse. */
export function fileBotConfiguration(filename=BOT_FILE) {
  return {
    read(){try{return JSON.parse(fs.readFileSync(filename,'utf8'));}catch{return {}; }},
    write(value){fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});const tmp=filename+'.'+crypto.randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(value),{mode:0o600});fs.renameSync(tmp,filename);}
  };
}

export function createSharedTikTokBotService({authenticate,entitlements,DeliveryClass,configuration=fileBotConfiguration(),fetchImpl=globalThis.fetch,now=Date.now}){
  let session={},refreshing=null;
  const deliveries=new Map(),limits=new Map();
  const provider=new DeliveryClass({getSession:()=>session,fetchFn:fetchImpl,now});
  function prepareSession(c){
    session={authenticated:true,accountUid:'shenpulse-bot',apiKey:c.apiKey||'',accessToken:c.accessToken||'',
      config:{provider:'euler-oauth',accountUid:'shenpulse-bot',apiKeySecretId:'server-key',accessTokenSecretId:'server-token',expiresAt:c.expiresAt||'',botUsername:c.botUsername||'',scopes:c.scopes||[]}};
  }
  async function credentials(){
    let c=configuration.read();
    if(c.enabled===false||!c.apiKey||!c.accessToken||!/^\w[\w.]{0,79}$/.test(c.botUsername||''))return null;
    if(Date.parse(c.expiresAt)>now()+60000){prepareSession(c);return c;}
    if(!c.refreshToken||!c.clientId||!c.clientSecret)return null;
    if(!refreshing)refreshing=(async()=>{
      const before=signature(c);
      const response=await fetchImpl('https://tiktok.eulerstream.com/tiktok/oauth/token',{method:'POST',redirect:'error',signal:AbortSignal.timeout(8000),headers:{'Content-Type':'application/json'},body:JSON.stringify({grant_type:'refresh_token',refresh_token:c.refreshToken,client_id:c.clientId,client_secret:c.clientSecret})});
      if(!response.ok)throw fail('BOT_AUTHORIZATION_REQUIRED');
      const text=await response.text();if(text.length>65536)throw fail('BOT_INVALID_RESPONSE');
      const token=JSON.parse(text).data;
      if(!token?.access_token||!Number.isFinite(Number(token.expires_in))||Number(token.expires_in)<=0)throw fail('BOT_AUTHORIZATION_REQUIRED');
      c={...c,accessToken:token.access_token,refreshToken:token.refresh_token||c.refreshToken,expiresAt:new Date(now()+Number(token.expires_in)*1000).toISOString(),scopes:Array.isArray(token.scopes)?token.scopes:c.scopes};
      if(signature(configuration.read())!==before)throw fail('BOT_CONTEXT_CHANGED');
      configuration.write(c);prepareSession(c);return c;
    })().catch(()=>{throw fail('BOT_AUTHORIZATION_REQUIRED');}).finally(()=>{refreshing=null;});
    return refreshing;
  }
  async function access(request){
    const user=await authenticate(request);
    const rights=await entitlements(user.uid);
    if(!['pro','premium'].includes(rights?.tier))throw fail('BOT_ACCESS_FORBIDDEN',403);
    return user;
  }
  async function status(request){
    await access(request);
    let c;try{c=await credentials();}catch{return {ready:false,reason:'bot-authorization-required'};}
    if(!c)return {ready:false,reason:'bot-configuration-required'};
    const ready=provider.status().canSend===true;
    return {ready,reason:ready?'ready':'bot-authorization-required',botUsername:c.botUsername,confirmation:'platform'};
  }
  async function send(request,body={}){
    const user=await access(request);
    const {requestId,roomId,message}=body;
    if(!/^[a-f\d-]{36}$/i.test(requestId||'')||!/^[1-9]\d{0,29}$/.test(roomId||'')||typeof message!=='string'||!message.trim()||[...message].length>500)throw fail('BOT_INVALID_MESSAGE',400);
    const key=user.uid+':'+requestId, stamp=now();
    for(const [id,entry] of deliveries)if(stamp-entry.at>1800000)deliveries.delete(id);
    if(deliveries.has(key))return deliveries.get(key).promise;
    if(deliveries.size>=5000)throw fail('BOT_BUSY',429);
    for(const id of ['user:'+user.uid,'room:'+roomId])if((limits.get(id)||0)>stamp)throw fail('BOT_RATE_LIMIT',429);
    if(limits.size>=4000)for(const [id,until]of limits)if(until<=stamp)limits.delete(id);
    if(limits.size>=4000)throw fail('BOT_BUSY',429);
    for(const id of ['user:'+user.uid,'room:'+roomId])limits.set(id,stamp+3000);
    const job={at:stamp,promise:null};
    const promise=(async()=>{
      const c=await credentials();if(!c||!provider.status().canSend)throw fail('BOT_AUTHORIZATION_REQUIRED');
      const result=await provider.send(roomId,{message},{shouldSend:()=>signature(configuration.read())===signature(c)});
      if(result?.sent!==true||result?.acknowledged!==true)throw fail('BOT_NOT_CONFIRMED');
      return {requestId,sent:true,acknowledged:true,confirmation:'platform',botUsername:c.botUsername};
    })();
    // Même requête = même résultat, y compris après un délai dépassé : aucun
    // second POST au fournisseur. Le corps du commentaire n'est pas journalisé.
    job.promise=promise;deliveries.set(key,job);
    return promise;
  }
  return {status,send};
}

export async function handleSharedTikTokBotRoute(service,request,url,readBody){
  if(url.pathname==='/api/chatbot/tiktok/status'&&request.method==='GET')return service.status(request);
  if(url.pathname==='/api/chatbot/tiktok/send'&&request.method==='POST')return service.send(request,await readBody(request));
  throw fail('BOT_ROUTE_NOT_FOUND',404);
}
