#pragma once
#include "motion-policy.h"
#include <cstdint>
namespace ShenPulse { namespace Koth {
enum class RoundOutcome { None,Win,Death,Fall,Timeout };
struct RoundClock {
 std::uint64_t started=0,deadline=0,hold=0;RoundOutcome outcome=RoundOutcome::None;bool running=false;
 void start(std::uint64_t now,std::uint64_t duration){started=now;deadline=now+duration;hold=0;outcome=RoundOutcome::None;running=true;}
 void stop(){running=false;hold=0;}
 RoundOutcome observe(std::uint64_t now,bool dead,bool fallen,bool finish){
  if(!running)return RoundOutcome::None;
  RoundOutcome result=RoundOutcome::None;
  if(dead)result=RoundOutcome::Death;else if(fallen)result=RoundOutcome::Fall;
  else {if(!finish)hold=0;else if(!hold)hold=now;
   if(hold&&hold+10000<deadline&&now>=hold+10000)result=RoundOutcome::Win;
   else if(now>=deadline)result=RoundOutcome::Timeout;
  }
  if(result!=RoundOutcome::None){outcome=result;running=false;hold=0;}return result;
 }
 std::uint64_t remaining(std::uint64_t now)const{return running&&deadline>now?deadline-now:0;}
};
enum class RestartAction { Wait,Teleport,Start };
struct RoundRestartGate {
 std::uint64_t settledSince=0,nextTeleport=0;
 void reset(){settledSince=nextTeleport=0;}
 RestartAction observe(std::uint64_t now,bool playable,bool onRamp){
  if(!playable){settledSince=0;return RestartAction::Wait;}
  if(!onRamp){settledSince=0;if(now<nextTeleport)return RestartAction::Wait;nextTeleport=now+500;return RestartAction::Teleport;}
  if(!settledSince)settledSince=now;
  return now-settledSince>=1000?RestartAction::Start:RestartAction::Wait;
 }
};
inline bool PlayerOnRamp(const Ramp& ramp,float width,Point p){const float progress=ramp.progress(p),height=HeightAboveRamp(ramp,p);return progress>=-0.5f&&progress<=ramp.length+1&&std::abs(p.x-ramp.origin.x)<=width*.65f&&height>=-1.5f&&height<=12;}
inline bool PlayerFallenFromRamp(const Ramp& ramp,Point p){return HeightAboveRamp(ramp,p)<-6;}
} }
