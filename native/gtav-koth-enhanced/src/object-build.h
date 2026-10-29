#pragma once
#include <cstddef>
#include <cstdint>
#include <vector>

namespace ShenPulse { namespace Koth {
enum class ObjectBuildFailure { None, Unavailable, NotReady, Deadline };
struct ObjectBuildResult {
 std::vector<int> objects;
 std::size_t completed=0,failedIndex=0;
 unsigned retries=0;
 ObjectBuildFailure failure=ObjectBuildFailure::None;
 bool ok() const {return failure==ObjectBuildFailure::None;}
};

// Give GTA frames to stream models and allocate entities. A failed replacement
// discards only its staged objects, never the live ramp or its obstacles.
template<class Create,class Pause,class Clock,class Ready,class Discard>
ObjectBuildResult StageObjects(std::size_t count,Create create,Pause pause,Clock now,Ready ready,Discard discard,std::uint64_t budgetMs=30000){
 ObjectBuildResult result;result.objects.reserve(count);
 const std::uint64_t started=now();
 for(std::size_t index=0;index<count;index++){
  result.failedIndex=index;const std::uint64_t firstAttempt=now();
  for(;;){
   if(!ready()){result.failure=ObjectBuildFailure::NotReady;break;}
   if(now()-started>=budgetMs){result.failure=ObjectBuildFailure::Deadline;break;}
   const int object=create(index);
   if(object){result.objects.push_back(object);result.completed++;break;}
   if(now()-firstAttempt>=2000){result.failure=ObjectBuildFailure::Unavailable;break;}
   result.retries++;pause(result.completed,count);
  }
  if(!result.ok())break;
  if(result.completed%8==0&&result.completed<count)pause(result.completed,count);
 }
 if(!result.ok()){
  for(auto it=result.objects.rbegin();it!=result.objects.rend();++it)discard(*it);
  result.objects.clear();
 }
 return result;
}
} }
