#include "runtime.h"
#include "vehicle-models.h"
namespace ShenPulse { namespace Koth {
Result Execute(const Request& request){
 Ped ped;if(!Ready(ped))return {3,"Chargez une partie jouable, hors menus."};
 const auto& code=request.code;
 if(code=="koth_create"){
  if(request.angle!=-1&&(request.angle<5||request.angle>60)||request.sections!=-1&&(request.sections<5||request.sections>95)||request.design!=-1&&(request.design<0||request.design>4)||request.animated!=-1&&(request.animated<0||request.animated>1))return {3,"Reglages de rampe invalides."};
  Ramp previous=ramp;int oldSections=sections,oldDesign=design;bool oldAnimated=animated;
  if(request.angle!=-1)ramp.angle=static_cast<float>(request.angle);if(request.sections!=-1)sections=request.sections;if(request.design!=-1)design=request.design;if(request.animated!=-1)animated=request.animated!=0;
  Result result=Build();if(result.status){ramp=previous;sections=oldSections;design=oldDesign;animated=oldAnimated;}return result;
 }
 if(code=="koth_destroy"){EndJail();ClearObstacles();ClearRamp();won=true;return {0,"Rampe retiree. F10 permet de la recreer."};}
 if(!active)return {3,"Creez la rampe KOTH depuis le menu F10."};
 if(code=="koth_clear"){ClearObstacles();return {0,"Obstacles de la rampe retires."};}
 if(code=="koth_start"){if(request.restartRound)StartRound(GetTickCount64(),true);else Teleport(false);return {0,"Retour au depart."};}
 if(code=="koth_finish"){Teleport(true);return {0,"Teleportation au sommet."};}
 if(code=="koth_ramp_jump"){
  Entity target=PED::IS_PED_IN_ANY_VEHICLE(ped,FALSE)?PED::GET_VEHICLE_PED_IS_IN(ped,FALSE):ped;
  ENTITY::SET_ENTITY_VELOCITY(target,0,12,18);return {0,"Saut vers le haut de la rampe."};
 }
 if(code=="koth_super_jump"){const auto duration=EffectDurationMs(request.duration,20);jumpUntil=GetTickCount64()+duration;return {0,"Super saut actif pendant "+std::to_string(duration/1000)+" secondes."};}
 if(code=="koth_heal"){ENTITY::SET_ENTITY_HEALTH(ped,ENTITY::GET_ENTITY_MAX_HEALTH(ped));return {0,"Vie restauree."};}
 if(code=="koth_shield"){
  restoreInvincible=true;
  // Protection remains restricted to the ramp, with physical reactions enabled.
 const auto duration=EffectDurationMs(request.duration,20);shieldUntil=GetTickCount64()+duration;return {0,"Protection active pendant "+std::to_string(duration/1000)+" secondes."};
 }
 if(code=="koth_sprint"){const auto duration=EffectDurationMs(request.duration,15);sprintUntil=GetTickCount64()+duration;sprintActive=true;return {0,"Sprint augmente pendant "+std::to_string(duration/1000)+" secondes."};}
 if(code=="koth_ragdoll"){const int duration=static_cast<int>(EffectDurationMs(request.duration,3));PED::SET_PED_CAN_RAGDOLL(ped,TRUE);PED::SET_PED_TO_RAGDOLL(ped,duration,duration,0,FALSE,FALSE,FALSE);return {0,"Chute pendant "+std::to_string(duration/1000)+" secondes."};}
 if(code=="koth_meteor"){
  Vector3 pos=ENTITY::GET_ENTITY_COORDS(ped,TRUE);invoke<Void>(0xE3AD2BDBAEE269AC,pos.x+1.0f,pos.y+1.2f,pos.z,4,1.0f,TRUE,FALSE,0.5f,FALSE);return {0,"Impact pres du joueur."};
 }
 if(code=="koth_jail")return StartJail(request);
 if(code=="koth_exit_jail"){if(!jailUntil)return {3,"Aucune prison KOTH active."};EndJail();Publish();return {0,"Prison retiree et joueur libere."};}
 if(code=="koth_companion"){
  Hash model=HashOf("a_m_y_runner_01");if(!Load(model))return {3,"Modele de compagnon indisponible."};
  Vector3 pos=ENTITY::GET_ENTITY_COORDS(ped,TRUE);Ped companion=PED::CREATE_PED(4,model,pos.x+2,pos.y,pos.z,0,FALSE,FALSE);
  STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);if(!TrackObstacle(companion)){if(companion&&ENTITY::DOES_ENTITY_EXIST(companion))ENTITY::DELETE_ENTITY(&companion);return {3,"Le compagnon n'a pas ete cree."};}
  AI::TASK_FOLLOW_TO_OFFSET_OF_ENTITY(companion,ped,1.5f,0,0,2.0f,-1,1.0f,TRUE);return {0,"Compagnon cree pendant 45 secondes."};
 }
 if(code=="koth_random_obstacle")return SpawnRandomObstacles(request);
 if(code=="koth_log")return SpawnObstacle(request,"prop_log_01",false);
 if(code=="koth_prop")return SpawnObstacle(request,"prop_barrel_02a",false);
 constexpr const char prefix[]="koth_vehicle_";
 if(code.rfind(prefix,0)==0){
  std::string model=code.substr(sizeof(prefix)-1);
  if(std::find(kVehicleModels.begin(),kVehicleModels.end(),model)==kVehicleModels.end())return {3,"Modele absent du catalogue ShenPulse."};
  return SpawnObstacle(request,model,true);
 }
 return {3,"Interaction KOTH inconnue."};
}
} }
