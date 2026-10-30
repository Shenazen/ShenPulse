#pragma once
namespace ShenPulse { namespace Koth {
// A streamed archetype can still be unsuitable for creating a standalone prop.
// Test creation, not only HAS_MODEL_LOADED, before using it for every floor tile.
template<class Model,class Load,class Probe>
Model ResolveSpawnModel(Model preferred,Model fallback,Load load,Probe probe){
 if(load(preferred)&&probe(preferred))return preferred;
 if(fallback!=preferred&&load(fallback)&&probe(fallback))return fallback;
 return Model{};
}
} }
