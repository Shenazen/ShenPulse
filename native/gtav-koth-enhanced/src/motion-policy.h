#pragma once
#include "geometry.h"
#include <cstdint>
#include <cstddef>
namespace ShenPulse { namespace Koth {
constexpr size_t kObstacleCapacity=256;
inline bool CanStageWave(size_t current,size_t requested){return requested>=1&&requested<=100&&current<=kObstacleCapacity&&requested<=kObstacleCapacity-current;}
inline float HeightAboveRamp(const Ramp& r,Point p){return (p.z-r.origin.z)*std::cos(r.radians())-(p.y-r.origin.y)*std::sin(r.radians());}
inline float DownhillSpeed(const Ramp& r,Point v){return -v.y*std::cos(r.radians())-v.z*std::sin(r.radians());}
inline Point DownhillVector(const Ramp& r,float magnitude){return {0,-magnitude*std::cos(r.radians()),-magnitude*std::sin(r.radians())};}
// Every model's centre starts inside the actual victory zone, regardless of size.
inline float ObstacleSpawnProgress(float length,float,int index){return length-2.5f-static_cast<float>(index%3)*0.8f;}
struct ObstacleBounds {
 float minProgress=100000,maxProgress=-100000,minSide=100000,maxSide=-100000,minHeight=100000,maxHeight=-100000;
 void include(const Ramp& r,Point p){float progress=r.progress(p),side=p.x-r.origin.x,height=HeightAboveRamp(r,p);minProgress=std::min(minProgress,progress);maxProgress=std::max(maxProgress,progress);minSide=std::min(minSide,side);maxSide=std::max(maxSide,side);minHeight=std::min(minHeight,height);maxHeight=std::max(maxHeight,height);}
};
inline bool TouchesRamp(const ObstacleBounds& b,float length,float width){return b.maxProgress>-12&&b.minProgress<length+12&&b.minSide<width*0.65f&&b.maxSide>-width*0.65f&&b.maxHeight>-3&&b.minHeight<3.5f;}
// No age limit: a stopped or inverted obstacle must remain on the ramp.
inline bool HasFallenFromRamp(const ObstacleBounds& b){return b.maxHeight<-12;}
inline bool CanRemoveFallen(const ObstacleBounds& b,std::uint64_t now,std::uint64_t fallenAt){return fallenAt&&now>=fallenAt+3000&&HasFallenFromRamp(b);}
inline float CoverCentreHeight(float halfLength,float roofZ,float extraPitch){float a=extraPitch*0.0174532925199433f;return 0.15f+halfLength*std::sin(a)-roofZ*std::cos(a);}
} }
