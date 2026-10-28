#pragma once
#include <algorithm>
#include <cmath>
namespace ShenPulse { namespace Koth {
struct Point { float x, y, z; };
struct Ramp {
 float angle=20.0f, length=300.0f;
 Point origin{-1040.0f,-2920.0f,210.0f};
 float radians() const {return angle*0.0174532925199433f;}
 Point at(float side,float distance,float height=0) const {
  float a=radians();return {origin.x+side,origin.y+distance*std::cos(a)-height*std::sin(a),origin.z+distance*std::sin(a)+height*std::cos(a)};
 }
 float progress(Point p) const {return (p.y-origin.y)*std::cos(radians())+(p.z-origin.z)*std::sin(radians());}
 bool atFinish(Point p,float width)const {return progress(p)>=length-6&&progress(p)<=length+8&&std::abs(p.x-origin.x)<width*0.48f&&std::abs((p.z-origin.z)*std::cos(radians())-(p.y-origin.y)*std::sin(radians()))<6;}
 void clamp(){angle=std::max(5.0f,std::min(60.0f,angle));length=std::max(50.0f,std::min(1200.0f,length));}
};
} }
