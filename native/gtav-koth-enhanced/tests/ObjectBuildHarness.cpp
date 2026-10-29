#include "../src/object-build.h"
#include <cassert>
#include <iostream>
#include <set>
using namespace ShenPulse::Koth;
struct Engine {
 std::uint64_t time=0;int inFrame=0,frames=0,next=1000,failAt=-1,transientAt=-1,transientFrames=0,cancelAfter=-1;
 int frameMs=16;std::set<int> staged;std::vector<int> deleted;
 int create(std::size_t index){
  assert(inFrame<8); // The constrained allocator rejects a ninth object in one frame.
  if(static_cast<int>(index)==failAt)return 0;
  if(static_cast<int>(index)==transientAt&&transientFrames>0){transientFrames--;return 0;}
  inFrame++;int id=next++;staged.insert(id);return id;
 }
 ObjectBuildResult build(std::size_t count,std::uint64_t budget=30000){return StageObjects(count,[&](std::size_t i){return create(i);},[&](std::size_t done,std::size_t total){assert(done<=total);inFrame=0;frames++;time+=frameMs;},[&]{return time;},[&]{return cancelAfter<0||frames<cancelAfter;},[&](int id){assert(staged.erase(id)==1);deleted.push_back(id);},budget);}
};
int main(){
 // Minimum, default and maximum ramp, including their starting cover object.
 for(int sections:{5,30,95}){
  Engine e;auto result=e.build(sections*9+1);
  assert(result.ok());assert(result.completed==static_cast<std::size_t>(sections*9+1));assert(e.staged.size()==result.completed);assert(e.deleted.empty());assert(e.frames==static_cast<int>((result.completed-1)/8));
 }
 // Streamed-out models and transient allocation failures at any stage recover.
 for(int index:{0,100,270,855}){
  Engine e;e.transientAt=index;e.transientFrames=3;auto result=e.build(856);
  assert(result.ok());assert(result.retries==3);assert(result.objects.size()==856);assert(e.deleted.empty());
 }
 // A permanent allocator failure cleans up every new entity; no partial ramp survives.
 // This includes a failed cover after the complete floor has been staged.
 for(int index:{0,99,270}){
  Engine e;e.failAt=index;auto result=e.build(271);
  assert(result.failure==ObjectBuildFailure::Unavailable);assert(result.failedIndex==static_cast<std::size_t>(index));assert(result.completed==static_cast<std::size_t>(index));assert(result.objects.empty());assert(e.staged.empty());assert(e.deleted.size()==static_cast<std::size_t>(index));assert(e.time>=2000&&e.time<4000);
  for(std::size_t i=1;i<e.deleted.size();i++)assert(e.deleted[i]<e.deleted[i-1]);
 }
 // Menus/loading/Online cancel without further native creations or leftover objects.
 {Engine e;e.cancelAfter=1;auto result=e.build(271);assert(result.failure==ObjectBuildFailure::NotReady);assert(result.completed==8);assert(e.staged.empty());assert(result.objects.empty());}
 // Very low frame rate cannot leave an unbounded loading loop.
 {Engine e;e.frameMs=5000;auto result=e.build(856);assert(result.failure==ObjectBuildFailure::Deadline);assert(e.time==30000);assert(e.staged.empty());assert(result.completed==48);}
 {Engine e;auto result=e.build(271,0);assert(result.failure==ObjectBuildFailure::Deadline);assert(result.completed==0);assert(e.staged.empty());}
 // Successful staging never invokes cleanup, so an existing ramp can be retained
 // until commit; on failure only handles returned by this staging run are deleted.
 {Engine e;const std::set<int> previous{7,8,9};e.failAt=10;auto result=e.build(271);assert(!result.ok());for(int id:e.deleted)assert(!previous.count(id));}
 std::cout<<"KOTH object creation: 14 scenarios passed (frame budget, streaming recovery, rollback, cancellation, deadline)"<<std::endl;
}
