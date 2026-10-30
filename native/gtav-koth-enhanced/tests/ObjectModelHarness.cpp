#include "../src/object-model.h"
#include <cassert>
#include <iostream>
#include <vector>
using ShenPulse::Koth::ResolveSpawnModel;
int main(){
 std::vector<int> loaded,probed;
 auto load=[&](int id){loaded.push_back(id);return true;};
 auto accepts=[&](int id){probed.push_back(id);return id==2;};
 assert(ResolveSpawnModel(1,2,load,accepts)==2);assert((loaded==std::vector<int>{1,2}));assert((probed==std::vector<int>{1,2}));
 loaded.clear();probed.clear();assert(ResolveSpawnModel(2,3,load,accepts)==2);assert((loaded==std::vector<int>{2}));
 loaded.clear();probed.clear();assert(ResolveSpawnModel(1,3,load,accepts)==0);assert((probed==std::vector<int>{1,3}));
 loaded.clear();probed.clear();assert(ResolveSpawnModel(1,1,load,accepts)==0);assert((loaded==std::vector<int>{1}));
 probed.clear();assert(ResolveSpawnModel(1,2,[](int){return false;},accepts)==0);assert(probed.empty());
 std::cout<<"KOTH standalone model selection: 5 scenarios passed\n";
}
