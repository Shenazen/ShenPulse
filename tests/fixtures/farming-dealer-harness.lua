ShenPulseBridge = {}
dofile("scripts/integration-preparation/farming-dealer.lua")
local calls = 0
local vehicle
function ShenPulseBridge:isReady() return g_currentMission ~= nil end
function ShenPulseBridge:getControlledVehicle() return vehicle end
function ShenPulseBridge:teleportToPosition(x, z)
    calls = calls + 1
    self.destination = {x, z}
    return self.teleportResult ~= false
end

-- Different maps must use their own delivery area, including negative coords.
for _, position in ipairs({{715, -301}, {-345, -342}, {1200, 950}}) do
    local places = {delivery = position}
    local used = {}
    g_currentMission = {storeSpawnPlaces = places, usedStorePlaces = used}
    PlacementUtil = {getPlace = function(actualPlaces, size, actualUsed)
        assert(actualPlaces == places and actualUsed == used)
        assert(size.width >= 4 and size.length >= 8)
        assert(size.widthOffset == 0 and size.lengthOffset == 0 and size.heightOffset == 0)
        return position[1], 0, position[2]
    end}
    assert(ShenPulseBridge:actionTeleportDealer() == true)
    assert(ShenPulseBridge.destination[1] == position[1])
    assert(ShenPulseBridge.destination[2] == position[2])
end

-- Preserve assembly-aware teleport delegation and failure acknowledgements.
vehicle = {size = {width=6, length=12}}
PlacementUtil.getPlace = function(_, size)
    assert(size.width == 6 and size.length == 12)
    return 52, 0, -75
end
ShenPulseBridge.teleportResult = false
assert(ShenPulseBridge:actionTeleportDealer() == false)
local before = calls
PlacementUtil.getPlace = function() return nil end
assert(ShenPulseBridge:actionTeleportDealer() == false and calls == before)
g_currentMission.storeSpawnPlaces = {}
assert(ShenPulseBridge:actionTeleportDealer() == false and calls == before)
g_currentMission = nil
assert(ShenPulseBridge:actionTeleportDealer() == false and calls == before)
print("Farming dealer behavior checks passed (8)")
