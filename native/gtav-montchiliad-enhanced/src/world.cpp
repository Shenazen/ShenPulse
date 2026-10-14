/** Domaine world ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
bool PlayerReady(Player& player, Ped& ped) {
    player = PLAYER::PLAYER_ID();
    ped = PLAYER::PLAYER_PED_ID();
    return ped != 0 && ENTITY::DOES_ENTITY_EXIST(ped) && !ENTITY::IS_ENTITY_DEAD(ped) && PLAYER::IS_PLAYER_CONTROL_ON(player);
}

bool CurrentPlayerVehicle(Ped ped, Vehicle& vehicle) {
    vehicle = 0;
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return false;
    if (!PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) return false;
    vehicle = PED::GET_VEHICLE_PED_IS_IN(ped, FALSE);
    return vehicle && ENTITY::DOES_ENTITY_EXIST(vehicle);
}

Entity PlayerTarget(Ped ped) {
    Vehicle vehicle = 0;
    return CurrentPlayerVehicle(ped, vehicle) ? vehicle : ped;
}

void Teleport(Entity target, const Vector3& p) {
    if (!target || !ENTITY::DOES_ENTITY_EXIST(target)) return;
    STREAMING::REQUEST_COLLISION_AT_COORD(p.x, p.y, p.z);
    ENTITY::SET_ENTITY_COORDS_NO_OFFSET(target, p.x, p.y, p.z, FALSE, FALSE, TRUE);
    ENTITY::SET_ENTITY_VELOCITY(target, 0.0f, 0.0f, 0.0f);
}

void TeleportPlayer(Ped ped, const Vector3& p) {
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return;
    Vehicle vehicle = 0;
    if (CurrentPlayerVehicle(ped, vehicle)) {
        STREAMING::REQUEST_COLLISION_AT_COORD(p.x, p.y, p.z);
        PED::SET_PED_COORDS_KEEP_VEHICLE(ped, p.x, p.y, p.z);
        Teleport(vehicle, p);
        ENTITY::SET_ENTITY_VELOCITY(vehicle, 0.0f, 0.0f, 0.0f);
        ENTITY::SET_ENTITY_VELOCITY(ped, 0.0f, 0.0f, 0.0f);
        WAIT(0);
        PED::SET_PED_INTO_VEHICLE(ped, vehicle, -1);
        return;
    }
    Teleport(ped, p);
}

bool PointInsideVictoryZone(const Vector3& p) {
    float dx = p.x - kVictoryCenter.x, dy = p.y - kVictoryCenter.y;
    return p.z >= kVictoryMinZ
        && p.z <= kVictoryMaxZ
        && dx * dx + dy * dy <= kVictoryRadius * kVictoryRadius;
}

bool PlayerInsideVictoryZone(Ped ped, Vector3& trackedPosition) {
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return false;
    trackedPosition = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    if (PointInsideVictoryZone(trackedPosition)) return true;
    Vehicle vehicle = 0;
    if (CurrentPlayerVehicle(ped, vehicle)) {
        Vector3 vehiclePosition = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        if (PointInsideVictoryZone(vehiclePosition)) {
            trackedPosition = vehiclePosition;
            return true;
        }
    }
    return false;
}

float Distance2D(const Vector3& a, const Vector3& b) {
    float dx = a.x - b.x;
    float dy = a.y - b.y;
    return std::sqrt(dx * dx + dy * dy);
}

Vehicle CurrentVehicle(Ped ped) {
    Vehicle vehicle = 0;
    return CurrentPlayerVehicle(ped, vehicle) ? vehicle : 0;
}

Result RequireVehicle(Ped ped, Vehicle& vehicle) {
    vehicle = CurrentVehicle(ped);
    return vehicle ? Result{0, ""} : Result{3, "Le joueur doit etre dans un vehicule pour cet effet."};
}

Hash HashName(const char* name) {
    return GAMEPLAY::GET_HASH_KEY(const_cast<char*>(name));
}

Hash RandomHash(const Hash* values, size_t count) {
    return values[(GetTickCount64() ^ GetCurrentProcessId()) % count];
}

Result LoadModel(Hash model, const char* label) {
    if (!STREAMING::IS_MODEL_IN_CDIMAGE(model) || !STREAMING::IS_MODEL_VALID(model)) {
        return {5, std::string(label) + " n'est pas disponible dans cette version de GTA V."};
    }
    STREAMING::REQUEST_MODEL(model);
    ULONGLONG deadline = GetTickCount64() + 5000;
    while (!STREAMING::HAS_MODEL_LOADED(model) && GetTickCount64() < deadline) WAIT(0);
    if (!STREAMING::HAS_MODEL_LOADED(model)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, std::string(label) + " n'a pas pu etre charge a temps."};
    }
    return {0, ""};
}

int SpawnAmbientChaosVehicles(Ped playerPed, std::vector<Vehicle>& targets, int requestedCount) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || requestedCount <= 0) return 0;
    const char* modelNames[] = {"blista", "asea", "stanier", "primo", "emperor", "ingot"};
    const float offsets[][2] = {
        {-7.5f, 12.0f}, {7.5f, 13.5f}, {-10.0f, 20.0f}, {10.0f, 21.5f}, {-13.0f, 29.0f}, {13.0f, 30.5f},
    };
    int spawned = 0;
    for (int index = 0; index < requestedCount && index < 6; ++index) {
        Hash model = HashName(modelNames[index % 6]);
        Result loaded = LoadModel(model, "Vehicule de l'effet");
        if (loaded.status != 0) continue;
        Vector3 position = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(playerPed, offsets[index][0], offsets[index][1], 1.0f);
        Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, position.x, position.y, position.z,
            ENTITY::GET_ENTITY_HEADING(playerPed) + 180.0f, FALSE, FALSE);
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) continue;
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
        VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(vehicle);
        VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, TRUE, TRUE, FALSE);
        targets.push_back(vehicle);
        ++spawned;
    }
    return spawned;
}

Result SpawnHostilePeds(Ped playerPed, const Hash* models, size_t modelCount, int requestedCount, const char* label) {
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    int spawned = 0;
    for (int index = 0; index < requestedCount; ++index) {
        Hash model = RandomHash(models, modelCount);
        Result loaded = LoadModel(model, label);
        if (loaded.status != 0) continue;
        float side = (index % 2 == 0 ? 1.0f : -1.0f) * (3.5f + static_cast<float>(index % 3));
        float forward = 8.0f + static_cast<float>(index);
        Vector3 spawn = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(playerPed, side, forward, 0.4f);
        Ped npc = PED::CREATE_PED(4, model, spawn.x, spawn.y, spawn.z, ENTITY::GET_ENTITY_HEADING(playerPed) + 180.0f, FALSE, FALSE);
        if (npc && ENTITY::DOES_ENTITY_EXIST(npc)) {
            ENTITY::SET_ENTITY_AS_MISSION_ENTITY(npc, TRUE, TRUE);
            PED::SET_BLOCKING_OF_NON_TEMPORARY_EVENTS(npc, TRUE);
            PED::SET_PED_AS_ENEMY(npc, TRUE);
            PED::SET_PED_COMBAT_ABILITY(npc, 2);
            PED::SET_PED_COMBAT_MOVEMENT(npc, 2);
            PED::SET_PED_COMBAT_RANGE(npc, 2);
            WEAPON::GIVE_WEAPON_TO_PED(npc, 0x1B06D571, 90, FALSE, TRUE);
            AI::TASK_COMBAT_PED(npc, playerPed, 0, 16);
            ++spawned;
        }
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    }
    if (!spawned) return {5, std::string(label) + " n'a pas pu apparaitre."};
    return {0, std::to_string(spawned) + " " + label + " envoye(s)."};
}
} }
