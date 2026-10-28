local C=...
local H={reset_effects=function()C.reset()end}
for code,value in pairs({freeze=0,slow=.5,fast=1.5,hyper=3})do H[code]=function(r)C.property("speed",r,C.player(),"CustomTimeDilation",value)end end
for code,factor in pairs({tiny={.2,.2,.2},small={.5,.5,.5},large={2,2,2},giant={4,4,4},wide={3,1,1},narrow={.33,1,1},short={1,1,.33},tall={1,1,3}})do
 H[code]=function(r)
  local mesh=C.player().Mesh
  C.timed("size",r,function()local old=C.vector(mesh.RelativeScale3D);return function(v)mesh:SetRelativeScale3D({X=old.X*v[1],Y=old.Y*v[2],Z=old.Z*v[3]})end,function()if C.valid(mesh)then mesh:SetRelativeScale3D(old) end end end,factor)
 end
end
for code,factor in pairs({tinypals=.2,smallpals=.5,largepals=2,giantpals=4})do H[code]=function(r)
 C.timed("palsize",r,function()
  local entries={};for _,a in ipairs(FindAllOf("PalMonsterCharacter")or{})do if C.valid(a)and C.valid(a.Mesh)then entries[#entries+1]={mesh=a.Mesh,scale=C.vector(a.Mesh.RelativeScale3D)}end end
  assert(#entries>0,"Approchez-vous d’un Pal avant de modifier sa taille")
  return function(v)for _,e in ipairs(entries)do if C.valid(e.mesh)then e.mesh:SetRelativeScale3D({X=e.scale.X*v,Y=e.scale.Y*v,Z=e.scale.Z*v})end end end,
   function()for _,e in ipairs(entries)do if C.valid(e.mesh)then e.mesh:SetRelativeScale3D(e.scale) end end end
 end,factor)
end end
for code,hour in pairs({midnight=0,morning=6,noon=12,evening=18})do H[code]=function()C.instance("PalTimeManager"):SetGameTime_FixDay(hour)end end
H.hours=function(r)local t=C.instance("PalTimeManager");t:SetGameTime_FixDay((t:GetCurrentPalWorldTime_Hour()+math.min(24,math.max(1,r.amount or 1)))%24)end
H.fullheal=function()local _,_,p=C.player();p:SetHP({Value=p:GetMaxHP().Value})end
H.heal=function(r)local _,_,p=C.player();p:SetHP({Value=math.min(p:GetMaxHP().Value,p:GetHP().Value+p:GetMaxHP().Value*math.min(100,math.max(1,r.amount or 25))/100)})end
H.damage=function(r)local _,_,p=C.player();p:SetHP({Value=math.max(1000,p:GetHP().Value-p:GetMaxHP().Value*math.min(100,math.max(1,r.amount or 25))/100)})end
H.kill=function()local _,_,p=C.player();p:SetHP({Value=0})end
H.respawn=function()local _,pc,comp=C.player();assert(comp:IsDead()or comp:IsDying(),"Le personnage doit être K.-O. pour réapparaître");pc.PlayerState:RequestRespawn()end
H.fillstam=function()local _,_,p=C.player();p:SetSP({Value=p:GetMaxSP().Value})end
H.emptystam=function()select(3,C.player()):SetSP({Value=0})end
for code,sign in pairs({givehunger=1,takehunger=-1})do H[code]=function(r)
 local _,_,p=C.player();local data=p.IndividualParameter.SaveParameter;local previous=data.FullStomach
 p.IndividualParameter:SetFullStomach(math.min(p:GetMaxFullStomach(),math.max(0,previous+sign*p:GetMaxFullStomach()*math.min(100,math.max(1,r.amount or 25))/100)))
end end
for code,status in pairs({poison=5,burn=19,wet=20,frozen=21,electrified=22,muddy=23,ivy=24})do H[code]=function(r)
 local statusComponent=C.player().StatusComponent
 C.timed("status_"..status,r,function()return function()statusComponent:AddStatus(status)end,function()if C.valid(statusComponent)then statusComponent:RemoveStatus(status)end end end)
end end
for code,factor in pairs({nojump=0,lowjump=.5,highjump=2,ultrajump=4})do H[code]=function(r)
 local move=C.player().CharacterMovement
 C.timed("jump",r,function()local old=move.JumpZVelocity;return function(v)move.JumpZVelocity=old*v end,function()if C.valid(move)then move.JumpZVelocity=old end end end,factor)
end end
for code,factor in pairs({antigrav=-.3,highgrav=3,lowgrav=.3})do H[code]=function(r)
 local move=C.player().CharacterMovement
 C.timed("gravity",r,function()local old=move.GravityScale;return function(v)move.GravityScale=old*v;if v<0 then C.player():LaunchCharacter({X=0,Y=0,Z=300},false,true)end end,function()if C.valid(move)then move.GravityScale=old end end end,factor)
end end
for code,height in pairs({jump=600,launch=1500,megalaunch=3500})do H[code]=function()local player=C.player();local z=player:K2_GetActorLocation().Z;player:LaunchCharacter({X=0,Y=0,Z=height},false,true);return function()return player:GetVelocity().Z>100 or player:K2_GetActorLocation().Z>z+10 end end end
for code,value in pairs({attup=200,attdown=-50,defup=200,defdown=-50})do H[code]=function(r)local field=code:sub(1,3)=="att"and"AttackUp"or"DefenseUp";local _,_,p=C.player();C.property(field,r,p,field,value)end end
for code,mult in pairs({widecam=1.5,narrowcam=.6})do H[code]=function(r)
 local _,pc=C.player();local camera=pc.PlayerCameraManager
 C.timed("camera_fov",r,function()local old=camera:GetFOVAngle();return function(v)C.active.camera_fov.targetAngle=math.min(150,math.max(30,old*v));pc:FOV(C.active.camera_fov.targetAngle)end,function()if C.valid(pc)then pc:FOV(0)end end end,mult)
 local target=C.active.camera_fov.targetAngle
 return function()return math.abs(camera:GetFOVAngle()-target)<1 end
end end
H.dark=function(r)local camera=select(2,C.player()).PlayerCameraManager;C.timed("camera_dark",r,function()return function()camera:StartCameraFade(0,1,.15,{R=0,G=0,B=0,A=1},false,true)end,function()if C.valid(camera)then camera:StopCameraFade()end end end)end
H.invert=function(r)local camera=C.player():GetComponentByClass(StaticFindObject("/Script/Pal.PalCharacterCameraComponent"));C.property("camera_invert",r,camera,"RotateSpeedRate",-1)end
H.rollcam=function(r)local camera=C.player():GetComponentByClass(StaticFindObject("/Script/Pal.PalCharacterCameraComponent"));C.timed("camera_roll",r,function()local rot=camera.RelativeRotation;local old={Pitch=rot.Pitch,Yaw=rot.Yaw,Roll=rot.Roll};local control=camera.bUsePawnControlRotation;local started=os.clock();return function()camera.bUsePawnControlRotation=false;C.active.camera_roll.update=function()assert(C.valid(camera));camera:K2_SetRelativeRotation({Pitch=old.Pitch,Yaw=old.Yaw,Roll=old.Roll+(os.clock()-started)*90},false,{},false)end end,function()if C.valid(camera)then camera:K2_SetRelativeRotation(old,false,{},false);camera.bUsePawnControlRotation=control end end end)end
for code,mode in pairs({autocatch="always",catchup="easier",catchdown="harder",failcatch="never"})do H[code]=function(r)
 local settings=C.instance("BP_PalGameSetting_C")
 local array=settings.CaptureJudgeRateArray
 C.timed("capture",r,function()
  local old={};for i=1,array:GetArrayNum()do old[i]=array[i]end
  return function(value)for i,v in ipairs(old)do array[i]=value=="always"and-1 or value=="never"and 1000000 or value=="easier"and v*.5 or v*2 end end,
   function()if C.valid(settings)then for i,v in ipairs(old)do array[i]=v end end end
 end,mode)
end end
local function expstate()
 local player,_,comp=C.player();local data=comp.IndividualParameter.SaveParameter
 local utility=C.default("/Script/Pal.PalUtility");local db=utility:GetExpDatabase(player)
 return player,data,utility,db:GetTotalExp(data.Level,true),db:GetTotalExp(data.Level+1,true)
end
local function awardexp(player,utility,amount)
 assert(amount>0,"Le personnage a atteint le niveau maximum")
 utility:GiveExpToAroundPlayerCharacter(player,C.vector(player:K2_GetActorLocation()),1,amount,true)
end
H.expup=function(r)
 local player,data,utility,floor,next=expstate()
 awardexp(player,utility,math.max(1,math.floor((next-floor)*math.min(100,math.max(1,r.amount or 10))/100))*r.quantity)
end
local function reduceexp(target)
 local _,_,comp=C.player();local data=comp.IndividualParameter.SaveParameter;local old=data.Exp
 data.Exp=math.max(0,math.floor(target))
 local widget=FindFirstOf("WBP_PLLvExp_C")
 if C.valid(widget)then widget:UpdateExp(data.Exp-old,old,1)end
end
H.expdown=function(r)
 local _,data,_,floor,next=expstate()
 reduceexp(math.max(floor,data.Exp-math.max(1,math.floor((next-floor)*math.min(100,math.max(1,r.amount or 10))/100))*r.quantity))
end
H.expzero=function()local _,_,_,floor=expstate();reduceexp(floor)end
H.expfull=function()local player,data,utility,_,next=expstate();awardexp(player,utility,next-data.Exp)end
local species={spawnpal={"SheepBall","CatMage","PinkCat","ChickenPal"},spawnalpha={"BOSS_SheepBall","BOSS_KingAlpaca"},spawnlegendary={"JetDragon","IceHorse","SaintCentaur","BlackCentaur"},spawntowerboss={"GYM_ElecPanda","GYM_LilyQueen"},spawnbounty={"Hunter_Rifle","Hunter_Grenade"},spawnsquad={"Hunter_Rifle"},spawnrampage={"PREDATOR_GrassPanda"}}
C.picks=C.picks or {};local picks=C.picks
for code,choices in pairs(species)do H[code]=function(r)
 local id=choices[(picks[code]or 0)%#choices+1];picks[code]=(picks[code]or 0)+1
 local _,_,comp=C.player();local count=code=="spawnsquad"and 4*r.quantity or r.quantity;local level=math.max(1,comp.IndividualParameter.SaveParameter.Level)
 local player=C.player();local manager=C.default("/Script/Pal.PalUtility"):GetNPCManager(player)
 assert(C.valid(manager)and C.valid(manager.NPCAIControllerBaseClass),"Gestionnaire d’apparition indisponible")
 local origin=C.vector(player:K2_GetActorLocation());local handles={}
 for i=1,count do
  local angle=i*2*math.pi/count
  local handle=manager:SpawnNPCForServer({ControllerClass=manager.NPCAIControllerBaseClass,CharacterID=FName(id),Level=level,Location={X=origin.X+400*math.cos(angle),Y=origin.Y+400*math.sin(angle),Z=origin.Z+100},Yaw=0,Squad=nil},nil)
  assert(C.valid(handle),"Le jeu a refusé cet adversaire")
  handles[#handles+1]=handle
 end
 C.spawned=C.spawned or {};for _,handle in ipairs(handles)do C.spawned[#C.spawned+1]=handle;if #C.spawned>64 then table.remove(C.spawned,1)end end
 return function()
  for _,handle in ipairs(handles)do if not C.valid(handle)or not C.valid(handle:TryGetIndividualActor())then return false end end
  return true
 end
end end

local function guidEqual(a,b)return a.A==b.A and a.B==b.B and a.C==b.C and a.D==b.D end
H.baseraid=function()
 local player,_,comp=C.player()
 local utility=C.default("/Script/Pal.PalUtility")
 local manager=utility:GetBaseCampManager(player)
 local base=manager:GetInRangedBaseCamp(player:K2_GetActorLocation(),0)
 assert(C.valid(base)and base:IsAvailable(),"Entrez dans une base construite pour lancer un raid")
 assert(guidEqual(base:GetGroupIdBelongTo(),comp.IndividualParameter:GetGroupId()),"Cette base ne vous appartient pas")
 assert(C.instance("PalOptionSubsystem"):GetOptionWorldSettings().bEnableInvaderEnemy and not base.bIgnoreInvader,"Les invasions sont désactivées dans les règles du monde ou pour cette base")
 local invader=utility:GetInvaderManager(player)
 assert(not C.valid(invader:GetInvaderInfo()),"Un raid est déjà en préparation ou en cours")
 -- Pass the fresh native GUID directly: the getter returns transient native storage.
 invader:StartInvaderMarchForBaseCamp(base:GetId())
 return function()return C.valid(utility:GetInvaderManager(player):GetInvaderInfo())end
end


H.wanted=function()
 local player,_,comp=C.player()
 local utility=C.default("/Script/Pal.PalWorldSecurityUtility")
 assert(not utility:IsWantedCharacter(player),"Le personnage est déjà recherché")
 local system=C.default("/Script/Pal.PalUtility"):GetWorldSecuritySystem(player)
 local handle=comp.IndividualHandle
 local individual=handle:GetIndividualID()
 assert(not system.IndividualCrimeStateMap:Contains(individual),"Attendez la fin de l’infraction en cours")
 local guid=C.default("/Script/Engine.KismetGuidLibrary"):NewGuid()
 local crime=StaticConstructObject(StaticFindObject("/Script/Pal.PalWorldSecurityCrimeInstance"),system,0)
 assert(C.valid(crime),"Le jeu ne peut pas créer l’avis de recherche")
 crime.InstanceId=guid;crime.CrimeId=FName("AttackToNonCriminal");crime.TargetId=individual;crime.TriggerType=2
 system.CrimeInstanceMap:Add(guid,crime)
 system.IndividualCrimeStateMap:Add(individual,{CrimeStateArray={guid}})
 system:ReportCriminal(handle,handle)
 return function()return utility:IsWantedCharacter(player)end
end


-- A single bounded construction listener avoids scanning every world object.
local mapEvents=_G.ShenPulsePalworldMapEvents
if not mapEvents then
 mapEvents={pending=nil};_G.ShenPulsePalworldMapEvents=mapEvents
 NotifyOnNewObject("/Script/Pal.PalMapObjectModel",function(object)
  local job=mapEvents.pending
  if job then job.objects[#job.objects+1]=object;if #job.objects>128 then table.remove(job.objects,1)end end
 end)
end
local function enumValue(path,suffix)
 local enum=StaticFindObject(path);assert(C.valid(enum),"Version du jeu incompatible")
 local value;enum:ForEachName(function(name,number)if name:ToString():sub(-#suffix)==suffix then value=number end end)
 assert(value,"Valeur native indisponible : "..suffix);return value
end
local function meteorTicks()
 if _G.ShenPulseFallTicksRegistered then return end
 local compatible=false
 StaticFindObject("/Script/Pal.PalSupplyDropActor"):ForEachProperty(function(property)
  if property:GetFullName():find(":TotalFallTime",1,true)then compatible=property:GetStruct():GetFullName()=="ScriptStruct /Script/CoreUObject.Timespan"end
 end)
 assert(compatible,"Horloge de météorite incompatible avec cette version du jeu")
 -- FTimespan has no reflected members: copying a Lua struct silently loses its ticks.
 RegisterCustomProperty({Name="ShenPulseFallTicks",Type=PropertyTypes.Int64Property,BelongsToClass="/Script/Pal.PalSupplyDropActor",OffsetInternal={Property="TotalFallTime",RelativeOffset=0}})
 _G.ShenPulseFallTicksRegistered=true
end
H.meteor=function(r)
 assert(not mapEvents.pending,"Une météorite est déjà en préparation")
 meteorTicks()
 local player,pc=C.player()
 local utility=C.default("/Script/Pal.PalUtility")
 local origin=C.vector(player:K2_GetActorLocation())
 local yaw=math.rad(pc.PlayerCameraManager:GetCameraRotation().Yaw)
 local x,y=origin.X+1800*math.cos(yaw),origin.Y+1800*math.sin(yaw)
 local hit={}
 local traced=C.default("/Script/Engine.KismetSystemLibrary"):LineTraceSingle(player,{X=x,Y=y,Z=origin.Z+5000},{X=x,Y=y,Z=origin.Z-15000},0,true,{player},0,hit,true,{R=0,G=0,B=0,A=1},{R=0,G=0,B=0,A=1},0)
 assert(traced and hit.Distance>100 and hit.ImpactNormal.Z>.5,"Sortez dans une zone dégagée pour faire tomber une météorite")
 local target=C.vector(hit.ImpactPoint)
 local spawnerPath="/Game/Pal/Blueprint/Supply/BP_SupplySpawner_Grass01.BP_SupplySpawner_Grass01_C"
 local dropPath="/Game/Pal/Blueprint/Supply/BP_SupplyDropActor_Meteor.BP_SupplyDropActor_Meteor_C"
 LoadAsset(spawnerPath);LoadAsset(dropPath)
 local spawnerClass,dropClass=StaticFindObject(spawnerPath),StaticFindObject(dropPath)
 assert(C.valid(spawnerClass)and C.valid(dropClass),"Les ressources natives de météorite sont indisponibles")
 local graphics=C.default("/Script/Engine.GameplayStatics")
 local supply=utility:GetSupplyManager(player)
 local previous={};for _,remote in ipairs(supply:GetSupplySpawnerData())do local data=remote:get();if C.valid(data)then previous[data:GetFullName()]=true end end
 local transform={Translation=target,Rotation={X=0,Y=0,Z=0,W=1},Scale3D={X=1,Y=1,Z=1}}
 local helper=graphics:BeginDeferredActorSpawnFromClass(player,spawnerClass,transform,1,player)
 assert(C.valid(helper),"Le jeu a refusé le point de chute")
 helper.ForceSupplyType=2;helper.SafeAreaRadiusForBaseCamp=0;helper.SafeAreaRadiusForActor=0
 helper=graphics:FinishSpawningActor(helper,transform)
 local job={objects={},helper=helper}
 local key="meteor_"..r.id
 mapEvents.pending=job
 C.timed(key,{duration=20},function()
  return function()end,function()
   if mapEvents.pending==job then mapEvents.pending=nil end
   if C.valid(job.actor)then job.actor:SetActorHiddenInGame(false);job.actor:SetActorEnableCollision(true)end
   if C.valid(job.drop)then job.drop:K2_DestroyActor()end
   if C.valid(helper)then helper:K2_DestroyActor()end
  end
 end)
 for _,remote in ipairs(supply:GetSupplySpawnerData())do local data=remote:get();if C.valid(data)and not previous[data:GetFullName()]then job.data=data end end
 assert(C.valid(job.data),"Le jeu n’a pas enregistré le point de chute")
 local manager=utility:GetMapObjectManager(player)
 assert(manager:RequestSpawnMapObject_Server(FName("MeteorDrop_Damagable"),target,{Pitch=0,Yaw=0,Roll=0}),"Le jeu a refusé la météorite")
 return function()
  if not C.valid(job.model)then
   for _,model in ipairs(job.objects)do
    if C.valid(model)and model.MapObjectMasterDataId:ToString()=="MeteorDrop_Damagable"then
     local at=model.InitialTransformCache.Translation
     if math.abs(at.X-target.X)<20 and math.abs(at.Y-target.Y)<20 then job.model=model;break end
    end
   end
   if not C.valid(job.model)then return false end
  end
  if not C.valid(job.actor)then
   for _,actor in ipairs(FindAllOf("BP_MapObject_MeteorDrop_Damagable_C")or{})do
    if C.valid(actor)then local model=actor:GetModel();if C.valid(model)and model:GetFullName()==job.model:GetFullName()then job.actor=actor;break end end
   end
   if not C.valid(job.actor)then return false end
  end
  job.actor:SetActorHiddenInGame(true);job.actor:SetActorEnableCollision(false)
  job.data:OnFinishedSpawningMapObjectModel(job.model.InstanceId,enumValue("/Script/Pal.EPalMapObjectOperationResult","::Success"))
  local fall={Translation={X=target.X,Y=target.Y,Z=target.Z+4000},Rotation={X=0,Y=0,Z=0,W=1},Scale3D={X=1,Y=1,Z=1}}
  local drop=graphics:BeginDeferredActorSpawnFromClass(player,dropClass,fall,1,player)
  assert(C.valid(drop),"Le jeu a refusé l’animation de météorite")
  drop=graphics:FinishSpawningActor(drop,fall);job.drop=drop
  drop.TargetLocation=target;drop.Velocity={X=0,Y=0,Z=-500};drop.ShenPulseFallTicks=80000000;drop.CurrentTime=0;drop.SupplyType=2;drop.SpawnerID=job.data.LevelObjectInstanceId;drop.MapObjectId=job.model.InstanceId
  job.data.DropActor=drop;drop:OnReplicateMapObjectModel(job.model)
  assert(drop:GetRemainingTimeToLanding()>7,"La chute de météorite n’a pas démarré")
  mapEvents.pending=nil;C.active[key].untilAt=os.clock()+9
  return true
 end
end

return H
