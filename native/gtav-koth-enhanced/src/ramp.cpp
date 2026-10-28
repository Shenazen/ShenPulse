#include "runtime.h"
namespace ShenPulse { namespace Koth {
Ramp ramp;float width=18.0f;bool active=false,won=false,wasDead=false;
int sections=30;bool animated=false;std::vector<RampTile> rampTiles;
int roundId=0,eventId=0,eventDelta=0,wins=0,deaths=0,design=0;
std::string eventName;
ULONGLONG lastState=0,finishSince=0,restartAt=0,jumpUntil=0,shieldUntil=0,freezeUntil=0,sprintUntil=0,jailUntil=0;
bool restoreInvincible=false,previousInvincible=false,sprintActive=false;Entity frozen=0;
std::vector<Object> tiles,jail;std::vector<Obstacle> obstacles;
Hash HashOf(const std::string& name){return GAMEPLAY::GET_HASH_KEY(const_cast<char*>(name.c_str()));}
bool Ready(Ped& ped){
 Player player=PLAYER::PLAYER_ID();ped=PLAYER::PLAYER_PED_ID();
 return PLAYER::IS_PLAYER_PLAYING(player)&&ped&&ENTITY::DOES_ENTITY_EXIST(ped)&&!ENTITY::IS_ENTITY_DEAD(ped)&&!NETWORK::NETWORK_IS_SESSION_ACTIVE()&&!UI::IS_PAUSE_MENU_ACTIVE()&&!STREAMING::IS_PLAYER_SWITCH_IN_PROGRESS();
}
bool Load(Hash model){
 if(!STREAMING::IS_MODEL_IN_CDIMAGE(model)||!STREAMING::IS_MODEL_VALID(model))return false;
 STREAMING::REQUEST_MODEL(model);ULONGLONG deadline=GetTickCount64()+2500;
 while(!STREAMING::HAS_MODEL_LOADED(model)&&GetTickCount64()<deadline){TickObstacles(GetTickCount64());WAIT(0);}
 return STREAMING::HAS_MODEL_LOADED(model)!=FALSE;
}
static void Delete(Entity entity){
 if(!entity||!ENTITY::DOES_ENTITY_EXIST(entity))return;
 ENTITY::SET_ENTITY_AS_MISSION_ENTITY(entity,TRUE,TRUE);ENTITY::DELETE_ENTITY(&entity);
}
void ClearObstacles(){for(const auto& item:obstacles){AuditObstacle(item,"removed");Delete(item.entity);}obstacles.clear();}
void ClearRamp(){for(auto tile:tiles)Delete(tile);tiles.clear();rampTiles.clear();active=false;StopRound();ReleaseRampProtection();finishSince=0;}
void Teleport(bool finish){
 Ped ped=PLAYER::PLAYER_PED_ID();if(!ped)return;
 Point p=ramp.at(0,finish?ramp.length-3:4,1.5f);
 Vehicle vehicle=PED::GET_VEHICLE_PED_IS_IN(ped,FALSE);Entity target=vehicle?vehicle:ped;
 STREAMING::REQUEST_COLLISION_AT_COORD(p.x,p.y,p.z);
 ENTITY::SET_ENTITY_COORDS_NO_OFFSET(target,p.x,p.y,p.z,FALSE,FALSE,TRUE);
 ENTITY::SET_ENTITY_HEADING(target,0);ENTITY::SET_ENTITY_VELOCITY(target,0,0,0);finishSince=0;
}
void Register(int delta,const char* name){
 eventId++;eventDelta=delta;eventName=name;if(delta>0)wins++;else deaths++;lastState=0;Publish();
}
void Publish(){
 const auto now=GetTickCount64();auto remaining=[now](ULONGLONG end){return end>now?end-now:0ULL;};
 Vector3 playerPosition=ENTITY::GET_ENTITY_COORDS(PLAYER::PLAYER_PED_ID(),TRUE);Point playerPoint{playerPosition.x,playerPosition.y,playerPosition.z};
 std::ostringstream out;
 out<<"{\"type\":\"koth:state\",\"sessionId\":\""<<Escape(session)<<"\",\"counterEventId\":"<<eventId<<",\"counterDelta\":"<<eventDelta<<",\"counterEvent\":\""<<eventName<<"\",\"roundId\":"<<roundId<<",\"active\":"<<(active?"true":"false")<<",\"won\":"<<(won?"true":"false")<<",\"wins\":"<<wins<<",\"deaths\":"<<deaths<<",\"ramp\":{\"angle\":"<<ramp.angle<<",\"length\":"<<ramp.length<<",\"sections\":"<<sections<<",\"design\":"<<design<<",\"designName\":\""<<DesignName(design)<<"\",\"animated\":"<<(animated?"true":"false")<<",\"tiles\":"<<tiles.size()<<",\"obstacles\":"<<obstacles.size()<<"},\"roundStatus\":\""<<RoundStatus()<<"\",\"roundDurationSeconds\":"<<roundDurationSeconds<<",\"roundRemainingMs\":"<<roundClock.remaining(now)<<",\"roundElapsedMs\":"<<(roundClock.running?now-roundClock.started:0)<<",\"roundAutoRestart\":"<<(roundAutoRestart?"true":"false")<<",\"playerProgress\":"<<ramp.progress(playerPoint)<<",\"playerHeight\":"<<HeightAboveRamp(ramp,playerPoint)<<",\"playerSide\":"<<(playerPoint.x-ramp.origin.x)<<",\"playerHealth\":"<<ENTITY::GET_ENTITY_HEALTH(PLAYER::PLAYER_PED_ID())<<",\"playerRagdoll\":"<<(PED::IS_PED_RAGDOLL(PLAYER::PLAYER_PED_ID())?"true":"false")<<",\"rampProtection\":"<<(rampProtection?"true":"false")<<",\"finishRemainingMs\":"<<(finishSince?remaining(finishSince+10000):0)<<",\"jailObjects\":"<<jail.size()<<",\"effectState\":{\"freezeRemainingMs\":"<<remaining(freezeUntil)<<",\"frozen\":"<<(frozen?"true":"false")<<",\"jumpRemainingMs\":"<<remaining(jumpUntil)<<",\"shieldRemainingMs\":"<<remaining(shieldUntil)<<",\"shieldActive\":"<<(restoreInvincible?"true":"false")<<",\"sprintRemainingMs\":"<<remaining(sprintUntil)<<"}}";
 Send(out.str());
}
void DrawText(const std::string& value,float x,float y,float size,int r,int g,int b){
 UI::SET_TEXT_FONT(0);UI::SET_TEXT_SCALE(0,size);UI::SET_TEXT_COLOUR(r,g,b,255);UI::SET_TEXT_CENTRE(TRUE);UI::SET_TEXT_OUTLINE();
 char format[]="STRING";UI::_SET_TEXT_ENTRY(format);UI::_ADD_TEXT_COMPONENT_STRING(const_cast<char*>(value.c_str()));UI::_DRAW_TEXT(x,y);
}
void Tick(ULONGLONG now){
 ReadRoundSettings(now);AnimateRamp(now);
 Ped ped=PLAYER::PLAYER_PED_ID();Player player=PLAYER::PLAYER_ID();
 DrawRampDesign(ped);
 if(now-lastState>1000&&connected){Publish();lastState=now;}
 TickObstacles(now);
 if(jumpUntil>now)GAMEPLAY::SET_SUPER_JUMP_THIS_FRAME(player);
 if(sprintUntil>now)PLAYER::SET_RUN_SPRINT_MULTIPLIER_FOR_PLAYER(player,1.49f);else if(sprintActive){PLAYER::SET_RUN_SPRINT_MULTIPLIER_FOR_PLAYER(player,1.0f);sprintActive=false;}
 if(restoreInvincible&&now>=shieldUntil)restoreInvincible=false;
 if(frozen&&now>=freezeUntil){if(ENTITY::DOES_ENTITY_EXIST(frozen))ENTITY::FREEZE_ENTITY_POSITION(frozen,FALSE);frozen=0;}
 if(jailUntil&&now>=jailUntil)EndJail();
 if(jailUntil>now)DrawText("PRISON  "+std::to_string((jailUntil-now+999)/1000)+" s",0.5f,0.75f,0.50f,255,190,60);
 if(!ped||!ENTITY::DOES_ENTITY_EXIST(ped)){ReleaseRampProtection();return;}
 Vector3 pos=ENTITY::GET_ENTITY_COORDS(ped,TRUE);Point p{pos.x,pos.y,pos.z};UpdateRampProtection(ped,p);
 bool dead=ENTITY::IS_ENTITY_DEAD(ped)!=FALSE,paused=UI::IS_PAUSE_MENU_ACTIVE()!=FALSE;TickRound(now,ped,dead,p,paused);
 if(!active||dead||paused)return;
 const auto remaining=roundClock.remaining(now);const auto seconds=(remaining+999)/1000;
 DrawText("TEMPS  "+std::to_string(seconds/60)+":"+(seconds%60<10?"0":"")+std::to_string(seconds%60),.5f,.81f,.40f,255,255,255);
 if(!roundClock.running){const bool victory=roundClock.outcome==RoundOutcome::Win;DrawText(victory?"VICTOIRE KOTH  +1 WIN":roundClock.outcome==RoundOutcome::Timeout?"TIME OUT  -1 WIN":roundClock.outcome==RoundOutcome::None?"LANCEZ UNE NOUVELLE PARTIE DANS SHENPULSE":"CHUTE / MORT  -1 WIN",.5f,.86f,.55f,victory?46:255,victory?255:100,100);return;}
 Point finish=ramp.at(0,ramp.length-3,0.1f);
 GRAPHICS::DRAW_MARKER(1,finish.x,finish.y,finish.z,0,0,0,0,0,0,width*0.8f,5,1,25,230,135,130,FALSE,FALSE,2,FALSE,nullptr,nullptr,FALSE);
 DrawText(finishSince?"VICTOIRE DANS "+std::to_string((10000-std::min<ULONGLONG>(10000,now-finishSince)+999)/1000)+" s":"SHENPULSE KOTH  -  ATTEIGNEZ LE SOMMET  |  F10 REGLAGES",0.5f,0.86f,0.48f,90,255,210);
 if(active)DrawText(std::to_string(static_cast<int>(std::max(0.0f,std::min(100.0f,ramp.progress(p)/ramp.length*100))))+" %",0.5f,0.92f,0.38f,255,255,255);
}
} }
