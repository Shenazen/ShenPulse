/** Domaine timed-effects ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
void UpdateVehicleFlip(ULONGLONG now) {
    if (!g_flippingVehicle || !g_vehicleFlipStartedAt) return;
    if (!ENTITY::DOES_ENTITY_EXIST(g_flippingVehicle)
        || ENTITY::IS_ENTITY_DEAD(g_flippingVehicle)) {
        Log("Vehicle flip cancelled because the vehicle no longer exists.");
        g_flippingVehicle = 0;
        g_vehicleFlipStartedAt = 0;
        g_vehicleFlipUntil = 0;
        g_vehicleFlipHalfLogged = false;
        return;
    }
    if (now < g_vehicleFlipStartedAt) return;

    float progress = std::min(
        1.0f,
        static_cast<float>(now - g_vehicleFlipStartedAt)
            / static_cast<float>(kVehicleFlipDurationMs)
    );
    float easedProgress = progress * progress * (3.0f - 2.0f * progress);
    ENTITY::SET_ENTITY_ROTATION(
        g_flippingVehicle,
        g_vehicleFlipStartRotation.x,
        g_vehicleFlipStartRotation.y + 360.0f * easedProgress,
        g_vehicleFlipStartRotation.z,
        2,
        TRUE
    );

    if (!g_vehicleFlipHalfLogged && progress >= 0.5f) {
        Vector3 observed = ENTITY::GET_ENTITY_ROTATION(g_flippingVehicle, 2);
        std::ostringstream midpoint;
        midpoint << "Vehicle flip midpoint rotation: "
                 << observed.x << ", " << observed.y << ", " << observed.z << ".";
        Log(midpoint.str());
        g_vehicleFlipHalfLogged = true;
    }
    if (now < g_vehicleFlipUntil && progress < 1.0f) return;

    Log("Vehicle flip completed through 360 degrees.");
    g_flippingVehicle = 0;
    g_vehicleFlipStartedAt = 0;
    g_vehicleFlipUntil = 0;
    g_vehicleFlipHalfLogged = false;
}

void UpdateTimedEffects(ULONGLONG now) {
    Player player = PLAYER::PLAYER_ID();
    Ped ped = PLAYER::PLAYER_PED_ID();
    bool pedExists = ped && ENTITY::DOES_ENTITY_EXIST(ped);

    CleanupGiftObjects(now);
    UpdateVehicleFlip(now);

    if (now < g_superJumpUntil) {
        GAMEPLAY::SET_SUPER_JUMP_THIS_FRAME(player);
        bool jumpRequested =
            CONTROLS::IS_CONTROL_JUST_PRESSED(0, 22)
            || PED::IS_PED_JUMPING(ped);
        if (pedExists
            && PED::IS_PED_ON_FOOT(ped)
            && jumpRequested
            && now >= g_nextSuperJumpBoostAt) {
            Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(ped);
            ENTITY::SET_ENTITY_VELOCITY(
                ped,
                velocity.x,
                velocity.y,
                std::max(velocity.z, 0.0f) + 28.0f
            );
            g_nextSuperJumpBoostAt = now + 1200;
        }
    }
    if (now < g_explosiveAmmoUntil) GAMEPLAY::SET_EXPLOSIVE_AMMO_THIS_FRAME(player);
    if (now < g_explosiveMeleeUntil) GAMEPLAY::SET_EXPLOSIVE_MELEE_THIS_FRAME(player);

    if (g_restoreInvincibility && now >= g_invincibleUntil) {
        PLAYER::SET_PLAYER_INVINCIBLE(player, g_wasInvincible ? TRUE : FALSE);
        if (pedExists) ENTITY::SET_ENTITY_INVINCIBLE(ped, g_wasInvincible ? TRUE : FALSE);
        g_restoreInvincibility = false;
        g_invincibleUntil = 0;
    }
    if (g_infiniteAmmoActive && now >= g_infiniteAmmoUntil) {
        if (pedExists) WEAPON::SET_PED_INFINITE_AMMO_CLIP(ped, FALSE);
        g_infiniteAmmoActive = false;
        g_infiniteAmmoUntil = 0;
    }
    if (g_drunkActive && now >= g_drunkUntil) {
        CAM::STOP_GAMEPLAY_CAM_SHAKING(TRUE);
        GRAPHICS::CLEAR_TIMECYCLE_MODIFIER();
        if (g_drunkPed && ENTITY::DOES_ENTITY_EXIST(g_drunkPed)) {
            PED::RESET_PED_MOVEMENT_CLIPSET(g_drunkPed, 0.5f);
        }
        STREAMING::REMOVE_ANIM_SET(
            const_cast<char*>("move_m@drunk@verydrunk")
        );
        g_drunkPed = 0;
        g_drunkActive = false;
        g_drunkUntil = 0;
    }
    if (g_slowMotionActive && now >= g_slowMotionUntil) {
        GAMEPLAY::SET_TIME_SCALE(1.0f);
        g_slowMotionActive = false;
        g_slowMotionUntil = 0;
    }
    if (g_danceUntil && now >= g_danceUntil) {
        if (g_dancePed && ENTITY::DOES_ENTITY_EXIST(g_dancePed)) {
            AI::CLEAR_PED_TASKS_IMMEDIATELY(g_dancePed);
        }
        g_dancePed = 0;
        g_danceUntil = 0;
    }
    if (g_prisonUntil && now >= g_prisonUntil) {
        EndPrison();
    } else if (g_frozenEntity && now >= g_frozenUntil) {
        if (ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, FALSE);
        g_frozenEntity = 0;
        g_frozenUntil = 0;
    }
    if (g_prisonUntil) {
        if (g_frozenEntity && ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) {
            ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, TRUE);
        }
        if (g_prisonPed && ENTITY::DOES_ENTITY_EXIST(g_prisonPed)) {
            if (!PED::IS_PED_IN_ANY_VEHICLE(g_prisonPed, FALSE)) {
                ENTITY::FREEZE_ENTITY_POSITION(g_prisonPed, TRUE);
                AI::UPDATE_TASK_HANDS_UP_DURATION(g_prisonPed, static_cast<int>(std::min<ULONGLONG>(60000ULL, g_prisonUntil > now ? g_prisonUntil - now : 0ULL)));
            }
        }
        DrawPrisonStatus(now);
    }
    if (pedExists && !ENTITY::IS_ENTITY_DEAD(ped)) {
        if (now < g_blackHoleUntil) {
            DrawBlackHole();
            if (
                now >= g_blackHolePullStartsAt
                && now >= g_nextBlackHolePullAt
            ) {
                PullWorldIntoBlackHole(ped);
                g_nextBlackHolePullAt = now + 120;
            }
            if (now < g_blackHolePullStartsAt) {
                int seconds = static_cast<int>(
                    (g_blackHolePullStartsAt - now + 999ULL) / 1000ULL
                );
                DrawHudText(
                    "TROU NOIR  -  ASPIRATION DANS "
                        + std::to_string(seconds),
                    196,
                    116,
                    255
                );
            } else {
                DrawHudText("TROU NOIR  -  ASPIRATION", 180, 92, 255);
            }
        }
        if (now < g_magneticStormUntil) {
            PullNearbyVehicles(ped, true);
            DrawHudText("TEMPETE MAGNETIQUE", 92, 225, 255);
        }
        UpdateTrainHit(now, ped);
    } else if (g_trainVehicle) {
        UpdateTrainHit(now, ped);
    }
}
} }
