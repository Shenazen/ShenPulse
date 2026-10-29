#include "runtime.h"
#include "object-build.h"
namespace ShenPulse { namespace Koth {
static std::wstring SettingsPath(){wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return L"";return std::wstring(local)+L"\\ShenPulse\\GtaMode\\koth-settings.ini";}
const char* DesignName(int id){const char* names[]={"Multicolore","Jaune clair / fonce","Vert clair / fonce","Bleu","Rouge"};return names[std::max(0,std::min(4,id))];}
void LoadSettings(){auto p=SettingsPath();ramp.angle=static_cast<float>(GetPrivateProfileIntW(L"Ramp",L"angle",20,p.c_str()));sections=std::max(5,std::min(95,static_cast<int>(GetPrivateProfileIntW(L"Ramp",L"sections",30,p.c_str()))));design=std::max(0,std::min(4,static_cast<int>(GetPrivateProfileIntW(L"Ramp",L"design",0,p.c_str()))));animated=GetPrivateProfileIntW(L"Ramp",L"animated",0,p.c_str())!=0;ramp.clamp();}
void SaveSettings(){auto p=SettingsPath();WritePrivateProfileStringW(L"Ramp",L"angle",std::to_wstring(static_cast<int>(ramp.angle)).c_str(),p.c_str());WritePrivateProfileStringW(L"Ramp",L"sections",std::to_wstring(sections).c_str(),p.c_str());WritePrivateProfileStringW(L"Ramp",L"design",std::to_wstring(design).c_str(),p.c_str());WritePrivateProfileStringW(L"Ramp",L"animated",animated?L"1":L"0",p.c_str());}
static void Place(const RampTile& t,float lift=0){Point p=ramp.at(t.side,t.distance,t.height+lift);ENTITY::SET_ENTITY_COORDS_NO_OFFSET(t.entity,p.x,p.y,p.z,FALSE,FALSE,TRUE);ENTITY::SET_ENTITY_ROTATION(t.entity,ramp.angle,t.roll,0,2,TRUE);}
// Native container textures do not reliably match the theme names. Keep their
// collisions and relief, then paint the exact roof faces with the selected palette.
void DrawRampDesign(Ped ped){
 if(!active||design==0||!ped)return;Vector3 player=ENTITY::GET_ENTITY_COORDS(ped,TRUE);
 for(size_t index=0;index<rampTiles.size();index++){
  const auto& t=rampTiles[index];float dx=t.roof[0].x-player.x,dy=t.roof[0].y-player.y,dz=t.roof[0].z-player.z;if(dx*dx+dy*dy+dz*dz>900.0f*900.0f)continue;
  bool light=((index/9+index%9)%2)==0;int r=0,g=0,b=0;
  if(design==1){r=light?247:155;g=light?207:116;b=light?57:24;}
  else if(design==2){r=light?79:24;g=light?173:82;b=light?69:38;}
  else if(design==3){r=34;g=96;b=194;}else{r=187;g=38;b=45;}
  auto triangle=[&](int a,int c,int d){const auto& p=t.roof[a];const auto& q=t.roof[c];const auto& v=t.roof[d];GRAPHICS::DRAW_POLY(p.x,p.y,p.z+t.lift,q.x,q.y,q.z+t.lift,v.x,v.y,v.z+t.lift,r,g,b,255);};
  triangle(0,1,2);triangle(0,2,3);
 }
}
void AnimateRamp(ULONGLONG now){static ULONGLONG next=0;if(!active||!animated||now<next)return;next=now+150;for(auto& t:rampTiles){t.lift=0.25f*std::sin(static_cast<float>(now%20000)*0.001f+t.distance*0.03f);Place(t,t.lift);}}
Result Build(){
 Ped ped;if(!Ready(ped))return {3,"Chargez une partie jouable, hors menus."};
 const auto started=GetTickCount64();
 ramp.clamp();sections=std::max(5,std::min(95,sections));design=std::max(0,std::min(4,design));
 const char* names[]={"prop_container_01a","prop_container_01b","prop_container_01c","prop_container_01d","prop_container_01e"};Hash models[5]{};Vector3 lows[5]{},highs[5]{};
 // Release model requests on every exit, including failed dimensions/loading.
 struct ModelRequests {Hash* models;int requested=0;~ModelRequests(){for(int i=0;i<requested;i++)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(models[i]);}} loaded{models};
 Log("Ramp build 1.0.10 started sections="+std::to_string(sections)+" design="+std::to_string(design)+" previous="+std::to_string(tiles.size())+" gameVersion="+std::to_string(static_cast<int>(getGameVersion())));
 for(int i=0;i<5;i++){
  models[i]=HashOf(names[i]);loaded.requested++;
  if(!Load(models[i])){Log(std::string("Ramp build model unavailable: ")+names[i]);return {3,"Un modele de conteneur est indisponible : "+std::string(names[i])+"."};}
  GAMEPLAY::GET_MODEL_DIMENSIONS(models[i],&lows[i],&highs[i]);
 }
 const float cellLength=highs[0].y-lows[0].y-0.08f,cellWidth=highs[0].x-lows[0].x-0.03f;
 if(cellLength<2||cellLength>20||cellWidth<1||cellWidth>6){Log("Ramp build invalid container dimensions");return {3,"Dimensions des conteneurs invalides."};}
 // Stage geometry separately: yields must not change the live ramp's coordinates.
 Ramp nextRamp=ramp;nextRamp.length=sections*cellLength;
 const std::size_t floorCount=static_cast<std::size_t>(sections)*9,total=floorCount+1;
 std::vector<RampTile> prepared;prepared.reserve(floorCount);
 int lastVariant=0;Point lastPosition{};
 const auto loadElapsed=GetTickCount64()-started;const auto budget=loadElapsed<25000?25000-loadElapsed:0;
 auto stage=StageObjects(total,[&](std::size_t index)->int{
  const bool cover=index==floorCount;
  const int row=static_cast<int>(index/9),col=static_cast<int>(index%9)-4;
  int variant=cover?0:design==0?(row*7+col+4)%5:design==1?((row+col+4)%2?1:4):design==2?((row+col+4)%2?0:3):design==3?0:3;
  lastVariant=variant;
  // A model can be evicted while loading another one on a constrained machine.
  // Re-request it before retrying; never issue CREATE_OBJECT for an unloaded model.
  if(!STREAMING::HAS_MODEL_LOADED(models[variant])){STREAMING::REQUEST_MODEL(models[variant]);return 0;}
  const float roll=col==-4?35.0f:col==4?-35.0f:0.0f;
  RampTile tile{0,col*cellWidth,row*cellLength+cellLength*0.5f,-highs[variant].z+(roll?1.8f:0),roll};
  const float coverPitch=15.0f,halfLength=std::max(std::abs(lows[0].y),std::abs(highs[0].y));
  Point position=cover?nextRamp.at(0,std::max(halfLength+2.0f,12.0f),CoverCentreHeight(halfLength,highs[0].z,coverPitch)):nextRamp.at(tile.side,tile.distance,tile.height);
  lastPosition=position;
  Object object=OBJECT::CREATE_OBJECT_NO_OFFSET(models[variant],position.x,position.y,position.z,FALSE,FALSE,FALSE);
  if(!object||!ENTITY::DOES_ENTITY_EXIST(object))return 0;
  ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object,TRUE,TRUE);ENTITY::FREEZE_ENTITY_POSITION(object,TRUE);
  ENTITY::SET_ENTITY_ROTATION(object,cover?nextRamp.angle-coverPitch:nextRamp.angle,cover?0:roll,0,2,TRUE);
  ENTITY::SET_ENTITY_COORDS_NO_OFFSET(object,position.x,position.y,position.z,FALSE,FALSE,TRUE);
  if(!cover){
   tile.entity=object;
   for(int corner=0;corner<4;corner++){float x=(corner==0||corner==3)?lows[variant].x:highs[variant].x;float y=corner<2?lows[variant].y:highs[variant].y;Vector3 v=ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(object,x,y,highs[variant].z+0.015f);tile.roof[corner]={v.x,v.y,v.z};}
   prepared.push_back(tile);
  }
  return object;
 },[&](std::size_t complete,std::size_t count){
  DrawText("CREATION DE LA RAMPE  "+std::to_string(complete)+" / "+std::to_string(count),.5f,.80f,.45f,90,255,210);
  WAIT(0);
 },[]{return GetTickCount64();},[&]{Ped current;return Ready(current);},[](int object){Entity entity=object;ENTITY::DELETE_ENTITY(&entity);},budget);
 if(!stage.ok()){
  std::ostringstream detail;detail<<"Ramp build failed reason="<<static_cast<int>(stage.failure)<<" completed="<<stage.completed<<"/"<<total<<" index="<<stage.failedIndex<<" model="<<names[lastVariant]<<" loaded="<<STREAMING::HAS_MODEL_LOADED(models[lastVariant])<<" position="<<lastPosition.x<<","<<lastPosition.y<<","<<lastPosition.z<<" retries="<<stage.retries<<" elapsedMs="<<GetTickCount64()-started;
  Log(detail.str());
  if(stage.failure==ObjectBuildFailure::NotReady)return {3,"Creation interrompue : reprenez le mode Histoire hors menus, puis reessayez."};
  return {3,"Rampe incomplete ("+std::to_string(stage.completed)+"/"+std::to_string(total)+"). Relancez GTA. Journal : ShenPulseKoth.log."};
 }
 EndJail();ClearObstacles();ClearRamp();ramp=nextRamp;width=cellWidth*7;tiles.swap(stage.objects);rampTiles.swap(prepared);active=true;won=false;wasDead=false;restartAt=0;StartRound(GetTickCount64(),true);SaveSettings();
 Log("Ramp build succeeded objects="+std::to_string(tiles.size())+" retries="+std::to_string(stage.retries)+" elapsedMs="+std::to_string(GetTickCount64()-started));
 return {0,"Rampe creee : "+std::to_string(sections)+" sections, "+DesignName(design)+"."};
}
} }
