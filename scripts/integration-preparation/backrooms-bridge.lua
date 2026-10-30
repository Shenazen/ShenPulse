-- ShenPulse loopback HTTP bridge. All Unreal access stays on the game thread.
local here=debug.getinfo(1,"S").source:match("^@(.*[/\\])") or ""
local shared=here:gsub("[/\\]ShenPulse[/\\]Scripts[/\\]$","/shared/")
package.cpath=shared.."?.dll;"..package.cpath
package.path=shared.."?.lua;"..package.path
local socket,json,E=require("socket"),require("json"),require("effects")
local server=assert(socket.bind("127.0.0.1",58903));server:settimeout(0)
local clients,nextId={},0

local function snapshot()
    local p=E.perso();if not p then return {ready=false} end
    local pos=p:K2_GetActorLocation()
    local result={ready=true,host=E.estHote(),x=pos.X,y=pos.Y,z=pos.Z,
        walk=p.WalkSpeed,sprint=p.SprintSpeed,maxWalk=p.CharacterMovement.MaxWalkSpeed,dead=p.IsDead}
    pcall(function() result.sanity=p.PlayerState.Sanity end)
    pcall(function() result.fov=E.controller().PlayerCameraManager:GetFOVAngle() end)
    local classes={hound="BP_Hound_C",smiler="BP_Roaming_Smiler_C",smiler_rapide="BP_Smiler_Dash_C",
        skinstealer="BP_SkinStealer_C",bacteria="Bacteria_BP_C",bacteria_rodeuse="Bacteria_Roaming_BP_C",
        partygoer="BP_RoamingPartygoer_C",moth="BP_Moth_C",clump="BP_Clump_C",faceling="BP_Faceling_C",
        araignee="BP_Membri_C",poupee="BP_Animation_C"}
    for key,cls in pairs(classes) do pcall(function()
        local count=0
        for _,a in ipairs(FindAllOf(cls) or {}) do
            if a:IsValid() and not a.bActorIsBeingDestroyed and not a.bHidden then count=count+1 end
        end
        result[key]=count
    end) end
    return result
end

local function respond(client,status,value)
    if client.closed then return end
    local body=json.encode(value)
    client.output="HTTP/1.1 "..status.." ShenPulse\r\nContent-Type: application/json\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: "..#body.."\r\n\r\n"..body
end
local function close(client)
    client.closed=true;pcall(function() client.socket:close() end)
    clients[client.id]=nil
end
local function dispatch(client,method,route,body)
    if method=="OPTIONS" and route=="/" then respond(client,200,{ok=true});return end
    local code=route:match("^/([a-z][a-z0-9_]*)$")
    if method~="POST" or not code then respond(client,404,{status=2,message="Interaction inconnue."});return end
    local valid,request=pcall(json.decode,body)
    if not valid or type(request)~="table" then respond(client,400,{status=2,message="Demande invalide."});return end
    client.executing=true
    ExecuteInGameThread(function()
        if client.closed then return end
        if code=="shenpulse_status" then
            local ok,state=pcall(snapshot)
            respond(client,200,ok and {status=0,state=state} or {status=1,message=tostring(state)});return
        end
        local effect=code=="shenpulse_reset" and E.reset or E.CATALOGUE[code]
        if not effect then respond(client,200,{status=2,message="Interaction inconnue."});return end
        local p=E.perso()
        if code~="shenpulse_reset" and (not p or p.IsDead) then
            respond(client,200,{status=3,message="Chargez une partie jouable avec un personnage vivant."});return
        end
        local duration=tonumber(request.duration)
        duration=duration and duration>0 and math.max(1,math.min(600,duration/1000)) or nil
        local options={pseudo=tostring(request.viewer or "Viewer"):gsub("[%c]",""):sub(1,64),
            n=math.max(1,math.min(20,math.floor(tonumber(request.quantity) or 1))),duree=duration}
        local ok,res,why=pcall(effect,options)
        if not ok then E.journal("Erreur "..code.." : "..tostring(res)) end
        respond(client,200,{status=not ok and 1 or res==false and 3 or 0,
            message=not ok and "Le jeu a refusé cet effet : "..tostring(res) or res==false and tostring(why or "Conditions de jeu non remplies.") or "Interaction exécutée."})
    end)
end
local function poll(client)
    if socket.gettime()>client.deadline then close(client);return end
    if client.output then
        local sent,err,last=client.socket:send(client.output)
        client.output=client.output:sub((sent or last or 0)+1)
        if #client.output==0 or err and err~="timeout" then close(client) end
        return
    end
    if client.executing then
        local _,err=client.socket:receive(1)
        if err and err~="timeout" then close(client) end
        return
    end
    local bytes,err,partial=client.socket:receive(4096)
    client.input=client.input..(bytes or partial or "")
    if #client.input>16384 then close(client);return end
    local ending=client.input:find("\r\n\r\n",1,true)
    if ending then
        local headers=client.input:sub(1,ending-1)
        local method,route=headers:match("^(%u+)%s+([^%s]+)%s+HTTP/1%.[01]")
        local lower="\r\n"..headers:lower()
        local length=tonumber(lower:match("\r\ncontent%-length:%s*(%d+)")) or 0
        if not method or #headers>8192 or length>8192 or lower:find("\r\norigin:",1,true) or lower:find("\r\ntransfer-encoding:",1,true) then
            respond(client,400,{status=2,message="Demande locale invalide."});return
        end
        if #client.input>=ending+3+length then
            dispatch(client,method,route,client.input:sub(ending+4,ending+3+length));return
        end
    end
    if err and err~="timeout" then close(client) end
end
LoopAsync(25,function()
    local count=0;for _ in pairs(clients) do count=count+1 end
    for _=1,math.max(0,16-count) do
        local c=server:accept();if not c then break end
        c:settimeout(0);nextId=nextId+1
        clients[nextId]={id=nextId,socket=c,input="",deadline=socket.gettime()+12}
    end
    for _,client in pairs(clients) do
        local ok,why=pcall(poll,client)
        if not ok then E.journal("Demande locale interrompue : "..tostring(why));close(client) end
    end
    return false
end)
E.journal("Module local prêt sur 127.0.0.1:58903.")
