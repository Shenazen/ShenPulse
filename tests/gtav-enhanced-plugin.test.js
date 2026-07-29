"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const sourcePath = path.join(
  __dirname,
  "..",
  "native",
  "gtav-montchiliad-enhanced",
  "src",
  "ShenPulseMontChiliadEnhanced.cpp"
);
const source = fs.readFileSync(sourcePath, "utf8");

test("le changement aléatoire GTA répartit réellement les véhicules atypiques", () => {
  assert.match(source, /RandomChoiceIndex\(10\)/);
  assert.match(source, /"bmx".*"cruiser".*"fixter"/s);
  assert.match(source, /"seashark".*"jetmax".*"squalo"/s);
  assert.match(source, /"forklift".*"handler".*"mower"/s);
  assert.match(source, /"ambulance".*"firetruk".*"police"/s);
  assert.match(source, /"annihilator".*"buzzard".*"cargobob"/s);
  assert.match(source, /VEHICLE::DELETE_VEHICLE\(&previousVehicle\)/);
});

test("le remplacement de véhicule confirme que le joueur est réellement au volant", () => {
  const spawnVehicle = source.match(
    /Result SpawnVehicleForPlayer\(Hash model, const char\* label = nullptr\) \{([\s\S]*?)\n\}\nResult AffectNearbyVehicles/
  )?.[1];

  assert.ok(spawnVehicle, "la fonction de remplacement de véhicule doit exister");
  assert.match(spawnVehicle, /AI::TASK_LEAVE_VEHICLE\(ped, previousVehicle, 16\)/);
  assert.match(spawnVehicle, /PED::IS_PED_IN_VEHICLE\(ped, vehicle, FALSE\)/);
  assert.match(spawnVehicle, /ULONGLONG seatDeadline = GetTickCount64\(\) \+ 1500/);
  assert.match(
    spawnVehicle,
    /if \(!PED::IS_PED_IN_VEHICLE\(ped, vehicle, FALSE\)\) \{[\s\S]*?return \{5,[\s\S]*?au volant/
  );
  assert.ok(
    spawnVehicle.indexOf("if (!PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE))")
      < spawnVehicle.lastIndexOf("VEHICLE::DELETE_VEHICLE(&previousVehicle)"),
    "l'ancien véhicule ne doit être supprimé qu'après la validation du transfert"
  );
  assert.match(
    source,
    /chaos_vehicle_supercar"\) return SpawnVehicleForPlayer\(HashName\("adder"\), "supercar Adder"\)/
  );
});

test("la chute du joueur est forcée puis confirmée par GTA", () => {
  const ragdoll = source.match(
    /Result ForcePlayerRagdoll\(Ped ped, int durationMs\) \{([\s\S]*?)\n\}\nResult SpawnVehicleForPlayer/
  )?.[1];

  assert.ok(ragdoll, "la procédure de chute vérifiable doit exister");
  assert.match(ragdoll, /AI::TASK_LEAVE_VEHICLE\(ped, vehicle, 16\)/);
  assert.match(ragdoll, /PED::SET_PED_CAN_RAGDOLL\(ped, TRUE\)/);
  assert.match(ragdoll, /PED::SET_PED_TO_RAGDOLL\(/);
  assert.match(ragdoll, /PED::IS_PED_RAGDOLL\(ped\)/);
  assert.match(
    ragdoll,
    /if \(!PED::IS_PED_RAGDOLL\(ped\)\) \{[\s\S]*?return \{5,[\s\S]*?faire chuter/
  );
  assert.match(
    source,
    /if \(code == "chaos_ragdoll"\) \{\s*return ForcePlayerRagdoll\(ped, 5000\)/
  );
});

test("l'ivresse combine une démarche et un effet visuel vérifié", () => {
  const drunkEffect = source.match(
    /Result StartDrunkEffect\(Ped ped, int durationMs\) \{([\s\S]*?)\n\}\nResult SpawnVehicleForPlayer/
  )?.[1];

  assert.ok(drunkEffect, "la procédure d'ivresse visible doit exister");
  assert.match(drunkEffect, /move_m@drunk@verydrunk/);
  assert.match(drunkEffect, /STREAMING::HAS_ANIM_SET_LOADED/);
  assert.match(drunkEffect, /PED::SET_PED_MOVEMENT_CLIPSET/);
  assert.match(drunkEffect, /GRAPHICS::SET_TIMECYCLE_MODIFIER/);
  assert.match(drunkEffect, /CAM::IS_GAMEPLAY_CAM_SHAKING\(\)/);
  assert.match(
    source,
    /if \(code == "chaos_drunk"\) \{\s*return StartDrunkEffect\(ped, 15000\)/
  );
  assert.match(source, /PED::RESET_PED_MOVEMENT_CLIPSET\(g_drunkPed, 0\.5f\)/);
  assert.match(source, /GRAPHICS::CLEAR_TIMECYCLE_MODIFIER\(\)/);
});

test("le super saut réutilise la propulsion verticale déjà validée", () => {
  assert.match(source, /GAMEPLAY::SET_SUPER_JUMP_THIS_FRAME\(player\)/);
  assert.match(source, /Result StartSuperJumpEffect\(Ped ped, int durationMs\)/);
  assert.match(source, /PED::IS_PED_ON_FOOT\(ped\)/);
  assert.match(source, /CONTROLS::IS_CONTROL_JUST_PRESSED\(0, 22\)/);
  assert.match(source, /now >= g_nextSuperJumpBoostAt/);
  assert.match(
    source,
    /Result StartSuperJumpEffect[\s\S]*?ENTITY::SET_ENTITY_VELOCITY\([\s\S]*?std::max\(velocity\.z, 0\.0f\) \+ 28\.0f/
  );
  assert.doesNotMatch(
    source.match(
      /Result StartSuperJumpEffect\(Ped ped, int durationMs\) \{([\s\S]*?)\n\}\nResult SpawnVehicleForPlayer/
    )?.[1] || "",
    /TASK_JUMP/
  );
  assert.match(source, /g_nextSuperJumpBoostAt = now \+ 1200/);
  assert.match(
    source,
    /if \(code == "chaos_super_jump"\) \{\s*return StartSuperJumpEffect\(ped, 20000\)/
  );
});

test("le trou noir est visible dans le ciel et attire le monde entier, joueur compris", () => {
  assert.match(source, /void DrawBlackHole\(\)/);
  assert.match(source, /52\.0f, 52\.0f, 52\.0f/);
  assert.match(source, /position\.x \+ forward\.x \* 70\.0f/);
  assert.match(source, /position\.z \+ 38\.0f/);
  assert.match(source, /worldGetAllVehicles\(entities, maxEntities\)/);
  assert.match(source, /worldGetAllPeds\(entities, maxEntities\)/);
  assert.match(source, /worldGetAllObjects\(entities, maxEntities\)/);
  assert.match(source, /PullEntityIntoBlackHole\(playerTarget, playerTarget\)/);
  assert.match(source, /g_blackHolePullStartsAt\s*=\s*g_blackHoleStartedAt \+ kBlackHoleTelegraphMs/);
  assert.match(source, /if \(entity == playerTarget\) speed = 7\.0f \+ progress \* 18\.0f/);
});

test("le choc du train fait apparaître une locomotive et applique un impact brutal", () => {
  const train = source.match(
    /Result StartTrainHit\(Ped playerPed\) \{([\s\S]*?)\n\}\nvoid UpdateTrainHit/
  )?.[1];
  assert.ok(train, "la séquence visible de la locomotive doit exister");
  assert.match(train, /HashName\("freight"\)/);
  assert.match(train, /VEHICLE::CREATE_VEHICLE/);
  assert.match(train, /ENTITY::SET_ENTITY_VISIBLE\(train, TRUE, FALSE\)/);
  assert.match(train, /g_trainApproachAt = now \+ kTrainTelegraphMs/);
  assert.match(source, /const int kTrainApproachMs = 1050/);
  assert.match(source, /ENTITY::SET_ENTITY_COORDS_NO_OFFSET\(\s*g_trainVehicle/);
  assert.match(source, /g_trainDirection\.x \* 130\.0f/);
  assert.match(source, /PED::SET_PED_TO_RAGDOLL\(playerPed, 4200, 4200/);
  assert.match(
    source,
    /if \(code == "chaos_train_hit"\) \{\s*return StartTrainHit\(ped\)/
  );
});

test("GTA affiche chaque variation WINS et connaît le multiplicateur X2", () => {
  assert.match(source, /if \(code == "overlay_win_x2"\)/);
  assert.match(source, /g_nativeWinMultiplierUntil = GetTickCount64\(\) \+ 60000/);
  assert.match(source, /MULTIPLICATEUR WINS X2  -  60 SEC/);
  assert.match(source, /MORT  /);
  assert.match(source, /VICTOIRE  /);
  assert.match(
    source,
    /g_counterHudUntil\s*=\s*now \+ static_cast<ULONGLONG>\(kWinCelebrationSeconds\) \* 1000ULL/
  );
  assert.match(source, /DrawHudText\(\s*g_counterHudText/);
  assert.match(source, /GRAPHICS::DRAW_RECT\(0\.5f, 0\.84f/);
  assert.match(source, /playerHealth <= 0/);
  assert.match(source, /PED::IS_PED_FATALLY_INJURED\(ped\)/);
  assert.match(source, /const int kVictoryHoldSeconds = 10/);
  assert.match(
    source,
    /if \(!g_roundActive && !g_airportTeleportAt\) \{\s*StartRound\("natural-zone-entered"\)/
  );
  const tpMountChiliad = source.match(
    /if \(code == "chaos_tp_mountchilliad"\) \{([\s\S]*?)\n\s*\}/
  )?.[1];
  assert.ok(tpMountChiliad);
  assert.doesNotMatch(tpMountChiliad, /StartRound/);
  assert.match(
    source,
    /now - g_zoneStart\s*>= static_cast<ULONGLONG>\(kVictoryHoldSeconds\) \* 1000ULL/
  );
  assert.match(source, /g_airportTeleportAt = now \+ kAirportTeleportDelayMs/);
  assert.match(source, /TeleportPlayer\(ped, kAirport\)/);
  assert.match(source, /\\"victoryRule\\":\\"hold-circle-10s\\"/);
  assert.doesNotMatch(source, /kRoundSeconds/);
  assert.doesNotMatch(source, /survive-timer/);
});

test("le manifeste 1.0.3 correspond au module GTA Enhanced compilé", () => {
  const manifest = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        "..",
        "resources",
        "installer-assets",
        "gtav-montchiliad",
        "1.0.3",
        "manifest.json"
      ),
      "utf8"
    )
  );
  assert.equal(manifest.version, "1.0.3");
  assert.equal(manifest.assets.length, 1);
  assert.equal(manifest.assets[0].id, "enhancedplugin");
  assert.equal(manifest.assets[0].size, 394752);
  assert.equal(manifest.assets[0].sha256.length, 64);
});
