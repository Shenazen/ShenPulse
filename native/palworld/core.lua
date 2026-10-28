-- Shared state of the ShenPulse Palworld module. Runs on the game thread.
local env=...
local C={active={},pending=nil,lastId="",heartbeatAt=0}
for k,v in pairs(env)do C[k]=v end
function C.player()
  local p,controller=C.pawn();local world=p:GetWorld()
  assert(C.valid(world)and world:GetFullName():find("MainWorld",1,true),"Chargez une partie solo")
  local comp=p.CharacterParameterComponent
  assert(C.valid(comp)and C.valid(comp.IndividualParameter),"Personnage indisponible")
  return p,controller,comp
end
function C.instance(name)local v=FindFirstOf(name);assert(C.valid(v),"API du jeu indisponible : "..name);return v end
function C.default(name)local c=StaticFindObject(name);assert(C.valid(c),"API du jeu indisponible");return c:GetCDO() end
function C.vector(v)return{X=v.X,Y=v.Y,Z=v.Z}end
function C.seconds(r)return math.min(600,math.max(1,tonumber(r.duration)and r.duration>0 and r.duration or 15))end
function C.restore(key)local v=C.active[key];if v then C.active[key]=nil;local ok,err=pcall(v.undo);if not ok then print("[ShenPulse] Restore "..key.." "..tostring(err))end end end
function C.reset()local keys={};for k in pairs(C.active)do keys[#keys+1]=k end;for _,k in ipairs(keys)do C.restore(k)end end
function C.timed(key,r,create,value)
  local a=C.active[key]
  if not a then local apply,undo=create();a={apply=apply,undo=undo};C.active[key]=a end
  a.untilAt=os.clock()+C.seconds(r)
  local ok,err=pcall(a.apply,value);if not ok then C.restore(key);error(err)end
end
function C.property(key,r,object,field,value)
  assert(C.valid(object),"Objet indisponible : "..field)
  C.timed(key,r,function()local old=object[field];return function(v)assert(C.valid(object),"Objet disparu");object[field]=v end,function()if C.valid(object)then object[field]=old end end end,value)
end
function C.playable()
  local p,pc,comp=C.player()
  assert(not comp:IsDead()and not comp:IsDying(),"Attendez la réapparition du personnage")
  assert(not C.default("/Script/Engine.GameplayStatics"):IsGamePaused(p:GetWorld()),"Fermez les menus et reprenez la partie")
  assert(not pc:IsMoveInputIgnored(),"Fermez les menus ou attendez la fin de la cinématique")
  assert(not C.default("/Script/Pal.PalUtility"):IsMultiplayer(p:GetWorld()),"Interactions disponibles en solo uniquement")
  return p,pc,comp
end
function C.snapshot()
  local data={timers={}}
  if not C.diagnostics then
    for k,e in pairs(C.active)do data.timers[k]=math.max(0,e.untilAt-os.clock())end
    data.ready=pcall(C.playable)
    return data
  end
  -- Native manager methods require a loaded world; pcall cannot catch native faults.
  local available,player=pcall(C.player)
  if not available then return data end
  local world=player:GetWorld()
  if not C.valid(world)or not world:GetFullName():find("MainWorld",1,true)then return data end
  local function sample(k,f)local ok,v=pcall(f);if ok then data[k]=v end end
  sample("player",function()return C.player():GetFullName()end)
  sample("world",function()return C.player():GetWorld():GetFullName()end)
  sample("hp",function()return select(3,C.player()):GetHP().Value end)
  sample("maxHp",function()return select(3,C.player()):GetMaxHP().Value end)
  sample("sp",function()return select(3,C.player()):GetSP().Value end)
  sample("maxSp",function()return select(3,C.player()):GetMaxSP().Value end)
  sample("hunger",function()return select(3,C.player()):GetFullStomach()end)
  sample("experience",function()return select(3,C.player()).IndividualParameter.SaveParameter.Exp end)
  sample("xpFloor",function()local player,_,comp=C.player();return C.default("/Script/Pal.PalUtility"):GetExpDatabase(player):GetTotalExp(comp.IndividualParameter.SaveParameter.Level,true)end)
  sample("xpNext",function()local player,_,comp=C.player();return C.default("/Script/Pal.PalUtility"):GetExpDatabase(player):GetTotalExp(comp.IndividualParameter.SaveParameter.Level+1,true)end)
  sample("level",function()return select(3,C.player()).IndividualParameter.SaveParameter.Level end)
  sample("dilation",function()return C.player().CustomTimeDilation end)
  sample("scale",function()return C.vector(C.player().Mesh.RelativeScale3D)end)
  sample("jump",function()return C.player().CharacterMovement.JumpZVelocity end)
  sample("gravity",function()return C.player().CharacterMovement.GravityScale end)
  sample("position",function()return C.vector(C.player():K2_GetActorLocation())end)
  sample("attack",function()return select(3,C.player()).AttackUp end)
  sample("defense",function()return select(3,C.player()).DefenseUp end)
  sample("hour",function()return C.instance("PalTimeManager"):GetCurrentPalWorldTime_Hour()end)
  sample("dead",function()return select(3,C.player()):IsDead()or select(3,C.player()):IsDying()end)
  sample("fov",function()return select(2,C.player()).PlayerCameraManager:GetFOVAngle() end)
  sample("capture",function()local a=C.instance("BP_PalGameSetting_C").CaptureJudgeRateArray;local v={};for i=1,a:GetArrayNum()do v[tostring(i)]=a[i]end;return v end)
  sample("characters",function()local v={};for _,a in ipairs(FindAllOf("PalCharacter")or{})do if C.valid(a)then v[a:GetFullName()]=true end end;return v end)
  sample("statuses",function()local out={};local component=C.player().StatusComponent;for _,id in ipairs({5,19,20,21,22,23,24})do out[tostring(id)]=C.valid(component:GetExecutionStatus(id))end;return out end)
  sample("palSizes",function()local out={};for _,actor in ipairs(FindAllOf("PalMonsterCharacter")or{})do if C.valid(actor)and C.valid(actor.Mesh)then out[actor:GetFullName()]=C.vector(actor.Mesh.RelativeScale3D)end end;return out end)
  sample("pals",function()local n=0;for _,a in ipairs(FindAllOf("PalMonsterCharacter")or{})do if C.valid(a)then n=n+1 end end;return n end)
  sample("velocity",function()return C.vector(C.player():GetVelocity())end)
  sample("cameraRate",function()local object=C.player():GetComponentByClass(StaticFindObject("/Script/Pal.PalCharacterCameraComponent"));assert(C.valid(object));return object.RotateSpeedRate end)
  sample("cameraRotation",function()local rot=select(2,C.player()).PlayerCameraManager:GetCameraRotation();return{Pitch=rot.Pitch,Yaw=rot.Yaw,Roll=rot.Roll}end)
  sample("spawned",function()local out={};for _,handle in ipairs(C.spawned or{})do if C.valid(handle)then local actor=handle:TryGetIndividualActor();if C.valid(actor)then out[actor:GetFullName()]=handle:TryGetIndividualParameter():GetCharacterID():ToString()end end end;return out end)
  for k,e in pairs(C.active)do data.timers[k]=math.max(0,e.untilAt-os.clock())end
  return data
end
function C.finish(r,status,message)
 C.write("result.json",C.json({id=r.id,gameId="palworld",status=status,message=message,executionConfirmed=status==0,metadata=C.snapshot()}))
end
function C.tick(handlers,token)
 local found,player=pcall(C.player);local identity=found and player:GetFullName()or nil
 if C.identity and C.identity~=identity then C.reset()end;C.identity=identity
 for k,v in pairs(C.active)do if os.clock()>=v.untilAt then C.restore(k)elseif v.update then local ok=pcall(v.update);if not ok then C.restore(k)end end end
 if os.time()>C.heartbeatAt then C.heartbeatAt=os.time();C.write("ready.json",C.json({gameId="palworld",token=token,at=os.time(),ready=pcall(C.playable)}))end
 if C.pending then
  local job=C.pending;local ok,done=pcall(job.verify)
  if ok and done then C.pending=nil;C.finish(job.request,0,"Interaction exécutée")
  elseif not ok or os.clock()>job.untilAt or C.identity~=job.identity then C.pending=nil;C.finish(job.request,3,not ok and tostring(done)or"Le jeu n’a pas confirmé le résultat de l’interaction")
  else return end
 end
 local content=C.read("request.lua");if not content or #content>32768 then return end
 local chunk=load(content,"ShenPulse request","t",{});if not chunk then return end
 local ok,r=pcall(chunk);if not ok or type(r)~="table"or r.token~=token or r.gameId~="palworld"or type(r.id)~="string"or r.id==C.lastId then return end
 C.lastId=r.id
 if type(r.expiresAt)~="number"or r.expiresAt<os.time()*1000 then return C.finish(r,3,"Demande expirée")end
 local fn=handlers[r.code];if not fn then return C.finish(r,2,"Interaction Palworld inconnue")end
 r.amount=tonumber(r.amount);if not r.amount or r.amount<=0 then r.amount=nil end
 r.quantity=math.min(10,math.max(1,math.floor(tonumber(r.quantity)or 1)))
 local playable,reason=pcall(function()
  if r.code=="respawn"then local p=C.player();assert(not C.default("/Script/Pal.PalUtility"):IsMultiplayer(p:GetWorld()),"Interactions disponibles en solo uniquement")
  elseif r.code~="reset_effects"then C.playable()end
 end)
 if not playable then return C.finish(r,3,tostring(reason))end
 local success,value=pcall(fn,r)
 if success and type(value)=="function"then C.pending={request=r,verify=value,identity=C.identity,untilAt=os.clock()+math.min(r.code=="baseraid"and 28 or 20,(r.expiresAt-os.time()*1000)/1000-.5)};return end
 C.finish(r,success and 0 or 3,success and"Interaction exécutée"or tostring(value))
end
return C
