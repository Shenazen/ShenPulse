/** Domaine gifts ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
void DeleteGiftObject(Entity entity) {
    if (!entity || !ENTITY::DOES_ENTITY_EXIST(entity)) return;
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(entity, TRUE, TRUE);
    ENTITY::DELETE_ENTITY(&entity);
}

void DeleteGiftObjects() {
    for (size_t index = 0; index < g_giftObjects.size(); ++index) {
        DeleteGiftObject(g_giftObjects[index].entity);
    }
    g_giftObjects.clear();
}

void CleanupGiftObjects(ULONGLONG) {
    for (size_t index = 0; index < g_giftObjects.size();) {
        TimedGiftObject& gift = g_giftObjects[index];
        if (!gift.entity || !ENTITY::DOES_ENTITY_EXIST(gift.entity)) {
            DeleteGiftObject(gift.entity);
            g_giftObjects.erase(g_giftObjects.begin() + index);
            continue;
        }
        ++index;
    }
}

int GiftTier(const std::string& code) {
    size_t position = code.find("gift_show_t");
    if (position == std::string::npos) return 0;
    position += 11;
    if (position >= code.size() || code[position] < '0' || code[position] > '9') return 0;
    return std::min(8, std::max(0, code[position] - '0'));
}

bool GiftCodeContainsAny(const std::string& code, const char* const* keywords, size_t keywordCount) {
    for (size_t index = 0; index < keywordCount; ++index) {
        if (keywords[index] && keywords[index][0] && code.find(keywords[index]) != std::string::npos) return true;
    }
    return false;
}

float GiftMarkerScale(int tier, float baseScale) {
    if (tier >= 8) return std::max(baseScale, 6.8f);
    if (tier >= 7) return std::max(baseScale, 5.2f);
    if (tier >= 6) return std::max(baseScale, 3.8f);
    if (tier >= 5) return std::max(baseScale, 2.7f);
    if (tier >= 4) return std::max(baseScale, 1.85f);
    if (tier >= 3) return std::max(baseScale, 1.25f);
    if (tier >= 2) return std::max(baseScale, 0.85f);
    return baseScale;
}

void AddGiftEntity(Entity entity, int red, int green, int blue, float markerScale) {
    (void)red;
    (void)green;
    (void)blue;
    (void)markerScale;
    g_giftObjects.push_back({entity});
    while (g_giftObjects.size() > kMaxGiftObjects) {
        DeleteGiftObject(g_giftObjects.front().entity);
        g_giftObjects.erase(g_giftObjects.begin());
    }
}

Entity GiftTarget(Ped playerPed) {
    return PlayerTarget(playerPed);
}

Vector3 GiftPosition(Entity target, float forward, float up, float sideStep) {
    float side = static_cast<float>(static_cast<int>((GetTickCount64() / 173ULL) % 5ULL) - 2) * sideStep;
    return ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(target, side, forward, up);
}

Result SpawnGiftObject(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward, float up) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || !modelNames || modelCount == 0) {
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Hash model = 0;
    Result lastError = {5, std::string(label) + " n'a pas de modele GTA disponible."};
    for (size_t index = 0; index < modelCount; ++index) {
        if (!modelNames[index] || !modelNames[index][0]) continue;
        Hash candidate = HashName(modelNames[index]);
        Result loaded = LoadModel(candidate, label);
        if (loaded.status == 0) {
            model = candidate;
            break;
        }
        lastError = loaded;
    }
    if (!model) {
        const char* fallbackModels[] = {"prop_ld_int_safe_01", "prop_money_bag_01", "prop_tool_box_04", "prop_roadcone02a"};
        for (size_t index = 0; index < sizeof(fallbackModels) / sizeof(fallbackModels[0]); ++index) {
            Hash candidate = HashName(fallbackModels[index]);
            Result loaded = LoadModel(candidate, label);
            if (loaded.status == 0) {
                model = candidate;
                break;
            }
            lastError = loaded;
        }
    }
    if (!model) return lastError;

    Entity target = GiftTarget(playerPed);
    Vector3 position = GiftPosition(target, forward, up, 0.85f);
    Object object = OBJECT::CREATE_OBJECT_NO_OFFSET(model, position.x, position.y, position.z, FALSE, FALSE, TRUE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!object || !ENTITY::DOES_ENTITY_EXIST(object)) {
        return {5, std::string(label) + " n'a pas pu apparaitre dans GTA."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object, TRUE, TRUE);
    OBJECT::PLACE_OBJECT_ON_GROUND_PROPERLY(object);
    ENTITY::SET_ENTITY_HEADING(object, ENTITY::GET_ENTITY_HEADING(target));
    ENTITY::FREEZE_ENTITY_POSITION(object, TRUE);
    AddGiftEntity(object, red, green, blue, markerScale);

    DrawHudText(std::string("CADEAU TIKTOK - ") + label, red, green, blue);
    return {0, std::string(label) + " apparait dans le jeu."};
}

Result SpawnGiftPed(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward, float up) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || !modelNames || modelCount == 0) {
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Hash model = 0;
    Result lastError = {5, std::string(label) + " n'a pas de modele GTA disponible."};
    for (size_t index = 0; index < modelCount; ++index) {
        if (!modelNames[index] || !modelNames[index][0]) continue;
        Hash candidate = HashName(modelNames[index]);
        Result loaded = LoadModel(candidate, label);
        if (loaded.status == 0) {
            model = candidate;
            break;
        }
        lastError = loaded;
    }
    if (!model) return lastError;

    Entity target = GiftTarget(playerPed);
    Vector3 position = GiftPosition(target, forward, up, 1.65f);
    Ped ped = PED::CREATE_PED(28, model, position.x, position.y, position.z, ENTITY::GET_ENTITY_HEADING(target) + 180.0f, FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) {
        return {5, std::string(label) + " n'a pas pu apparaitre dans GTA."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(ped, TRUE, TRUE);
    PED::SET_BLOCKING_OF_NON_TEMPORARY_EVENTS(ped, TRUE);
    PED::SET_PED_CAN_RAGDOLL(ped, FALSE);
    ENTITY::SET_ENTITY_COLLISION(ped, FALSE, FALSE);
    ENTITY::FREEZE_ENTITY_POSITION(ped, TRUE);
    AI::TASK_STAND_STILL(ped, 30000);
    AddGiftEntity(ped, red, green, blue, markerScale);
    DrawHudText(std::string("CADEAU TIKTOK - ") + label, red, green, blue);
    return {0, std::string(label) + " apparait dans le jeu."};
}

Result SpawnGiftVehicle(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward, float up, bool airborne) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || !modelNames || modelCount == 0) {
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Hash model = 0;
    Result lastError = {5, std::string(label) + " n'a pas de modele GTA disponible."};
    for (size_t index = 0; index < modelCount; ++index) {
        if (!modelNames[index] || !modelNames[index][0]) continue;
        Hash candidate = HashName(modelNames[index]);
        Result loaded = LoadModel(candidate, label);
        if (loaded.status == 0) {
            model = candidate;
            break;
        }
        lastError = loaded;
    }
    if (!model) return lastError;

    Entity target = GiftTarget(playerPed);
    Vector3 position = GiftPosition(target, forward, up, 1.4f);
    Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, position.x, position.y, position.z, ENTITY::GET_ENTITY_HEADING(target) + 180.0f, FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) {
        return {5, std::string(label) + " n'a pas pu apparaitre dans GTA."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
    VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, FALSE, TRUE, FALSE);
    VEHICLE::SET_VEHICLE_DOORS_LOCKED_FOR_ALL_PLAYERS(vehicle, TRUE);
    VEHICLE::SET_VEHICLE_FORWARD_SPEED(vehicle, 0.0f);
    ENTITY::SET_ENTITY_COLLISION(vehicle, FALSE, FALSE);
    ENTITY::FREEZE_ENTITY_POSITION(vehicle, TRUE);
    if (!airborne) VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(vehicle);
    AddGiftEntity(vehicle, red, green, blue, markerScale);
    DrawHudText(std::string("CADEAU TIKTOK - ") + label, red, green, blue);
    return {0, std::string(label) + " apparait dans le jeu."};
}

Result SpawnGiftPedOrObject(Ped playerPed, const char* label, const char* const* pedModels, size_t pedModelCount, const char* const* objectModels, size_t objectModelCount, int red, int green, int blue, float markerScale, float forward, float up) {
    Result ped = SpawnGiftPed(playerPed, label, pedModels, pedModelCount, red, green, blue, markerScale, forward, up);
    if (ped.status == 0 || ped.status == kEffectRetryStatus) return ped;
    return SpawnGiftObject(playerPed, label, objectModels, objectModelCount, red, green, blue, markerScale, forward, up);
}

Result SpawnGiftVehicleOrObject(Ped playerPed, const char* label, const char* const* vehicleModels, size_t vehicleModelCount, const char* const* objectModels, size_t objectModelCount, int red, int green, int blue, float markerScale, float forward, float up, bool airborne) {
    Result vehicle = SpawnGiftVehicle(playerPed, label, vehicleModels, vehicleModelCount, red, green, blue, markerScale, forward, up, airborne);
    if (vehicle.status == 0 || vehicle.status == kEffectRetryStatus) return vehicle;
    return SpawnGiftObject(playerPed, label, objectModels, objectModelCount, red, green, blue, markerScale, forward, up);
}

Result SpawnTikTokGiftObject(Ped playerPed, const std::string& code) {
    int tier = GiftTier(code);
    float tierMarker = GiftMarkerScale(tier);
    const char* whaleKeywords[] = {"_whale_", "baleine", "orca", "killerwhale", "humpback", "cachalot"};
    if (GiftCodeContainsAny(code, whaleKeywords, sizeof(whaleKeywords) / sizeof(whaleKeywords[0]))) {
        const char* pedModels[] = {"a_c_humpback", "a_c_killerwhale", "a_c_dolphin", "a_c_sharktiger"};
        const char* objectModels[] = {"prop_container_03a", "prop_air_bigradar_l1", "prop_byard_float_01"};
        return SpawnGiftPedOrObject(playerPed, "Baleine TikTok", pedModels, sizeof(pedModels) / sizeof(pedModels[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 60, 185, 255, GiftMarkerScale(std::max(tier, 7), 6.0f), 9.5f, 4.5f);
    }
    const char* seaKeywords[] = {"_sea_", "dolphin", "shark", "requin", "fish", "poisson", "ocean", "turtle", "crab", "octopus", "jellyfish", "meduse", "sirene", "mermaid"};
    if (GiftCodeContainsAny(code, seaKeywords, sizeof(seaKeywords) / sizeof(seaKeywords[0]))) {
        const char* pedModels[] = {"a_c_dolphin", "a_c_sharktiger", "a_c_fish"};
        const char* objectModels[] = {"prop_byard_float_01", "prop_container_03a", "prop_amb_beach_ring_01"};
        return SpawnGiftPedOrObject(playerPed, "Animal marin TikTok", pedModels, sizeof(pedModels) / sizeof(pedModels[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 70, 210, 255, GiftMarkerScale(std::max(tier, 4), 2.8f), 7.0f, 2.6f);
    }
    const char* lionKeywords[] = {"_lion_", "tiger", "tigre", "panther", "leopard", "puma"};
    if (GiftCodeContainsAny(code, lionKeywords, sizeof(lionKeywords) / sizeof(lionKeywords[0]))) {
        const char* models[] = {"a_c_mtlion", "a_c_retriever", "a_c_deer"};
        return SpawnGiftPed(playerPed, "Fauve TikTok", models, sizeof(models) / sizeof(models[0]), 255, 184, 72, GiftMarkerScale(std::max(tier, 4), 2.2f), 5.5f, 0.8f);
    }
    const char* animalKeywords[] = {"_animal_", "corgi", "dog", "chien", "puppy", "cat", "kitten", "chat", "panda", "bear", "ours", "elephant", "girafa", "giraffe", "girafe", "monkey", "gorilla", "chimp", "deer", "cerf", "rabbit", "lapin", "fox", "wolf"};
    if (GiftCodeContainsAny(code, animalKeywords, sizeof(animalKeywords) / sizeof(animalKeywords[0]))) {
        const char* models[] = {"a_c_deer", "a_c_cow", "a_c_boar", "a_c_retriever", "a_c_chop", "a_c_coyote"};
        return SpawnGiftPed(playerPed, "Animal TikTok", models, sizeof(models) / sizeof(models[0]), 130, 230, 120, GiftMarkerScale(std::max(tier, 3), 1.8f), 5.3f, 0.75f);
    }
    const char* vehicleKeywords[] = {"_vehicle_", "car", "voiture", "racecar", "racing", "moto", "motorcycle", "bike", "train", "bus", "taxi", "truck", "yacht", "boat", "ship", "bateau"};
    if (GiftCodeContainsAny(code, vehicleKeywords, sizeof(vehicleKeywords) / sizeof(vehicleKeywords[0]))) {
        const char* models[] = {"adder", "zentorno", "turismor", "comet2", "banshee", "blista"};
        const char* objectModels[] = {"prop_tool_box_04", "prop_barrier_work05"};
        return SpawnGiftVehicleOrObject(playerPed, "Vehicule TikTok", models, sizeof(models) / sizeof(models[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 92, 220, 255, GiftMarkerScale(std::max(tier, 4), 2.3f));
    }
    const char* airKeywords[] = {"_air_", "plane", "jet", "aircraft", "helicopter", "helico", "rocket", "fusee", "spaceship", "ufo"};
    if (GiftCodeContainsAny(code, airKeywords, sizeof(airKeywords) / sizeof(airKeywords[0]))) {
        const char* models[] = {"luxor", "cuban800", "dodo", "maverick", "frogger"};
        const char* objectModels[] = {"prop_air_bigradar_l1", "prop_ld_bomb", "prop_mp_cone_02"};
        return SpawnGiftVehicleOrObject(playerPed, "Avion TikTok", models, sizeof(models) / sizeof(models[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 104, 204, 255, GiftMarkerScale(std::max(tier, 6), 3.6f), 10.5f, 6.5f, true);
    }
    const char* spaceKeywords[] = {"_space_", "galaxy", "galaxie", "star", "etoile", "interstellar", "universe", "planet", "moon", "lune", "sun", "soleil", "meteor", "comet"};
    if (GiftCodeContainsAny(code, spaceKeywords, sizeof(spaceKeywords) / sizeof(spaceKeywords[0]))) {
        const char* vehicleModels[] = {"luxor", "cuban800", "dodo", "blista"};
        const char* objectModels[] = {"prop_air_bigradar_l1", "prop_ld_int_safe_01", "prop_money_bag_01", "prop_tool_box_04"};
        return SpawnGiftVehicleOrObject(playerPed, "Galaxie TikTok", vehicleModels, sizeof(vehicleModels) / sizeof(vehicleModels[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 124, 92, 255, GiftMarkerScale(std::max(tier, 6), 4.0f), 8.0f, 2.2f, true);
    }
    const char* moneyKeywords[] = {"_money_", "cash", "coin", "coins", "gold", "argent", "billet", "treasure", "jackpot", "bank", "diamond", "diamant", "coffre"};
    if (GiftCodeContainsAny(code, moneyKeywords, sizeof(moneyKeywords) / sizeof(moneyKeywords[0]))) {
        const char* models[] = {"prop_money_bag_01", "prop_cash_case_01", "prop_anim_cash_pile_01", "prop_ld_int_safe_01", "prop_poly_bag_money"};
        return SpawnGiftObject(playerPed, "Argent TikTok", models, sizeof(models) / sizeof(models[0]), 96, 255, 150, GiftMarkerScale(tier, 1.2f));
    }
    if (code.find("rose") != std::string::npos || code.find("rosa") != std::string::npos || code.find("_flower_") != std::string::npos || code.find("bouquet") != std::string::npos || code.find("fleur") != std::string::npos) {
        const char* models[] = {"prop_single_rose", "prop_plant_int_04a", "prop_plant_int_02a"};
        return SpawnGiftObject(playerPed, "Rose TikTok", models, sizeof(models) / sizeof(models[0]), 255, 92, 132, GiftMarkerScale(tier, 0.7f));
    }
    if (code.find("heart") != std::string::npos || code.find("coeur") != std::string::npos || code.find("love") != std::string::npos) {
        const char* models[] = {"prop_ld_health_pack", "prop_med_bag_01"};
        return SpawnGiftObject(playerPed, "Coeur TikTok", models, sizeof(models) / sizeof(models[0]), 255, 72, 108, GiftMarkerScale(tier, 0.85f));
    }
    const char* foodKeywords[] = {"_food_", "donut", "doughnut", "cake", "gateau", "pizza", "burger", "icecream", "popcorn", "candy", "chocolate", "coffee", "sushi"};
    if (GiftCodeContainsAny(code, foodKeywords, sizeof(foodKeywords) / sizeof(foodKeywords[0]))) {
        const char* models[] = {"prop_amb_donut", "prop_donut_01", "prop_cs_burger_01", "prop_food_bs_burg3", "prop_food_cb_burg02"};
        return SpawnGiftObject(playerPed, "Nourriture TikTok", models, sizeof(models) / sizeof(models[0]), 255, 186, 92, GiftMarkerScale(tier, 1.0f));
    }
    if (code.find("ball") != std::string::npos || code.find("cap") != std::string::npos || code.find("basket") != std::string::npos || code.find("_sports_") != std::string::npos || code.find("trophy") != std::string::npos) {
        const char* models[] = {"prop_beachball_02", "prop_bskball_01", "prop_beach_volball01"};
        return SpawnGiftObject(playerPed, "Sport TikTok", models, sizeof(models) / sizeof(models[0]), 92, 210, 255, GiftMarkerScale(tier, 1.0f));
    }
    if (code.find("_fire_") != std::string::npos || code.find("firework") != std::string::npos || code.find("magic") != std::string::npos || code.find("thunder") != std::string::npos || code.find("lightning") != std::string::npos) {
        const char* models[] = {"prop_ld_bomb", "prop_mp_cone_02", "prop_gas_tank_01a"};
        return SpawnGiftObject(playerPed, "Effet lumineux TikTok", models, sizeof(models) / sizeof(models[0]), 255, 120, 40, GiftMarkerScale(tier, 2.0f), 5.6f, 1.6f);
    }
    if (code.find("_music_") != std::string::npos || code.find("microphone") != std::string::npos || code.find("guitar") != std::string::npos || code.find("piano") != std::string::npos) {
        const char* models[] = {"prop_el_guitar_01", "prop_microphone_02", "prop_speaker_05"};
        return SpawnGiftObject(playerPed, "Musique TikTok", models, sizeof(models) / sizeof(models[0]), 180, 120, 255, GiftMarkerScale(tier, 1.4f));
    }
    if (code.find("_royal_") != std::string::npos || code.find("_luxury_") != std::string::npos || code.find("crown") != std::string::npos || code.find("couronne") != std::string::npos || code.find("perfume") != std::string::npos || code.find("parfum") != std::string::npos) {
        const char* models[] = {"prop_ld_int_safe_01", "prop_jewel_02a", "prop_money_bag_01"};
        return SpawnGiftObject(playerPed, "Luxe TikTok", models, sizeof(models) / sizeof(models[0]), 255, 210, 80, GiftMarkerScale(std::max(tier, 4), 1.9f));
    }
    if (tier >= 7) {
        const char* models[] = {"adder", "zentorno", "turismor", "cuban800"};
        const char* objectModels[] = {"prop_air_bigradar_l1", "prop_ld_int_safe_01", "prop_container_03a"};
        return SpawnGiftVehicleOrObject(playerPed, "Mega cadeau TikTok", models, sizeof(models) / sizeof(models[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 255, 210, 80, GiftMarkerScale(tier, 4.2f), 8.0f, 2.0f);
    }
    if (tier >= 5) {
        const char* models[] = {"prop_ld_int_safe_01", "prop_money_bag_01", "prop_jewel_02a", "prop_container_03a"};
        return SpawnGiftObject(playerPed, "Gros cadeau TikTok", models, sizeof(models) / sizeof(models[0]), 255, 210, 80, GiftMarkerScale(tier, 2.2f), 5.5f, 1.6f);
    }

    const char* models[] = {"prop_ld_int_safe_01", "prop_money_bag_01", "prop_jewel_02a", "prop_tool_box_04"};
    return SpawnGiftObject(playerPed, "Cadeau TikTok", models, sizeof(models) / sizeof(models[0]), 255, 216, 92, tierMarker);
}
} }
