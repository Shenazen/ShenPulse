#include "../src/motion-policy.h"
#include "../src/random-obstacles.h"
#include <cassert>
#include <iostream>
#include <set>
using namespace ShenPulse::Koth;
int main(){int checks=0;auto check=[&](bool v){assert(v);++checks;};
 for(float angle:{5.0f,20.0f,35.0f,60.0f})for(float length:{60.0f,363.61f,1151.43f}){
  Ramp r;r.angle=angle;r.length=length;Point velocity=DownhillVector(r,12);check(std::abs(DownhillSpeed(r,velocity)-12)<0.001f);check(std::abs(HeightAboveRamp(r,r.at(4,length-3,12))-12)<0.001f);
  for(float half:{0.5f,5.0f,80.0f})for(int index=0;index<100;index++){float progress=ObstacleSpawnProgress(length,half,index);check(progress>=length-6&&progress<=length+8);check(std::abs(r.progress(r.at(0,progress,200))-progress)<0.001f);}
  ObstacleBounds resting;resting.include(r,r.at(-1,length*.5f,0));resting.include(r,r.at(1,length*.5f+4,2));check(TouchesRamp(resting,length,18));check(!HasFallenFromRamp(resting));check(!CanRemoveFallen(resting,3600000,1));
  ObstacleBounds partlyFallen;partlyFallen.include(r,r.at(0,-10,-30));partlyFallen.include(r,r.at(0,15,0.2f));check(!HasFallenFromRamp(partlyFallen));check(!CanRemoveFallen(partlyFallen,999999,1));
  ObstacleBounds fallen;fallen.include(r,r.at(0,-25,-30));fallen.include(r,r.at(0,-20,-15));check(HasFallenFromRamp(fallen));check(!CanRemoveFallen(fallen,3999,1000));check(CanRemoveFallen(fallen,4000,1000));check(!CanRemoveFallen(fallen,999999,0));
 }
 check(CanStageWave(0,100));check(CanStageWave(156,100));check(!CanStageWave(157,100));check(!CanStageWave(256,1));check(!CanStageWave(0,101));check(!CanStageWave(0,0));
 for(float half:{3.0f,6.0f}){float extra=15*0.0174532925199433f,height=CoverCentreHeight(half,1.5f,15);check(std::abs(height-half*std::sin(extra)+1.5f*std::cos(extra)-0.15f)<0.001f);check(height+half*std::sin(extra)+1.5f*std::cos(extra)>1.6f);}
 ObstacleShuffleBag bag(12345);size_t previous=9999;for(int cycle=0;cycle<4;cycle++){std::set<size_t> chosen;for(int i=0;i<743;i++){size_t value=bag.next(743);check(value<743);check(value!=previous);check(chosen.insert(value).second);previous=value;bag.range(-1,1);}check(chosen.size()==743);}
 std::cout<<"KOTH arrival/lifecycle/random/cover: "<<checks<<" assertions passed"<<std::endl;
}
