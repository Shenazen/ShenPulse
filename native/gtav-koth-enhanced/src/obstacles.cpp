#include "runtime.h"
#include "vehicle-models.h"
#include "random-obstacles.h"
#include <unordered_map>
namespace ShenPulse { namespace Koth {
static ObstacleShuffleBag random(static_cast<unsigned int>(GetTickCount64()^GetCurrentProcessId()));
static std::wstring MotionPath(){wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return L"";return std::wstring(local)+L"\\ShenPulse\\GtaMode\\motion-audit.jsonl";}
static std::ofstream AuditFile(){static bool first=true;auto path=MotionPath();if(path.empty())return {};std::ofstream file(path.c_str(),first?std::ios::trunc:std::ios::app);if(file)first=false;return file;}
static ObstacleBounds Bounds(Entity entity,const Vector3& low,const Vector3& high){ObstacleBounds result;for(int c=0;c<8;c++){Vector3 p=ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(entity,c&1?high.x:low.x,c&2?high.y:low.y,c&4?high.z:low.z);result.include(ramp,{p.x,p.y,p.z});}return result;}
void AuditObstacle(const Obstacle& item,const char* phase){
 if(!item.audit)return;auto file=AuditFile();if(!file)return;
 bool exists=ENTITY::DOES_ENTITY_EXIST(item.entity)!=FALSE;Vector3 p{},v{},player=ENTITY::GET_ENTITY_COORDS(PLAYER::PLAYER_PED_ID(),TRUE);ObstacleBounds b;
 if(exists){p=ENTITY::GET_ENTITY_COORDS(item.entity,TRUE);v=ENTITY::GET_ENTITY_VELOCITY(item.entity);b=Bounds(item.entity,item.low,item.high);}
 file<<"{\"session\":\""<<Escape(session)<<"\",\"id\":"<<item.requestId<<",\"entity\":"<<item.entity<<",\"model\":\""<<Escape(item.model)<<"\",\"phase\":\""<<phase<<"\",\"elapsedMs\":"<<(GetTickCount64()-item.born)<<",\"exists\":"<<(exists?"true":"false")<<",\"visible\":"<<(exists&&ENTITY::IS_ENTITY_VISIBLE(item.entity)?"true":"false")<<",\"progress\":"<<ramp.progress({p.x,p.y,p.z})<<",\"height\":"<<HeightAboveRamp(ramp,{p.x,p.y,p.z})<<",\"side\":"<<(p.x-ramp.origin.x)<<",\"bodyMinHeight\":"<<b.minHeight<<",\"bodyMaxHeight\":"<<b.maxHeight<<",\"bodyMinProgress\":"<<b.minProgress<<",\"bodyMaxProgress\":"<<b.maxProgress<<",\"downhillSpeed\":"<<DownhillSpeed(ramp,{v.x,v.y,v.z})<<",\"observedSpeed\":"<<item.observedSpeed<<",\"downhillTravel\":"<<item.maxDownhill<<",\"onRampTravel\":"<<item.onRampTravel<<",\"spawnProgress\":"<<item.spawnProgress<<",\"activeObstacles\":"<<obstacles.size()<<",\"playerProgress\":"<<ramp.progress({player.x,player.y,player.z})<<",\"playerDead\":"<<(ENTITY::IS_ENTITY_DEAD(PLAYER::PLAYER_PED_ID())?"true":"false")<<",\"frameMs\":"<<(GAMEPLAY::GET_FRAME_TIME()*1000)<<"}"<<std::endl;
}
bool TrackObstacle(Entity entity){
 if(!entity||!ENTITY::DOES_ENTITY_EXIST(entity)||obstacles.size()>=kObstacleCapacity)return false;
 ENTITY::SET_ENTITY_AS_MISSION_ENTITY(entity,TRUE,TRUE);Obstacle item;item.entity=entity;item.expires=GetTickCount64()+45000;obstacles.push_back(item);return true;
}
static void Wake(Entity entity){ENTITY::SET_ENTITY_DYNAMIC(entity,TRUE);ENTITY::FREEZE_ENTITY_POSITION(entity,FALSE);ENTITY::SET_ENTITY_HAS_GRAVITY(entity,TRUE);ENTITY::SET_ENTITY_COLLISION(entity,TRUE,TRUE);ENTITY::SET_ENTITY_LOAD_COLLISION_FLAG(entity,TRUE);ENTITY::SET_ENTITY_LOD_DIST(entity,2000);ENTITY::SET_ENTITY_ALWAYS_PRERENDER(entity,TRUE);invoke<Void>(0x710311ADF0E20730,entity);}
struct PreparedModel {Hash hash;Vector3 low,high;bool rigid;};
struct StagedObstacle {Entity entity;ObstacleModel model;PreparedModel dimensions;float side=0,progress=0;};
Result SpawnObstacleBatch(const Request& request,const std::vector<ObstacleModel>& choices){
 if(choices.empty()||choices.size()>100)return {3,"Choisissez entre 1 et 100 obstacles."};
 if(!CanStageWave(obstacles.size(),choices.size()))return {3,"La rampe contient trop d'obstacles. Attendez leur chute ou utilisez Rampe nettoyee."};
 const ULONGLONG started=GetTickCount64();std::unordered_map<std::string,PreparedModel> prepared;
 for(const auto& choice:choices){if(prepared.count(choice.name))continue;Hash hash=HashOf(choice.name);if(!STREAMING::IS_MODEL_IN_CDIMAGE(hash)||!STREAMING::IS_MODEL_VALID(hash)||choice.vehicle&&!STREAMING::IS_MODEL_A_VEHICLE(hash)){for(const auto& pair:prepared)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(pair.second.hash);return {3,"Ce modele n'est pas chargeable dans cette edition GTA : "+choice.name};}STREAMING::REQUEST_MODEL(hash);prepared.emplace(choice.name,PreparedModel{hash,{},{},false});}
 const ULONGLONG deadline=GetTickCount64()+15000;bool loaded=false;
 do{loaded=true;for(const auto& pair:prepared)if(!STREAMING::HAS_MODEL_LOADED(pair.second.hash)){loaded=false;STREAMING::REQUEST_MODEL(pair.second.hash);}if(!loaded){TickObstacles(GetTickCount64());WAIT(0);}}while(!loaded&&GetTickCount64()<deadline);
 if(!loaded){for(const auto& pair:prepared)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(pair.second.hash);return {3,"Les modeles n'ont pas tous charge. Reessayez avec une vague plus petite."};}
 for(auto& pair:prepared){auto& m=pair.second;STREAMING::REQUEST_COLLISION_FOR_MODEL(m.hash);GAMEPLAY::GET_MODEL_DIMENSIONS(m.hash,&m.low,&m.high);m.rigid=VEHICLE::IS_THIS_MODEL_A_TRAIN(m.hash)||pair.first=="cablecar"||pair.first=="freighttrailer"||m.low.z<-3.0f;}
 std::vector<StagedObstacle> staged;bool failed=false;
 for(size_t i=0;i<choices.size();i++){
  const auto& choice=choices[i];const auto& m=prepared.at(choice.name);float progress=ObstacleSpawnProgress(ramp.length,0,static_cast<int>(i));Point p=ramp.at(0,progress,80);
  Entity entity=choice.vehicle&&!m.rigid?VEHICLE::CREATE_VEHICLE(m.hash,p.x,p.y,p.z,180,FALSE,FALSE):OBJECT::CREATE_OBJECT_NO_OFFSET(m.hash,p.x,p.y,p.z,FALSE,FALSE,FALSE);
  if(!entity||!ENTITY::DOES_ENTITY_EXIST(entity)||ENTITY::GET_ENTITY_MODEL(entity)!=m.hash){if(entity&&ENTITY::DOES_ENTITY_EXIST(entity))ENTITY::DELETE_ENTITY(&entity);failed=true;break;}
  ENTITY::SET_ENTITY_AS_MISSION_ENTITY(entity,TRUE,TRUE);ENTITY::FREEZE_ENTITY_POSITION(entity,TRUE);ENTITY::SET_ENTITY_COLLISION(entity,FALSE,TRUE);ENTITY::SET_ENTITY_VISIBLE(entity,FALSE,FALSE);
  float roll=choice.name=="prop_log_01"?90.0f:choice.vehicle?random.range(m.rigid?-2.0f:-8.0f,m.rigid?2.0f:8.0f):0;
  float yaw=choice.vehicle?180.0f+random.range(-5.0f,5.0f):0;
  ENTITY::SET_ENTITY_ROTATION(entity,choice.vehicle?-ramp.angle:ramp.angle,roll,yaw,2,TRUE);staged.push_back({entity,choice,m,0,progress});
 }
 // Let GTA apply every model's transform before measuring its rotated bounds.
 TickObstacles(GetTickCount64());WAIT(0);
 float cursor=-width*0.4f,layer=0,layerHeight=0;
 for(auto& entry:staged){
  auto b=Bounds(entry.entity,entry.dimensions.low,entry.dimensions.high);Vector3 origin=ENTITY::GET_ENTITY_COORDS(entry.entity,TRUE);float relativeLow=b.minHeight-HeightAboveRamp(ramp,{origin.x,origin.y,origin.z});
  float halfWidth=std::max(std::abs(b.minSide),std::abs(b.maxSide)),bodyWidth=halfWidth*2,bodyHeight=std::max(1.0f,b.maxHeight-b.minHeight);
  if(choices.size()==1){float room=std::max(0.0f,width*0.42f-halfWidth);entry.side=random.range(-room,room);}
  else if(bodyWidth>width*0.8f){if(layerHeight>0){layer+=layerHeight+1.0f;layerHeight=0;}entry.side=0;}
  else{if(cursor+bodyWidth>width*0.4f){layer+=layerHeight+1.0f;layerHeight=0;cursor=-width*0.4f;}entry.side=cursor+halfWidth;cursor+=bodyWidth+0.7f;}
  Point p=ramp.at(entry.side,entry.progress,0.8f-relativeLow+layer);ENTITY::SET_ENTITY_COORDS_NO_OFFSET(entry.entity,p.x,p.y,p.z,FALSE,FALSE,TRUE);
  layerHeight=std::max(layerHeight,bodyHeight);if(bodyWidth>width*0.8f){layer+=layerHeight+1.0f;layerHeight=0;cursor=-width*0.4f;}
 }
 TickObstacles(GetTickCount64());WAIT(0);
 if(failed){for(auto& entry:staged)ENTITY::DELETE_ENTITY(&entry.entity);for(const auto& pair:prepared)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(pair.second.hash);return {3,"GTA n'a pas pu creer toute la vague ; aucun obstacle partiel n'a ete conserve."};}
 const size_t before=obstacles.size();
 for(auto& entry:staged){
  Entity entity=entry.entity;const bool vehicle=entry.model.vehicle&&!entry.dimensions.rigid;
  if(!vehicle){OBJECT::SET_ACTIVATE_OBJECT_PHYSICS_AS_SOON_AS_IT_IS_UNFROZEN(entity,TRUE);OBJECT::SET_OBJECT_PHYSICS_PARAMS(entity,entry.dimensions.rigid?3000.0f:entry.model.name=="prop_log_01"?350.0f:100.0f,1,0.02f,0,0,0.02f,0,0,0.01f,30,0);}
  ENTITY::SET_ENTITY_VISIBLE(entity,TRUE,FALSE);Wake(entity);if(vehicle){VEHICLE::SET_VEHICLE_HANDBRAKE(entity,FALSE);VEHICLE::SET_VEHICLE_ENGINE_ON(entity,FALSE,TRUE,FALSE);}
  Point velocity=DownhillVector(ramp,entry.dimensions.rigid?18.0f:random.range(12.0f,16.0f));velocity.x=random.range(-1.5f,1.5f);ENTITY::SET_ENTITY_VELOCITY(entity,velocity.x,velocity.y,velocity.z);
  Obstacle item;item.entity=entity;item.sliding=true;item.vehicle=vehicle;item.model=entry.model.name;item.born=GetTickCount64();item.nextSample=item.born+2000;item.lastUpdate=item.born;item.positionCheck=item.born;item.spawnProgress=entry.progress;item.lastProgress=entry.progress;item.checkedProgress=entry.progress;item.audit=request.audit>0;item.requestId=request.id;item.low=entry.dimensions.low;item.high=entry.dimensions.high;item.bounds=Bounds(entity,item.low,item.high);item.nextBounds=item.born+250;obstacles.push_back(item);AuditObstacle(obstacles.back(),"spawn");
 }
 for(const auto& pair:prepared)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(pair.second.hash);
 if(request.audit){auto file=AuditFile();size_t visible=0,exists=0;for(const auto& item:obstacles){if(ENTITY::DOES_ENTITY_EXIST(item.entity)){exists++;if(ENTITY::IS_ENTITY_VISIBLE(item.entity))visible++;}}if(file)file<<"{\"session\":\""<<Escape(session)<<"\",\"phase\":\"batch-release\",\"id\":"<<request.id<<",\"created\":"<<staged.size()<<",\"activeBefore\":"<<before<<",\"activeAfter\":"<<obstacles.size()<<",\"existingEntities\":"<<exists<<",\"visibleEntities\":"<<visible<<",\"preparationMs\":"<<(GetTickCount64()-started)<<"}"<<std::endl;}
 return {0,std::to_string(staged.size())+" obstacle(s) lances depuis l'arrivee, collisions actives jusqu'a leur chute."};
}
Result SpawnObstacle(const Request& request,const std::string& name,bool vehicle){return SpawnObstacleBatch(request,std::vector<ObstacleModel>(request.quantity,{name,vehicle}));}
Result SpawnRandomObstacles(const Request& request){std::vector<ObstacleModel> choices;for(int i=0;i<request.quantity;i++){size_t index=random.next(kVehicleModels.size()+2);choices.push_back(index<kVehicleModels.size()?ObstacleModel{kVehicleModels[index],true}:ObstacleModel{index==kVehicleModels.size()?"prop_log_01":"prop_barrel_02a",false});}return SpawnObstacleBatch(request,choices);}
void TickObstacles(ULONGLONG now){
 for(auto it=obstacles.begin();it!=obstacles.end();){
  auto& item=*it;Entity entity=item.entity;bool exists=ENTITY::DOES_ENTITY_EXIST(entity)!=FALSE;
  if(!exists||!item.sliding&&now>=item.expires){AuditObstacle(item,exists?"companion-expired":"missing");if(exists)ENTITY::DELETE_ENTITY(&entity);it=obstacles.erase(it);continue;}
  if(item.sliding){
   Vector3 p=ENTITY::GET_ENTITY_COORDS(entity,TRUE),v=ENTITY::GET_ENTITY_VELOCITY(entity);float progress=ramp.progress({p.x,p.y,p.z}),speed=DownhillSpeed(ramp,{v.x,v.y,v.z});
   float dt=(now-item.lastUpdate)*0.001f;if(dt>0&&dt<1)item.observedSpeed=(item.lastProgress-progress)/dt;item.lastUpdate=now;
   if(now>=item.nextBounds){item.bounds=Bounds(entity,item.low,item.high);item.nextBounds=now+250;}
   bool onRamp=TouchesRamp(item.bounds,ramp.length,width);item.maxDownhill=std::max(item.maxDownhill,item.spawnProgress-progress);if(onRamp)item.onRampTravel=std::max(item.onRampTravel,item.spawnProgress-progress);
   if(HasFallenFromRamp(item.bounds)){if(!item.fallenAt){item.fallenAt=now;AuditObstacle(item,"left-ramp");}if(CanRemoveFallen(item.bounds,now,item.fallenAt)){item.bounds=Bounds(entity,item.low,item.high);if(CanRemoveFallen(item.bounds,now,item.fallenAt)){AuditObstacle(item,"fallen-cleanup");ENTITY::DELETE_ENTITY(&entity);it=obstacles.erase(it);continue;}item.fallenAt=0;}}
   else item.fallenAt=0;
   if(onRamp){
    if(speed<18){Point force=DownhillVector(ramp,6.0f);ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(entity,0,force.x,force.y,force.z,0,FALSE,TRUE,FALSE);}
    if(item.vehicle)VEHICLE::SET_VEHICLE_HANDBRAKE(entity,FALSE);
    if(speed<8&&now-item.lastDrive>=200){Point boost=DownhillVector(ramp,12-speed);ENTITY::SET_ENTITY_VELOCITY(entity,v.x+boost.x,v.y+boost.y,v.z+boost.z);item.lastDrive=now;}
    if(now-item.positionCheck>=1000){bool stopped=item.checkedProgress-progress<0.5f;item.positionCheck=now;item.checkedProgress=progress;if(stopped&&now-item.lastNudge>1500){Wake(entity);Point impulse=DownhillVector(ramp,3.0f);impulse.x=(p.x>ramp.origin.x?-1.0f:1.0f);impulse.y-=0.5f*std::sin(ramp.radians());impulse.z+=0.5f*std::cos(ramp.radians());ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(entity,1,impulse.x,impulse.y,impulse.z,0,FALSE,TRUE,FALSE);item.lastNudge=now;}}
   }
   if(item.audit&&now>=item.nextSample){AuditObstacle(item,"sample");item.nextSample=now+2000;}item.lastProgress=progress;
  }
  ++it;
 }
}
} }
