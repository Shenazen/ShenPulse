-- ShenPulse Hogwarts Legacy. Module local UE4SS distinct du module tiers fourni.
local source = debug.getinfo(1, "S").source:gsub("^@", ""):gsub("\\", "/")
local directory = assert(source:match("^(.*)/Scripts/[^/]+$"), "Dossier ShenPulse introuvable") .. "/"
local game_id = "hogwarts-legacy"
local function read(file)
    local handle = io.open(directory .. file, "rb")
    if not handle then return nil end
    local value = handle:read("*a"); handle:close(); return value
end
local function write(file, value)
    local handle = assert(io.open(directory .. file .. ".tmp", "wb"))
    handle:write(value); handle:close()
    os.remove(directory .. file)
    assert(os.rename(directory .. file .. ".tmp", directory .. file))
end
local function quote(value)
    return '"' .. tostring(value or ""):gsub("\\", "\\\\"):gsub('"', '\\"'):gsub("\n", "\\n"):gsub("\r", "\\r"):gsub("\t", "\\t"):gsub("[%z\1-\8\11\12\14-\31]", "") .. '"'
end
local config = assert(read("bridge.json"), "Installer les interactions depuis ShenPulse")
local token = assert(config:match('"token"%s*:%s*"([a-f0-9]+)"'), "Configuration invalide")
assert(#token == 64, "Configuration invalide")
local function valid(value)
    local ok, result = pcall(function() return value and value:IsValid() end)
    return ok and result
end
local function instance(name)
    local value = FindFirstOf(name)
    assert(valid(value), "Objet indisponible dans cette situation : " .. name)
    return value
end
local frame_checked, frame_player, frame_controller = false, nil, nil
local function pawn()
    if frame_checked then
        if frame_player then return frame_player, frame_controller end
        error("Chargez une sauvegarde avec un personnage contrôlable, hors menu principal")
    end
    frame_checked = true
    local function playable(controller)
        if not valid(controller) then return false end
        local player = controller.Pawn
        if not valid(player) then return false end
        local ok, info = pcall(function() return player.CachedCharacterStateInfo end)
        local world = player:GetWorld():GetFullName():lower()
        if ok and valid(info) and not world:find("frontend",1,true) and not world:find("mainmenu",1,true) and not world:find("/rootlevel.",1,true) then
            frame_player, frame_controller = player, controller
            return true
        end
        return false
    end
    if playable(FindFirstOf("PlayerController")) then return frame_player, frame_controller end
    for _, controller in ipairs(FindAllOf("PlayerController") or {}) do
        if playable(controller) then return frame_player, frame_controller end
    end
    error("Chargez une sauvegarde avec un personnage contrôlable, hors menu principal")
end
local function state() return pawn().CachedCharacterStateInfo end
local function default(path) local object = StaticFindObject(path); assert(valid(object), "API du jeu indisponible"); return object end
local active, pending = {}, nil
local function restore(key)
    local effect = active[key]
    if effect then
        active[key] = nil
        local ok, err = pcall(effect.restore)
        if not ok then print("[ShenPulse] Restauration "..key.." : "..tostring(err)) end
    end
end
-- os.clock is monotone wall time in the Windows C runtime used by UE4SS.
local function timed(key, seconds, create, value)
    local effect = active[key]
    if not effect then
        local apply, undo = create()
        effect = { until_at = os.clock() + seconds, apply = apply, restore = undo }
        active[key] = effect
    end
    local ok, err = pcall(effect.apply, value)
    if not ok then restore(key); error(err) end
end
local function reset() local keys={}; for key in pairs(active) do keys[#keys+1]=key end; for _, key in ipairs(keys) do restore(key) end end
local handlers = {}
local function register(code, action) handlers[code] = action end
local function duration(request, fallback) return math.min(120, math.max(1, tonumber(request.duration) and request.duration > 0 and request.duration or fallback)) end
local function item_count(id)
    return default("/Script/Phoenix.Default__InventoryManagerInterface"):GetCount(pawn():GetCharacterID(), FName(id), 0, 0, FName("None"), FName("None"))
end
local function inventory(id, count)
    local before = item_count(id)
    instance("InventoryManager"):InventoryAdd(id, count)
    assert(item_count(id) > before, "Objet non ajouté : vérifiez la progression et la place dans l’inventaire")
end
register("soin_complet", function() local s = state(); s:SetHealth(s:GetMaxHealth(), true) end)
register("tout_annuler", reset)
for _, seconds in ipairs({15, 30}) do
    register("invincible_" .. seconds, function(r)
        timed("invincible", duration(r, seconds), function()
            local info, player = state(), pawn()
            local original = info:IsInvulnerableToDamage()
            return function() info:SetInvulnerableToDamage(true); player:SetInvulnerable(true) end,
                function() if valid(info) then info:SetInvulnerableToDamage(original) end; if valid(player) then player:SetInvulnerable(original) end end
        end)
    end)
end
for _, amount in ipairs({100, 500, 2000}) do
    register("xp_" .. amount, function(r) instance("ExperienceManager"):AddExperience(amount * r.quantity, "ShenPulse", "LIVE") end)
    register("argent_" .. amount, function(r) inventory("Knuts", amount * r.quantity) end)
end
local potions = { potion_soin="WoundCleaning", potion_defense="Edurus", potion_force="Maxima", potion_concentration="AMFillPotion", potion_invisibilite="InvisibilityPotion", potion_tonnerre="AutoDamagePotion", potion_chance="FelixFelicis", potion_vigueur="PepperUp", plante_chou="ChompingCabbage_Byproduct" }
for code, item in pairs(potions) do register(code, function(r) inventory(item, math.min(10, r.quantity)) end) end
for _, percentage in ipairs({25, 50}) do
    register("degats_" .. percentage, function() local s = state(); s:SetHealth(math.max(1, s:GetHealth() - s:GetMaxHealth() * percentage / 100), true) end)
end
for _, seconds in ipairs({6, 10}) do
    register("ralenti_" .. seconds, function(r)
        timed("slow", duration(r, seconds), function()
            local manager, player = default("/Script/FXUtil.Default__TimeDilationManager"), pawn()
            return function() manager:StartWorldTimeDilation(player, 0.25, player, 0) end,
                function() if valid(player) then manager:FinishWorldTimeDilation(player, 0) end end
        end)
    end)
end
for code, factor in pairs({ geant=2, minuscule=0.5 }) do
    register(code, function(r)
        timed("size", duration(r, 10), function()
            local mesh = pawn().Mesh; local previous = mesh.RelativeScale3D; local old = {X=previous.X,Y=previous.Y,Z=previous.Z}
            return function(multiplier) mesh:SetRelativeScale3D({X=old.X*multiplier,Y=old.Y*multiplier,Z=old.Z*multiplier}) end,
                function() if valid(mesh) then mesh:SetRelativeScale3D(old) end end
        end, factor)
    end)
end
register("projection", function() local movement=pawn().CharacterMovement; movement:SetMovementMode(3,0); movement:AddImpulse({X=0,Y=0,Z=1600}, true) end)
register("balai_force", function()
    local player = pawn()
    assert(not player:GetIsOnAMountOrInTransition(), "Descendez de votre monture avant de relancer cet effet")
    local broom = FindFirstOf("BroomItemTool")
    assert(valid(broom), "Débloquez le balai et utilisez-le une première fois dans une zone autorisée")
    broom:SpawnAndMountBroom(true, false)
    return function() return valid(player) and player:GetIsOnAMountOrInTransition() end
end)
for _, hours in ipairs({6,12}) do register("heure_"..hours, function()
    local scheduler = instance("Scheduler"); local before = scheduler:GetSimulatedHourBP()
    scheduler:AdvanceHours(hours)
    assert(scheduler:GetSimulatedHourBP() == (before + hours) % 24, "L’horloge est verrouillée par la séquence de jeu en cours")
end) end
local weather = { meteo_clair="Clear", meteo_couvert="Overcast_Heavy_01", meteo_pluie="Rainy", meteo_orage="StormyLarge_01", meteo_tempete="FIG_07_Storm", meteo_neige="Winter_Snow_01", meteo_brume="Misty_01" }
for code, name in pairs(weather) do register(code, function() default("/Script/Weather.Default__WeatherMasterComponent"):SetOverrideWeather(pawn(), FName(name), true) end) end
local creatures = { niffleur="Niffler", licorne="Unicorn", phenix="Phoenix", hippogriffe="Hippogriff", sombral="Thestral", graphorn="Graphorn", boursouflet="Puffskein", veaudelune="Mooncalf", fleureur="Kneazle", dirico="Diricawl", focifere="Fwooper", jobberknoll="Jobberknoll" }
local function creature_names(type_id)
    local names = {}
    for _, actor in ipairs(FindAllOf("Creature_Character") or {}) do
        if valid(actor) then
            if actor:GetClass():GetFullName():match("[.]BP_"..type_id.."_Creature_C$") then names[actor:GetFullName()] = true end
        end
    end
    return names
end
for code, name in pairs(creatures) do register("creature_"..code, function(r)
    local before, count = creature_names(name), math.min(5,r.quantity)
    local manager = instance("CreatureManager")
    for _=1,count do manager:CreatureSpawnWild(FName(name)) end
    return function()
        local added = 0
        for actor in pairs(creature_names(name)) do if not before[actor] then added=added+1 end end
        return added >= count
    end
end) end
local enemies = { loup="Wolf", loup_noir="WolfBlack", gobelin="GoblinMelee", gobelin_mage="GoblinMage", gobelin_tireur="GoblinSniper", gobelin_assassin="GoblinAssassin", gobelin_chef="GoblinChieftain", troll_foret="Troll_Forest", troll_riviere="Troll_River", troll_montagne="Troll_Mountain", troll_cuirasse="Troll_Armored", araignee_geante="SpiderAccromantula", araignee="SpiderVenomous", araignee_bebe="SpiderVenomousBaby", araignee_tank="SpiderVenomousTank", inferius="Inferius", braconnier="DW_Poacher_Grunt", braconnier_mage="DW_Poacher_Mage", braconnier_tireur="DW_Poacher_Sniper", braconnier_chef="DW_Poacher_Captain", mage_noir="DW_Extortionist_Grunt", mage_noir_sorcier="DW_Extortionist_Mage", dugbog="Dugbog_Marsh" }
local function spawn_enemy(id, request)
    local actor = pawn(); local p = actor:K2_GetActorLocation(); local f = actor:GetActorForwardVector()
    local manager = instance("NPC_DBRegManager")
    for i=1,math.min(5, request.quantity) do
        local transform = {Rotation={X=0,Y=0,Z=0,W=1},Translation={X=p.X+f.X*1000-f.Y*i*200,Y=p.Y+f.Y*1000+f.X*i*200,Z=p.Z+100},Scale3D={X=1,Y=1,Z=1}}
        local spawned = manager:Spawn(actor:GetWorld(), transform, id, 0, 0, false, 1, nil, nil)
        assert(valid(spawned), "Apparition impossible dans cette zone")
    end
end
for code, name in pairs(enemies) do register("ennemi_"..code, function(r) spawn_enemy(name,r) end) end
register("boss_dragon", function() spawn_enemy("Dragon_HungarianHorntail", {quantity=1}) end)
register("teleportation", function()
    local actor = pawn(); local p = actor:K2_GetActorLocation(); local trace = default("/Script/Engine.Default__KismetSystemLibrary")
    for _=1,12 do
        local x,y = p.X+math.random(-800,800),p.Y+math.random(-800,800)
        local hit = {}
        local found = trace:LineTraceSingle(actor,{X=x,Y=y,Z=p.Z+1000},{X=x,Y=y,Z=p.Z-1500},0,false,{},0,hit,true,{R=0,G=0,B=0,A=0},{R=0,G=0,B=0,A=0},0)
        if found and hit.ImpactPoint then
            if actor:SafeTeleportTo({X=x,Y=y,Z=hit.ImpactPoint.Z+100}, actor:K2_GetActorRotation(), false, false) then return end
        end
    end
    error("Aucun sol libre trouvé : téléportation annulée")
end)
local function json(value)
    local kind=type(value)
    if kind=="nil" then return "null" elseif kind=="boolean" then return tostring(value) elseif kind=="number" then return value==value and tostring(value) or "null" elseif kind~="table" then return quote(value) end
    local parts={}; for k,v in pairs(value) do parts[#parts+1]=quote(k)..":"..json(v) end
    return "{"..table.concat(parts,",").."}"
end
local function snapshot()
    local data = { timers = {} }
    local function sample(key, fn) local ok, value=pcall(fn); if ok then data[key]=value end end
    sample("player", function() return pawn():GetFullName() end)
    sample("world", function() return pawn():GetWorld():GetFullName() end)
    sample("health", function() return state():GetHealth() end)
    sample("maxHealth", function() return state():GetMaxHealth() end)
    sample("invulnerable", function() return state():IsInvulnerableToDamage() end)
    sample("paused", function() return default("/Script/Engine.Default__GameplayStatics"):IsGamePaused(pawn():GetWorld()) end)
    sample("intro", function() return pawn():IsPlayingIntro() end)
    sample("controlsBlocked", function() local _, controller=pawn(); return controller:IsMoveInputIgnored() end)
    sample("xp", function() return instance("ExperienceManager"):GetExperiencePoints() end)
    sample("level", function() return instance("ExperienceManager"):GetExperienceLevel() end)
    sample("money", function() return item_count("Knuts") end)
    sample("hour", function() return instance("Scheduler"):GetSimulatedHourBP() end)
    sample("minute", function() return instance("Scheduler"):GetSimulatedMinuteBP() end)
    sample("dilation", function() return default("/Script/Engine.Default__GameplayStatics"):GetGlobalTimeDilation(pawn()) end)
    sample("scale", function() local v=pawn().Mesh.RelativeScale3D; return {X=v.X,Y=v.Y,Z=v.Z} end)
    sample("position", function() local v=pawn():K2_GetActorLocation(); return {X=v.X,Y=v.Y,Z=v.Z} end)
    for key,effect in pairs(active) do data.timers[key]=math.max(0,effect.until_at-os.clock()) end
    return data
end
local function finish(request, status, message)
    write("result.json", json({id=request.id,gameId=game_id,status=status,executionConfirmed=status==0,message=message,metadata=snapshot()}))
end
local previous_id, heartbeat_at, session_player = "", 0, nil
local function tick()
    frame_checked, frame_player, frame_controller = false, nil, nil
    local playable, current = pcall(pawn)
    local identity = playable and current:GetFullName() or nil
    if session_player and session_player ~= identity then reset() end
    session_player = identity
    for key, effect in pairs(active) do if os.clock() >= effect.until_at then restore(key) end end
    if os.time() > heartbeat_at then
        heartbeat_at = os.time()
        local ready = pcall(pawn)
        write("ready.json", json({gameId=game_id,token=token,at=os.time(),ready=ready,metadata=snapshot()}))
    end
    if pending then
        local ok, done = pcall(pending.verify)
        if ok and done and pending.identity == identity then
            finish(pending.request, 0, "Interaction exécutée")
        elseif not ok or not playable or pending.identity ~= identity or os.clock() >= pending.until_at then
            finish(pending.request, 3, not ok and tostring(done) or "Le jeu n’a pas confirmé l’apparition ou la montée sur le balai. Vérifiez la zone et la progression de la sauvegarde.")
        else return end
        pending = nil
    end
    local data = read("request.lua")
    if not data or #data > 32768 then return end
    local chunk = load(data,"ShenPulse request","t",{})
    if not chunk then return end
    local parsed, request = pcall(chunk)
    if not parsed or type(request) ~= "table" or request.token ~= token or request.gameId ~= game_id or type(request.id) ~= "string" or request.id == previous_id then return end
    previous_id = request.id
    local status, message = 3, "Demande expirée"
    if type(request.expiresAt) == "number" and request.expiresAt >= os.time()*1000 then
        local action = handlers[request.code]
        if action then
            request.quantity = math.min(10,math.max(1,tonumber(request.quantity) or 1))
            local ok, err = pcall(function()
                if request.code ~= "tout_annuler" then
                    local player, controller=pawn()
                    assert(not controller:IsMoveInputIgnored(), "Attendez la fin de la conversation ou de la cinématique")
                    assert(not default("/Script/Engine.Default__GameplayStatics"):IsGamePaused(player:GetWorld()), "Reprenez la partie hors menus")
                end
                return action(request)
            end)
            if ok and type(err) == "function" then
                pending = {request=request,verify=err,identity=identity,until_at=os.clock()+math.min(8,math.max(0,(request.expiresAt-os.time()*1000)/1000-0.5))}
                return
            end
            status, message = ok and 0 or 3, ok and "Interaction exécutée" or tostring(err)
        else status, message = 2, "Interaction Hogwarts inconnue" end
    end
    finish(request, status, message)
end
print("[ShenPulse] Hogwarts Legacy chargé")
local tick_queued = false
LoopAsync(150, function()
    if tick_queued then return false end
    tick_queued = true
    ExecuteInGameThread(function()
        local ok, err=pcall(tick)
        tick_queued = false
        if not ok then print("[ShenPulse] "..tostring(err)) end
    end)
    return false
end)
