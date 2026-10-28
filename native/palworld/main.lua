-- ShenPulse Palworld: local commands, game-thread execution, no external service.
local source = debug.getinfo(1, "S").source:gsub("^@", ""):gsub("\\", "/")
local directory = assert(source:match("^(.*)/Scripts/[^/]+$"), "Dossier ShenPulse introuvable") .. "/"
local game_id = "palworld"
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
local current_controller
RegisterHook("/Script/Engine.PlayerController:ClientRestart",function(context)
 local controller=context:get()
 if valid(controller)and controller:IsA("/Script/Pal.PalPlayerController")then current_controller=controller end
end)
local function pawn()
 local controller=current_controller
 assert(valid(controller),"Chargez une partie solo hors menus")
 local character=controller.Character
 assert(valid(character)and valid(character.CharacterParameterComponent),"Attendez le personnage")
 assert(valid(character.CharacterParameterComponent.IndividualParameter),"Attendez les données du personnage")
 local world=character:GetWorld()
 assert(valid(world)and world:GetFullName():find("MainWorld",1,true),"Chargez une partie solo")
 return character,controller
end
local function json(v)
  local t=type(v); if t=="nil" then return "null" elseif t=="number" then return v==v and tostring(v) or "null" elseif t=="boolean" then return tostring(v) elseif t~="table" then return quote(v) end
  local out={};for k,x in pairs(v) do out[#out+1]=quote(k)..":"..json(x) end;return "{"..table.concat(out,",").."}"
end
local environment={directory=directory,read=read,write=write,json=json,valid=valid,pawn=pawn}
local core=assert(load(assert(read("Scripts/core.lua")),"ShenPulse core","t",_ENV))(environment)
local effects=assert(load(assert(read("Scripts/effects.lua")),"ShenPulse effects","t",_ENV))(core)
local function tick()core.tick(effects,token)end
print("[ShenPulse] Palworld loaded")
local queued=false
LoopAsync(150,function()if not queued then queued=true;ExecuteInGameThread(function()local ok,err=pcall(tick);queued=false;if not ok then print("[ShenPulse] "..tostring(err))end end)end;return false end)
