function ShenPulseBridge:actionTeleportDealer()
    local mission = g_currentMission
    if not self:isReady() or not mission or not PlacementUtil then return false end
    local places = mission.storeSpawnPlaces
    if not places or next(places) == nil then return false end

    -- Use the map's vehicle delivery area and the same placement API as purchases.
    -- Do not mark the place occupied: teleporting does not purchase a vehicle.
    local vehicle = self:getControlledVehicle(true)
    local size = {width=4, length=8, height=4, widthOffset=0, lengthOffset=0, heightOffset=0}
    if vehicle then
        size.width = math.max(size.width, vehicle.size and vehicle.size.width or 0)
        size.length = math.max(size.length, vehicle.size and vehicle.size.length or 0)
    end
    local x, _, z = PlacementUtil.getPlace(places, size, mission.usedStorePlaces or {}, true, true, false, true)
    if type(x) ~= "number" or type(z) ~= "number" then return false end
    -- teleportToPosition keeps the native assembly teleport for attached tools.
    return self:teleportToPosition(x, z, "Concession")
end
