local UEHelpers = require("UEHelpers")
local E = {}

local function journal(m) print("[ShenPulse] " .. m .. "\n") end
E.journal = journal

function E.controller()
    for _,pc in ipairs(FindAllOf("PlayerController") or {}) do
        if pc:IsValid() and not pc.bActorIsBeingDestroyed and pc:IsLocalPlayerController() then return pc end
    end
end
function E.world()
    local pc=E.controller()
    return pc and pc:GetWorld() or UEHelpers.GetWorld()
end
function E.perso()
    local pc = E.controller()
    if not (pc and pc:IsValid()) then return nil end
    local c = pc.Character
    if c and c:IsValid() and not c.bActorIsBeingDestroyed and c:IsA("/Game/Game/BPCharacter_Demo.BPCharacter_Demo_C") then return c end
    return nil
end

-- L'hote (ou le solo) a l'autorite : c'est lui qui fait apparaitre les monstres pour tous.
function E.estHote()
    local p = E.perso()
    if not p then return false end
    local ok, r = pcall(function() return p:HasAuthority() end)
    return ok and r == true
end

local GS
local function gs()
    if not (GS and GS:IsValid()) then GS = StaticFindObject("/Script/Engine.Default__GameplayStatics") end
    return GS
end

local function charger(chemin)
    local obj = StaticFindObject(chemin)
    if obj and obj:IsValid() then return obj end
    pcall(function() LoadAsset((chemin:gsub("_C$", ""))) end)
    obj = StaticFindObject(chemin)
    if obj and obj:IsValid() then return obj end
    return nil
end

-- ---------------------------------------------------------------------------
-- MONSTRES : n'importe quel monstre, dans n'importe quel niveau, avec le pseudo
-- du viewer au-dessus. Ils disparaissent seuls apres `duree` secondes.
-- ---------------------------------------------------------------------------
local MONSTRES = {
    hound           = "/Game/Entity/Hound/BP_Hound.BP_Hound_C",
    smiler          = "/Game/Entity/RoamingSmiler/BP_Roaming_Smiler.BP_Roaming_Smiler_C",
    smiler_rapide   = "/Game/Entity/DashSmiler/BP_Smiler_Dash.BP_Smiler_Dash_C",
    skinstealer     = "/Game/Entity/SkinStealer/BP_SkinStealer.BP_SkinStealer_C",
    bacteria        = "/Game/Entity/AI/Bacteria_BP.Bacteria_BP_C",
    bacteria_rodeuse = "/Game/Entity/RoamingBacteria/Bacteria_Roaming_BP.Bacteria_Roaming_BP_C",
    partygoer       = "/Game/Entity/RoamingPartyGoer/BP_RoamingPartygoer.BP_RoamingPartygoer_C",
    moth            = "/Game/Entity/DeathMoth/FemaleMoth/BP_Moth.BP_Moth_C",
    clump           = "/Game/Entity/Clumps/BP_Clump.BP_Clump_C",
    faceling        = "/Game/Entity/Faceling/BP_Faceling.BP_Faceling_C",
    araignee        = "/Game/Entity/AranaeMembri/BP_Membri.BP_Membri_C",
    poupee          = "/Game/Entity/AnimatedDoll/BP_Animation.BP_Animation_C",
}
local HORDE = {"hound", "smiler", "skinstealer", "bacteria", "partygoer", "faceling", "clump"}
local MAX_MONSTRES = 8
local nos = {}   -- Object names only: delayed work must never retain freed UObject wrappers.
local function objectName(object)
    return object and object:IsValid() and object:GetFullName():match("^[^ ]+ (.+)$") or nil
end
local function resolve(name)
    if not name then return nil end
    local object=StaticFindObject(name)
    return object and object:IsValid() and object or nil
end

local function nettoyer()
    local gardes = {}
    for _, m in ipairs(nos) do
        if not m.parti and resolve(m.acteurNom) then table.insert(gardes, m) end
    end
    nos = gardes
end

