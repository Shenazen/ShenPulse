#include "runtime.h"
namespace ShenPulse { namespace Hiking {
Progress progress;Point startPoint{};std::vector<Point> route;std::vector<Actor> actors;
std::string eventName;int roundId=0,eventId=0,eventDelta=0,durationSeconds=1200;
bool autoRestart=true,allowDriving=false,showCounter=true,active=false;
ULONGLONG restartAt=0,lastState=0,sprintUntil=0,quakeUntil=0,nextQuake=0;Blip checkpointBlip=0;
static Koth::RoundRestartGate restartGate;static ULONGLONG readAt=0,revision=0;
std::wstring SettingsPath(const wchar_t* name){wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return L"";return std::wstring(local)+L"\\ShenPulse\\GtaMode\\"+name;}
Point Position(Ped ped){Vector3 p=ENTITY::GET_ENTITY_COORDS(ped,TRUE);return {p.x,p.y,p.z};}
bool Ready(Ped& ped){Player player=PLAYER::PLAYER_ID();ped=PLAYER::PLAYER_PED_ID();return ped&&ENTITY::DOES_ENTITY_EXIST(ped)&&!ENTITY::IS_ENTITY_DEAD(ped)&&PLAYER::IS_PLAYER_CONTROL_ON(player)&&!NETWORK::NETWORK_IS_SESSION_ACTIVE()&&!UI::IS_PAUSE_MENU_ACTIVE()&&!STREAMING::IS_PLAYER_SWITCH_IN_PROGRESS()&&CAM::IS_SCREEN_FADED_IN();}
void Teleport(Point p){Vector3 v{};v.x=p.x;v.y=p.y;v.z=p.z+0.8f;MontChiliad::TeleportPlayer(PLAYER::PLAYER_PED_ID(),v);ENTITY::SET_ENTITY_HEADING(PLAYER::PLAYER_PED_ID(),85);lastState=0;}
void Start(ULONGLONG now,bool move){ClearActors();progress.start(now,static_cast<ULONGLONG>(durationSeconds)*1000);restartGate.reset();restartAt=0;roundId++;active=true;if(move)Teleport(startPoint);lastState=0;}
void ReadSettings(ULONGLONG now){if(now<readAt)return;readAt=now+500;auto file=SettingsPath(L"hiking-round.ini");const int seconds=std::max(60,std::min(86400,static_cast<int>(GetPrivateProfileIntW(L"Round",L"durationSeconds",1200,file.c_str()))));const bool restart=GetPrivateProfileIntW(L"Round",L"autoRestart",1,file.c_str())!=0;wchar_t value[64];GetPrivateProfileStringW(L"Round",L"revision",L"0",value,64,file.c_str());auto rev=_wcstoui64(value,nullptr,10);bool changed=rev!=revision||seconds!=durationSeconds;durationSeconds=seconds;autoRestart=restart;revision=rev;if(changed&&active&&progress.running){progress.started=now;progress.deadline=now+seconds*1000;}}
void DrawText(const std::string& value,float x,float y,float size,int r,int g,int b){Koth::DrawText(value,x,y,size,r,g,b);}
void Tick(ULONGLONG now){
 ReadSettings(now);MontChiliad::UpdateTimedEffects(now);TickActors(now);
 Ped ped=PLAYER::PLAYER_PED_ID();if(!ped||!ENTITY::DOES_ENTITY_EXIST(ped))return;Point p=Position(ped);const bool dead=ENTITY::IS_ENTITY_DEAD(ped)!=FALSE;Ped readyPed=0;const bool ready=Ready(readyPed);
 if(!active&&ready&&connected)Start(now);
 if(!active)return;
 if(sprintUntil>now)PLAYER::SET_RUN_SPRINT_MULTIPLIER_FOR_PLAYER(PLAYER::PLAYER_ID(),1.49f);else PLAYER::SET_RUN_SPRINT_MULTIPLIER_FOR_PLAYER(PLAYER::PLAYER_ID(),1.0f);
 if(quakeUntil>now){if(!CAM::IS_GAMEPLAY_CAM_SHAKING())CAM::SHAKE_GAMEPLAY_CAM(const_cast<char*>("SMALL_EXPLOSION_SHAKE"),0.65f);if(now>=nextQuake){nextQuake=now+700;ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(ped,1,static_cast<float>(std::sin(now*.01))*2,static_cast<float>(std::cos(now*.01))*2,1.2f,TRUE,TRUE,TRUE,TRUE);}}else if(CAM::IS_GAMEPLAY_CAM_SHAKING())CAM::STOP_GAMEPLAY_CAM_SHAKING(TRUE);
 if(progress.running){auto before=progress.passed;const int outcome=progress.tick(now,dead,ready&&(allowDriving||!PED::IS_PED_IN_ANY_VEHICLE(ped,FALSE)),p,route);if(before!=progress.passed){lastState=0;if(checkpointBlip)UI::REMOVE_BLIP(&checkpointBlip);}if(outcome){ClearActors();eventId++;eventDelta=outcome==1?1:-1;eventName=outcome==1?"win":outcome==-2?"timeout":"death";restartAt=now+(outcome==1?5000:3000);restartGate.reset();Log("Round outcome "+eventName+" round="+std::to_string(roundId));lastState=0;}}
 else if(restartAt&&now>=restartAt){auto action=restartGate.observe(now,ready&&!PED::IS_PED_RAGDOLL(ped)&&(!PLAYER::GET_PLAYER_INVINCIBLE(PLAYER::PLAYER_ID())||MontChiliad::g_restoreInvincibility),Distance(p,startPoint)<5);if(action==Koth::RestartAction::Teleport)Teleport(startPoint);else if(action==Koth::RestartAction::Start){restartAt=0;restartGate.reset();if(autoRestart)Start(now,false);}}
 if(now-lastState>=500&&connected){Publish();lastState=now;}
 if(!ready)return;
 if(progress.running&&progress.passed<route.size()){
  Point target=route[progress.passed];if(!checkpointBlip){checkpointBlip=UI::ADD_BLIP_FOR_COORD(target.x,target.y,target.z);UI::SET_BLIP_COLOUR(checkpointBlip,2);UI::SET_BLIP_ROUTE(checkpointBlip,TRUE);}
  GRAPHICS::DRAW_MARKER(1,target.x,target.y,target.z-1,0,0,0,0,0,0,8,8,3,35,235,140,135,FALSE,FALSE,2,FALSE,nullptr,nullptr,FALSE);
  if(!allowDriving&&PED::IS_PED_IN_ANY_VEHICLE(ped,FALSE))DrawText("SORTEZ DU VEHICULE POUR VALIDER LE POINT",.5f,.76f,.4f,255,180,80);
  const float dx=target.x-p.x,dy=target.y-p.y,length=std::max(1.f,std::sqrt(dx*dx+dy*dy));Point arrow{p.x+dx/length*5,p.y+dy/length*5,p.z+1.2f};GRAPHICS::DRAW_MARKER(2,arrow.x,arrow.y,arrow.z,0,0,0,0,0,static_cast<float>(std::atan2(dy,dx)*180/3.14159265)-90,0.65f,0.65f,0.65f,50,255,140,220,FALSE,FALSE,2,FALSE,nullptr,nullptr,FALSE);
 }
 const auto seconds=(progress.remaining(now)+999)/1000;DrawText("TEMPS "+std::to_string(seconds/60)+":"+(seconds%60<10?"0":"")+std::to_string(seconds%60),.5f,.05f,.5f,255,255,255);
 if(showCounter)DrawText("POINTS "+std::to_string(progress.passed)+" / "+std::to_string(route.size()),.5f,.9f,.4f,60,255,180);
 DrawText(progress.running?"SHENPULSE HIKING  |  F10 REGLAGES":progress.outcome==1?"VICTOIRE  +1 WIN":progress.outcome==-2?"TIME OUT  -1 WIN":"DEFAITE  -1 WIN",.5f,.85f,.45f,60,255,200);
}
} }
