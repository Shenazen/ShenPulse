/** Domaine player-effects ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
Result ArmPeds(Ped playerPed) {
    const int maxNearbyPeds = 64;
    int nearbyPeds[maxNearbyPeds + 1] = {};
    nearbyPeds[0] = maxNearbyPeds;
    int count = PED::GET_PED_NEARBY_PEDS(playerPed, nearbyPeds, -1);
    int armed = 0;
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    for (int i = 0; i < count && armed < 12; ++i) {
        Ped ped = nearbyPeds[i + 1];
        if (!ped || ped == playerPed || !ENTITY::DOES_ENTITY_EXIST(ped) || ENTITY::IS_ENTITY_DEAD(ped)
            || PED::IS_PED_A_PLAYER(ped) || !PED::IS_PED_HUMAN(ped)) continue;
        Vector3 p = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
        float dx = p.x - origin.x, dy = p.y - origin.y, dz = p.z - origin.z;
        if (dx * dx + dy * dy + dz * dz > 3025.0f) continue;
        WEAPON::GIVE_WEAPON_TO_PED(ped, 0x83BF0278, 180, FALSE, TRUE);
        AI::TASK_COMBAT_PED(ped, playerPed, 0, 16);
        ++armed;
    }
    if (armed) return {0, std::to_string(armed) + " passant(s) ont ete armes."};
    const Hash fallbackModels[] = { HashName("g_m_y_mexgoon_02"), HashName("g_m_y_lost_01") };
    Result fallback = SpawnHostilePeds(playerPed, fallbackModels,
        sizeof(fallbackModels) / sizeof(fallbackModels[0]), 6, "passant(s) arme(s)");
    if (fallback.status == 0) fallback.message = "6 passant(s) armes ont ete envoyes autour du joueur.";
    return fallback;
}

Result ForcePlayerRagdoll(Ped ped, int durationMs) {
    Vehicle vehicle = CurrentVehicle(ped);
    if (vehicle) {
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 16);
        ULONGLONG leaveDeadline = GetTickCount64() + 750;
        while (PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)
            && GetTickCount64() < leaveDeadline) {
            WAIT(0);
        }
        if (PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)) {
            Vector3 exitPosition =
                ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 2.5f, 0.0f, 0.8f);
            ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
                ped,
                exitPosition.x,
                exitPosition.y,
                exitPosition.z,
                FALSE,
                FALSE,
                TRUE
            );
            WAIT(0);
        }
    }

    AI::CLEAR_PED_TASKS_IMMEDIATELY(ped);
    PED::SET_PED_CAN_RAGDOLL(ped, TRUE);
    PED::SET_PED_CAN_RAGDOLL_FROM_PLAYER_IMPACT(ped, TRUE);
    ULONGLONG ragdollDeadline = GetTickCount64() + 1000;
    while (!PED::IS_PED_RAGDOLL(ped) && GetTickCount64() < ragdollDeadline) {
        PED::SET_PED_TO_RAGDOLL(
            ped,
            durationMs,
            durationMs,
            0,
            TRUE,
            TRUE,
            FALSE
        );
        WAIT(0);
    }
    if (!PED::IS_PED_RAGDOLL(ped)) {
        return {5, "GTA V n'a pas pu faire chuter le joueur."};
    }
    ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(
        ped,
        1,
        0.0f,
        0.0f,
        2.5f,
        TRUE,
        TRUE,
        TRUE,
        TRUE
    );
    return {0, "Le joueur a chute pendant 5 secondes."};
}

Result StartDrunkEffect(Ped ped, int durationMs) {
    const char* movementClipset = "move_m@drunk@verydrunk";
    STREAMING::REQUEST_ANIM_SET(const_cast<char*>(movementClipset));
    ULONGLONG loadDeadline = GetTickCount64() + 3000;
    while (!STREAMING::HAS_ANIM_SET_LOADED(const_cast<char*>(movementClipset))
        && GetTickCount64() < loadDeadline) {
        WAIT(0);
    }
    if (!STREAMING::HAS_ANIM_SET_LOADED(const_cast<char*>(movementClipset))) {
        return {5, "GTA V n'a pas pu charger la demarche ivre."};
    }

    PED::SET_PED_MOVEMENT_CLIPSET(
        ped,
        const_cast<char*>(movementClipset),
        0.75f
    );
    GRAPHICS::SET_TIMECYCLE_MODIFIER(const_cast<char*>("spectator5"));
    GRAPHICS::SET_TIMECYCLE_MODIFIER_STRENGTH(0.9f);
    CAM::SHAKE_GAMEPLAY_CAM(const_cast<char*>("DRUNK_SHAKE"), 1.8f);
    CAM::SET_GAMEPLAY_CAM_SHAKE_AMPLITUDE(1.8f);
    WAIT(0);
    if (!CAM::IS_GAMEPLAY_CAM_SHAKING()) {
        PED::RESET_PED_MOVEMENT_CLIPSET(ped, 0.25f);
        STREAMING::REMOVE_ANIM_SET(const_cast<char*>(movementClipset));
        GRAPHICS::CLEAR_TIMECYCLE_MODIFIER();
        return {5, "GTA V n'a pas active l'effet visuel d'ivresse."};
    }

    g_drunkPed = ped;
    g_drunkActive = true;
    g_drunkUntil = GetTickCount64() + durationMs;
    return {0, "La vision et la demarche du joueur sont perturbees pendant 15 secondes."};
}

Result StartSuperJumpEffect(Ped ped, int durationMs) {
    Vehicle vehicle = CurrentVehicle(ped);
    if (vehicle) {
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 16);
        ULONGLONG leaveDeadline = GetTickCount64() + 750;
        while (PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)
            && GetTickCount64() < leaveDeadline) {
            WAIT(0);
        }
    }
    if (!PED::IS_PED_ON_FOOT(ped)) {
        return {3, "Le joueur doit etre a pied pour activer les super sauts."};
    }

    g_superJumpUntil = GetTickCount64() + durationMs;
    GAMEPLAY::SET_SUPER_JUMP_THIS_FRAME(PLAYER::PLAYER_ID());
    Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(ped);
    ENTITY::SET_ENTITY_VELOCITY(
        ped,
        velocity.x,
        velocity.y,
        std::max(velocity.z, 0.0f) + 28.0f
    );
    g_nextSuperJumpBoostAt = GetTickCount64() + 1200;
    return {0, "Le joueur peut faire des super sauts pendant 20 secondes."};
}

Result SpawnVehicleForPlayer(Hash model, const char* label) {
    if (!STREAMING::IS_MODEL_IN_CDIMAGE(model) || !STREAMING::IS_MODEL_VALID(model)
        || !STREAMING::IS_MODEL_A_VEHICLE(model)) {
        return {5, "Ce vehicule n'est pas disponible dans cette version de GTA V."};
    }

    STREAMING::REQUEST_MODEL(model);
    ULONGLONG deadline = GetTickCount64() + 5000;
    while (!STREAMING::HAS_MODEL_LOADED(model) && GetTickCount64() < deadline) WAIT(0);
    if (!STREAMING::HAS_MODEL_LOADED(model)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, "Le chargement du vehicule a pris trop de temps."};
    }

    Player player = 0;
    Ped ped = 0;
    if (!PlayerReady(player, ped)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Vehicle previousVehicle = CurrentVehicle(ped);
    Entity origin = PlayerTarget(ped);
    Vector3 spawn = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(origin, 0.0f, 5.5f, 1.0f);
    float heading = ENTITY::GET_ENTITY_HEADING(origin);
    Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, spawn.x, spawn.y, spawn.z, heading, FALSE, FALSE);
    if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, "GTA V n'a pas pu creer le vehicule."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
    VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(vehicle);
    VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, TRUE, TRUE, FALSE);

    // GTA can silently ignore SET_PED_INTO_VEHICLE while the player is still
    // attached to the vehicle being replaced. Leave that vehicle first, then
    // retry the transfer until the native confirms that the player is seated.
    if (previousVehicle && previousVehicle != vehicle && ENTITY::DOES_ENTITY_EXIST(previousVehicle)) {
        AI::TASK_LEAVE_VEHICLE(ped, previousVehicle, 16);
        ULONGLONG leaveDeadline = GetTickCount64() + 750;
        while (PED::IS_PED_IN_VEHICLE(ped, previousVehicle, FALSE)
            && GetTickCount64() < leaveDeadline) {
            WAIT(0);
        }
        if (PED::IS_PED_IN_VEHICLE(ped, previousVehicle, FALSE)) {
            AI::CLEAR_PED_TASKS_IMMEDIATELY(ped);
            Vector3 exitPosition =
                ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 0.0f, -2.5f, 0.5f);
            ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
                ped,
                exitPosition.x,
                exitPosition.y,
                exitPosition.z,
                FALSE,
                FALSE,
                TRUE
            );
            WAIT(0);
        }
    }

    ULONGLONG seatDeadline = GetTickCount64() + 1500;
    while (!PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)
        && GetTickCount64() < seatDeadline) {
        PED::SET_PED_INTO_VEHICLE(ped, vehicle, -1);
        WAIT(0);
    }
    if (!PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)) {
        if (vehicle && ENTITY::DOES_ENTITY_EXIST(vehicle)) {
            VEHICLE::DELETE_VEHICLE(&vehicle);
        }
        if (previousVehicle && ENTITY::DOES_ENTITY_EXIST(previousVehicle)) {
            PED::SET_PED_INTO_VEHICLE(ped, previousVehicle, -1);
        }
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, "GTA V n'a pas pu placer le joueur au volant du nouveau vehicule."};
    }

    if (previousVehicle && previousVehicle != vehicle && ENTITY::DOES_ENTITY_EXIST(previousVehicle)) {
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(previousVehicle, TRUE, TRUE);
        VEHICLE::DELETE_VEHICLE(&previousVehicle);
    }
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    return {
        0,
        label && *label
            ? std::string("Nouveau vehicule surprise : ") + label + "."
            : "Le vehicule du joueur a ete remplace."
    };
}

Result AffectNearbyVehicles(Ped playerPed, bool explode, bool launch) {
    const int maxNearbyVehicles = 64;
    int nearbyVehicles[maxNearbyVehicles + 1] = {};
    nearbyVehicles[0] = maxNearbyVehicles;
    int count = PED::GET_PED_NEARBY_VEHICLES(playerPed, nearbyVehicles);
    Vehicle playerVehicle = CurrentVehicle(playerPed);
    std::vector<Vehicle> targets;
    for (int index = 0; index < count && targets.size() < 20; ++index) {
        Vehicle vehicle = nearbyVehicles[index + 1];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        targets.push_back(vehicle);
    }
    if (targets.empty()) SpawnAmbientChaosVehicles(playerPed, targets, 6);

    int affected = 0;
    for (size_t index = 0; index < targets.size() && affected < 20; ++index) {
        Vehicle vehicle = targets[index];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        if (explode) {
            Vector3 position = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
            FIRE::ADD_EXPLOSION(position.x, position.y, position.z, 2, 1.0f, TRUE, FALSE, 0.5f);
        }
        if (launch) {
            Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(vehicle);
            ENTITY::SET_ENTITY_VELOCITY(vehicle, velocity.x, velocity.y, std::max(velocity.z, 0.0f) + 24.0f);
        }
        ++affected;
    }
    if (!affected) return {5, "GTA V n'a pas pu preparer de vehicule pour cet effet."};
    return {0, std::to_string(affected) + " vehicule(s) ont ete affectes."};
}

Result SpawnFriendlyAnimal(Ped playerPed) {
    const Hash animals[] = { HashName("a_c_chop"), HashName("a_c_deer"), HashName("a_c_boar"), HashName("a_c_coyote"), HashName("a_c_retriever") };
    Hash model = RandomHash(animals, sizeof(animals) / sizeof(animals[0]));
    Result loaded = LoadModel(model, "Animal");
    if (loaded.status != 0) return loaded;
    Vector3 spawn = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(playerPed, 2.5f, 5.0f, 0.3f);
    Ped animal = PED::CREATE_PED(28, model, spawn.x, spawn.y, spawn.z, ENTITY::GET_ENTITY_HEADING(playerPed), FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!animal || !ENTITY::DOES_ENTITY_EXIST(animal)) return {5, "L'animal n'a pas pu apparaitre."};
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(animal, TRUE, TRUE);
    AI::TASK_WANDER_STANDARD(animal, 10.0f, 10);
    return {0, "Un animal aleatoire est apparu."};
}

Result PullNearbyVehicles(Ped playerPed, bool upward, bool ensureTargets) {
    const int maxNearbyVehicles = 64;
    int nearbyVehicles[maxNearbyVehicles + 1] = {};
    nearbyVehicles[0] = maxNearbyVehicles;
    int count = PED::GET_PED_NEARBY_VEHICLES(playerPed, nearbyVehicles);
    Vehicle playerVehicle = CurrentVehicle(playerPed);
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    if (!upward && GetTickCount64() < g_blackHoleUntil) {
        origin = g_blackHoleCenter;
    }
    std::vector<Vehicle> targets;
    for (int index = 0; index < count && targets.size() < 24; ++index) {
        Vehicle vehicle = nearbyVehicles[index + 1];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        targets.push_back(vehicle);
    }
    if (ensureTargets && targets.size() < 6) {
        SpawnAmbientChaosVehicles(playerPed, targets, static_cast<int>(6 - targets.size()));
    }

    int affected = 0;
    for (size_t index = 0; index < targets.size() && affected < 24; ++index) {
        Vehicle vehicle = targets[index];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        Vector3 p = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        float dx = origin.x - p.x;
        float dy = origin.y - p.y;
        float dz = origin.z - p.z;
        float distance = std::max(1.0f, std::sqrt(dx * dx + dy * dy + dz * dz));
        if (upward) {
            ENTITY::SET_ENTITY_VELOCITY(vehicle, dx / distance * 48.0f, dy / distance * 48.0f, 34.0f);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(vehicle, 1, dx / distance * 42.0f, dy / distance * 42.0f, 38.0f, TRUE, TRUE, TRUE, TRUE);
        } else {
            float radial = std::min(72.0f, std::max(34.0f, distance * 3.2f));
            float tangent = distance < 7.0f ? 42.0f : 27.0f;
            float lift = distance < 5.0f ? 30.0f : std::min(18.0f, 7.0f + distance * 0.35f);
            float vx = dx / distance * radial - dy / distance * tangent;
            float vy = dy / distance * radial + dx / distance * tangent;
            ENTITY::SET_ENTITY_VELOCITY(vehicle, vx, vy, lift);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(vehicle, 1, vx * 0.9f, vy * 0.9f, lift + 8.0f, TRUE, TRUE, TRUE, TRUE);
        }
        ++affected;
    }

    const int maxNearbyPeds = 48;
    int nearbyPeds[maxNearbyPeds + 1] = {};
    nearbyPeds[0] = maxNearbyPeds;
    int pedCount = PED::GET_PED_NEARBY_PEDS(playerPed, nearbyPeds, -1);
    for (int index = 0; index < pedCount && affected < 48; ++index) {
        Ped ped = nearbyPeds[index + 1];
        if (!ped || ped == playerPed || !ENTITY::DOES_ENTITY_EXIST(ped) || ENTITY::IS_ENTITY_DEAD(ped)) continue;
        Vector3 p = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
        float dx = origin.x - p.x;
        float dy = origin.y - p.y;
        float distance = std::max(1.0f, std::sqrt(dx * dx + dy * dy));
        PED::SET_PED_TO_RAGDOLL(ped, 1800, 1800, 0, TRUE, TRUE, FALSE);
        if (upward) {
            ENTITY::SET_ENTITY_VELOCITY(ped, dx / distance * 24.0f, dy / distance * 24.0f, 20.0f);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(ped, 1, dx / distance * 20.0f, dy / distance * 20.0f, 20.0f, TRUE, TRUE, TRUE, TRUE);
        } else {
            float vx = dx / distance * 32.0f - dy / distance * 16.0f;
            float vy = dy / distance * 32.0f + dx / distance * 16.0f;
            ENTITY::SET_ENTITY_VELOCITY(ped, vx, vy, 11.0f);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(ped, 1, vx, vy, 14.0f, TRUE, TRUE, TRUE, TRUE);
        }
        ++affected;
    }

    Entity target = PlayerTarget(playerPed);
    if (upward && target && ENTITY::DOES_ENTITY_EXIST(target)) {
        Vector3 p = ENTITY::GET_ENTITY_COORDS(target, TRUE);
        float dx = origin.x - p.x;
        float dy = origin.y - p.y;
        float dz = origin.z - p.z;
        float distance = std::max(1.0f, std::sqrt(dx * dx + dy * dy + dz * dz));
        Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(target);
        ENTITY::SET_ENTITY_VELOCITY(target, velocity.x * 0.75f, velocity.y * 0.75f, std::max(velocity.z, 0.0f) + 18.0f);
        ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(target, 1, dx / distance * 8.0f, dy / distance * 8.0f, 36.0f, TRUE, TRUE, TRUE, TRUE);
        ++affected;
    }

    Vector3 marker = upward ? ENTITY::GET_ENTITY_COORDS(PlayerTarget(playerPed), TRUE) : origin;
    GRAPHICS::DRAW_MARKER(
        upward ? 28 : 1,
        marker.x, marker.y, marker.z + (upward ? 3.0f : 0.4f),
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        upward ? 12.0f : 18.0f, upward ? 12.0f : 18.0f, upward ? 12.0f : 5.0f,
        upward ? 40 : 116, upward ? 225 : 30, upward ? 255 : 180, 110,
        FALSE, FALSE, 2, FALSE, nullptr, nullptr, FALSE);

    if (!affected) return {0, upward ? "Tempete magnetique active; aucun vehicule proche pour le moment." : "Trou noir ouvert; aucun vehicule proche pour le moment."};
    return {0, std::to_string(affected) + (upward ? " cible(s) projetees." : " cible(s) attirees.")};
}

Result SpawnVehicleAbovePlayer(Ped playerPed, Hash model, const char* label) {
    Result loaded = LoadModel(model, label);
    if (loaded.status != 0) return loaded;
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, origin.x, origin.y, origin.z + 28.0f, ENTITY::GET_ENTITY_HEADING(playerPed), FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) return {5, std::string(label) + " n'a pas pu apparaitre."};
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
    ENTITY::SET_ENTITY_VELOCITY(vehicle, 0.0f, 0.0f, -8.0f);
    return {0, std::string(label) + " est tombe du ciel."};
}
} }
