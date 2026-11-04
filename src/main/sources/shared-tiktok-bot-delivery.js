"use strict";
const { randomUUID } = require("node:crypto");
const { readState } = require("../state-projection");
const { DEFAULT_WEB_ORIGIN } = require("../account/constants");
const { EulerOAuthChatDelivery } = require("./euler-oauth-chat-delivery");
const { hasAuthenticatedAccount } = require("../account-access");

const failed = (reason) => Object.assign(new Error("Le bot ShenPulse n’a pas confirmé l’envoi du message."), { code: `tiktok-chat-${reason}` });

/** Accès automatique au bot commun. Aucun secret TikTok ou fournisseur dans
 * l'application : seul le jeton du compte ShenPulse est utilisé côté serveur. */
class SharedTikTokBotDelivery {
  constructor({ store, identityProvider, fetchFn = globalThis.fetch, now = Date.now, baseUrl = DEFAULT_WEB_ORIGIN, onChanged = () => {} }) {
    this.store=store;this.identityProvider=identityProvider;this.fetch=fetchFn;this.now=now;this.baseUrl=baseUrl;
    this.cached=null;this.checkedAt=0;this.refreshing=null;this.generation=0;this.controllers=new Set();
    this.onChanged=onChanged;
  }
  owner(){return String(readState(this.store,["settings.account.uid"]).settings?.account?.uid||"");}
  status(){
    const owner=this.owner(),fresh=this.cached?.owner===owner&&this.now()-this.checkedAt<60000;
    if(!fresh&&!this.refreshing&&owner&&this.identityProvider)void this.refresh().catch(()=>{});
    return {canSend:fresh&&this.cached.ready===true,transport:"shenpulse-bot",confirmation:"platform",requiresAuthorization:false,
      authorization:fresh&&this.cached.ready?"service":"missing",reason:fresh?this.cached.reason:"bot-checking",botUsername:fresh?this.cached.botUsername||"":""};
  }
  async request(route,body,owner,shouldSend=()=>true){
    if(!this.identityProvider)throw failed("service-unavailable");
    if(this.controllers.size>=20)throw failed("busy");
    const generation=this.generation,controller=new AbortController();this.controllers.add(controller);
    const timer=setTimeout(()=>controller.abort(),9000);timer.unref?.();
    try{
      const identity=await this.identityProvider();
      if(this.owner()!==owner||identity.uid!==owner||generation!==this.generation||!shouldSend()||controller.signal.aborted)throw failed("cancelled");
      const response=await this.fetch(`${this.baseUrl}/api/chatbot/tiktok/${route}`,{method:body?"POST":"GET",redirect:"error",signal:controller.signal,
        headers:{Authorization:`Bearer ${identity.idToken}`,"Content-Type":"application/json"},...(body?{body:JSON.stringify(body)}:{})});
      if(!response.ok)throw failed(response.status===429?"rate-limit":"service-unavailable");
      const text=await response.text();if(text.length>65536)throw failed("invalid-response");
      let result;try{result=JSON.parse(text);}catch{throw failed("invalid-response");}
      if(this.owner()!==owner||generation!==this.generation||!shouldSend())throw failed("cancelled");
      return result;
    }catch(error){if(error.code?.startsWith("tiktok-chat-"))throw error;throw failed("service-unavailable");}
    finally{clearTimeout(timer);this.controllers.delete(controller);}
  }
  async refresh(force=false){
    if(this.refreshing)return this.refreshing;
    const owner=this.owner(),generation=this.generation;
    if(!owner||!this.identityProvider)return this.statusWithoutRefresh();
    if(!force&&this.cached?.owner===owner&&this.now()-this.checkedAt<60000)return this.statusWithoutRefresh();
    const work=(async()=>{
      let result;
      try{result=await this.request("status",null,owner);}
      catch{result={ready:false,reason:"bot-service-unavailable"};}
      if(owner!==this.owner()||generation!==this.generation)return this.statusWithoutRefresh();
      const botUsername=/^[\w.]{1,80}$/.test(result.botUsername||"")?result.botUsername:"";
      const ready=result.ready===true&&Boolean(botUsername);
      this.cached={owner,ready,reason:ready?"ready":["bot-configuration-required","bot-authorization-required"].includes(result.reason)?result.reason:"bot-service-unavailable",botUsername};
      this.checkedAt=this.now();this.onChanged();return this.statusWithoutRefresh();
    })();
    this.refreshing=work;try{return await work;}finally{if(this.refreshing===work)this.refreshing=null;}
  }
  statusWithoutRefresh(){const own=this.cached?.owner===this.owner()&&this.now()-this.checkedAt<60000;return {ready:own&&this.cached.ready===true,botUsername:own?this.cached.botUsername||"":""};}
  async send(roomId,payload,{shouldSend=()=>true}={}){
    if(!/^[1-9]\d{0,29}$/.test(roomId||"")||typeof payload?.message!=="string"||!payload.message.trim()||[...payload.message].length>500)throw failed("invalid-message");
    const owner=this.owner();
    await this.refresh();
    if(!this.statusWithoutRefresh().ready||!shouldSend())throw failed("service-unavailable");
    const requestId=randomUUID();
    const result=await this.request("send",{requestId,roomId,message:payload.message},owner,shouldSend);
    if(result.requestId!==requestId||result.sent!==true||result.acknowledged!==true)throw failed("not-confirmed");
    return {sent:true,acknowledged:true,confirmation:"platform",transport:"shenpulse-bot"};
  }
  reset(){this.generation++;for(const controller of this.controllers)controller.abort();this.controllers.clear();this.cached=null;this.checkedAt=0;this.refreshing=null;}
}
function usesAutomaticChatBot(store) {
  const state=readState(store,["settings.tiktok.chat","settings.account.uid"]);
  const chat=state.settings?.tiktok?.chat,uid=state.settings?.account?.uid||"";
  return !(chat&&chat.accountUid===uid&&(chat.provider==="euler-oauth"||chat.automatic===false));
}
function createAutomaticChatDelivery({getSession,getAutomatic,shared,fetchFn}) {
  const personal=new EulerOAuthChatDelivery({getSession,fetchFn});
  return {
    status:()=>getAutomatic()?shared.status():personal.status(),
    send:(...args)=>(getAutomatic()?shared:personal).send(...args),
    reset:()=>{personal.reset();shared.reset();}
  };
}
function personalTikTokChatSession(store) {
  const state=readState(store,["settings.tiktok.chat","settings.account"]);
  const config=state.settings?.tiktok?.chat||{provider:"none"},accountUid=state.settings?.account?.uid||"";
  const authenticated=hasAuthenticatedAccount(store),own=authenticated&&config.provider==="euler-oauth"&&config.accountUid===accountUid;
  return {config,accountUid,authenticated,apiKey:own&&config.apiKeySecretId?store.getSecret(config.apiKeySecretId):"",accessToken:own&&config.accessTokenSecretId?store.getSecret(config.accessTokenSecretId):""};
}
module.exports={SharedTikTokBotDelivery,usesAutomaticChatBot,createAutomaticChatDelivery,personalTikTokChatSession};
