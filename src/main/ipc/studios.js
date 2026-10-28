"use strict";
const { StudioInstallationService } = require("../studio-installation/service");
function registerStudiosIpc({handle,core,store,requireGameAccess}){
  const studios=new StudioInstallationService({core,store,requireGameAccess});
  handle("studio:status",()=>studios.status());
  handle("studio:install",(_event,options)=>studios.install({packId:String(options?.packId||"supermarket-simulator"),studioId:String(options?.studioId||""),profileId:String(options?.profileId||""),accountUid:String(options?.accountUid||""),overlayOnly:options?.overlayOnly===true,motion:options?.motion==="fixed"?"fixed":"animated"}));
  return studios;
}
module.exports={registerStudiosIpc};
