/** Domaine prison ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
void DeletePrisonObjects() {
    for (size_t index = 0; index < g_prisonObjects.size(); ++index) {
        Object object = g_prisonObjects[index];
        if (!object || !ENTITY::DOES_ENTITY_EXIST(object)) continue;
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object, TRUE, TRUE);
        OBJECT::DELETE_OBJECT(&object);
    }
    g_prisonObjects.clear();
}

void EndPrison() {
    if (g_frozenEntity && ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) {
        ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, FALSE);
    }
    if (g_prisonPed && ENTITY::DOES_ENTITY_EXIST(g_prisonPed)) {
        ENTITY::FREEZE_ENTITY_POSITION(g_prisonPed, FALSE);
        PED::SET_PED_CAN_RAGDOLL(g_prisonPed, TRUE);
        AI::CLEAR_PED_TASKS_IMMEDIATELY(g_prisonPed);
    }
    DeletePrisonObjects();
    g_frozenEntity = 0;
    g_frozenUntil = 0;
    g_prisonPed = 0;
    g_prisonUntil = 0;
}

bool TryCreatePrisonPanel(Hash model, const Vector3& center, float x, float y, float heading) {
    Object object = OBJECT::CREATE_OBJECT_NO_OFFSET(model, center.x + x, center.y + y, center.z - 1.05f, FALSE, FALSE, FALSE);
    if (!object || !ENTITY::DOES_ENTITY_EXIST(object)) return false;
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object, TRUE, TRUE);
    OBJECT::PLACE_OBJECT_ON_GROUND_PROPERLY(object);
    ENTITY::SET_ENTITY_HEADING(object, heading);
    ENTITY::FREEZE_ENTITY_POSITION(object, TRUE);
    g_prisonObjects.push_back(object);
    return true;
}

void CreatePrisonCage(const Vector3& center) {
    const char* modelNames[] = {
        "prop_fnclink_03e",
        "prop_fnclink_03c",
        "prop_fnclink_02gate1",
        "prop_const_fence03b_cr",
    };
    Hash model = 0;
    for (size_t index = 0; index < sizeof(modelNames) / sizeof(modelNames[0]); ++index) {
        Hash candidate = HashName(modelNames[index]);
        if (!STREAMING::IS_MODEL_IN_CDIMAGE(candidate) || !STREAMING::IS_MODEL_VALID(candidate)) continue;
        STREAMING::REQUEST_MODEL(candidate);
        ULONGLONG deadline = GetTickCount64() + 2500;
        while (!STREAMING::HAS_MODEL_LOADED(candidate) && GetTickCount64() < deadline) WAIT(0);
        if (STREAMING::HAS_MODEL_LOADED(candidate)) {
            model = candidate;
            break;
        }
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(candidate);
    }
    if (!model) return;

    TryCreatePrisonPanel(model, center, 0.0f, 2.8f, 0.0f);
    TryCreatePrisonPanel(model, center, 0.0f, -2.8f, 180.0f);
    TryCreatePrisonPanel(model, center, 2.8f, 0.0f, 90.0f);
    TryCreatePrisonPanel(model, center, -2.8f, 0.0f, 270.0f);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
}

Result StartPrison(Ped ped) {
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return {kEffectRetryStatus, kGameNotReadyMessage};
    EndPrison();

    Vehicle vehicle = 0;
    Vector3 center = ENTITY::GET_ENTITY_COORDS(PlayerTarget(ped), TRUE);
    if (CurrentPlayerVehicle(ped, vehicle)) {
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 4160);
        ULONGLONG deadline = GetTickCount64() + 1200;
        while (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE) && GetTickCount64() < deadline) WAIT(0);
        if (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) {
            Vector3 exit = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 3.2f, 0.0f, 0.6f);
            Teleport(ped, exit);
            WAIT(0);
        }
        center = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    }

    Vehicle prisonVehicle = 0;
    bool stillInVehicle = CurrentPlayerVehicle(ped, prisonVehicle);
    Entity prisonerTarget = stillInVehicle ? static_cast<Entity>(prisonVehicle) : static_cast<Entity>(ped);
    if (stillInVehicle) {
        center = ENTITY::GET_ENTITY_COORDS(prisonVehicle, TRUE);
    }

    STREAMING::REQUEST_COLLISION_AT_COORD(center.x, center.y, center.z);
    float groundZ = center.z;
    bool foundGround = false;
    ULONGLONG groundDeadline = GetTickCount64() + 1600;
    while (GetTickCount64() < groundDeadline) {
        if (GAMEPLAY::GET_GROUND_Z_FOR_3D_COORD(center.x, center.y, center.z + 30.0f, &groundZ, FALSE)) {
            foundGround = true;
            break;
        }
        WAIT(0);
    }
    center.z = foundGround ? groundZ + (stillInVehicle ? 1.15f : 1.0f) : center.z + (stillInVehicle ? 0.5f : 0.85f);
    Teleport(prisonerTarget, center);
    if (stillInVehicle) {
        VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(prisonVehicle);
        center = ENTITY::GET_ENTITY_COORDS(prisonVehicle, TRUE);
    } else {
        WAIT(0);
        float height = ENTITY::GET_ENTITY_HEIGHT_ABOVE_GROUND(ped);
        if (height < 0.55f) {
            Vector3 raised = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
            raised.z += 0.7f - std::max(0.0f, height);
            Teleport(ped, raised);
        }
        center = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    }

    AI::CLEAR_PED_TASKS_IMMEDIATELY(ped);
    if (!stillInVehicle) {
        AI::TASK_HANDS_UP(ped, 60000, 0, -1, TRUE);
        PED::SET_PED_CAN_RAGDOLL(ped, FALSE);
    }
    ENTITY::FREEZE_ENTITY_POSITION(prisonerTarget, TRUE);
    g_frozenEntity = prisonerTarget;
    g_frozenUntil = GetTickCount64() + 60000;
    g_prisonPed = ped;
    g_prisonCenter = center;
    g_prisonUntil = g_frozenUntil;
    CreatePrisonCage(center);
    return {0, "Le joueur est enferme en prison pendant 60 secondes."};
}

void DrawPrisonStatus(ULONGLONG now) {
    if (!g_prisonUntil || now >= g_prisonUntil) return;
    int remaining = static_cast<int>((g_prisonUntil - now + 999ULL) / 1000ULL);
    GRAPHICS::DRAW_MARKER(
        1,
        g_prisonCenter.x, g_prisonCenter.y, g_prisonCenter.z - 0.7f,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        6.2f, 6.2f, 2.4f,
        255, 54, 86, 92,
        FALSE, FALSE, 2, FALSE, nullptr, nullptr, FALSE);
    DrawHudText("PRISON  -  " + std::to_string(remaining) + " SEC", 255, 92, 108);
}
} }
