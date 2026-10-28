#include "runtime.h"
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
 ramp.clamp();sections=std::max(5,std::min(95,sections));design=std::max(0,std::min(4,design));
 const char* names[]={"prop_container_01a","prop_container_01b","prop_container_01c","prop_container_01d","prop_container_01e"};Hash models[5];Vector3 lows[5]{},highs[5]{};
 for(int i=0;i<5;i++){models[i]=HashOf(names[i]);if(!Load(models[i])){for(int j=0;j<i;j++)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(models[j]);return {3,"Un modele de conteneur est indisponible."};}GAMEPLAY::GET_MODEL_DIMENSIONS(models[i],&lows[i],&highs[i]);}
 const float cellLength=highs[0].y-lows[0].y-0.08f,cellWidth=highs[0].x-lows[0].x-0.03f;
 if(cellLength<2||cellLength>20||cellWidth<1||cellWidth>6)return {3,"Dimensions des conteneurs invalides."};
 Ramp previous=ramp;float previousWidth=width;ramp.length=sections*cellLength;width=cellWidth*7;
 std::vector<RampTile> prepared;std::vector<Object> objects;bool failed=false;
 for(int row=0;row<sections&&!failed;row++)for(int col=-4;col<=4;col++){
  int variant=design==0?(row*7+col+4)%5:design==1?((row+col+4)%2?1:4):design==2?((row+col+4)%2?0:3):design==3?0:3;
  const float roll=col==-4?35.0f:col==4?-35.0f:0.0f;
  RampTile tile{0,col*cellWidth, row*cellLength+cellLength*0.5f,-highs[variant].z+(roll?1.8f:0),roll};Point p=ramp.at(tile.side,tile.distance,tile.height);
  tile.entity=OBJECT::CREATE_OBJECT_NO_OFFSET(models[variant],p.x,p.y,p.z,FALSE,FALSE,FALSE);
  if(!tile.entity||!ENTITY::DOES_ENTITY_EXIST(tile.entity)){failed=true;break;}
  ENTITY::SET_ENTITY_AS_MISSION_ENTITY(tile.entity,TRUE,TRUE);ENTITY::FREEZE_ENTITY_POSITION(tile.entity,TRUE);Place(tile);
  for(int corner=0;corner<4;corner++){float x=(corner==0||corner==3)?lows[variant].x:highs[variant].x;float y=corner<2?lows[variant].y:highs[variant].y;Vector3 v=ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(tile.entity,x,y,highs[variant].z+0.015f);tile.roof[corner]={v.x,v.y,v.z};}
  objects.push_back(tile.entity);prepared.push_back(tile);
 }
 // A short inclined container at the start: the downhill face provides cover,
 // while the uphill roof meets the floor. It is part of the same ramp cleanup.
 if(!failed){
  const float coverPitch=15.0f,halfLength=std::max(std::abs(lows[0].y),std::abs(highs[0].y));
  const float centre=std::max(halfLength+2.0f,12.0f);
  Point position=ramp.at(0,centre,CoverCentreHeight(halfLength,highs[0].z,coverPitch));
  Object cover=OBJECT::CREATE_OBJECT_NO_OFFSET(models[0],position.x,position.y,position.z,FALSE,FALSE,FALSE);
  if(!cover||!ENTITY::DOES_ENTITY_EXIST(cover))failed=true;
  else{ENTITY::SET_ENTITY_AS_MISSION_ENTITY(cover,TRUE,TRUE);ENTITY::FREEZE_ENTITY_POSITION(cover,TRUE);ENTITY::SET_ENTITY_ROTATION(cover,ramp.angle-coverPitch,0,0,2,TRUE);ENTITY::SET_ENTITY_COORDS_NO_OFFSET(cover,position.x,position.y,position.z,FALSE,FALSE,TRUE);objects.push_back(cover);}
 }
 for(auto model:models)STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
 if(failed){for(auto e:objects)ENTITY::DELETE_ENTITY(&e);ramp=previous;width=previousWidth;return {3,"GTA n'a pas pu creer toute la rampe."};}
 EndJail();ClearObstacles();ClearRamp();tiles.swap(objects);rampTiles.swap(prepared);active=true;won=false;wasDead=false;restartAt=0;StartRound(GetTickCount64(),true);SaveSettings();
 return {0,"Rampe creee : "+std::to_string(sections)+" sections, "+DesignName(design)+"."};
}
} }
