#include "runtime.h"
namespace ShenPulse { namespace Koth {
void EndJail(){if(frozen&&ENTITY::DOES_ENTITY_EXIST(frozen))ENTITY::FREEZE_ENTITY_POSITION(frozen,FALSE);frozen=0;freezeUntil=0;jailUntil=0;for(auto entity:jail)if(ENTITY::DOES_ENTITY_EXIST(entity))ENTITY::DELETE_ENTITY(&entity);jail.clear();}
Result StartJail(const Request& request){
 Ped ped;if(!Ready(ped))return {3,"Chargez une partie jouable."};EndJail();Hash model=HashOf("prop_fnclink_03e");if(!Load(model))return {3,"Le modele des barreaux est indisponible."};
 Vector3 pos=ENTITY::GET_ENTITY_COORDS(ped,TRUE);const float offsets[4][3]={{0,2.8f,0},{0,-2.8f,180},{2.8f,0,90},{-2.8f,0,270}};
 for(const auto& o:offsets){Object panel=OBJECT::CREATE_OBJECT_NO_OFFSET(model,pos.x+o[0],pos.y+o[1],pos.z-1.0f,FALSE,FALSE,FALSE);if(panel&&ENTITY::DOES_ENTITY_EXIST(panel)){ENTITY::SET_ENTITY_AS_MISSION_ENTITY(panel,TRUE,TRUE);ENTITY::SET_ENTITY_HEADING(panel,o[2]);ENTITY::FREEZE_ENTITY_POSITION(panel,TRUE);jail.push_back(panel);}}
 STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);if(jail.size()!=4){EndJail();return {3,"La prison n'a pas pu etre construite."};}
 frozen=PED::IS_PED_IN_ANY_VEHICLE(ped,FALSE)?PED::GET_VEHICLE_PED_IS_IN(ped,FALSE):ped;ENTITY::FREEZE_ENTITY_POSITION(frozen,TRUE);const auto duration=EffectDurationMs(request.duration,5);jailUntil=freezeUntil=GetTickCount64()+duration;
 Publish();return {0,"Prison visible (4 panneaux) pendant "+std::to_string(duration/1000)+" secondes."};
}
} }
