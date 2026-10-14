/** Domaine world-effects ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
bool PullEntityIntoBlackHole(Entity entity, Entity playerTarget) {
    if (!entity
        || !ENTITY::DOES_ENTITY_EXIST(entity)
        || ENTITY::IS_ENTITY_DEAD(entity)
        || entity == g_trainVehicle) {
        return false;
    }
    Vector3 position = ENTITY::GET_ENTITY_COORDS(entity, TRUE);
    float dx = g_blackHoleCenter.x - position.x;
    float dy = g_blackHoleCenter.y - position.y;
    float dz = g_blackHoleCenter.z - position.z;
    float distance = std::sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > 240.0f) return false;
    distance = std::max(1.0f, distance);
    ULONGLONG now = GetTickCount64();
    if (now < g_blackHolePullStartsAt) return false;
    float progress = std::min(
        1.0f,
        static_cast<float>(now - g_blackHolePullStartsAt) / 12000.0f
    );
    float speed = 9.0f + progress * 31.0f;
    if (entity == playerTarget) speed = 7.0f + progress * 18.0f;
    float vx = dx / distance * speed;
    float vy = dy / distance * speed;
    float vz = dz / distance * speed;
    ENTITY::SET_ENTITY_VELOCITY(entity, vx, vy, vz);
    ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(
        entity,
        1,
        vx * 0.42f,
        vy * 0.42f,
        vz * 0.42f,
        TRUE,
        TRUE,
        TRUE,
        TRUE
    );
    return true;
}

int PullWorldIntoBlackHole(Ped playerPed) {
    Entity playerTarget = PlayerTarget(playerPed);
    int affected = 0;
    if (playerTarget && ENTITY::DOES_ENTITY_EXIST(playerTarget)) {
        if (playerTarget == playerPed) {
            PED::SET_PED_CAN_RAGDOLL(playerPed, TRUE);
            PED::SET_PED_TO_RAGDOLL(playerPed, 900, 900, 0, TRUE, TRUE, FALSE);
        }
        if (PullEntityIntoBlackHole(playerTarget, playerTarget)) ++affected;
    }

    const int maxEntities = 512;
    int entities[maxEntities] = {};
    int count = worldGetAllVehicles(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        Entity entity = entities[index];
        if (entity == playerTarget) continue;
        if (PullEntityIntoBlackHole(entity, playerTarget)) ++affected;
    }

    count = worldGetAllPeds(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        Ped ped = entities[index];
        if (ped == playerPed || ped == playerTarget) continue;
        if (ped && ENTITY::DOES_ENTITY_EXIST(ped) && !ENTITY::IS_ENTITY_DEAD(ped)) {
            PED::SET_PED_CAN_RAGDOLL(ped, TRUE);
            PED::SET_PED_TO_RAGDOLL(ped, 900, 900, 0, TRUE, TRUE, FALSE);
        }
        if (PullEntityIntoBlackHole(ped, playerTarget)) ++affected;
    }

    count = worldGetAllObjects(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        if (PullEntityIntoBlackHole(entities[index], playerTarget)) ++affected;
    }
    count = worldGetAllPickups(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        if (PullEntityIntoBlackHole(entities[index], playerTarget)) ++affected;
    }
    return affected;
}

void DrawBlackHole() {
    GRAPHICS::DRAW_MARKER(
        28,
        g_blackHoleCenter.x, g_blackHoleCenter.y, g_blackHoleCenter.z,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        52.0f, 52.0f, 52.0f,
        0, 0, 0, 245,
        FALSE, TRUE, 2, TRUE, nullptr, nullptr, FALSE);
    GRAPHICS::DRAW_MARKER(
        6,
        g_blackHoleCenter.x, g_blackHoleCenter.y, g_blackHoleCenter.z,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        66.0f, 66.0f, 66.0f,
        36, 0, 58, 210,
        FALSE, TRUE, 2, TRUE, nullptr, nullptr, FALSE);
}

void DeleteTrainVehicle() {
    if (g_trainVehicle && ENTITY::DOES_ENTITY_EXIST(g_trainVehicle)) {
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(g_trainVehicle, TRUE, TRUE);
        VEHICLE::DELETE_VEHICLE(&g_trainVehicle);
    }
    g_trainVehicle = 0;
    g_trainTarget = 0;
    g_trainUntil = 0;
    g_trainApproachAt = 0;
    g_trainImpactAt = 0;
    g_trainImpactApplied = false;
    g_trainSpawnPosition = {0.0f, 0, 0.0f, 0, 0.0f, 0};
}

Result StartTrainHit(Ped playerPed) {
    DeleteTrainVehicle();
    Hash model = HashName("freight");
    Result loaded = LoadModel(model, "La locomotive");
    if (loaded.status != 0) return loaded;

    Entity target = PlayerTarget(playerPed);
    Vector3 targetPosition = ENTITY::GET_ENTITY_COORDS(target, TRUE);
    Vector3 forward = GameplayCameraForward();
    float horizontalLength = std::max(0.01f, std::sqrt(forward.x * forward.x + forward.y * forward.y));
    forward.x /= horizontalLength;
    forward.y /= horizontalLength;
    Vector3 spawn = {
        targetPosition.x + forward.x * 54.0f, 0,
        targetPosition.y + forward.y * 54.0f, 0,
        targetPosition.z + 1.5f, 0
    };
    float heading = CAM::GET_GAMEPLAY_CAM_ROT(2).z + 180.0f;
    Vehicle train = VEHICLE::CREATE_VEHICLE(
        model,
        spawn.x,
        spawn.y,
        spawn.z,
        heading,
        FALSE,
        FALSE
    );
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!train || !ENTITY::DOES_ENTITY_EXIST(train)) {
        return {5, "La locomotive n'a pas pu apparaitre."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(train, TRUE, TRUE);
    ENTITY::SET_ENTITY_COLLISION(train, TRUE, TRUE);
    ENTITY::SET_ENTITY_DYNAMIC(train, TRUE);
    ENTITY::SET_ENTITY_LOAD_COLLISION_FLAG(train, TRUE);
    ENTITY::SET_ENTITY_INVINCIBLE(train, TRUE);
    ENTITY::SET_ENTITY_VISIBLE(train, TRUE, FALSE);
    ENTITY::SET_ENTITY_ALPHA(train, 255, FALSE);
    ENTITY::SET_ENTITY_LOD_DIST(train, 1000);
    ENTITY::FREEZE_ENTITY_POSITION(train, TRUE);
    g_trainVehicle = train;
    g_trainTarget = target;
    g_trainDirection = {-forward.x, 0, -forward.y, 0, 0.0f, 0};
    g_trainSpawnPosition = spawn;
    g_trainImpactApplied = false;
    ULONGLONG now = GetTickCount64();
    g_trainApproachAt = now + kTrainTelegraphMs;
    g_trainImpactAt = g_trainApproachAt + kTrainApproachMs;
    g_trainUntil = g_trainImpactAt + 3200;
    ENTITY::SET_ENTITY_VELOCITY(train, 0.0f, 0.0f, 0.0f);
    return {0, "Une locomotive apparait face a la camera avant de foncer sur le joueur."};
}

void UpdateTrainHit(ULONGLONG now, Ped playerPed) {
    if (!g_trainVehicle) return;
    if (now >= g_trainUntil || !ENTITY::DOES_ENTITY_EXIST(g_trainVehicle)) {
        DeleteTrainVehicle();
        return;
    }
    Entity target = g_trainTarget;
    if (!target || !ENTITY::DOES_ENTITY_EXIST(target) || ENTITY::IS_ENTITY_DEAD(target)) {
        target = PlayerTarget(playerPed);
        g_trainTarget = target;
    }
    if (!target || !ENTITY::DOES_ENTITY_EXIST(target)) return;

    Vector3 trainPosition = ENTITY::GET_ENTITY_COORDS(g_trainVehicle, TRUE);
    Vector3 targetPosition = ENTITY::GET_ENTITY_COORDS(target, TRUE);
    if (now < g_trainApproachAt) {
        ENTITY::FREEZE_ENTITY_POSITION(g_trainVehicle, TRUE);
        ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
            g_trainVehicle,
            g_trainSpawnPosition.x,
            g_trainSpawnPosition.y,
            g_trainSpawnPosition.z,
            FALSE,
            FALSE,
            TRUE
        );
        int seconds = static_cast<int>(
            (g_trainApproachAt - now + 999ULL) / 1000ULL
        );
        DrawHudText(
            "TRAIN EN APPROCHE  -  " + std::to_string(seconds),
            255,
            196,
            64
        );
        return;
    }
    ENTITY::FREEZE_ENTITY_POSITION(g_trainVehicle, FALSE);
    float dx = targetPosition.x - trainPosition.x;
    float dy = targetPosition.y - trainPosition.y;
    float distance = std::max(0.01f, std::sqrt(dx * dx + dy * dy));
    g_trainDirection = {dx / distance, 0, dy / distance, 0, 0.0f, 0};
    float progress = std::min(
        1.0f,
        static_cast<float>(now - g_trainApproachAt)
            / static_cast<float>(kTrainApproachMs)
    );
    Vector3 approachPosition = {
        g_trainSpawnPosition.x
            + (targetPosition.x - g_trainSpawnPosition.x) * progress,
        0,
        g_trainSpawnPosition.y
            + (targetPosition.y - g_trainSpawnPosition.y) * progress,
        0,
        g_trainSpawnPosition.z
            + (targetPosition.z + 1.0f - g_trainSpawnPosition.z) * progress,
        0
    };
    ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
        g_trainVehicle,
        approachPosition.x,
        approachPosition.y,
        approachPosition.z,
        FALSE,
        FALSE,
        TRUE
    );
    DrawHudText("IMPACT DU TRAIN", 255, 90, 64);

    if (!g_trainImpactApplied && (now >= g_trainImpactAt || distance <= 7.0f)) {
        g_trainImpactApplied = true;
        ENTITY::SET_ENTITY_VELOCITY(
            g_trainVehicle,
            g_trainDirection.x * 42.0f,
            g_trainDirection.y * 42.0f,
            0.0f
        );
        if (target == playerPed) {
            PED::SET_PED_CAN_RAGDOLL(playerPed, TRUE);
            PED::SET_PED_TO_RAGDOLL(playerPed, 4200, 4200, 0, TRUE, TRUE, FALSE);
        }
        ENTITY::SET_ENTITY_VELOCITY(
            target,
            g_trainDirection.x * 74.0f,
            g_trainDirection.y * 74.0f,
            22.0f
        );
        ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(
            target,
            1,
            g_trainDirection.x * 130.0f,
            g_trainDirection.y * 130.0f,
            42.0f,
            TRUE,
            TRUE,
            TRUE,
            TRUE
        );
        FIRE::ADD_EXPLOSION(
            targetPosition.x,
            targetPosition.y,
            targetPosition.z,
            29,
            0.6f,
            FALSE,
            TRUE,
            0.8f
        );
    }
}
} }
