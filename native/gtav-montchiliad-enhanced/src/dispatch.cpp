/** Domaine dispatch ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
Result Execute(std::string code) {
    std::transform(code.begin(), code.end(), code.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (code == "overlay_win_x2") {
        g_nativeWinMultiplier = 2;
        g_nativeWinMultiplierUntil = GetTickCount64() + 60000;
        g_counterHudText = "MULTIPLICATEUR WINS X2  -  60 SEC";
        g_counterHudUntil = GetTickCount64() + 5000;
        return {0, "Le multiplicateur WINS X2 est visible et actif pendant 60 secondes."};
    }
    if (code == "chaos_exit_prison") {
        EndPrison();
        return {0, "Le joueur est sorti de prison."};
    }
    Player player = 0;
    Ped ped = 0;
    if (!PlayerReady(player, ped)) return {kEffectRetryStatus, kGameNotReadyMessage};
    if (code == "chaos_upupaway") {
        Entity target = PlayerTarget(ped);
        Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(target);
        ENTITY::SET_ENTITY_VELOCITY(target, velocity.x, velocity.y, std::max(velocity.z, 0.0f) + 28.0f);
        return {0, "Le joueur a ete propulse."};
    }
    if (code == "chaos_tp_mountchilliad") {
        ResetVictoryZoneEntry();
        TeleportPlayer(ped, kMont);
        return {0, "Le joueur a ete envoye au Mont Chiliad."};
    }
    if (code == "chaos_tp_random") {
        size_t count = sizeof(kTeleports) / sizeof(kTeleports[0]);
        TeleportPlayer(ped, kTeleports[(GetTickCount64() ^ GetCurrentProcessId()) % count]);
        return {0, "Le joueur a ete teleporte."};
    }
    if (code == "chaos_time_night") { TIME::SET_CLOCK_TIME(0, 0, 0); return {0, "La nuit est tombee."}; }
    if (code == "chaos_time_day") { TIME::SET_CLOCK_TIME(12, 0, 0); return {0, "Le jour s'est leve."}; }
    if (code == "chaos_invincible") {
        if (!g_restoreInvincibility) {
            g_wasInvincible = PLAYER::GET_PLAYER_INVINCIBLE(player) != FALSE;
            g_restoreInvincibility = true;
        }
        PLAYER::SET_PLAYER_INVINCIBLE(player, TRUE);
        ENTITY::SET_ENTITY_INVINCIBLE(ped, TRUE);
        g_invincibleUntil = GetTickCount64() + 20000;
        return {0, "Le joueur est invincible pendant 20 secondes."};
    }
    if (code == "chaos_5stars") {
        PLAYER::SET_PLAYER_WANTED_LEVEL(player, 5, FALSE);
        PLAYER::SET_PLAYER_WANTED_LEVEL_NOW(player, FALSE);
        return {0, "Le niveau de recherche est passe a 5 etoiles."};
    }
    if (code == "chaos_random_weapons") return ArmPeds(ped);
    if (code == "chaos_playerveh_explode") {
        Vehicle vehicle = PED::GET_VEHICLE_PED_IS_IN(ped, FALSE);
        if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) return {3, "Le joueur doit etre dans un vehicule pour cet effet."};
        Vector3 p = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        FIRE::ADD_EXPLOSION(p.x, p.y, p.z, 2, 1.0f, TRUE, FALSE, 1.0f);
        return {0, "Le vehicule du joueur a explose."};
    }
    if (code == "chaos_tp_lsairport") {
        TeleportPlayer(ped, kAirport);
        return {0, "Le joueur a ete envoye a l'aeroport."};
    }
    if (code == "chaos_player_suicide") {
        ENTITY::SET_ENTITY_HEALTH(ped, 0);
        return {0, "Le joueur a ete elimine."};
    }
    if (code == "chaos_vehicle_random") {
        const char* bicycles[] = {
            "bmx", "cruiser", "fixter", "scorcher", "tribike", "tribike2", "tribike3"
        };
        const char* motorcycles[] = {
            "akuma", "bati", "bati2", "bagger", "blazer", "blazer3", "daemon", "double",
            "faggio2", "hakuchou", "hexer", "innovation", "nemesis", "pcj", "ruffian",
            "sanchez", "sanchez2", "sovereign", "thrust", "vader"
        };
        const char* watercraft[] = {
            "seashark", "seashark2", "seashark3", "dinghy", "dinghy2", "dinghy3",
            "jetmax", "speeder", "speeder2", "squalo", "suntrap", "tropic", "tropic2"
        };
        const char* offroad[] = {
            "bfinjection", "bifta", "bodhi2", "dubsta3", "dune", "dune2", "guardian",
            "insurgent", "kalahari", "mesa3", "monster", "monster3", "rancherxl",
            "rebel", "rebel2", "sandking", "sandking2", "technical", "trophytruck"
        };
        const char* unusual[] = {
            "airtug", "bulldozer", "caddy", "caddy2", "caddy3", "docktug", "dump",
            "forklift", "handler", "mixer", "mixer2", "mower", "ripley", "scrap",
            "tractor", "tractor2", "tractor3", "utillitruck", "utillitruck2", "utillitruck3"
        };
        const char* classics[] = {
            "btype", "btype2", "btype3", "casco", "cheetah2", "coquette2", "coquette3",
            "hotknife", "jb700", "mamba", "manana", "manana2", "monroe", "peyote",
            "pigalle", "roosevelt", "roosevelt2", "tornado", "tornado2", "voodoo2", "ztype"
        };
        const char* performance[] = {
            "adder", "banshee", "banshee2", "bullet", "carbonizzare", "cheetah", "comet2",
            "comet3", "coquette", "elegy2", "entityxf", "feltzer2", "furoregt", "infernus",
            "jester", "jester2", "massacro", "osiris", "penetrator", "reaper", "seven70",
            "t20", "tempesta", "turismo2", "turismor", "vacca", "voltic", "zentorno"
        };
        const char* emergency[] = {
            "ambulance", "fbi", "fbi2", "firetruk", "lguard", "police", "police2",
            "police3", "police4", "policeb", "policeold1", "policeold2", "policet",
            "pranger", "riot", "sheriff", "sheriff2"
        };
        const char* heavyAndPublic[] = {
            "bison", "boxville", "boxville2", "burrito3", "bus", "camper", "coach",
            "journey", "minivan", "mule", "packer", "paradise", "phantom", "pony",
            "pounder", "rumpo", "stockade", "stretch", "taxi", "tourbus", "towtruck", "trash"
        };
        const char* aircraft[] = {
            "annihilator", "buzzard", "buzzard2", "cargobob", "duster", "frogger",
            "mammatus", "maverick", "stunt", "velum", "cuban800"
        };

        const char** selectedPool = nullptr;
        size_t selectedCount = 0;
        const char* selectedLabel = "vehicule";
        switch (RandomChoiceIndex(10)) {
            case 0:
                selectedPool = bicycles;
                selectedCount = sizeof(bicycles) / sizeof(bicycles[0]);
                selectedLabel = "velo";
                break;
            case 1:
                selectedPool = motorcycles;
                selectedCount = sizeof(motorcycles) / sizeof(motorcycles[0]);
                selectedLabel = "moto ou quad";
                break;
            case 2:
                selectedPool = watercraft;
                selectedCount = sizeof(watercraft) / sizeof(watercraft[0]);
                selectedLabel = "jet-ski ou bateau";
                break;
            case 3:
                selectedPool = offroad;
                selectedCount = sizeof(offroad) / sizeof(offroad[0]);
                selectedLabel = "tout-terrain";
                break;
            case 4:
                selectedPool = unusual;
                selectedCount = sizeof(unusual) / sizeof(unusual[0]);
                selectedLabel = "vehicule insolite";
                break;
            case 5:
                selectedPool = classics;
                selectedCount = sizeof(classics) / sizeof(classics[0]);
                selectedLabel = "vehicule de collection";
                break;
            case 6:
                selectedPool = performance;
                selectedCount = sizeof(performance) / sizeof(performance[0]);
                selectedLabel = "sportive ou supercar";
                break;
            case 7:
                selectedPool = emergency;
                selectedCount = sizeof(emergency) / sizeof(emergency[0]);
                selectedLabel = "vehicule d'urgence";
                break;
            case 8:
                selectedPool = heavyAndPublic;
                selectedCount = sizeof(heavyAndPublic) / sizeof(heavyAndPublic[0]);
                selectedLabel = "poids lourd ou transport public";
                break;
            default:
                selectedPool = aircraft;
                selectedCount = sizeof(aircraft) / sizeof(aircraft[0]);
                selectedLabel = "aeronef";
                break;
        }
        const char* modelName = selectedPool[RandomChoiceIndex(selectedCount)];
        return SpawnVehicleForPlayer(HashName(modelName), selectedLabel);
    }
    if (code == "chaos_vehicle_supercar") return SpawnVehicleForPlayer(HashName("adder"), "supercar Adder");
    if (code == "chaos_vehicle_motorcycle") return SpawnVehicleForPlayer(0xF9300CC5);
    if (code == "chaos_vehicle_tank") return SpawnVehicleForPlayer(0x2EA68690);
    if (code == "chaos_vehicle_helicopter") return SpawnVehicleForPlayer(0x2F03547B);
    if (code == "chaos_vehicle_repair") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        VEHICLE::SET_VEHICLE_FIXED(vehicle);
        VEHICLE::SET_VEHICLE_ENGINE_HEALTH(vehicle, 1000.0f);
        VEHICLE::SET_VEHICLE_BODY_HEALTH(vehicle, 1000.0f);
        VEHICLE::SET_VEHICLE_PETROL_TANK_HEALTH(vehicle, 1000.0f);
        VEHICLE::SET_VEHICLE_DIRT_LEVEL(vehicle, 0.0f);
        VEHICLE::SET_VEHICLE_UNDRIVEABLE(vehicle, FALSE);
        VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, TRUE, TRUE, FALSE);
        return {0, "Le vehicule du joueur a ete repare."};
    }
    if (code == "chaos_vehicle_boost") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        VEHICLE::SET_VEHICLE_FORWARD_SPEED(vehicle, 85.0f);
        return {0, "Le vehicule du joueur a recu un boost."};
    }
    if (code == "chaos_vehicle_flip") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        Vector3 position = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        Vector3 rotation = ENTITY::GET_ENTITY_ROTATION(vehicle, 2);
        Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(vehicle);
        position.z += 1.6f;
        ENTITY::SET_ENTITY_COORDS_NO_OFFSET(vehicle, position.x, position.y, position.z, FALSE, FALSE, TRUE);
        ENTITY::SET_ENTITY_VELOCITY(
            vehicle,
            velocity.x,
            velocity.y,
            std::max(velocity.z, 0.0f) + 9.0f
        );
        g_flippingVehicle = vehicle;
        g_vehicleFlipStartRotation = rotation;
        g_vehicleFlipStartedAt = GetTickCount64();
        g_vehicleFlipUntil = g_vehicleFlipStartedAt + kVehicleFlipDurationMs;
        g_vehicleFlipHalfLogged = false;
        return {0, "Le vehicule du joueur effectue un tonneau complet."};
    }
    if (code == "chaos_vehicle_random_color") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        int primary = static_cast<int>((GetTickCount64() / 7) % 160);
        int secondary = static_cast<int>((GetTickCount64() / 13 + 53) % 160);
        VEHICLE::SET_VEHICLE_COLOURS(vehicle, primary, secondary);
        return {0, "La couleur du vehicule a change."};
    }
    if (code == "chaos_vehicle_eject") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 16);
        ULONGLONG deadline = GetTickCount64() + 550;
        while (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE) && GetTickCount64() < deadline) WAIT(0);
        if (!PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) {
            PED::SET_PED_TO_RAGDOLL(ped, 2200, 2200, 0, TRUE, TRUE, FALSE);
            Vector3 forward = ENTITY::GET_ENTITY_FORWARD_VECTOR(vehicle);
            ENTITY::SET_ENTITY_VELOCITY(ped, forward.x * 18.0f, forward.y * 18.0f, 8.0f);
        } else {
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(vehicle, 1, 0.0f, 0.0f, 34.0f, TRUE, TRUE, TRUE, TRUE);
        }
        return {0, "Le joueur a ete ejecte du vehicule."};
    }
    if (code == "chaos_heal") {
        ENTITY::SET_ENTITY_HEALTH(ped, ENTITY::GET_ENTITY_MAX_HEALTH(ped));
        return {0, "La vie du joueur a ete restauree."};
    }
    if (code == "chaos_damage") {
        int health = ENTITY::GET_ENTITY_HEALTH(ped);
        ENTITY::SET_ENTITY_HEALTH(ped, std::max(1, health - 50));
        return {0, "Le joueur a perdu de la vie."};
    }
    if (code == "chaos_armor") {
        PED::SET_PED_ARMOUR(ped, 100);
        return {0, "L'armure du joueur a ete remplie."};
    }
    if (code == "chaos_clear_wanted") {
        PLAYER::CLEAR_PLAYER_WANTED_LEVEL(player);
        return {0, "La police ne recherche plus le joueur."};
    }
    if (code == "chaos_wanted_up") {
        int wanted = std::min(5, PLAYER::GET_PLAYER_WANTED_LEVEL(player) + 1);
        PLAYER::SET_PLAYER_WANTED_LEVEL(player, wanted, FALSE);
        PLAYER::SET_PLAYER_WANTED_LEVEL_NOW(player, FALSE);
        return {0, "Le niveau de recherche a augmente."};
    }
    if (code == "chaos_ragdoll") {
        return ForcePlayerRagdoll(ped, 5000);
    }
    if (code == "chaos_drunk") {
        return StartDrunkEffect(ped, 15000);
    }
    if (code == "chaos_super_jump") {
        return StartSuperJumpEffect(ped, 20000);
    }
    if (code == "chaos_explosive_ammo") {
        g_explosiveAmmoUntil = GetTickCount64() + 20000;
        return {0, "Les munitions sont explosives pendant 20 secondes."};
    }
    if (code == "chaos_explosive_melee") {
        g_explosiveMeleeUntil = GetTickCount64() + 20000;
        return {0, "Les coups sont explosifs pendant 20 secondes."};
    }
    if (code == "chaos_infinite_ammo") {
        WEAPON::SET_PED_INFINITE_AMMO_CLIP(ped, TRUE);
        g_infiniteAmmoActive = true;
        g_infiniteAmmoUntil = GetTickCount64() + 20000;
        return {0, "Les munitions sont infinies pendant 20 secondes."};
    }
    if (code == "chaos_remove_weapons") {
        WEAPON::REMOVE_ALL_PED_WEAPONS(ped, TRUE);
        return {0, "Toutes les armes du joueur ont ete retirees."};
    }
    if (code == "chaos_give_minigun") {
        WEAPON::GIVE_WEAPON_TO_PED(ped, 0x42BF8A85, 999, FALSE, TRUE);
        return {0, "Le joueur a recu un minigun."};
    }
    if (code == "chaos_weather_rain") {
        GAMEPLAY::SET_WEATHER_TYPE_NOW_PERSIST(const_cast<char*>("RAIN"));
        return {0, "La pluie s'est installee."};
    }
    if (code == "chaos_weather_thunder") {
        GAMEPLAY::SET_WEATHER_TYPE_NOW_PERSIST(const_cast<char*>("THUNDER"));
        return {0, "Un orage a commence."};
    }
    if (code == "chaos_weather_clear") {
        GAMEPLAY::CLEAR_OVERRIDE_WEATHER();
        GAMEPLAY::CLEAR_WEATHER_TYPE_PERSIST();
        GAMEPLAY::SET_WEATHER_TYPE_NOW_PERSIST(const_cast<char*>("CLEAR"));
        return {0, "Le ciel s'est degage."};
    }
    if (code == "chaos_slow_motion") {
        GAMEPLAY::SET_TIME_SCALE(0.35f);
        g_slowMotionActive = true;
        g_slowMotionUntil = GetTickCount64() + 10000;
        return {0, "Le jeu est ralenti pendant 10 secondes."};
    }
    if (code == "chaos_freeze_player") {
        if (g_frozenEntity && ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) {
            ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, FALSE);
        }
        g_frozenEntity = PlayerTarget(ped);
        ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, TRUE);
        g_frozenUntil = GetTickCount64() + 5000;
        return {0, "Le joueur est immobilise pendant 5 secondes."};
    }
    if (code == "chaos_explode_nearby_vehicles") return AffectNearbyVehicles(ped, true, false);
    if (code == "chaos_launch_nearby_vehicles") return AffectNearbyVehicles(ped, false, true);
    if (code == "chaos_prison") {
        return StartPrison(ped);
    }
    if (code == "chaos_black_hole") {
        Entity target = PlayerTarget(ped);
        Vector3 position = ENTITY::GET_ENTITY_COORDS(target, TRUE);
        Vector3 forward = GameplayCameraForward();
        float horizontalLength = std::max(
            0.01f,
            std::sqrt(forward.x * forward.x + forward.y * forward.y)
        );
        forward.x /= horizontalLength;
        forward.y /= horizontalLength;
        g_blackHoleCenter = {
            position.x + forward.x * 70.0f,
            0,
            position.y + forward.y * 70.0f,
            0,
            position.z + 38.0f,
            0
        };
        g_blackHoleStartedAt = GetTickCount64();
        g_blackHolePullStartsAt =
            g_blackHoleStartedAt + kBlackHoleTelegraphMs;
        g_blackHoleUntil =
            g_blackHoleStartedAt + kBlackHoleDurationMs;
        g_nextBlackHolePullAt = g_blackHolePullStartsAt;
        return {0, "Un enorme trou noir apparait face a la camera avant d'attirer progressivement tout le monde."};
    }
    if (code == "chaos_meteor") {
        Vector3 p = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(PlayerTarget(ped), 0.0f, 10.0f, 4.0f);
        FIRE::ADD_EXPLOSION(p.x, p.y, p.z, 29, 4.0f, TRUE, FALSE, 1.0f);
        return {0, "Une meteorite est tombee pres du joueur."};
    }
    if (code == "chaos_zombie_horde") {
        const Hash models[] = { HashName("u_m_y_zombie_01") };
        return SpawnHostilePeds(ped, models, sizeof(models) / sizeof(models[0]), 7, "zombie(s)");
    }
    if (code == "chaos_spawn_alien") {
        const Hash models[] = { HashName("s_m_m_movalien_01"), HashName("s_m_m_movspace_01") };
        return SpawnHostilePeds(ped, models, sizeof(models) / sizeof(models[0]), 3, "alien(s)");
    }
    if (code == "chaos_magnetic_storm") {
        g_magneticStormUntil = GetTickCount64() + 7000;
        return PullNearbyVehicles(ped, true, true);
    }
    if (code == "chaos_half_turn") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        ENTITY::SET_ENTITY_HEADING(vehicle, ENTITY::GET_ENTITY_HEADING(vehicle) + 180.0f);
        return {0, "Le vehicule a fait demi-tour."};
    }
    if (code == "chaos_dance") {
        Vehicle vehicle = 0;
        if (CurrentPlayerVehicle(ped, vehicle)) {
            AI::TASK_LEAVE_VEHICLE(ped, vehicle, 4160);
            ULONGLONG deadline = GetTickCount64() + 1200;
            while (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE) && GetTickCount64() < deadline) WAIT(0);
            if (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) {
                Vector3 exit = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 3.2f, 0.0f, 0.8f);
                Teleport(ped, exit);
                WAIT(0);
            }
        }
        AI::CLEAR_PED_TASKS(ped);
        AI::TASK_START_SCENARIO_IN_PLACE(ped, const_cast<char*>("WORLD_HUMAN_PARTYING"), 0, TRUE);
        g_dancePed = ped;
        g_danceUntil = GetTickCount64() + 30000;
        return {0, "Le joueur danse pendant 30 secondes."};
    }
    if (code == "chaos_propulsion") {
        Entity target = PlayerTarget(ped);
        Vector3 forward = ENTITY::GET_ENTITY_FORWARD_VECTOR(target);
        ENTITY::SET_ENTITY_VELOCITY(target, forward.x * 50.0f, forward.y * 50.0f, 10.0f);
        return {0, "Le joueur a ete propulse vers l'avant."};
    }
    if (code == "chaos_tank_on_head") return SpawnVehicleAbovePlayer(ped, HashName("rhino"), "Un tank");
    if (code == "chaos_animal_random") return SpawnFriendlyAnimal(ped);
    if (code == "chaos_tp_sky") {
        Entity target = PlayerTarget(ped);
        Vector3 p = ENTITY::GET_ENTITY_COORDS(target, TRUE);
        p.z += 220.0f;
        TeleportPlayer(ped, p);
        return {0, "Le joueur a ete teleporte dans le ciel."};
    }
    if (code == "chaos_train_hit") {
        return StartTrainHit(ped);
    }
    if (code == "chaos_delete_vehicle") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
        VEHICLE::DELETE_VEHICLE(&vehicle);
        return {0, "Le vehicule du joueur a ete supprime."};
    }
    if (code.rfind("gift_show", 0) == 0 || code.rfind("gift_drop_", 0) == 0) return SpawnTikTokGiftObject(ped, code);
    return {4, "Cette interaction Mont Chiliad n'est pas reconnue."};
}

void ProcessQueue() {
    {
        std::lock_guard<std::mutex> guard(g_queueLock);
        if (g_queue.empty()) return;
    }

    for (int i = 0; i < 32; ++i) {
        Player player = 0;
        Ped ped = 0;
        bool playerReady = PlayerReady(player, ped);
        Request request = {};
        {
            std::lock_guard<std::mutex> guard(g_queueLock);
            if (g_queue.empty()) return;
            if (playerReady) {
                request = g_queue.front();
                g_queue.pop_front();
            } else {
                std::deque<Request>::iterator recovery = std::find_if(g_queue.begin(), g_queue.end(), [](const Request& queued) {
                    std::string code = queued.code;
                    std::transform(code.begin(), code.end(), code.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                    return code == "chaos_exit_prison";
                });
                if (recovery == g_queue.end()) return;
                request = *recovery;
                g_queue.erase(recovery);
            }
        }
        Result result;
        try { result = Execute(request.code); }
        catch (...) { result = {5, "L'interaction a echoue dans GTA Enhanced."}; }
        if (result.status == kEffectRetryStatus) {
            std::lock_guard<std::mutex> guard(g_queueLock);
            g_queue.push_front(request);
            return;
        }
        Reply(request.id, result);
        Log("Effect " + request.code + " returned status " + std::to_string(result.status) + ".");
    }
}
} }
