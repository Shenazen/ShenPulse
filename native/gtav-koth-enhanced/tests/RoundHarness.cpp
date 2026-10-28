#include "../src/round-policy.h"
#include <cassert>
#include <iostream>
using namespace ShenPulse::Koth;
int main(){int count=0;auto check=[&](bool b){assert(b);count++;};RoundClock c;
 c.start(1000,60000);check(c.remaining(2000)==59000);check(c.observe(2000,false,false,true)==RoundOutcome::None);check(c.observe(11999,false,false,true)==RoundOutcome::None);check(c.observe(12000,false,false,true)==RoundOutcome::Win);check(c.observe(13000,true,true,false)==RoundOutcome::None);
 c.start(1000,60000);c.observe(50000,false,false,true);check(c.observe(60000,false,false,true)==RoundOutcome::Win);
 c.start(1000,60000);c.observe(51000,false,false,true);check(c.observe(61000,false,false,true)==RoundOutcome::Timeout);
 c.start(1000,60000);c.observe(2000,false,false,true);c.observe(11000,false,false,false);c.observe(12000,false,false,true);check(c.observe(13000,false,false,true)==RoundOutcome::None);check(c.observe(22000,false,false,true)==RoundOutcome::Win);
 for(auto outcome:{RoundOutcome::Death,RoundOutcome::Fall,RoundOutcome::Timeout})for(int i=0;i<100;i++){c.start(1000,60000);check(c.observe(outcome==RoundOutcome::Timeout?61000:2000,outcome==RoundOutcome::Death,outcome==RoundOutcome::Fall,false)==outcome);for(int j=0;j<10;j++)check(c.observe(62000+j,true,true,true)==RoundOutcome::None);}
 c.start(1000,900000);check(c.remaining(1000)==900000);c.stop();check(c.observe(999999,true,true,false)==RoundOutcome::None);
 for(float angle:{5.f,20.f,60.f}){Ramp r;r.angle=angle;r.length=363.61f;check(PlayerOnRamp(r,18,r.at(0,4,1)));check(PlayerOnRamp(r,18,r.at(0,361,1)));check(!PlayerOnRamp(r,18,r.at(15,100,1)));check(!PlayerOnRamp(r,18,r.at(0,100,-6.1f)));check(!PlayerOnRamp(r,18,r.at(0,-5,1)));check(!PlayerFallenFromRamp(r,r.at(0,100,0)));check(PlayerFallenFromRamp(r,r.at(0,100,-6.1f)));}
 RoundRestartGate gate;
 for(int i=0;i<20;i++)check(gate.observe(1000+i*100,false,false)==RestartAction::Wait);
 check(gate.observe(3000,true,false)==RestartAction::Teleport);
 check(gate.observe(3100,true,false)==RestartAction::Wait);
 check(gate.observe(3500,true,false)==RestartAction::Teleport);
 check(gate.observe(3600,true,true)==RestartAction::Wait);
 check(gate.observe(4500,false,true)==RestartAction::Wait);
 check(gate.observe(5000,true,true)==RestartAction::Wait);
 check(gate.observe(5999,true,true)==RestartAction::Wait);
 check(gate.observe(6000,true,true)==RestartAction::Start);
 gate.reset();check(gate.observe(7000,true,true)==RestartAction::Wait);
 check(gate.observe(7500,true,false)==RestartAction::Teleport);
 check(gate.observe(7600,true,true)==RestartAction::Wait);
 check(gate.observe(8600,true,true)==RestartAction::Start);
 std::cout<<"KOTH round outcomes, deadline, dedupe and protection: "<<count<<" assertions passed"<<std::endl;
}
