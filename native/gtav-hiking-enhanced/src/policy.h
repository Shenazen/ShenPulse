#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>
namespace ShenPulse { namespace Hiking {
struct Point {float x,y,z;};
inline float Distance(Point a,Point b){float x=a.x-b.x,y=a.y-b.y,z=a.z-b.z;return std::sqrt(x*x+y*y+z*z);}
inline bool ValidPoint(Point p){return std::isfinite(p.x)&&std::isfinite(p.y)&&std::isfinite(p.z)&&std::abs(p.x)<20000&&std::abs(p.y)<20000&&p.z>-300&&p.z<6000;}
struct Progress {
 size_t passed=0;std::uint64_t started=0,deadline=0;bool running=false;int outcome=0;
 void start(std::uint64_t now,std::uint64_t duration){passed=0;started=now;deadline=now+duration;running=true;outcome=0;}
 int tick(std::uint64_t now,bool dead,bool allowed,Point p,const std::vector<Point>& route){
  if(!running)return 0;
  int result=dead?-1:now>=deadline?-2:0;
  if(!result&&allowed&&passed<route.size()&&Distance(p,route[passed])<=7.0f){passed++;if(passed==route.size())result=1;}
  if(result){running=false;outcome=result;}return result;
 }
 std::uint64_t remaining(std::uint64_t now)const{return running&&deadline>now?deadline-now:0;}
};
} }
