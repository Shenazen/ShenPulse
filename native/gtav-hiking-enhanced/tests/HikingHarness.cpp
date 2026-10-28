#include "../src/policy.h"
#include <cassert>
#include <iostream>
using namespace ShenPulse::Hiking;
int main(){int n=0;auto check=[&](bool value){assert(value);n++;};std::vector<Point> route;for(int i=0;i<30;i++)route.push_back({static_cast<float>(i*20),0,5});Progress p;p.start(1000,1200000);check(p.remaining(2000)==1199000);check(p.tick(2000,false,true,route.back(),route)==0);check(p.passed==0);for(int i=0;i<29;i++){check(p.tick(3000+i*1000,false,true,route[i],route)==0);check(p.passed==i+1);}check(p.tick(32000,false,true,route.back(),route)==1);check(p.tick(33000,true,true,route.back(),route)==0);check(p.passed==30);
 for(int i=0;i<100;i++){p.start(1000,60000);check(p.tick(61000,false,true,route[0],route)==-2);check(p.tick(62000,true,true,route[0],route)==0);p.start(1000,60000);check(p.tick(2000,true,true,route[0],route)==-1);check(p.tick(3000,true,true,route[0],route)==0);}
 p.start(1000,60000);check(p.tick(2000,false,false,route[0],route)==0);check(p.passed==0);check(p.tick(3000,false,true,route[0],route)==0);check(p.passed==1);check(!ValidPoint({NAN,1,1}));check(!ValidPoint({1,1,10000}));check(ValidPoint({501,5604,798}));std::cout<<n<<" Hiking route/deadline/death/order assertions passed"<<std::endl;}
