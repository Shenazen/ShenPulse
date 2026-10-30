
-- Local XML command queue; no network service or external application is used.
local bridgeDirectory = getUserProfileAppPath() .. "modSettings/ShenPulse/"
createFolder(getUserProfileAppPath() .. "modSettings/")
createFolder(bridgeDirectory)
ShenPulseBridge.pendingRestores = {}
ShenPulseBridge.lastRequest = ""
ShenPulseBridge.pollElapsed = 0
ShenPulseBridge.heartbeatElapsed = 1000
local allowed = {
    money1k="actionMoney1k", money5k="actionMoney5k", money10k="actionMoney10k", money50k="actionMoney50k", money100k="actionMoney100k",
    moneyMinus5k="actionMoneyMinus5k", moneyMinus10k="actionMoneyMinus10k",
    superForceOn="actionSuperForceOn", superForceOff="actionSuperForceOff", superSpeedOn="actionSuperSpeedOn", superSpeedOff="actionSuperSpeedOff",
    fillFuel="actionFillFuel", repair="actionRepair", flip="actionFlip", flipSimple="actionFlipSimple", reset="actionReset", superJump="actionSuperJump",
    timeMorning="actionTimeMorning", timeNoon="actionTimeNoon", timeEvening="actionTimeEvening", timeNight="actionTimeNight", skipDay="actionSkipDay",
    weatherSun="actionWeatherSun", weatherRain="actionWeatherRain", weatherStorm="actionWeatherStorm",
    teleport1="actionTeleport1", teleport2="actionTeleport2", teleport3="actionTeleport3", teleport5="actionTeleport5", teleport10="actionTeleport10", teleportDealer="actionTeleportDealer",
    fillWheat="actionFillWheat", fillBarley="actionFillBarley", spawnBale="actionSpawnBale", spawnBaleBlue="actionSpawnBaleBlue", spawnPallet="actionSpawnPallet",
    deleteBales="actionDeleteBales", deletePallets="actionDeletePallets", growth1="actionGrowth1", growth6="actionGrowth6", growth12="actionGrowth12"
}
local vehicleOnly = {fillFuel=true,repair=true,flip=true,flipSimple=true,reset=true,superJump=true,fillWheat=true,fillBarley=true}
local restores = {superSpeedOn="actionSuperSpeedOff",superForceOn="actionSuperForceOff"}
local function writeXml(filename, values)
    local xml=createXMLFile("ShenPulse", bridgeDirectory .. filename, "ShenPulse")
    if not xml or xml==0 then return end
    for key,value in pairs(values) do setXMLString(xml,"ShenPulse#" .. key,tostring(value)) end
    saveXMLFile(xml)
    delete(xml)
end
function ShenPulseBridge:restoreEffects()
    for _,entry in pairs(self.pendingRestores) do pcall(self[entry.method],self) end
    self.pendingRestores={}
end
function ShenPulseBridge:processRequest()
    if not fileExists(bridgeDirectory .. "request.xml") then return end
    local xml=loadXMLFile("ShenPulse",bridgeDirectory .. "request.xml")
    if not xml or xml==0 then return end
    local requestId=getXMLString(xml,"ShenPulse#id") or ""
    local code=getXMLString(xml,"ShenPulse#code") or ""
    local quantity=math.max(1,math.min(20,getXMLInt(xml,"ShenPulse#quantity") or 1))
    local duration=math.max(1000,math.min(600000,getXMLInt(xml,"ShenPulse#duration") or 15000))
    delete(xml)
    if requestId=="" or requestId==self.lastRequest then return end
    self.lastRequest=requestId
    local status,message=0,"Interaction executee."
    if not allowed[code] then status,message=2,"Interaction inconnue."
    elseif not g_currentMission or not g_localPlayer then status,message=3,"Chargez une partie et controlez votre personnage."
    elseif g_currentMission.getIsServer and not g_currentMission:getIsServer() then status,message=3,"Cette interaction necessite la session solo ou le joueur hote."
    elseif vehicleOnly[code] and not self:getControlledVehicle(true) then status,message=3,"Prenez le controle d'un vehicule."
    else
        local ok,errorMessage=pcall(function()
            for _=1,quantity do
                if self[allowed[code]](self)==false then
                    status,message=3,"Conditions non remplies : verifiez le vehicule, sa remorque et la partie chargee."
                    break
                end
            end
            if restores[code] then self.pendingRestores[code]={method=restores[code],expires=(g_time or 0)+duration} end
            if code=="superSpeedOff" then self.pendingRestores.superSpeedOn=nil end
            if code=="superForceOff" then self.pendingRestores.superForceOn=nil end
        end)
        if not ok then status,message=1,"Le jeu a refuse cette interaction."; print("[ShenPulse] " .. tostring(errorMessage)) end
    end
    writeXml("response.xml",{id=requestId,status=status,message=message})
