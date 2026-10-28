#include "runtime.h"
namespace ShenPulse { namespace Koth {
RoundClock roundClock;static RoundRestartGate restartGate;int roundDurationSeconds=900;bool roundAutoRestart=true,rampProtection=false;static ULONGLONG settingsRevision=0,nextRead=0;
static std::wstring RoundSettingsPath(){wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return L"";return std::wstring(local)+L"\\ShenPulse\\GtaMode\\koth-round.ini";}
void ReadRoundSettings(ULONGLONG now){if(now<nextRead)return;nextRead=now+500;auto path=RoundSettingsPath();const int duration=std::max(60,std::min(86400,static_cast<int>(GetPrivateProfileIntW(L"Round",L"durationSeconds",900,path.c_str()))));const bool restart=GetPrivateProfileIntW(L"Round",L"autoRestart",1,path.c_str())!=0;wchar_t value[64];GetPrivateProfileStringW(L"Round",L"revision",L"0",value,64,path.c_str());const ULONGLONG revision=_wcstoui64(value,nullptr,10);bool changed=revision!=settingsRevision||duration!=roundDurationSeconds||restart!=roundAutoRestart;roundDurationSeconds=duration;roundAutoRestart=restart;settingsRevision=revision;if(changed&&active){StartRound(now,false);Log("Round settings: "+std::to_string(duration)+" seconds");}}
void StartRound(ULONGLONG now,bool teleport){restartGate.reset();roundClock.start(now,static_cast<ULONGLONG>(roundDurationSeconds)*1000);won=false;wasDead=false;restartAt=0;finishSince=0;roundId++;if(teleport)Teleport(false);lastState=0;}
void StopRound(){restartGate.reset();roundClock.stop();finishSince=0;}
const char* RoundStatus(){if(roundClock.running)return "running";if(roundClock.outcome==RoundOutcome::Win)return "won";if(roundClock.outcome==RoundOutcome::Timeout)return "timeout";if(roundClock.outcome!=RoundOutcome::None)return "lost";return "stopped";}
void ReleaseRampProtection(){if(!rampProtection)return;Player player=PLAYER::PLAYER_ID();invoke<Void>(0x6BC97F4F4BB3C04B,player,FALSE);PLAYER::SET_PLAYER_INVINCIBLE(player,FALSE);rampProtection=false;}
void UpdateRampProtection(Ped ped,Point p){bool protect=active&&PlayerOnRamp(ramp,width,p);if(protect){if(!rampProtection){rampProtection=true;PLAYER::SET_PLAYER_INVINCIBLE(PLAYER::PLAYER_ID(),FALSE);invoke<Void>(0x6BC97F4F4BB3C04B,PLAYER::PLAYER_ID(),TRUE);PED::SET_PED_CAN_RAGDOLL(ped,TRUE);}}else ReleaseRampProtection();}
void TickRound(ULONGLONG now,Ped ped,bool dead,Point p,bool paused){
 if(!active)return;const bool fallen=PlayerFallenFromRamp(ramp,p);
 if(!roundClock.running){
  if(restartAt&&now>=restartAt){
   const bool playable=!paused&&!dead&&PLAYER::IS_PLAYER_CONTROL_ON(PLAYER::PLAYER_ID())&&CAM::IS_SCREEN_FADED_IN()&&!STREAMING::IS_PLAYER_SWITCH_IN_PROGRESS()&&!PED::IS_PED_RAGDOLL(ped);
   const auto action=restartGate.observe(now,playable,PlayerOnRamp(ramp,width,p)&&ramp.progress(p)<8);
   if(action==RestartAction::Teleport)Teleport(false);
   else if(action==RestartAction::Start){restartAt=0;restartGate.reset();if(roundAutoRestart)StartRound(now,false);}
  }
  return;
 }
 const auto outcome=roundClock.observe(now,dead,fallen,!paused&&ramp.atFinish(p,width));finishSince=roundClock.hold;
 if(outcome==RoundOutcome::None)return;
 restartGate.reset();won=outcome==RoundOutcome::Win;wasDead=dead;restartAt=now+(won?5000:3000);
 const char* name=won?"win":outcome==RoundOutcome::Timeout?"timeout":outcome==RoundOutcome::Fall?"fall":"death";
 Register(won?1:-1,name);Log(std::string("Round outcome ")+name+" round="+std::to_string(roundId));
 }
} }
