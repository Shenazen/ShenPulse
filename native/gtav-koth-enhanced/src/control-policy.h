#pragma once
#include <algorithm>
#include <cstdint>
namespace ShenPulse { namespace Koth {
inline std::uint64_t EffectDurationMs(int requestedSeconds,int defaultSeconds){
 const int value=requestedSeconds>0?requestedSeconds:defaultSeconds;
 return static_cast<std::uint64_t>(std::max(1,std::min(3600,value)))*1000ULL;
}
} }
