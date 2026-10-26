"use strict";
const { StudioInstallationService } = require("../studio-installation/service");
function registerStudiosIpc({handle,core,store,requireGameAccess}){
  const studios=new StudioInstallationService({core,store,requireGameAccess});
  handle("studio:status",()=>studios.status());
  handle("studio:install",(_event,options)=>studios.install({studioId:String(options?.studioId||""),profileId:String(options?.profileId||""),accountUid:String(options?.accountUid||""),motion:options?.motion==="fixed"?"fixed":"animated"}));
  return studios;
}
module.exports={registerStudiosIpc};
