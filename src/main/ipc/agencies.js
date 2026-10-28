"use strict";
const {agencyRequest}=require("../agency-service");
const {sanitizeEntity}=require("./sanitizers");
function registerAgencyIpc({handle,accountService}){
  handle("agencies:list",()=>agencyRequest(accountService,"list"));
  handle("agencies:dashboard",()=>agencyRequest(accountService,"dashboard"));
  handle("agencies:command",(_event,command,body)=>agencyRequest(accountService,String(command),sanitizeEntity(body || {})));
  handle("admin:agencies-dashboard",()=>agencyRequest(accountService,"dashboard",{},true));
  handle("admin:agencies-command",(_event,command,body)=>agencyRequest(accountService,String(command),sanitizeEntity(body || {}),true));
}
module.exports={registerAgencyIpc};