-- ⚠️ (07/10, mesure) K2_DestroyActor laisse le monstre visible plusieurs secondes (il s'est
-- meme teleporte a 53 m APRES l'ordre). On le fait disparaitre a l'ecran tout de suite :
-- cerveau coupe, cache, sans collision, envoye sous la carte, PUIS detruit.
local function effacer(a)
    if not (a and a:IsValid()) then return end
    pcall(function() a:SetActorHiddenInGame(true) end)
    pcall(function() a:SetActorEnableCollision(false) end)
    pcall(function() a:SetLifeSpan(0.1) end)
end
-- 🔴 (07/10, PLANTAGE du jeu) un monstre exorcise gardait son minuteur de disparition : 90 s
-- plus tard, le minuteur touchait un objet deja LIBERE par le moteur -> acces memoire, jeu
-- tue. Regle : un monstre retire est marque `parti` et on OUBLIE ses references aussitot ;
-- plus personne ne touche jamais un objet qu'on a detruit.
local function retirer(m)
    if m.parti then return end
    m.parti = true
    local a,c,t=resolve(m.acteurNom),resolve(m.controleurNom),resolve(m.etiquetteNom)
    m.acteurNom,m.controleurNom,m.etiquetteNom=nil,nil,nil
    pcall(function() if c then c:UnPossess();c:SetLifeSpan(0.1) end end)
    effacer(t)
    effacer(a)
end

local function poserEtiquette(acteur, pseudo)
    if not pseudo or pseudo == "" then return nil end
    local w = E.world()
    local cls = StaticFindObject("/Script/Engine.TextRenderActor")
    local al = acteur:K2_GetActorLocation()
    local t = w:SpawnActor(cls, {X = al.X, Y = al.Y, Z = al.Z + 130}, {Pitch = 0, Yaw = 0, Roll = 0})
    if not (t and t:IsValid()) then return nil end
    local tr = t.TextRender
    tr:K2_SetText(FText(pseudo))
    tr:SetWorldSize(34.0)
    tr:SetHorizontalAlignment(1)
    t:K2_AttachToActor(acteur, FName("None"), 1, 1, 1, false)
    return t
end

-- Cherche un emplacement libre autour du joueur.
-- ⭐ (07/10, William : « je crois qu'il l'a mis dans un mur ») SpawnActor ACCEPTE un point
-- dans un mur : on demande d'abord a la carte de navigation du niveau (celle des IA) un
-- point ou l'on peut MARCHER, entre 5 et 12 m. Repli : l'ancienne methode par angles.
-- ⚠️ Z + 100 : a Z + 40 le monstre touche le sol et l'apparition echoue.
local NAV
local function pointMarchable(pos, mini, maxi)
    if not (NAV and NAV:IsValid()) then NAV = StaticFindObject("/Script/NavigationSystem.Default__NavigationSystemV1") end
    if not (NAV and NAV:IsValid()) then return nil end
    local w = E.world()
    for _ = 1, 12 do
        local out = {X=0,Y=0,Z=0}
        local ok, trouve = pcall(function() return NAV:K2_GetRandomReachablePointInRadius(w, {X = pos.X, Y = pos.Y, Z = pos.Z}, out, maxi + 0.0, nil, nil) end)
        if ok and trouve and out.X then
            local dx, dy = out.X - pos.X, out.Y - pos.Y
            if dx * dx + dy * dy >= mini * mini then return out end
        end
    end
    return nil
end

local function spawnAt(cls,location,yaw,collision)
    local angle=math.rad(yaw)/2
    local transform={Rotation={X=0,Y=0,Z=math.sin(angle),W=math.cos(angle)},Translation=location,Scale3D={X=1,Y=1,Z=1}}
    local a=gs():BeginDeferredActorSpawnFromClass(E.world(),cls,transform,collision,nil)
    if not(a and a:IsValid()) then return nil end
    pcall(function() a.AutoPossessAI=3 end)
    gs():FinishSpawningActor(a,transform)
    if a:IsValid() and not a.bActorIsBeingDestroyed then return a end
end

local function apparaitre(cls, distances, angles)
    local p = E.perso(); if not p then return nil end
    local pos = p:K2_GetActorLocation(); local rot = p:K2_GetActorRotation()
    local w = E.world()
    for _ = 1, 4 do
        local pt = pointMarchable(pos, 500, 1200)
        if not pt then break end
        local yaw = math.deg(math.atan(pos.Y - pt.Y, pos.X - pt.X))     -- tourne vers le joueur
        local a = spawnAt(cls,{X=pt.X,Y=pt.Y,Z=pt.Z+100},yaw,1)
        if a and a:IsValid() then return a end
    end
    for _, d in ipairs(distances) do
        for _, ang in ipairs(angles) do
            local y = math.rad(rot.Yaw + ang)
            local a = spawnAt(cls,{X=pos.X+math.cos(y)*d,Y=pos.Y+math.sin(y)*d,Z=pos.Z+100},rot.Yaw+ang+180,2)
            if a and a:IsValid() then return a end
        end
    end
    return nil
end

function E.monstre(id, pseudo, duree)
    if not E.estHote() then return false, "seul le createur de la partie peut faire apparaitre des monstres" end
    local chemin = MONSTRES[id]; if not chemin then return false, "monstre inconnu" end
    local cls = charger(chemin); if not cls then return false, "monstre introuvable" end
    nettoyer()
    while #nos >= MAX_MONSTRES do retirer(table.remove(nos, 1)) end
    -- derriere / sur les cotes d'abord : on doit le DECOUVRIR, pas l'avoir dans le nez
    local a = apparaitre(cls, {900, 650, 1200, 450}, {180, 140, -140, 90, -90, 30, -30, 0})
    if not a then return false, "pas de place libre" end
    pcall(function() a:SpawnDefaultController() end)
    local ok, ctrl = pcall(function() return a.Controller end)
    local m = {acteurNom=objectName(a),controleurNom=ok and objectName(ctrl) or nil}
    local okE, et = pcall(poserEtiquette, a, pseudo)
    if okE then m.etiquetteNom=objectName(et) end
    table.insert(nos, m)
    duree = math.max(10, math.min(tonumber(duree) or 45, 180))
    -- Unreal owns expiry. Lua keeps no actor reference alive across garbage collection.
    a:SetLifeSpan(duree)
    if ok and ctrl and ctrl:IsValid() then ctrl:SetLifeSpan(duree+0.2) end
    if okE and et and et:IsValid() then et:SetLifeSpan(duree) end
    return true
end

function E.horde(pseudo, duree)
    local n = 0
    for i = 1, 3 do
        local id = HORDE[math.random(#HORDE)]
        if E.monstre(id, pseudo, duree) then n = n + 1 end
    end
    return n > 0, (n == 0) and "aucun monstre n'a pu apparaitre" or nil
end

-- Exorcisme : nos monstres ET ceux du niveau proches du joueur disparaissent.
function E.exorcisme()
    nettoyer()
    for _, m in ipairs(nos) do retirer(m) end
    nos = {}
    local p = E.perso()
    if p and E.estHote() then
        local pos = p:K2_GetActorLocation()
        for _, chemin in pairs(MONSTRES) do
            local court = chemin:match("%.([%w_]+)$")
            for _, a in ipairs(FindAllOf(court) or {}) do
                -- jamais un acteur deja en cours de destruction (memoire bientot liberee)
                local vivant = a:IsValid() and not a.bActorIsBeingDestroyed
                if vivant then
                    local l = a:K2_GetActorLocation()
                    local dx, dy = l.X - pos.X, l.Y - pos.Y
                    if dx * dx + dy * dy < 3000 * 3000 then
                        pcall(function() local c = a.Controller; if c and c:IsValid() then c:UnPossess(); c:K2_DestroyActor() end end)
                        effacer(a)
                    end
                end
            end
        end
    end
    return true
end

-- ---------------------------------------------------------------------------
-- SONS ET SECOUSSES
-- ---------------------------------------------------------------------------
local SONS = {
    cri     = {"/Game/Sounds/Jumpscares/BacteriaJumpscare.BacteriaJumpscare", "/Game/Sounds/Jumpscares/Jumpscare_Light_04.Jumpscare_Light_04",
               "/Game/Sounds/Jumpscares/Jumpscare_Light_05.Jumpscare_Light_05", "/Game/Sounds/Jumpscares/Jumpscare_Light_07.Jumpscare_Light_07",
               "/Game/Sounds/Jumpscares/Impact_1.Impact_1", "/Game/Sounds/Jumpscares/Impact_2.Impact_2"},
    rire    = {"/Game/Sounds/Jumpscares/Smiler_1.Smiler_1", "/Game/Sounds/Jumpscares/Smiler_2.Smiler_2"},
    alarme  = {"/Game/Sounds/Jumpscares/Alarming_Sound.Alarming_Sound"},
    musique = {"/Game/Sounds/Jumpscares/ost_stinger1.ost_stinger1"},
}
function E.son(famille)
    local liste = SONS[famille]; if not liste then return false, "son inconnu" end
    local son = charger(liste[math.random(#liste)]); if not son then return false, "son introuvable" end
    gs():PlaySound2D(E.world(), son, 1.0, 1.0, 0.0, nil, nil, false)
    return true
end

function E.secousse(duree)
    local p = E.perso(); if not p then return false, "pas de personnage" end
    local cls = charger("/Game/Game/Shakes/BP_Electrocute_Shake.BP_Electrocute_Shake_C")
    if not cls then return false, "secousse introuvable" end
    p:PlayCameraShake(cls, math.max(1.0, math.min(tonumber(duree) or 3, 10)))
    return true
end

-- ---------------------------------------------------------------------------
-- LE PERSONNAGE
-- ---------------------------------------------------------------------------
local function appeler(nom)
    local p = E.perso(); if not p then return false, "pas de personnage" end
    p[nom](p)
    return true
end

local insaniteGeneration=0
local visionOwner=nil
local visionFov=nil
local visionCamera=nil
local function cameraFor(p)
    for _,camera in ipairs(FindAllOf("CameraComponent") or {}) do
        if camera:IsValid() then
            local owner=camera:GetOwner()
            if owner and owner:IsValid() and owner:GetAddress()==p:GetAddress() then return camera end
        end
    end
end
local function rendreVision()
    local p=E.perso()
    if p and visionOwner==p:GetAddress() then
        local camera=resolve(visionCamera)
        if camera and camera:IsValid() and visionFov then camera:SetFieldOfView(visionFov) end
    end
    visionOwner=nil
    visionFov=nil
    visionCamera=nil
end
function E.insanite(duree)
    local p=E.perso();if not p then return false,"pas de personnage" end
    local camera=cameraFor(p)
    if not (camera and camera:IsValid()) then return false,"caméra indisponible" end
    local owner=p:GetAddress()
    local initial=visionOwner==owner and visionFov or camera.FieldOfView
    visionOwner=owner
    visionFov=initial
    visionCamera=objectName(camera)
    local cameraName=visionCamera
    insaniteGeneration=insaniteGeneration+1
    local current=insaniteGeneration
    local tours=math.floor(math.max(5,math.min(tonumber(duree) or 15,60))*10)
    local elapsed=0
    camera:SetFieldOfView(math.max(45,initial-18))
    LoopAsync(100,function()
        if current~=insaniteGeneration then return true end
        tours=tours-1;elapsed=elapsed+0.1
        if tours<=0 then ExecuteInGameThread(rendreVision);return true end
        ExecuteInGameThread(function()
            local q=E.perso()
            if current==insaniteGeneration and q and q:GetAddress()==owner then
                local manager=resolve(cameraName)
                if manager and manager:IsValid() then manager:SetFieldOfView(math.max(45,math.min(140,initial+18*math.sin(elapsed*5)))) end
            end
        end)
        return false
    end)
    return true
end
function E.evanouissement() return appeler("SRV_PassOut") end
function E.glissade() return appeler("MC_Slipped") end
function E.douleur() return appeler("LiquidPain") end
function E.epuisement() return appeler("Burnout") end
local function inventorySlots(p)
    local slots={}
    p.PlayerState.Items_Rep:ForEach(function(_,entry)
        slots[#slots+1]=entry:get():ToString()
    end)
    return slots
end
function E.lacher_tout()
    local p=E.perso();if not p then return false,"pas de personnage" end
    if not E.estHote() then return false,"partie solo ou hôte requise" end
    for index,name in ipairs(inventorySlots(p)) do
        if name~="None" then
            p:DropItem_SERVER(FName(name))
            p.PlayerState.Items_Rep[index]=FName("None")
        end
    end
    p:DestroyEquipItem_SERVER()
    p:InvCheckItem()
    pcall(function() p.PlayerState:OnRep_Items_Rep() end)
    return true
end
function E.mort()
    local p=E.perso();if not p then return false,"pas de personnage" end
    p:KillServer(false)
    return true
end

function E.sanite(delta)
    local p = E.perso(); if not p then return false, "pas de personnage" end
    local ps = p.PlayerState; if not (ps and ps:IsValid()) then return false, "pas d'etat joueur" end
    ps:SRV_AddSanity(delta + 0.0)
    return true
end

-- Vitesse : le jeu recalcule MaxWalkSpeed depuis SES valeurs de base (WalkSpeed /
-- SprintSpeed) — changer MaxWalkSpeed seul ne tient pas (mesure 07/10 : 275 -> 520
-- seulement en changeant WalkSpeed). On garde les valeurs d'origine pour les rendre.
local vitesseFin = 0
local origine = nil      -- {marche, course} relevees AVANT le premier effet
local function rendreVitesse()
    local q = E.perso(); if not (q and origine) then return end
    if q:GetAddress()~=origine.personnage then origine=nil;return end
    q.WalkSpeed = origine.marche; q.SprintSpeed = origine.course
    q.CharacterMovement.MaxWalkSpeed = origine.marche
    pcall(function() q:SetWalkSpeedServer(origine.marche) end)
    origine=nil
end
-- ⭐ (07/10, William : « l'accélération ne marche pas ») trois verrous, mesurés un par un :
--  1. le jeu remet MaxWalkSpeed a chaque debut/fin de course -> on la REIMPOSE 20 fois/s ;
--  2. un garde-fou du personnage bride la vitesse reelle a SprintSpeed (550) -> on releve
--     WalkSpeed ET SprintSpeed ;
--  3. courir (Maj) va deja a 550 : un bonus x1,9 sur la marche ne se sentait pas.
-- Mesure finale : vitesse reelle 950 (marche 275, course 550), retour a 275 a la fin.
function E.vitesse(cible, duree)
    local p = E.perso(); if not p then return false, "pas de personnage" end
    if not origine or origine.personnage~=p:GetAddress() then origine = {marche = p.WalkSpeed or 275.0, course = p.SprintSpeed or 550.0,personnage=p:GetAddress()} end
    local owner=p:GetAddress()
    local course = math.max(cible * 1.35, cible + 50)
    p.WalkSpeed = cible + 0.0
    p.SprintSpeed = course
    p.CharacterMovement.MaxWalkSpeed = cible + 0.0
    pcall(function() p:SetWalkSpeedServer(cible + 0.0) end)
    vitesseFin = vitesseFin + 1
    local moi = vitesseFin
    local tours = math.floor(math.max(5, math.min(tonumber(duree) or 20, 90)) * 20)
    LoopAsync(50, function()
        tours = tours - 1
        if moi ~= vitesseFin then return true end             -- un effet plus recent a la main
        if tours <= 0 then ExecuteInGameThread(rendreVitesse); return true end
        ExecuteInGameThread(function()
            local q = E.perso()
            if q and q:GetAddress()==owner and moi==vitesseFin then q.WalkSpeed = cible + 0.0; q.SprintSpeed = course; q.CharacterMovement.MaxWalkSpeed = cible + 0.0 end
        end)
        return false
    end)
    return true
end

-- ---------------------------------------------------------------------------
-- OBJETS (noms internes verifies dans ETBCommandsMod + en jeu)
-- ---------------------------------------------------------------------------
local OBJETS = {
    eau_amande = "AlmondWater", barre_energie = "EnergyBar", jus = "Juice", baton_lumineux = "Glowstick",
    pistolet_detresse = "Flaregun", feu_artifice = "Firework", tronconneuse = "Chainsaw", couteau = "Knife",
    pied_de_biche = "Crowbar", corde = "Rope", appareil_photo = "Camera", lidar = "Lidar",
    thermometre = "Thermometer", talkie = "WalkieTalkie", insecticide = "BugSpray", gelee = "MothJelly",
    casque = "DivingHelmet", jouet = "Toy", eau_concentree = "AlmondConcentrate",
}
local PLUIE = {"eau_amande", "barre_energie", "jus", "baton_lumineux", "pistolet_detresse", "corde", "couteau"}
function E.objet(id, auSol, quantity)
    local p = E.perso(); if not p then return false, "pas de personnage" end
    local nom = OBJETS[id]; if not nom then return false, "objet inconnu" end
    quantity=math.max(1,math.min(20,math.floor(quantity or 1)))
    if not auSol then
        local free=0;for _,name in ipairs(inventorySlots(p)) do if name=="None" then free=free+1 end end
        if free<quantity then return false,"Pas assez de places libres dans l’inventaire." end
    end
    for _=1,quantity do
        if auSol then p:DropItem_SERVER(FName(nom)) else p:InvAddByName(FName(nom)) end
    end
    return true
end
function E.pluie()
    local p = E.perso(); if not p then return false, "pas de personnage" end
    for i = 1, 5 do p:DropItem_SERVER(FName(OBJETS[PLUIE[math.random(#PLUIE)]])) end
    return true
end

-- Tout remettre d'aplomb (bouton « Remettre à zéro » de l'app).
function E.reset()
    for _,m in ipairs(nos) do retirer(m) end
    nos={}
    insaniteGeneration=insaniteGeneration+1
    local p = E.perso()
    if p then
        pcall(rendreVision)
        pcall(rendreVitesse)
    end
    vitesseFin = vitesseFin + 1
    return true
end

-- ---------------------------------------------------------------------------
-- LE CATALOGUE : id de l'app -> action. `o` = {pseudo, n, duree}
-- ---------------------------------------------------------------------------
E.CATALOGUE = {}
for id in pairs(MONSTRES) do
    E.CATALOGUE["monstre_" .. id] = function(o) return E.monstre(id, o.pseudo, o.duree) end
end
E.CATALOGUE.horde            = function(o) return E.horde(o.pseudo, o.duree) end
E.CATALOGUE.exorcisme        = function(o) return E.exorcisme() end
E.CATALOGUE.cri              = function(o) return E.son("cri") end
E.CATALOGUE.rire_smiler      = function(o) return E.son("rire") end
E.CATALOGUE.alarme           = function(o) return E.son("alarme") end
E.CATALOGUE.musique_angoisse = function(o) return E.son("musique") end
E.CATALOGUE.secousse         = function(o) return E.secousse(o.duree) end
E.CATALOGUE.insanite         = function(o) return E.insanite(o.duree) end
E.CATALOGUE.evanouissement   = function(o) return E.evanouissement() end
E.CATALOGUE.glissade         = function(o) return E.glissade() end
E.CATALOGUE.douleur          = function(o) return E.douleur() end
E.CATALOGUE.epuisement       = function(o) return E.epuisement() end
E.CATALOGUE.lacher_tout      = function(o) return E.lacher_tout() end
E.CATALOGUE.mort             = function(o) return E.mort() end
E.CATALOGUE.folie            = function(o) return E.sanite(-25 * math.max(1, math.min(o.n or 1, 4))) end
E.CATALOGUE.serenite         = function(o) return E.sanite(25 * math.max(1, math.min(o.n or 1, 4))) end
E.CATALOGUE.serenite_totale  = function(o) return E.sanite(100) end
E.CATALOGUE.ralenti          = function(o) return E.vitesse(110, o.duree) end
E.CATALOGUE.rapide           = function(o) return E.vitesse(950, o.duree) end
E.CATALOGUE.pluie_objets     = function(o) return E.pluie() end
for id in pairs(OBJETS) do
    E.CATALOGUE["objet_" .. id] = function(o)
        return E.objet(id,false,o.n)
    end
    E.CATALOGUE["sol_" .. id] = function(o)
        return E.objet(id,true,o.n)
    end
end

return E
