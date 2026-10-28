#include "../src/geometry.h"
#include "../src/control-policy.h"
#include <cassert>
#include <iostream>
using namespace ShenPulse::Koth;
int main(){
 for(float angle:{10.0f,20.0f,35.0f})for(float length:{100.0f,300.0f,600.0f}){
  Ramp r;r.angle=angle;r.length=length;
  auto p=r.at(0,length-3,1);
  assert(r.atFinish(p,18));
  assert(!r.atFinish(r.at(12,length-3,1),18));
  assert(!r.atFinish(r.at(0,4,1),18));
  assert(!r.atFinish(r.at(0,length-3,20),18));
  assert(std::abs(r.progress(r.at(0,75))-75)<0.001f);
 }
 Ramp r;r.angle=-5;r.length=10000;r.clamp();assert(r.angle==5&&r.length==1200);
 assert(EffectDurationMs(2,20)==2000);assert(EffectDurationMs(0,5)==5000);assert(EffectDurationMs(-1,20)==20000);assert(EffectDurationMs(5000,5)==3600000);assert(EffectDurationMs(60,5)==60000);
 std::cout<<"KOTH geometry and durations: 52 assertions passed"<<std::endl;
}