end
function ShenPulseBridge:update(dt)
    if self.flipAnimator and self.flipAnimator.isActive then pcall(function() self.flipAnimator:update(dt) end) end
    if self.jumpAnimator and self.jumpAnimator.isActive then pcall(function() self.jumpAnimator:update(dt) end) end
    local now=g_time or 0
    for code,entry in pairs(self.pendingRestores) do
        if now>=entry.expires then pcall(self[entry.method],self);self.pendingRestores[code]=nil end
    end
    self.pollElapsed=self.pollElapsed+dt
    self.heartbeatElapsed=self.heartbeatElapsed+dt
    if self.heartbeatElapsed>=1000 then self.heartbeatElapsed=0;writeXml("ready.xml",{ready="true"}) end
    if fileExists(bridgeDirectory .. "diagnostics.enabled") then
        self.diagnosticElapsed=(self.diagnosticElapsed or 0)+dt
        if self.diagnosticElapsed>=500 then
            self.diagnosticElapsed=0
            pcall(function()
                local player=g_localPlayer
                local mission=g_currentMission
                local farm=mission and mission:getFarmId() or 1
                if player and player.farmId then farm=player.farmId end
                local vehicle=self:getControlledVehicle(true)
                local x,y,z=0,0,0
                if player then x,y,z=player:getPosition() end
                local values={time=g_time or 0,money=mission and mission:getMoney(farm) or -1,
                    x=x,y=y,z=z,strength=self.superStrengthEnabled or false,
                    runSpeed=PlayerStateWalk.MAXIMUM_RUN_SPEED or 0,vehicle=vehicle and vehicle:getFullName() or "",
                    hour=mission and mission.environment.dayTime or 0,day=mission and mission.environment.currentMonotonicDay or 0,
                    bales=0,pallets=0,
                    nativeTeleport=type(mission.teleportVehicle),
                    growthState=tostring(mission.growthSystem and mission.growthSystem.isGrowing),
                    growthPeriod=tostring(mission.growthSystem and mission.growthSystem.currentPeriod)}
                local weather=mission.environment.weather
                local growth=mission.growthSystem
                if growth then
                    local state={}
                    for key,value in pairs(growth) do
                        if type(value)=="number" or type(value)=="boolean" then
                            table.insert(state,tostring(key).."="..tostring(value))
                        end
                    end
                    table.sort(state);values.growth=table.concat(state,";")
                end
                pcall(function()
                    local forecast=weather.forecastItems[1]
                    local object=weather:getWeatherObjectByIndex(forecast.season,forecast.objectIndex)
                    values.weather=tostring(object.type or object.name or object.index)
                end)
                if vehicle then
                    local _,ry,rz=getWorldRotation(vehicle.rootNode)
                    values.roll=rz;values.rotation=ry
                    values.speed=vehicle.lastSpeedReal or 0
                    local children=vehicle.getAttachedImplements and vehicle:getAttachedImplements() or {}
                    values.attachments=#children
                    if children[1] and children[1].object then
                        values.ax,values.ay,values.az=getWorldTranslation(children[1].object.rootNode)
                        values.attached=children[1].object:getFullName()
                    end
                end
                if vehicle then
                    values.vx,values.vy,values.vz=getWorldTranslation(vehicle.rootNode)
                    values.damage=vehicle.getDamageAmount and vehicle:getDamageAmount() or -1
                    values.fill=vehicle.getFillUnitFillLevel and vehicle:getFillUnitFillLevel(1) or -1
                end
                for _,entry in pairs(mission.itemSystem.itemsToSave or {}) do
                    if entry.item and entry.item.isa and entry.item:isa(Bale) then values.bales=values.bales+1 end
                end
                for _,entry in pairs(mission.vehicleSystem.vehicles or {}) do if entry.isPallet then values.pallets=values.pallets+1 end end
                writeXml("diagnostic.xml",values)
            end)
        end
    end
    if self.pollElapsed>=100 then self.pollElapsed=0;self:processRequest() end
end
function ShenPulseBridge:loadMap() self.lastRequest="";self.heartbeatElapsed=1000 end
function ShenPulseBridge:deleteMap()
    self:restoreEffects()
    if fileExists(bridgeDirectory .. "ready.xml") then deleteFile(bridgeDirectory .. "ready.xml") end
end
addModEventListener(ShenPulseBridge)
