local checks = 0
local function check(value, message) checks=checks+1; assert(value, message) end
local controls=false
local clock, paused, menu, health, invulnerable, dilation, xp, full = 0, false, false, 200, false, 1, 0, false
local memory, items, tick, notifications = {}, {}, nil, {}
local function basename(file) return file:gsub('\\','/'):match('([^/]+)$') end
local native_io = io
io = { open = function(file, mode)
    local name=basename(file)
    if mode=='rb' then
        if name=='bridge.json' then return {read=function()return '{"token":"'..string.rep('b',64)..'"}'end,close=function()end} end
        if not memory[name] then return nil end
        return {read=function()return memory[name]end,close=function()end}
    end
    return {write=function(_,s)memory[name]=s end,close=function()end}
end }
os.remove=function(file)memory[basename(file)]=nil;return true end
os.rename=function(a,b)memory[basename(b)]=memory[basename(a)];memory[basename(a)]=nil;return true end
os.clock=function()return clock end
os.time=function()return 1700000000+math.floor(clock)end
local function object(fields)fields=fields or {};fields.IsValid=function()return true end;return fields end
local world=object({GetFullName=function()return menu=='root' and 'World /Game/Levels/RootLevel.RootLevel' or menu and 'World /Game/Levels/Frontend/Frontend.Frontend' or 'World /Game/Levels/Overland/Overland.Overland'end})
local info=object({GetHealth=function()return health end,GetMaxHealth=function()return 200 end,SetHealth=function(_,v)health=v;return true end,IsInvulnerableToDamage=function()return invulnerable end,SetInvulnerableToDamage=function(_,v)invulnerable=v end})
local mesh=object({RelativeScale3D={X=1,Y=1,Z=1},SetRelativeScale3D=function(self,v)self.RelativeScale3D=v end})
FName=function(v)return {name=v,ToString=function(self)return self.name end}end
local player=object({CachedCharacterStateInfo=info,Mesh=mesh,GetFullName=function()return 'BP_Player_123'end,GetWorld=function()return world end,GetCharacterID=function()return FName('Player')end,IsPlayingIntro=function()return false end,SetInvulnerable=function(_,v)invulnerable=v end,K2_GetActorLocation=function()return{X=1,Y=2,Z=3}end})
local inventory=object({InventoryAdd=function(_,id,count)if not full then items[id]=(items[id]or 0)+count end end})
local experience=object({GetExperiencePoints=function()return xp end,GetExperienceLevel=function()return 1 end,AddExperience=function(_,amount)xp=xp+amount end})
local scheduler=object({GetSimulatedHourBP=function()return 6 end,GetSimulatedMinuteBP=function()return 0 end})
local invalid={IsValid=function()return false end}
local singleton={InventoryManager=inventory,ExperienceManager=experience,Scheduler=scheduler}
FindFirstOf=function(name)return singleton[name] or invalid end
local creature_list={}
FindAllOf=function(name)if name=='Creature_Character'then return creature_list elseif name=='PlayerController'then return {object({Pawn=player,IsMoveInputIgnored=function()return controls end})}else return {}end end
local statics=object({IsGamePaused=function()return paused end,GetGlobalTimeDilation=function()return dilation end})
local counts=object({GetCount=function(_,character,id,kind,stolen,holder,variation)
    assert(character.name=='Player' and kind==0 and stolen==0 and holder.name=='None' and variation.name=='None')
    return items[id.name]or 0
end})
local time_manager=object({StartWorldTimeDilation=function(_,p,value,provider)assert(p==player and provider==player);dilation=value end,FinishWorldTimeDilation=function(_,provider)assert(provider==player);dilation=1 end})
StaticFindObject=function(path)
    if path=='/Script/Engine.Default__GameplayStatics'then return statics end
    if path=='/Script/Phoenix.Default__InventoryManagerInterface'then return counts end
    if path=='/Script/FXUtil.Default__TimeDilationManager'then return time_manager end
    if path=='/Script/Phoenix.Default__UIManager'then return object({AddTextTickerNotification=function(_,v)notifications[#notifications+1]=v end})end
    return invalid
end
LoopAsync=function(_,callback)tick=callback end
ExecuteInGameThread=function(callback)callback()end
local module_file=assert(native_io.open('native/shop-games/hogwarts/main.lua','rb'));local module_source=module_file:read('*a');module_file:close();assert(load(module_source,'@/local/ShenPulse/Scripts/main.lua'))()
local sequence=0
local function send(code, duration, token)
    sequence=sequence+1
    memory['request.lua']=string.format('return {id="%s",token="%s",gameId="hogwarts-legacy",code="%s",expiresAt=%d,quantity=1,duration=%d,viewer="Élodie cadeau"}',sequence,token or string.rep('b',64),code,os.time()*1000+10000,duration or 0)
    tick();return memory['result.json']or''
end
local function ok(code,seconds)local result=send(code,seconds);check(result:find('"status":0',1,true),result);return result end
local function unavailable(code)local result=send(code);check(result:find('"status":3',1,true),result);return result end
ok('degats_25');check(health==150,'25% health loss')
ok('soin_complet');check(health==200,'Full heal')
ok('argent_100');check(items.Knuts==100,'Currency added and counted through native static interface')
full=true;unavailable('potion_soin');check(items.WoundCleaning==nil,'Full inventory cannot report success');full=false
ok('xp_500');check(xp==500,'XP amount')
ok('geant',10);check(mesh.RelativeScale3D.X==2,'Giant scale')
clock=5;ok('geant',10);check(mesh.RelativeScale3D.X==2,'Repeated giant does not multiply scale')
ok('minuscule',10);check(mesh.RelativeScale3D.X==0.5,'Opposed size uses original scale')
clock=11;tick();check(mesh.RelativeScale3D.X==1,'Original deadline and original scale restored')
ok('ralenti_6',6);check(dilation==0.25,'Slow time')
clock=14;ok('ralenti_10',10);clock=18;tick();check(dilation==1,'Slow effect is not extended by repeats or game time dilation')
ok('invincible_15',15);check(invulnerable,'Invincibility starts');clock=34;tick();check(not invulnerable,'Invincibility expires')
invulnerable=true;ok('invincible_30',1);clock=36;tick();check(invulnerable,'Preexisting invulnerability is preserved');invulnerable=false
ok('geant',10);paused=true;unavailable('degats_25');ok('tout_annuler');check(mesh.RelativeScale3D.X==1 and paused,'Reset works during pause without leaving it');paused=false
menu=true;clock=clock+1;tick();check(memory['ready.json']:find('"ready":false',1,true),'Menu is not a playable state');unavailable('argent_100');menu=false
menu='root';clock=clock+1;tick();check(memory['ready.json']:find('"ready":false',1,true),'Bootstrap world is not a playable state');menu=false
controls=true;unavailable('argent_100');controls=false
local last=memory['result.json'];send('argent_100',0,string.rep('c',64));check(memory['result.json']==last,'Wrong secret does not execute')
ok('argent_100');local once=items.Knuts;tick();check(items.Knuts==once,'Duplicate request is never replayed')
local before=items.Knuts;memory['request.lua']=string.format('return {id="expired",token="%s",gameId="hogwarts-legacy",code="argent_100",expiresAt=0}',string.rep('b',64));tick();check(items.Knuts==before,'Expired request does not execute')
singleton.CreatureManager=object({CreatureSpawnWild=function()end})
send('creature_niffleur');check(not memory['result.json']:find('"id":"'..sequence..'"',1,true),'An asynchronous spawn is not immediately confirmed')
creature_list={object({GetFullName=function()return 'Niffler_123'end,GetClass=function()return object({GetFullName=function()return 'BlueprintGeneratedClass /Game/Test/BP_Niffler_Creature.BP_Niffler_Creature_C'end})end})};tick();check(memory['result.json']:find('"id":"'..sequence..'"',1,true) and memory['result.json']:find('"status":0',1,true),'Only a newly created creature of the requested type confirms success')
send('creature_niffleur');clock=clock+9;tick();check(memory['result.json']:find('"status":3',1,true) and memory['result.json']:find('"executionConfirmed":false',1,true),'A spawn without a new creature times out honestly')
singleton.CreatureManager=nil
for code in os.getenv('SHENPULSE_HOGWARTS_TEST_CODES'):gmatch('[^,]+') do local result=send(code,1);check(not result:find('"status":2',1,true),'Catalog handler missing: '..code)end
io=native_io
print('Hogwarts behavior checks passed ('..checks..')')
