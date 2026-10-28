#pragma once
#include <algorithm>
#include <numeric>
#include <random>
#include <vector>
namespace ShenPulse { namespace Koth {
class ObstacleShuffleBag {
 std::mt19937 engine;std::vector<size_t> bag;size_t previous=static_cast<size_t>(-1);
 public:explicit ObstacleShuffleBag(unsigned int seed):engine(seed){}
 size_t next(size_t count){if(bag.empty()){bag.resize(count);std::iota(bag.begin(),bag.end(),0);std::shuffle(bag.begin(),bag.end(),engine);if(count>1&&bag.back()==previous)std::swap(bag.front(),bag.back());}size_t value=bag.back();bag.pop_back();previous=value;return value;}
 float range(float minimum,float maximum){return std::uniform_real_distribution<float>(minimum,maximum)(engine);}
};
} }
