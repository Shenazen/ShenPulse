#define WIN32_LEAN_AND_MEAN
#define NOMINMAX
#include <winsock2.h>
#include <ws2tcpip.h>
#include <windows.h>
#include <algorithm>
#include <atomic>
#include <cctype>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <deque>
#include <mutex>
#include <sstream>
#include <string>
#include <vector>
#include "main.h"
#include "natives.h"
#pragma comment(lib, "Ws2_32.lib")

namespace {
const char* kVersion = "2026.08.02.1-vehicle-flip-roll";
const unsigned short kPort = 58430;
const size_t kMaxQueuedRequests = 250;
const int kEffectRetryStatus = 9;
const char* kGameNotReadyMessage = "La partie GTA V n'est pas prete; interaction gardee en attente.";
const Vector3 kMont = {501.76f, 0, 5604.28f, 0, 798.25f, 0};
const Vector3 kVictoryCenter = {501.76f, 0, 5604.28f, 0, 797.91f, 0};
const float kVictoryRadius = 4.0f;
const float kVictoryMinZ = 790.0f;
const float kVictoryMaxZ = 810.0f;
const int kWinCelebrationSeconds = 7;
const int kVictoryHoldSeconds = 10;
const int kAirportTeleportDelayMs = 1200;
const int kBlackHoleTelegraphMs = 3000;
const int kBlackHoleDurationMs = 22000;
const int kTrainTelegraphMs = 2200;
const int kTrainApproachMs = 1050;
const int kVehicleFlipDurationMs = 900;
const Vector3 kAirport = {-1034.6f, 0, -2733.6f, 0, 20.2f, 0};
const Vector3 kTeleports[] = {
    {-75.0f, 0, -818.0f, 0, 326.0f, 0}, {425.4f, 0, 5614.3f, 0, 766.5f, 0},
    {-1034.6f, 0, -2733.6f, 0, 20.2f, 0}, {1692.4f, 0, 3291.6f, 0, 41.1f, 0},
    {-1604.5f, 0, 5256.7f, 0, 3.9f, 0}, {2870.0f, 0, 4380.0f, 0, 50.0f, 0},
};
struct Request { int id; std::string code; };
struct Result { int status; std::string message; };
struct TimedGiftObject { Entity entity; };
HMODULE g_module = nullptr;
std::atomic<bool> g_running(false), g_connected(false), g_networkStarted(false);
SOCKET g_socket = INVALID_SOCKET;
std::mutex g_socketLock, g_queueLock, g_logLock;
std::deque<Request> g_queue;
std::string g_sessionId, g_lastEvent = "boot";
ULONGLONG g_lastState = 0, g_roundStart = 0, g_zoneStart = 0, g_airportTeleportAt = 0, g_winDisplayUntil = 0, g_invincibleUntil = 0;
ULONGLONG g_superJumpUntil = 0, g_nextSuperJumpBoostAt = 0, g_explosiveAmmoUntil = 0, g_explosiveMeleeUntil = 0;
ULONGLONG g_infiniteAmmoUntil = 0, g_drunkUntil = 0, g_slowMotionUntil = 0, g_frozenUntil = 0;
ULONGLONG g_prisonUntil = 0, g_blackHoleStartedAt = 0, g_blackHolePullStartsAt = 0, g_blackHoleUntil = 0, g_nextBlackHolePullAt = 0, g_magneticStormUntil = 0, g_danceUntil = 0;
ULONGLONG g_trainUntil = 0, g_trainApproachAt = 0, g_trainImpactAt = 0;
ULONGLONG g_vehicleFlipStartedAt = 0, g_vehicleFlipUntil = 0;
ULONGLONG g_nativeWinMultiplierUntil = 0, g_counterHudUntil = 0;
ULONGLONG g_lastDeathAt = 0;
ULONGLONG g_playerAliveSince = 0;
Entity g_frozenEntity = 0;
Entity g_trainTarget = 0;
Vehicle g_trainVehicle = 0;
Vehicle g_flippingVehicle = 0;
Ped g_prisonPed = 0, g_dancePed = 0, g_drunkPed = 0;
Vector3 g_prisonCenter = {0.0f, 0, 0.0f, 0, 0.0f, 0};
Vector3 g_blackHoleCenter = {0.0f, 0, 0.0f, 0, 0.0f, 0};
Vector3 g_trainDirection = {0.0f, 0, 0.0f, 0, 0.0f, 0};
Vector3 g_trainSpawnPosition = {0.0f, 0, 0.0f, 0, 0.0f, 0};
Vector3 g_vehicleFlipStartRotation = {0.0f, 0, 0.0f, 0, 0.0f, 0};
std::vector<Object> g_prisonObjects;
std::vector<TimedGiftObject> g_giftObjects;
const size_t kMaxGiftObjects = 512;
bool g_restoreInvincibility = false, g_wasInvincible = false, g_infiniteAmmoActive = false;
bool g_drunkActive = false, g_slowMotionActive = false, g_roundActive = false, g_inZone = false, g_won = false;
bool g_playerWasDead = false, g_autoTeleportedWinner = false;
bool g_trainImpactApplied = false;
bool g_vehicleFlipHalfLogged = false;
bool g_playerAliveObserved = false;
Ped g_lastObservedPlayerPed = 0;
int g_lastObservedPlayerHealth = 0;
int g_roundId = 0, g_winId = 0, g_counterDelta = 0, g_counterEventId = 0, g_zoneEventId = 0;
int g_counterWinCount = 0, g_counterDeathCount = 0;
int g_nativeWinMultiplier = 1;
std::string g_counterEvent;
std::string g_counterHudText;

Hash HashName(const char* name);
void DrawHudText(const std::string& message, int red, int green, int blue);
void StartRound(const char* eventName);
Result LoadModel(Hash model, const char* label);
int SpawnAmbientChaosVehicles(Ped playerPed, std::vector<Vehicle>& targets, int requestedCount);
Result SpawnHostilePeds(Ped playerPed, const Hash* models, size_t modelCount, int requestedCount, const char* label);

size_t RandomChoiceIndex(size_t count) {
    static std::atomic<unsigned long long> nonce(0);
    if (!count) return 0;
    unsigned long long value = static_cast<unsigned long long>(GetTickCount64());
    value ^= static_cast<unsigned long long>(GetCurrentProcessId()) << 21;
    value ^= (++nonce) * 0x9E3779B97F4A7C15ULL;
    value ^= value >> 30;
    value *= 0xBF58476D1CE4E5B9ULL;
    value ^= value >> 27;
    return static_cast<size_t>(value % count);
}
Vector3 GameplayCameraForward() {
    const float degreesToRadians = 0.01745329251994329577f;
    Vector3 rotation = CAM::GET_GAMEPLAY_CAM_ROT(2);
    float pitch = rotation.x * degreesToRadians;
    float yaw = rotation.z * degreesToRadians;
    float horizontal = std::abs(std::cos(pitch));
    return {
        -std::sin(yaw) * horizontal,
        0,
        std::cos(yaw) * horizontal,
        0,
        std::sin(pitch),
        0
    };
}

std::string ModuleDir() {
    char path[MAX_PATH] = {};
    GetModuleFileNameA(g_module, path, MAX_PATH);
    std::string value(path);
    size_t slash = value.find_last_of("\\/");
    return slash == std::string::npos ? "" : value.substr(0, slash + 1);
}
void Log(const std::string& message) {
    std::lock_guard<std::mutex> guard(g_logLock);
    std::string line = "[ShenPulse Mont Chiliad Enhanced] " + message + "\r\n";
    OutputDebugStringA(line.c_str());
    char localAppData[MAX_PATH] = {};
    size_t length = 0;
    std::string logPath = ModuleDir() + "ShenPulseMontChiliadEnhanced.log";
    if (getenv_s(&length, localAppData, sizeof(localAppData), "LOCALAPPDATA") == 0 && length > 1) {
        std::string shenPulseDirectory = std::string(localAppData) + "\\ShenPulse";
        std::string logDirectory = shenPulseDirectory + "\\Logs";
        CreateDirectoryA(shenPulseDirectory.c_str(), nullptr);
        CreateDirectoryA(logDirectory.c_str(), nullptr);
        logPath = logDirectory + "\\ShenPulseMontChiliadEnhanced.log";
    }
    FILE* file = nullptr;
    if (fopen_s(&file, logPath.c_str(), "ab") == 0 && file) {
        fwrite(line.data(), 1, line.size(), file);
        fclose(file);
    }
}
std::string Escape(const std::string& value) {
    std::string result;
    for (unsigned char c : value) {
        switch (c) {
        case '\\': result += "\\\\"; break;
        case '"': result += "\\\""; break;
        case '\n': result += "\\n"; break;
        case '\r': result += "\\r"; break;
        case '\t': result += "\\t"; break;
        default: if (c >= 0x20) result += static_cast<char>(c); break;
        }
    }
    return result;
}
bool ReadInt(const std::string& json, const char* key, int& value) {
    std::string token = std::string("\"") + key + "\"";
    size_t pos = json.find(token);
    if (pos == std::string::npos || (pos = json.find(':', pos + token.size())) == std::string::npos) return false;
    ++pos;
    while (pos < json.size() && std::isspace(static_cast<unsigned char>(json[pos]))) ++pos;
    bool negative = pos < json.size() && json[pos] == '-';
    if (negative) ++pos;
    if (pos >= json.size() || !std::isdigit(static_cast<unsigned char>(json[pos]))) return false;
    long long parsed = 0;
    while (pos < json.size() && std::isdigit(static_cast<unsigned char>(json[pos]))) {
        parsed = parsed * 10 + json[pos++] - '0';
        if (parsed > 2147483647LL) return false;
    }
    value = static_cast<int>(negative ? -parsed : parsed);
    return true;
}
bool ReadString(const std::string& json, const char* key, std::string& value) {
    std::string token = std::string("\"") + key + "\"";
    size_t pos = json.find(token);
    if (pos == std::string::npos || (pos = json.find(':', pos + token.size())) == std::string::npos) return false;
    ++pos;
    while (pos < json.size() && std::isspace(static_cast<unsigned char>(json[pos]))) ++pos;
    if (pos >= json.size() || json[pos++] != '"') return false;
    std::string parsed;
    while (pos < json.size()) {
        char c = json[pos++];
        if (c == '"') { value = parsed; return true; }
        if (c != '\\') { parsed += c; continue; }
        if (pos >= json.size()) return false;
        char escaped = json[pos++];
        if (escaped == '"' || escaped == '\\' || escaped == '/') parsed += escaped;
        else if (escaped == 'n') parsed += '\n';
        else if (escaped == 'r') parsed += '\r';
        else if (escaped == 't') parsed += '\t';
        else return false;
    }
    return false;
}
void CloseSocket(SOCKET expected = INVALID_SOCKET) {
    SOCKET toClose = INVALID_SOCKET;
    bool clearedCurrent = false;
    {
        std::lock_guard<std::mutex> guard(g_socketLock);
        toClose = expected == INVALID_SOCKET ? g_socket : expected;
        if (toClose != INVALID_SOCKET && g_socket == toClose) {
            g_socket = INVALID_SOCKET;
            clearedCurrent = true;
        }
    }
    if (toClose != INVALID_SOCKET) {
        shutdown(toClose, SD_BOTH);
        closesocket(toClose);
    }
    if (clearedCurrent) g_connected.store(false);
}
bool Send(const std::string& json) {
    std::lock_guard<std::mutex> guard(g_socketLock);
    if (g_socket == INVALID_SOCKET) return false;
    std::string frame = json;
    frame.push_back('\0');
    size_t sent = 0;
    while (sent < frame.size()) {
        int count = send(g_socket, frame.data() + sent, static_cast<int>(frame.size() - sent), 0);
        if (count == SOCKET_ERROR || count <= 0) {
            shutdown(g_socket, SD_BOTH);
            closesocket(g_socket);
            g_socket = INVALID_SOCKET;
            g_connected.store(false);
            return false;
        }
        sent += static_cast<size_t>(count);
    }
    return true;
}
void QueueFrame(const std::string& frame) {
    int id = -1;
    std::string code;
    if (!ReadInt(frame, "id", id) || id < 0 || !ReadString(frame, "code", code) || code.empty()) return;
    std::lock_guard<std::mutex> guard(g_queueLock);
    if (g_queue.size() >= kMaxQueuedRequests) g_queue.pop_front();
    g_queue.push_back({id, code});
}
DWORD WINAPI NetworkLoop(LPVOID) {
    WSADATA data = {};
    if (WSAStartup(MAKEWORD(2, 2), &data) != 0) {
        Log("Winsock initialization failed.");
        g_networkStarted.store(false);
        return 0;
    }
    while (g_running.load()) {
        SOCKET next = socket(AF_INET, SOCK_STREAM, IPPROTO_TCP);
        if (next == INVALID_SOCKET) { Sleep(250); continue; }
        BOOL enabled = TRUE;
        DWORD timeout = 1000;
        setsockopt(next, IPPROTO_TCP, TCP_NODELAY, reinterpret_cast<const char*>(&enabled), sizeof(enabled));
        setsockopt(next, SOL_SOCKET, SO_KEEPALIVE, reinterpret_cast<const char*>(&enabled), sizeof(enabled));
        setsockopt(next, SOL_SOCKET, SO_RCVTIMEO, reinterpret_cast<const char*>(&timeout), sizeof(timeout));
        sockaddr_in address = {};
        address.sin_family = AF_INET;
        address.sin_port = htons(kPort);
        inet_pton(AF_INET, "127.0.0.1", &address.sin_addr);
        if (connect(next, reinterpret_cast<sockaddr*>(&address), sizeof(address)) == SOCKET_ERROR) {
            closesocket(next);
            Sleep(250);
            continue;
        }
        {
            std::lock_guard<std::mutex> guard(g_socketLock);
            if (!g_running.load()) { closesocket(next); break; }
            g_socket = next;
            g_connected.store(true);
        }
        Log("Connected to ShenPulse on 127.0.0.1:58430.");
        std::string buffer;
        char chunk[4096];
        while (g_running.load()) {
            int received = recv(next, chunk, sizeof(chunk), 0);
            if (received == SOCKET_ERROR) {
                if (WSAGetLastError() == WSAETIMEDOUT) continue;
                break;
            }
            if (received <= 0) break;
            for (int i = 0; i < received; ++i) {
                if (chunk[i] == '\0') { QueueFrame(buffer); buffer.clear(); }
                else if (buffer.size() < 65536) buffer.push_back(chunk[i]);
                else buffer.clear();
            }
        }
        CloseSocket(next);
        if (g_running.load()) {
            Log("Disconnected; reconnecting locally.");
            Sleep(250);
        }
    }
    CloseSocket();
    WSACleanup();
    g_networkStarted.store(false);
    return 0;
}
bool PlayerReady(Player& player, Ped& ped) {
    player = PLAYER::PLAYER_ID();
    ped = PLAYER::PLAYER_PED_ID();
    return ped != 0 && ENTITY::DOES_ENTITY_EXIST(ped) && !ENTITY::IS_ENTITY_DEAD(ped) && PLAYER::IS_PLAYER_CONTROL_ON(player);
}
bool CurrentPlayerVehicle(Ped ped, Vehicle& vehicle) {
    vehicle = 0;
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return false;
    if (!PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) return false;
    vehicle = PED::GET_VEHICLE_PED_IS_IN(ped, FALSE);
    return vehicle && ENTITY::DOES_ENTITY_EXIST(vehicle);
}
Entity PlayerTarget(Ped ped) {
    Vehicle vehicle = 0;
    return CurrentPlayerVehicle(ped, vehicle) ? vehicle : ped;
}
void Teleport(Entity target, const Vector3& p) {
    if (!target || !ENTITY::DOES_ENTITY_EXIST(target)) return;
    STREAMING::REQUEST_COLLISION_AT_COORD(p.x, p.y, p.z);
    ENTITY::SET_ENTITY_COORDS_NO_OFFSET(target, p.x, p.y, p.z, FALSE, FALSE, TRUE);
    ENTITY::SET_ENTITY_VELOCITY(target, 0.0f, 0.0f, 0.0f);
}
void TeleportPlayer(Ped ped, const Vector3& p) {
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return;
    Vehicle vehicle = 0;
    if (CurrentPlayerVehicle(ped, vehicle)) {
        STREAMING::REQUEST_COLLISION_AT_COORD(p.x, p.y, p.z);
        PED::SET_PED_COORDS_KEEP_VEHICLE(ped, p.x, p.y, p.z);
        Teleport(vehicle, p);
        ENTITY::SET_ENTITY_VELOCITY(vehicle, 0.0f, 0.0f, 0.0f);
        ENTITY::SET_ENTITY_VELOCITY(ped, 0.0f, 0.0f, 0.0f);
        WAIT(0);
        PED::SET_PED_INTO_VEHICLE(ped, vehicle, -1);
        return;
    }
    Teleport(ped, p);
}
bool PointInsideVictoryZone(const Vector3& p) {
    float dx = p.x - kVictoryCenter.x, dy = p.y - kVictoryCenter.y;
    return p.z >= kVictoryMinZ
        && p.z <= kVictoryMaxZ
        && dx * dx + dy * dy <= kVictoryRadius * kVictoryRadius;
}
bool PlayerInsideVictoryZone(Ped ped, Vector3& trackedPosition) {
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return false;
    trackedPosition = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    if (PointInsideVictoryZone(trackedPosition)) return true;
    Vehicle vehicle = 0;
    if (CurrentPlayerVehicle(ped, vehicle)) {
        Vector3 vehiclePosition = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        if (PointInsideVictoryZone(vehiclePosition)) {
            trackedPosition = vehiclePosition;
            return true;
        }
    }
    return false;
}
void RegisterCounterEvent(int amount, const char* eventName) {
    if (amount == 0) return;
    ULONGLONG now = GetTickCount64();
    if (g_nativeWinMultiplierUntil && now >= g_nativeWinMultiplierUntil) {
        g_nativeWinMultiplier = 1;
        g_nativeWinMultiplierUntil = 0;
    }
    ++g_counterEventId;
    g_counterDelta = amount;
    g_counterEvent = eventName ? eventName : "";
    if (g_counterEvent == "win") ++g_counterWinCount;
    if (g_counterEvent == "death") ++g_counterDeathCount;
    int visibleAmount = amount * std::max(1, g_nativeWinMultiplier);
    g_counterHudText =
        (g_counterEvent == "win" ? "VICTOIRE  " : "MORT  ")
        + std::string(visibleAmount > 0 ? "+" : "")
        + std::to_string(visibleAmount)
        + (std::abs(visibleAmount) == 1 ? " WIN" : " WINS");
    g_counterHudUntil =
        now + static_cast<ULONGLONG>(kWinCelebrationSeconds) * 1000ULL;
    Log("Counter event " + g_counterEvent + " #" + std::to_string(g_counterEventId) + " delta " + std::to_string(amount) + ".");
}
void ResetVictoryZoneEntry() {
    g_inZone = false;
    g_zoneStart = 0;
    g_lastState = 0;
}
float Distance2D(const Vector3& a, const Vector3& b) {
    float dx = a.x - b.x;
    float dy = a.y - b.y;
    return std::sqrt(dx * dx + dy * dy);
}
void DeletePrisonObjects() {
    for (size_t index = 0; index < g_prisonObjects.size(); ++index) {
        Object object = g_prisonObjects[index];
        if (!object || !ENTITY::DOES_ENTITY_EXIST(object)) continue;
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object, TRUE, TRUE);
        OBJECT::DELETE_OBJECT(&object);
    }
    g_prisonObjects.clear();
}
void DeleteGiftObject(Entity entity) {
    if (!entity || !ENTITY::DOES_ENTITY_EXIST(entity)) return;
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(entity, TRUE, TRUE);
    ENTITY::DELETE_ENTITY(&entity);
}
void DeleteGiftObjects() {
    for (size_t index = 0; index < g_giftObjects.size(); ++index) {
        DeleteGiftObject(g_giftObjects[index].entity);
    }
    g_giftObjects.clear();
}
void CleanupGiftObjects(ULONGLONG) {
    for (size_t index = 0; index < g_giftObjects.size();) {
        TimedGiftObject& gift = g_giftObjects[index];
        if (!gift.entity || !ENTITY::DOES_ENTITY_EXIST(gift.entity)) {
            DeleteGiftObject(gift.entity);
            g_giftObjects.erase(g_giftObjects.begin() + index);
            continue;
        }
        ++index;
    }
}
void EndPrison() {
    if (g_frozenEntity && ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) {
        ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, FALSE);
    }
    if (g_prisonPed && ENTITY::DOES_ENTITY_EXIST(g_prisonPed)) {
        ENTITY::FREEZE_ENTITY_POSITION(g_prisonPed, FALSE);
        PED::SET_PED_CAN_RAGDOLL(g_prisonPed, TRUE);
        AI::CLEAR_PED_TASKS_IMMEDIATELY(g_prisonPed);
    }
    DeletePrisonObjects();
    g_frozenEntity = 0;
    g_frozenUntil = 0;
    g_prisonPed = 0;
    g_prisonUntil = 0;
}
bool TryCreatePrisonPanel(Hash model, const Vector3& center, float x, float y, float heading) {
    Object object = OBJECT::CREATE_OBJECT_NO_OFFSET(model, center.x + x, center.y + y, center.z - 1.05f, FALSE, FALSE, FALSE);
    if (!object || !ENTITY::DOES_ENTITY_EXIST(object)) return false;
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object, TRUE, TRUE);
    OBJECT::PLACE_OBJECT_ON_GROUND_PROPERLY(object);
    ENTITY::SET_ENTITY_HEADING(object, heading);
    ENTITY::FREEZE_ENTITY_POSITION(object, TRUE);
    g_prisonObjects.push_back(object);
    return true;
}
void CreatePrisonCage(const Vector3& center) {
    const char* modelNames[] = {
        "prop_fnclink_03e",
        "prop_fnclink_03c",
        "prop_fnclink_02gate1",
        "prop_const_fence03b_cr",
    };
    Hash model = 0;
    for (size_t index = 0; index < sizeof(modelNames) / sizeof(modelNames[0]); ++index) {
        Hash candidate = HashName(modelNames[index]);
        if (!STREAMING::IS_MODEL_IN_CDIMAGE(candidate) || !STREAMING::IS_MODEL_VALID(candidate)) continue;
        STREAMING::REQUEST_MODEL(candidate);
        ULONGLONG deadline = GetTickCount64() + 2500;
        while (!STREAMING::HAS_MODEL_LOADED(candidate) && GetTickCount64() < deadline) WAIT(0);
        if (STREAMING::HAS_MODEL_LOADED(candidate)) {
            model = candidate;
            break;
        }
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(candidate);
    }
    if (!model) return;

    TryCreatePrisonPanel(model, center, 0.0f, 2.8f, 0.0f);
    TryCreatePrisonPanel(model, center, 0.0f, -2.8f, 180.0f);
    TryCreatePrisonPanel(model, center, 2.8f, 0.0f, 90.0f);
    TryCreatePrisonPanel(model, center, -2.8f, 0.0f, 270.0f);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
}
Result StartPrison(Ped ped) {
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) return {kEffectRetryStatus, kGameNotReadyMessage};
    EndPrison();

    Vehicle vehicle = 0;
    Vector3 center = ENTITY::GET_ENTITY_COORDS(PlayerTarget(ped), TRUE);
    if (CurrentPlayerVehicle(ped, vehicle)) {
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 4160);
        ULONGLONG deadline = GetTickCount64() + 1200;
        while (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE) && GetTickCount64() < deadline) WAIT(0);
        if (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) {
            Vector3 exit = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 3.2f, 0.0f, 0.6f);
            Teleport(ped, exit);
            WAIT(0);
        }
        center = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    }

    Vehicle prisonVehicle = 0;
    bool stillInVehicle = CurrentPlayerVehicle(ped, prisonVehicle);
    Entity prisonerTarget = stillInVehicle ? static_cast<Entity>(prisonVehicle) : static_cast<Entity>(ped);
    if (stillInVehicle) {
        center = ENTITY::GET_ENTITY_COORDS(prisonVehicle, TRUE);
    }

    STREAMING::REQUEST_COLLISION_AT_COORD(center.x, center.y, center.z);
    float groundZ = center.z;
    bool foundGround = false;
    ULONGLONG groundDeadline = GetTickCount64() + 1600;
    while (GetTickCount64() < groundDeadline) {
        if (GAMEPLAY::GET_GROUND_Z_FOR_3D_COORD(center.x, center.y, center.z + 30.0f, &groundZ, FALSE)) {
            foundGround = true;
            break;
        }
        WAIT(0);
    }
    center.z = foundGround ? groundZ + (stillInVehicle ? 1.15f : 1.0f) : center.z + (stillInVehicle ? 0.5f : 0.85f);
    Teleport(prisonerTarget, center);
    if (stillInVehicle) {
        VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(prisonVehicle);
        center = ENTITY::GET_ENTITY_COORDS(prisonVehicle, TRUE);
    } else {
        WAIT(0);
        float height = ENTITY::GET_ENTITY_HEIGHT_ABOVE_GROUND(ped);
        if (height < 0.55f) {
            Vector3 raised = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
            raised.z += 0.7f - std::max(0.0f, height);
            Teleport(ped, raised);
        }
        center = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    }

    AI::CLEAR_PED_TASKS_IMMEDIATELY(ped);
    if (!stillInVehicle) {
        AI::TASK_HANDS_UP(ped, 60000, 0, -1, TRUE);
        PED::SET_PED_CAN_RAGDOLL(ped, FALSE);
    }
    ENTITY::FREEZE_ENTITY_POSITION(prisonerTarget, TRUE);
    g_frozenEntity = prisonerTarget;
    g_frozenUntil = GetTickCount64() + 60000;
    g_prisonPed = ped;
    g_prisonCenter = center;
    g_prisonUntil = g_frozenUntil;
    CreatePrisonCage(center);
    return {0, "Le joueur est enferme en prison pendant 60 secondes."};
}
void DrawPrisonStatus(ULONGLONG now) {
    if (!g_prisonUntil || now >= g_prisonUntil) return;
    int remaining = static_cast<int>((g_prisonUntil - now + 999ULL) / 1000ULL);
    GRAPHICS::DRAW_MARKER(
        1,
        g_prisonCenter.x, g_prisonCenter.y, g_prisonCenter.z - 0.7f,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        6.2f, 6.2f, 2.4f,
        255, 54, 86, 92,
        FALSE, FALSE, 2, FALSE, nullptr, nullptr, FALSE);
    DrawHudText("PRISON  -  " + std::to_string(remaining) + " SEC", 255, 92, 108);
}
Result ArmPeds(Ped playerPed) {
    const int maxNearbyPeds = 64;
    int nearbyPeds[maxNearbyPeds + 1] = {};
    nearbyPeds[0] = maxNearbyPeds;
    int count = PED::GET_PED_NEARBY_PEDS(playerPed, nearbyPeds, -1);
    int armed = 0;
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    for (int i = 0; i < count && armed < 12; ++i) {
        Ped ped = nearbyPeds[i + 1];
        if (!ped || ped == playerPed || !ENTITY::DOES_ENTITY_EXIST(ped) || ENTITY::IS_ENTITY_DEAD(ped)
            || PED::IS_PED_A_PLAYER(ped) || !PED::IS_PED_HUMAN(ped)) continue;
        Vector3 p = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
        float dx = p.x - origin.x, dy = p.y - origin.y, dz = p.z - origin.z;
        if (dx * dx + dy * dy + dz * dz > 3025.0f) continue;
        WEAPON::GIVE_WEAPON_TO_PED(ped, 0x83BF0278, 180, FALSE, TRUE);
        AI::TASK_COMBAT_PED(ped, playerPed, 0, 16);
        ++armed;
    }
    if (armed) return {0, std::to_string(armed) + " passant(s) ont ete armes."};
    const Hash fallbackModels[] = { HashName("g_m_y_mexgoon_02"), HashName("g_m_y_lost_01") };
    Result fallback = SpawnHostilePeds(playerPed, fallbackModels,
        sizeof(fallbackModels) / sizeof(fallbackModels[0]), 6, "passant(s) arme(s)");
    if (fallback.status == 0) fallback.message = "6 passant(s) armes ont ete envoyes autour du joueur.";
    return fallback;
}
Vehicle CurrentVehicle(Ped ped) {
    Vehicle vehicle = 0;
    return CurrentPlayerVehicle(ped, vehicle) ? vehicle : 0;
}
Result RequireVehicle(Ped ped, Vehicle& vehicle) {
    vehicle = CurrentVehicle(ped);
    return vehicle ? Result{0, ""} : Result{3, "Le joueur doit etre dans un vehicule pour cet effet."};
}
Result ForcePlayerRagdoll(Ped ped, int durationMs) {
    Vehicle vehicle = CurrentVehicle(ped);
    if (vehicle) {
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 16);
        ULONGLONG leaveDeadline = GetTickCount64() + 750;
        while (PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)
            && GetTickCount64() < leaveDeadline) {
            WAIT(0);
        }
        if (PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)) {
            Vector3 exitPosition =
                ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 2.5f, 0.0f, 0.8f);
            ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
                ped,
                exitPosition.x,
                exitPosition.y,
                exitPosition.z,
                FALSE,
                FALSE,
                TRUE
            );
            WAIT(0);
        }
    }

    AI::CLEAR_PED_TASKS_IMMEDIATELY(ped);
    PED::SET_PED_CAN_RAGDOLL(ped, TRUE);
    PED::SET_PED_CAN_RAGDOLL_FROM_PLAYER_IMPACT(ped, TRUE);
    ULONGLONG ragdollDeadline = GetTickCount64() + 1000;
    while (!PED::IS_PED_RAGDOLL(ped) && GetTickCount64() < ragdollDeadline) {
        PED::SET_PED_TO_RAGDOLL(
            ped,
            durationMs,
            durationMs,
            0,
            TRUE,
            TRUE,
            FALSE
        );
        WAIT(0);
    }
    if (!PED::IS_PED_RAGDOLL(ped)) {
        return {5, "GTA V n'a pas pu faire chuter le joueur."};
    }
    ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(
        ped,
        1,
        0.0f,
        0.0f,
        2.5f,
        TRUE,
        TRUE,
        TRUE,
        TRUE
    );
    return {0, "Le joueur a chute pendant 5 secondes."};
}
Result StartDrunkEffect(Ped ped, int durationMs) {
    const char* movementClipset = "move_m@drunk@verydrunk";
    STREAMING::REQUEST_ANIM_SET(const_cast<char*>(movementClipset));
    ULONGLONG loadDeadline = GetTickCount64() + 3000;
    while (!STREAMING::HAS_ANIM_SET_LOADED(const_cast<char*>(movementClipset))
        && GetTickCount64() < loadDeadline) {
        WAIT(0);
    }
    if (!STREAMING::HAS_ANIM_SET_LOADED(const_cast<char*>(movementClipset))) {
        return {5, "GTA V n'a pas pu charger la demarche ivre."};
    }

    PED::SET_PED_MOVEMENT_CLIPSET(
        ped,
        const_cast<char*>(movementClipset),
        0.75f
    );
    GRAPHICS::SET_TIMECYCLE_MODIFIER(const_cast<char*>("spectator5"));
    GRAPHICS::SET_TIMECYCLE_MODIFIER_STRENGTH(0.9f);
    CAM::SHAKE_GAMEPLAY_CAM(const_cast<char*>("DRUNK_SHAKE"), 1.8f);
    CAM::SET_GAMEPLAY_CAM_SHAKE_AMPLITUDE(1.8f);
    WAIT(0);
    if (!CAM::IS_GAMEPLAY_CAM_SHAKING()) {
        PED::RESET_PED_MOVEMENT_CLIPSET(ped, 0.25f);
        STREAMING::REMOVE_ANIM_SET(const_cast<char*>(movementClipset));
        GRAPHICS::CLEAR_TIMECYCLE_MODIFIER();
        return {5, "GTA V n'a pas active l'effet visuel d'ivresse."};
    }

    g_drunkPed = ped;
    g_drunkActive = true;
    g_drunkUntil = GetTickCount64() + durationMs;
    return {0, "La vision et la demarche du joueur sont perturbees pendant 15 secondes."};
}
Result StartSuperJumpEffect(Ped ped, int durationMs) {
    Vehicle vehicle = CurrentVehicle(ped);
    if (vehicle) {
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 16);
        ULONGLONG leaveDeadline = GetTickCount64() + 750;
        while (PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)
            && GetTickCount64() < leaveDeadline) {
            WAIT(0);
        }
    }
    if (!PED::IS_PED_ON_FOOT(ped)) {
        return {3, "Le joueur doit etre a pied pour activer les super sauts."};
    }

    g_superJumpUntil = GetTickCount64() + durationMs;
    GAMEPLAY::SET_SUPER_JUMP_THIS_FRAME(PLAYER::PLAYER_ID());
    Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(ped);
    ENTITY::SET_ENTITY_VELOCITY(
        ped,
        velocity.x,
        velocity.y,
        std::max(velocity.z, 0.0f) + 28.0f
    );
    g_nextSuperJumpBoostAt = GetTickCount64() + 1200;
    return {0, "Le joueur peut faire des super sauts pendant 20 secondes."};
}
Result SpawnVehicleForPlayer(Hash model, const char* label = nullptr) {
    if (!STREAMING::IS_MODEL_IN_CDIMAGE(model) || !STREAMING::IS_MODEL_VALID(model)
        || !STREAMING::IS_MODEL_A_VEHICLE(model)) {
        return {5, "Ce vehicule n'est pas disponible dans cette version de GTA V."};
    }

    STREAMING::REQUEST_MODEL(model);
    ULONGLONG deadline = GetTickCount64() + 5000;
    while (!STREAMING::HAS_MODEL_LOADED(model) && GetTickCount64() < deadline) WAIT(0);
    if (!STREAMING::HAS_MODEL_LOADED(model)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, "Le chargement du vehicule a pris trop de temps."};
    }

    Player player = 0;
    Ped ped = 0;
    if (!PlayerReady(player, ped)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Vehicle previousVehicle = CurrentVehicle(ped);
    Entity origin = PlayerTarget(ped);
    Vector3 spawn = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(origin, 0.0f, 5.5f, 1.0f);
    float heading = ENTITY::GET_ENTITY_HEADING(origin);
    Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, spawn.x, spawn.y, spawn.z, heading, FALSE, FALSE);
    if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, "GTA V n'a pas pu creer le vehicule."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
    VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(vehicle);
    VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, TRUE, TRUE, FALSE);

    // GTA can silently ignore SET_PED_INTO_VEHICLE while the player is still
    // attached to the vehicle being replaced. Leave that vehicle first, then
    // retry the transfer until the native confirms that the player is seated.
    if (previousVehicle && previousVehicle != vehicle && ENTITY::DOES_ENTITY_EXIST(previousVehicle)) {
        AI::TASK_LEAVE_VEHICLE(ped, previousVehicle, 16);
        ULONGLONG leaveDeadline = GetTickCount64() + 750;
        while (PED::IS_PED_IN_VEHICLE(ped, previousVehicle, FALSE)
            && GetTickCount64() < leaveDeadline) {
            WAIT(0);
        }
        if (PED::IS_PED_IN_VEHICLE(ped, previousVehicle, FALSE)) {
            AI::CLEAR_PED_TASKS_IMMEDIATELY(ped);
            Vector3 exitPosition =
                ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 0.0f, -2.5f, 0.5f);
            ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
                ped,
                exitPosition.x,
                exitPosition.y,
                exitPosition.z,
                FALSE,
                FALSE,
                TRUE
            );
            WAIT(0);
        }
    }

    ULONGLONG seatDeadline = GetTickCount64() + 1500;
    while (!PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)
        && GetTickCount64() < seatDeadline) {
        PED::SET_PED_INTO_VEHICLE(ped, vehicle, -1);
        WAIT(0);
    }
    if (!PED::IS_PED_IN_VEHICLE(ped, vehicle, FALSE)) {
        if (vehicle && ENTITY::DOES_ENTITY_EXIST(vehicle)) {
            VEHICLE::DELETE_VEHICLE(&vehicle);
        }
        if (previousVehicle && ENTITY::DOES_ENTITY_EXIST(previousVehicle)) {
            PED::SET_PED_INTO_VEHICLE(ped, previousVehicle, -1);
        }
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, "GTA V n'a pas pu placer le joueur au volant du nouveau vehicule."};
    }

    if (previousVehicle && previousVehicle != vehicle && ENTITY::DOES_ENTITY_EXIST(previousVehicle)) {
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(previousVehicle, TRUE, TRUE);
        VEHICLE::DELETE_VEHICLE(&previousVehicle);
    }
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    return {
        0,
        label && *label
            ? std::string("Nouveau vehicule surprise : ") + label + "."
            : "Le vehicule du joueur a ete remplace."
    };
}
Result AffectNearbyVehicles(Ped playerPed, bool explode, bool launch) {
    const int maxNearbyVehicles = 64;
    int nearbyVehicles[maxNearbyVehicles + 1] = {};
    nearbyVehicles[0] = maxNearbyVehicles;
    int count = PED::GET_PED_NEARBY_VEHICLES(playerPed, nearbyVehicles);
    Vehicle playerVehicle = CurrentVehicle(playerPed);
    std::vector<Vehicle> targets;
    for (int index = 0; index < count && targets.size() < 20; ++index) {
        Vehicle vehicle = nearbyVehicles[index + 1];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        targets.push_back(vehicle);
    }
    if (targets.empty()) SpawnAmbientChaosVehicles(playerPed, targets, 6);

    int affected = 0;
    for (size_t index = 0; index < targets.size() && affected < 20; ++index) {
        Vehicle vehicle = targets[index];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        if (explode) {
            Vector3 position = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
            FIRE::ADD_EXPLOSION(position.x, position.y, position.z, 2, 1.0f, TRUE, FALSE, 0.5f);
        }
        if (launch) {
            Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(vehicle);
            ENTITY::SET_ENTITY_VELOCITY(vehicle, velocity.x, velocity.y, std::max(velocity.z, 0.0f) + 24.0f);
        }
        ++affected;
    }
    if (!affected) return {5, "GTA V n'a pas pu preparer de vehicule pour cet effet."};
    return {0, std::to_string(affected) + " vehicule(s) ont ete affectes."};
}
Hash HashName(const char* name) {
    return GAMEPLAY::GET_HASH_KEY(const_cast<char*>(name));
}
Hash RandomHash(const Hash* values, size_t count) {
    return values[(GetTickCount64() ^ GetCurrentProcessId()) % count];
}
Result LoadModel(Hash model, const char* label) {
    if (!STREAMING::IS_MODEL_IN_CDIMAGE(model) || !STREAMING::IS_MODEL_VALID(model)) {
        return {5, std::string(label) + " n'est pas disponible dans cette version de GTA V."};
    }
    STREAMING::REQUEST_MODEL(model);
    ULONGLONG deadline = GetTickCount64() + 5000;
    while (!STREAMING::HAS_MODEL_LOADED(model) && GetTickCount64() < deadline) WAIT(0);
    if (!STREAMING::HAS_MODEL_LOADED(model)) {
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        return {5, std::string(label) + " n'a pas pu etre charge a temps."};
    }
    return {0, ""};
}
int SpawnAmbientChaosVehicles(Ped playerPed, std::vector<Vehicle>& targets, int requestedCount) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || requestedCount <= 0) return 0;
    const char* modelNames[] = {"blista", "asea", "stanier", "primo", "emperor", "ingot"};
    const float offsets[][2] = {
        {-7.5f, 12.0f}, {7.5f, 13.5f}, {-10.0f, 20.0f}, {10.0f, 21.5f}, {-13.0f, 29.0f}, {13.0f, 30.5f},
    };
    int spawned = 0;
    for (int index = 0; index < requestedCount && index < 6; ++index) {
        Hash model = HashName(modelNames[index % 6]);
        Result loaded = LoadModel(model, "Vehicule de l'effet");
        if (loaded.status != 0) continue;
        Vector3 position = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(playerPed, offsets[index][0], offsets[index][1], 1.0f);
        Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, position.x, position.y, position.z,
            ENTITY::GET_ENTITY_HEADING(playerPed) + 180.0f, FALSE, FALSE);
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
        if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) continue;
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
        VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(vehicle);
        VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, TRUE, TRUE, FALSE);
        targets.push_back(vehicle);
        ++spawned;
    }
    return spawned;
}
Result SpawnHostilePeds(Ped playerPed, const Hash* models, size_t modelCount, int requestedCount, const char* label) {
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    int spawned = 0;
    for (int index = 0; index < requestedCount; ++index) {
        Hash model = RandomHash(models, modelCount);
        Result loaded = LoadModel(model, label);
        if (loaded.status != 0) continue;
        float side = (index % 2 == 0 ? 1.0f : -1.0f) * (3.5f + static_cast<float>(index % 3));
        float forward = 8.0f + static_cast<float>(index);
        Vector3 spawn = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(playerPed, side, forward, 0.4f);
        Ped npc = PED::CREATE_PED(4, model, spawn.x, spawn.y, spawn.z, ENTITY::GET_ENTITY_HEADING(playerPed) + 180.0f, FALSE, FALSE);
        if (npc && ENTITY::DOES_ENTITY_EXIST(npc)) {
            ENTITY::SET_ENTITY_AS_MISSION_ENTITY(npc, TRUE, TRUE);
            PED::SET_BLOCKING_OF_NON_TEMPORARY_EVENTS(npc, TRUE);
            PED::SET_PED_AS_ENEMY(npc, TRUE);
            PED::SET_PED_COMBAT_ABILITY(npc, 2);
            PED::SET_PED_COMBAT_MOVEMENT(npc, 2);
            PED::SET_PED_COMBAT_RANGE(npc, 2);
            WEAPON::GIVE_WEAPON_TO_PED(npc, 0x1B06D571, 90, FALSE, TRUE);
            AI::TASK_COMBAT_PED(npc, playerPed, 0, 16);
            ++spawned;
        }
        STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    }
    if (!spawned) return {5, std::string(label) + " n'a pas pu apparaitre."};
    return {0, std::to_string(spawned) + " " + label + " envoye(s)."};
}
int GiftTier(const std::string& code) {
    size_t position = code.find("gift_show_t");
    if (position == std::string::npos) return 0;
    position += 11;
    if (position >= code.size() || code[position] < '0' || code[position] > '9') return 0;
    return std::min(8, std::max(0, code[position] - '0'));
}
bool GiftCodeContainsAny(const std::string& code, const char* const* keywords, size_t keywordCount) {
    for (size_t index = 0; index < keywordCount; ++index) {
        if (keywords[index] && keywords[index][0] && code.find(keywords[index]) != std::string::npos) return true;
    }
    return false;
}
float GiftMarkerScale(int tier, float baseScale = 0.55f) {
    if (tier >= 8) return std::max(baseScale, 6.8f);
    if (tier >= 7) return std::max(baseScale, 5.2f);
    if (tier >= 6) return std::max(baseScale, 3.8f);
    if (tier >= 5) return std::max(baseScale, 2.7f);
    if (tier >= 4) return std::max(baseScale, 1.85f);
    if (tier >= 3) return std::max(baseScale, 1.25f);
    if (tier >= 2) return std::max(baseScale, 0.85f);
    return baseScale;
}
void AddGiftEntity(Entity entity, int red, int green, int blue, float markerScale) {
    (void)red;
    (void)green;
    (void)blue;
    (void)markerScale;
    g_giftObjects.push_back({entity});
    while (g_giftObjects.size() > kMaxGiftObjects) {
        DeleteGiftObject(g_giftObjects.front().entity);
        g_giftObjects.erase(g_giftObjects.begin());
    }
}
Entity GiftTarget(Ped playerPed) {
    return PlayerTarget(playerPed);
}
Vector3 GiftPosition(Entity target, float forward, float up, float sideStep) {
    float side = static_cast<float>(static_cast<int>((GetTickCount64() / 173ULL) % 5ULL) - 2) * sideStep;
    return ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(target, side, forward, up);
}
Result SpawnGiftObject(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale = 0.55f, float forward = 4.2f, float up = 1.25f) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || !modelNames || modelCount == 0) {
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Hash model = 0;
    Result lastError = {5, std::string(label) + " n'a pas de modele GTA disponible."};
    for (size_t index = 0; index < modelCount; ++index) {
        if (!modelNames[index] || !modelNames[index][0]) continue;
        Hash candidate = HashName(modelNames[index]);
        Result loaded = LoadModel(candidate, label);
        if (loaded.status == 0) {
            model = candidate;
            break;
        }
        lastError = loaded;
    }
    if (!model) {
        const char* fallbackModels[] = {"prop_ld_int_safe_01", "prop_money_bag_01", "prop_tool_box_04", "prop_roadcone02a"};
        for (size_t index = 0; index < sizeof(fallbackModels) / sizeof(fallbackModels[0]); ++index) {
            Hash candidate = HashName(fallbackModels[index]);
            Result loaded = LoadModel(candidate, label);
            if (loaded.status == 0) {
                model = candidate;
                break;
            }
            lastError = loaded;
        }
    }
    if (!model) return lastError;

    Entity target = GiftTarget(playerPed);
    Vector3 position = GiftPosition(target, forward, up, 0.85f);
    Object object = OBJECT::CREATE_OBJECT_NO_OFFSET(model, position.x, position.y, position.z, FALSE, FALSE, TRUE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!object || !ENTITY::DOES_ENTITY_EXIST(object)) {
        return {5, std::string(label) + " n'a pas pu apparaitre dans GTA."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(object, TRUE, TRUE);
    OBJECT::PLACE_OBJECT_ON_GROUND_PROPERLY(object);
    ENTITY::SET_ENTITY_HEADING(object, ENTITY::GET_ENTITY_HEADING(target));
    ENTITY::FREEZE_ENTITY_POSITION(object, TRUE);
    AddGiftEntity(object, red, green, blue, markerScale);

    DrawHudText(std::string("CADEAU TIKTOK - ") + label, red, green, blue);
    return {0, std::string(label) + " apparait dans le jeu."};
}
Result SpawnGiftPed(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward, float up) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || !modelNames || modelCount == 0) {
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Hash model = 0;
    Result lastError = {5, std::string(label) + " n'a pas de modele GTA disponible."};
    for (size_t index = 0; index < modelCount; ++index) {
        if (!modelNames[index] || !modelNames[index][0]) continue;
        Hash candidate = HashName(modelNames[index]);
        Result loaded = LoadModel(candidate, label);
        if (loaded.status == 0) {
            model = candidate;
            break;
        }
        lastError = loaded;
    }
    if (!model) return lastError;

    Entity target = GiftTarget(playerPed);
    Vector3 position = GiftPosition(target, forward, up, 1.65f);
    Ped ped = PED::CREATE_PED(28, model, position.x, position.y, position.z, ENTITY::GET_ENTITY_HEADING(target) + 180.0f, FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!ped || !ENTITY::DOES_ENTITY_EXIST(ped)) {
        return {5, std::string(label) + " n'a pas pu apparaitre dans GTA."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(ped, TRUE, TRUE);
    PED::SET_BLOCKING_OF_NON_TEMPORARY_EVENTS(ped, TRUE);
    PED::SET_PED_CAN_RAGDOLL(ped, FALSE);
    ENTITY::SET_ENTITY_COLLISION(ped, FALSE, FALSE);
    ENTITY::FREEZE_ENTITY_POSITION(ped, TRUE);
    AI::TASK_STAND_STILL(ped, 30000);
    AddGiftEntity(ped, red, green, blue, markerScale);
    DrawHudText(std::string("CADEAU TIKTOK - ") + label, red, green, blue);
    return {0, std::string(label) + " apparait dans le jeu."};
}
Result SpawnGiftVehicle(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward = 7.0f, float up = 1.0f, bool airborne = false) {
    if (!playerPed || !ENTITY::DOES_ENTITY_EXIST(playerPed) || !modelNames || modelCount == 0) {
        return {kEffectRetryStatus, kGameNotReadyMessage};
    }

    Hash model = 0;
    Result lastError = {5, std::string(label) + " n'a pas de modele GTA disponible."};
    for (size_t index = 0; index < modelCount; ++index) {
        if (!modelNames[index] || !modelNames[index][0]) continue;
        Hash candidate = HashName(modelNames[index]);
        Result loaded = LoadModel(candidate, label);
        if (loaded.status == 0) {
            model = candidate;
            break;
        }
        lastError = loaded;
    }
    if (!model) return lastError;

    Entity target = GiftTarget(playerPed);
    Vector3 position = GiftPosition(target, forward, up, 1.4f);
    Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, position.x, position.y, position.z, ENTITY::GET_ENTITY_HEADING(target) + 180.0f, FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) {
        return {5, std::string(label) + " n'a pas pu apparaitre dans GTA."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
    VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, FALSE, TRUE, FALSE);
    VEHICLE::SET_VEHICLE_DOORS_LOCKED_FOR_ALL_PLAYERS(vehicle, TRUE);
    VEHICLE::SET_VEHICLE_FORWARD_SPEED(vehicle, 0.0f);
    ENTITY::SET_ENTITY_COLLISION(vehicle, FALSE, FALSE);
    ENTITY::FREEZE_ENTITY_POSITION(vehicle, TRUE);
    if (!airborne) VEHICLE::SET_VEHICLE_ON_GROUND_PROPERLY(vehicle);
    AddGiftEntity(vehicle, red, green, blue, markerScale);
    DrawHudText(std::string("CADEAU TIKTOK - ") + label, red, green, blue);
    return {0, std::string(label) + " apparait dans le jeu."};
}
Result SpawnGiftPedOrObject(Ped playerPed, const char* label, const char* const* pedModels, size_t pedModelCount, const char* const* objectModels, size_t objectModelCount, int red, int green, int blue, float markerScale, float forward, float up) {
    Result ped = SpawnGiftPed(playerPed, label, pedModels, pedModelCount, red, green, blue, markerScale, forward, up);
    if (ped.status == 0 || ped.status == kEffectRetryStatus) return ped;
    return SpawnGiftObject(playerPed, label, objectModels, objectModelCount, red, green, blue, markerScale, forward, up);
}
Result SpawnGiftVehicleOrObject(Ped playerPed, const char* label, const char* const* vehicleModels, size_t vehicleModelCount, const char* const* objectModels, size_t objectModelCount, int red, int green, int blue, float markerScale, float forward = 7.0f, float up = 1.0f, bool airborne = false) {
    Result vehicle = SpawnGiftVehicle(playerPed, label, vehicleModels, vehicleModelCount, red, green, blue, markerScale, forward, up, airborne);
    if (vehicle.status == 0 || vehicle.status == kEffectRetryStatus) return vehicle;
    return SpawnGiftObject(playerPed, label, objectModels, objectModelCount, red, green, blue, markerScale, forward, up);
}
Result SpawnTikTokGiftObject(Ped playerPed, const std::string& code) {
    int tier = GiftTier(code);
    float tierMarker = GiftMarkerScale(tier);
    const char* whaleKeywords[] = {"_whale_", "baleine", "orca", "killerwhale", "humpback", "cachalot"};
    if (GiftCodeContainsAny(code, whaleKeywords, sizeof(whaleKeywords) / sizeof(whaleKeywords[0]))) {
        const char* pedModels[] = {"a_c_humpback", "a_c_killerwhale", "a_c_dolphin", "a_c_sharktiger"};
        const char* objectModels[] = {"prop_container_03a", "prop_air_bigradar_l1", "prop_byard_float_01"};
        return SpawnGiftPedOrObject(playerPed, "Baleine TikTok", pedModels, sizeof(pedModels) / sizeof(pedModels[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 60, 185, 255, GiftMarkerScale(std::max(tier, 7), 6.0f), 9.5f, 4.5f);
    }
    const char* seaKeywords[] = {"_sea_", "dolphin", "shark", "requin", "fish", "poisson", "ocean", "turtle", "crab", "octopus", "jellyfish", "meduse", "sirene", "mermaid"};
    if (GiftCodeContainsAny(code, seaKeywords, sizeof(seaKeywords) / sizeof(seaKeywords[0]))) {
        const char* pedModels[] = {"a_c_dolphin", "a_c_sharktiger", "a_c_fish"};
        const char* objectModels[] = {"prop_byard_float_01", "prop_container_03a", "prop_amb_beach_ring_01"};
        return SpawnGiftPedOrObject(playerPed, "Animal marin TikTok", pedModels, sizeof(pedModels) / sizeof(pedModels[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 70, 210, 255, GiftMarkerScale(std::max(tier, 4), 2.8f), 7.0f, 2.6f);
    }
    const char* lionKeywords[] = {"_lion_", "tiger", "tigre", "panther", "leopard", "puma"};
    if (GiftCodeContainsAny(code, lionKeywords, sizeof(lionKeywords) / sizeof(lionKeywords[0]))) {
        const char* models[] = {"a_c_mtlion", "a_c_retriever", "a_c_deer"};
        return SpawnGiftPed(playerPed, "Fauve TikTok", models, sizeof(models) / sizeof(models[0]), 255, 184, 72, GiftMarkerScale(std::max(tier, 4), 2.2f), 5.5f, 0.8f);
    }
    const char* animalKeywords[] = {"_animal_", "corgi", "dog", "chien", "puppy", "cat", "kitten", "chat", "panda", "bear", "ours", "elephant", "girafa", "giraffe", "girafe", "monkey", "gorilla", "chimp", "deer", "cerf", "rabbit", "lapin", "fox", "wolf"};
    if (GiftCodeContainsAny(code, animalKeywords, sizeof(animalKeywords) / sizeof(animalKeywords[0]))) {
        const char* models[] = {"a_c_deer", "a_c_cow", "a_c_boar", "a_c_retriever", "a_c_chop", "a_c_coyote"};
        return SpawnGiftPed(playerPed, "Animal TikTok", models, sizeof(models) / sizeof(models[0]), 130, 230, 120, GiftMarkerScale(std::max(tier, 3), 1.8f), 5.3f, 0.75f);
    }
    const char* vehicleKeywords[] = {"_vehicle_", "car", "voiture", "racecar", "racing", "moto", "motorcycle", "bike", "train", "bus", "taxi", "truck", "yacht", "boat", "ship", "bateau"};
    if (GiftCodeContainsAny(code, vehicleKeywords, sizeof(vehicleKeywords) / sizeof(vehicleKeywords[0]))) {
        const char* models[] = {"adder", "zentorno", "turismor", "comet2", "banshee", "blista"};
        const char* objectModels[] = {"prop_tool_box_04", "prop_barrier_work05"};
        return SpawnGiftVehicleOrObject(playerPed, "Vehicule TikTok", models, sizeof(models) / sizeof(models[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 92, 220, 255, GiftMarkerScale(std::max(tier, 4), 2.3f));
    }
    const char* airKeywords[] = {"_air_", "plane", "jet", "aircraft", "helicopter", "helico", "rocket", "fusee", "spaceship", "ufo"};
    if (GiftCodeContainsAny(code, airKeywords, sizeof(airKeywords) / sizeof(airKeywords[0]))) {
        const char* models[] = {"luxor", "cuban800", "dodo", "maverick", "frogger"};
        const char* objectModels[] = {"prop_air_bigradar_l1", "prop_ld_bomb", "prop_mp_cone_02"};
        return SpawnGiftVehicleOrObject(playerPed, "Avion TikTok", models, sizeof(models) / sizeof(models[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 104, 204, 255, GiftMarkerScale(std::max(tier, 6), 3.6f), 10.5f, 6.5f, true);
    }
    const char* spaceKeywords[] = {"_space_", "galaxy", "galaxie", "star", "etoile", "interstellar", "universe", "planet", "moon", "lune", "sun", "soleil", "meteor", "comet"};
    if (GiftCodeContainsAny(code, spaceKeywords, sizeof(spaceKeywords) / sizeof(spaceKeywords[0]))) {
        const char* vehicleModels[] = {"luxor", "cuban800", "dodo", "blista"};
        const char* objectModels[] = {"prop_air_bigradar_l1", "prop_ld_int_safe_01", "prop_money_bag_01", "prop_tool_box_04"};
        return SpawnGiftVehicleOrObject(playerPed, "Galaxie TikTok", vehicleModels, sizeof(vehicleModels) / sizeof(vehicleModels[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 124, 92, 255, GiftMarkerScale(std::max(tier, 6), 4.0f), 8.0f, 2.2f, true);
    }
    const char* moneyKeywords[] = {"_money_", "cash", "coin", "coins", "gold", "argent", "billet", "treasure", "jackpot", "bank", "diamond", "diamant", "coffre"};
    if (GiftCodeContainsAny(code, moneyKeywords, sizeof(moneyKeywords) / sizeof(moneyKeywords[0]))) {
        const char* models[] = {"prop_money_bag_01", "prop_cash_case_01", "prop_anim_cash_pile_01", "prop_ld_int_safe_01", "prop_poly_bag_money"};
        return SpawnGiftObject(playerPed, "Argent TikTok", models, sizeof(models) / sizeof(models[0]), 96, 255, 150, GiftMarkerScale(tier, 1.2f));
    }
    if (code.find("rose") != std::string::npos || code.find("rosa") != std::string::npos || code.find("_flower_") != std::string::npos || code.find("bouquet") != std::string::npos || code.find("fleur") != std::string::npos) {
        const char* models[] = {"prop_single_rose", "prop_plant_int_04a", "prop_plant_int_02a"};
        return SpawnGiftObject(playerPed, "Rose TikTok", models, sizeof(models) / sizeof(models[0]), 255, 92, 132, GiftMarkerScale(tier, 0.7f));
    }
    if (code.find("heart") != std::string::npos || code.find("coeur") != std::string::npos || code.find("love") != std::string::npos) {
        const char* models[] = {"prop_ld_health_pack", "prop_med_bag_01"};
        return SpawnGiftObject(playerPed, "Coeur TikTok", models, sizeof(models) / sizeof(models[0]), 255, 72, 108, GiftMarkerScale(tier, 0.85f));
    }
    const char* foodKeywords[] = {"_food_", "donut", "doughnut", "cake", "gateau", "pizza", "burger", "icecream", "popcorn", "candy", "chocolate", "coffee", "sushi"};
    if (GiftCodeContainsAny(code, foodKeywords, sizeof(foodKeywords) / sizeof(foodKeywords[0]))) {
        const char* models[] = {"prop_amb_donut", "prop_donut_01", "prop_cs_burger_01", "prop_food_bs_burg3", "prop_food_cb_burg02"};
        return SpawnGiftObject(playerPed, "Nourriture TikTok", models, sizeof(models) / sizeof(models[0]), 255, 186, 92, GiftMarkerScale(tier, 1.0f));
    }
    if (code.find("ball") != std::string::npos || code.find("cap") != std::string::npos || code.find("basket") != std::string::npos || code.find("_sports_") != std::string::npos || code.find("trophy") != std::string::npos) {
        const char* models[] = {"prop_beachball_02", "prop_bskball_01", "prop_beach_volball01"};
        return SpawnGiftObject(playerPed, "Sport TikTok", models, sizeof(models) / sizeof(models[0]), 92, 210, 255, GiftMarkerScale(tier, 1.0f));
    }
    if (code.find("_fire_") != std::string::npos || code.find("firework") != std::string::npos || code.find("magic") != std::string::npos || code.find("thunder") != std::string::npos || code.find("lightning") != std::string::npos) {
        const char* models[] = {"prop_ld_bomb", "prop_mp_cone_02", "prop_gas_tank_01a"};
        return SpawnGiftObject(playerPed, "Effet lumineux TikTok", models, sizeof(models) / sizeof(models[0]), 255, 120, 40, GiftMarkerScale(tier, 2.0f), 5.6f, 1.6f);
    }
    if (code.find("_music_") != std::string::npos || code.find("microphone") != std::string::npos || code.find("guitar") != std::string::npos || code.find("piano") != std::string::npos) {
        const char* models[] = {"prop_el_guitar_01", "prop_microphone_02", "prop_speaker_05"};
        return SpawnGiftObject(playerPed, "Musique TikTok", models, sizeof(models) / sizeof(models[0]), 180, 120, 255, GiftMarkerScale(tier, 1.4f));
    }
    if (code.find("_royal_") != std::string::npos || code.find("_luxury_") != std::string::npos || code.find("crown") != std::string::npos || code.find("couronne") != std::string::npos || code.find("perfume") != std::string::npos || code.find("parfum") != std::string::npos) {
        const char* models[] = {"prop_ld_int_safe_01", "prop_jewel_02a", "prop_money_bag_01"};
        return SpawnGiftObject(playerPed, "Luxe TikTok", models, sizeof(models) / sizeof(models[0]), 255, 210, 80, GiftMarkerScale(std::max(tier, 4), 1.9f));
    }
    if (tier >= 7) {
        const char* models[] = {"adder", "zentorno", "turismor", "cuban800"};
        const char* objectModels[] = {"prop_air_bigradar_l1", "prop_ld_int_safe_01", "prop_container_03a"};
        return SpawnGiftVehicleOrObject(playerPed, "Mega cadeau TikTok", models, sizeof(models) / sizeof(models[0]), objectModels, sizeof(objectModels) / sizeof(objectModels[0]), 255, 210, 80, GiftMarkerScale(tier, 4.2f), 8.0f, 2.0f);
    }
    if (tier >= 5) {
        const char* models[] = {"prop_ld_int_safe_01", "prop_money_bag_01", "prop_jewel_02a", "prop_container_03a"};
        return SpawnGiftObject(playerPed, "Gros cadeau TikTok", models, sizeof(models) / sizeof(models[0]), 255, 210, 80, GiftMarkerScale(tier, 2.2f), 5.5f, 1.6f);
    }

    const char* models[] = {"prop_ld_int_safe_01", "prop_money_bag_01", "prop_jewel_02a", "prop_tool_box_04"};
    return SpawnGiftObject(playerPed, "Cadeau TikTok", models, sizeof(models) / sizeof(models[0]), 255, 216, 92, tierMarker);
}
Result SpawnFriendlyAnimal(Ped playerPed) {
    const Hash animals[] = { HashName("a_c_chop"), HashName("a_c_deer"), HashName("a_c_boar"), HashName("a_c_coyote"), HashName("a_c_retriever") };
    Hash model = RandomHash(animals, sizeof(animals) / sizeof(animals[0]));
    Result loaded = LoadModel(model, "Animal");
    if (loaded.status != 0) return loaded;
    Vector3 spawn = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(playerPed, 2.5f, 5.0f, 0.3f);
    Ped animal = PED::CREATE_PED(28, model, spawn.x, spawn.y, spawn.z, ENTITY::GET_ENTITY_HEADING(playerPed), FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!animal || !ENTITY::DOES_ENTITY_EXIST(animal)) return {5, "L'animal n'a pas pu apparaitre."};
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(animal, TRUE, TRUE);
    AI::TASK_WANDER_STANDARD(animal, 10.0f, 10);
    return {0, "Un animal aleatoire est apparu."};
}
Result PullNearbyVehicles(Ped playerPed, bool upward, bool ensureTargets = false) {
    const int maxNearbyVehicles = 64;
    int nearbyVehicles[maxNearbyVehicles + 1] = {};
    nearbyVehicles[0] = maxNearbyVehicles;
    int count = PED::GET_PED_NEARBY_VEHICLES(playerPed, nearbyVehicles);
    Vehicle playerVehicle = CurrentVehicle(playerPed);
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    if (!upward && GetTickCount64() < g_blackHoleUntil) {
        origin = g_blackHoleCenter;
    }
    std::vector<Vehicle> targets;
    for (int index = 0; index < count && targets.size() < 24; ++index) {
        Vehicle vehicle = nearbyVehicles[index + 1];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        targets.push_back(vehicle);
    }
    if (ensureTargets && targets.size() < 6) {
        SpawnAmbientChaosVehicles(playerPed, targets, static_cast<int>(6 - targets.size()));
    }

    int affected = 0;
    for (size_t index = 0; index < targets.size() && affected < 24; ++index) {
        Vehicle vehicle = targets[index];
        if (!vehicle || vehicle == playerVehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle) || ENTITY::IS_ENTITY_DEAD(vehicle)) continue;
        Vector3 p = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        float dx = origin.x - p.x;
        float dy = origin.y - p.y;
        float dz = origin.z - p.z;
        float distance = std::max(1.0f, std::sqrt(dx * dx + dy * dy + dz * dz));
        if (upward) {
            ENTITY::SET_ENTITY_VELOCITY(vehicle, dx / distance * 48.0f, dy / distance * 48.0f, 34.0f);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(vehicle, 1, dx / distance * 42.0f, dy / distance * 42.0f, 38.0f, TRUE, TRUE, TRUE, TRUE);
        } else {
            float radial = std::min(72.0f, std::max(34.0f, distance * 3.2f));
            float tangent = distance < 7.0f ? 42.0f : 27.0f;
            float lift = distance < 5.0f ? 30.0f : std::min(18.0f, 7.0f + distance * 0.35f);
            float vx = dx / distance * radial - dy / distance * tangent;
            float vy = dy / distance * radial + dx / distance * tangent;
            ENTITY::SET_ENTITY_VELOCITY(vehicle, vx, vy, lift);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(vehicle, 1, vx * 0.9f, vy * 0.9f, lift + 8.0f, TRUE, TRUE, TRUE, TRUE);
        }
        ++affected;
    }

    const int maxNearbyPeds = 48;
    int nearbyPeds[maxNearbyPeds + 1] = {};
    nearbyPeds[0] = maxNearbyPeds;
    int pedCount = PED::GET_PED_NEARBY_PEDS(playerPed, nearbyPeds, -1);
    for (int index = 0; index < pedCount && affected < 48; ++index) {
        Ped ped = nearbyPeds[index + 1];
        if (!ped || ped == playerPed || !ENTITY::DOES_ENTITY_EXIST(ped) || ENTITY::IS_ENTITY_DEAD(ped)) continue;
        Vector3 p = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
        float dx = origin.x - p.x;
        float dy = origin.y - p.y;
        float distance = std::max(1.0f, std::sqrt(dx * dx + dy * dy));
        PED::SET_PED_TO_RAGDOLL(ped, 1800, 1800, 0, TRUE, TRUE, FALSE);
        if (upward) {
            ENTITY::SET_ENTITY_VELOCITY(ped, dx / distance * 24.0f, dy / distance * 24.0f, 20.0f);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(ped, 1, dx / distance * 20.0f, dy / distance * 20.0f, 20.0f, TRUE, TRUE, TRUE, TRUE);
        } else {
            float vx = dx / distance * 32.0f - dy / distance * 16.0f;
            float vy = dy / distance * 32.0f + dx / distance * 16.0f;
            ENTITY::SET_ENTITY_VELOCITY(ped, vx, vy, 11.0f);
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(ped, 1, vx, vy, 14.0f, TRUE, TRUE, TRUE, TRUE);
        }
        ++affected;
    }

    Entity target = PlayerTarget(playerPed);
    if (upward && target && ENTITY::DOES_ENTITY_EXIST(target)) {
        Vector3 p = ENTITY::GET_ENTITY_COORDS(target, TRUE);
        float dx = origin.x - p.x;
        float dy = origin.y - p.y;
        float dz = origin.z - p.z;
        float distance = std::max(1.0f, std::sqrt(dx * dx + dy * dy + dz * dz));
        Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(target);
        ENTITY::SET_ENTITY_VELOCITY(target, velocity.x * 0.75f, velocity.y * 0.75f, std::max(velocity.z, 0.0f) + 18.0f);
        ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(target, 1, dx / distance * 8.0f, dy / distance * 8.0f, 36.0f, TRUE, TRUE, TRUE, TRUE);
        ++affected;
    }

    Vector3 marker = upward ? ENTITY::GET_ENTITY_COORDS(PlayerTarget(playerPed), TRUE) : origin;
    GRAPHICS::DRAW_MARKER(
        upward ? 28 : 1,
        marker.x, marker.y, marker.z + (upward ? 3.0f : 0.4f),
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        upward ? 12.0f : 18.0f, upward ? 12.0f : 18.0f, upward ? 12.0f : 5.0f,
        upward ? 40 : 116, upward ? 225 : 30, upward ? 255 : 180, 110,
        FALSE, FALSE, 2, FALSE, nullptr, nullptr, FALSE);

    if (!affected) return {0, upward ? "Tempete magnetique active; aucun vehicule proche pour le moment." : "Trou noir ouvert; aucun vehicule proche pour le moment."};
    return {0, std::to_string(affected) + (upward ? " cible(s) projetees." : " cible(s) attirees.")};
}
bool PullEntityIntoBlackHole(Entity entity, Entity playerTarget) {
    if (!entity
        || !ENTITY::DOES_ENTITY_EXIST(entity)
        || ENTITY::IS_ENTITY_DEAD(entity)
        || entity == g_trainVehicle) {
        return false;
    }
    Vector3 position = ENTITY::GET_ENTITY_COORDS(entity, TRUE);
    float dx = g_blackHoleCenter.x - position.x;
    float dy = g_blackHoleCenter.y - position.y;
    float dz = g_blackHoleCenter.z - position.z;
    float distance = std::sqrt(dx * dx + dy * dy + dz * dz);
    if (distance > 240.0f) return false;
    distance = std::max(1.0f, distance);
    ULONGLONG now = GetTickCount64();
    if (now < g_blackHolePullStartsAt) return false;
    float progress = std::min(
        1.0f,
        static_cast<float>(now - g_blackHolePullStartsAt) / 12000.0f
    );
    float speed = 9.0f + progress * 31.0f;
    if (entity == playerTarget) speed = 7.0f + progress * 18.0f;
    float vx = dx / distance * speed;
    float vy = dy / distance * speed;
    float vz = dz / distance * speed;
    ENTITY::SET_ENTITY_VELOCITY(entity, vx, vy, vz);
    ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(
        entity,
        1,
        vx * 0.42f,
        vy * 0.42f,
        vz * 0.42f,
        TRUE,
        TRUE,
        TRUE,
        TRUE
    );
    return true;
}
int PullWorldIntoBlackHole(Ped playerPed) {
    Entity playerTarget = PlayerTarget(playerPed);
    int affected = 0;
    if (playerTarget && ENTITY::DOES_ENTITY_EXIST(playerTarget)) {
        if (playerTarget == playerPed) {
            PED::SET_PED_CAN_RAGDOLL(playerPed, TRUE);
            PED::SET_PED_TO_RAGDOLL(playerPed, 900, 900, 0, TRUE, TRUE, FALSE);
        }
        if (PullEntityIntoBlackHole(playerTarget, playerTarget)) ++affected;
    }

    const int maxEntities = 512;
    int entities[maxEntities] = {};
    int count = worldGetAllVehicles(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        Entity entity = entities[index];
        if (entity == playerTarget) continue;
        if (PullEntityIntoBlackHole(entity, playerTarget)) ++affected;
    }

    count = worldGetAllPeds(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        Ped ped = entities[index];
        if (ped == playerPed || ped == playerTarget) continue;
        if (ped && ENTITY::DOES_ENTITY_EXIST(ped) && !ENTITY::IS_ENTITY_DEAD(ped)) {
            PED::SET_PED_CAN_RAGDOLL(ped, TRUE);
            PED::SET_PED_TO_RAGDOLL(ped, 900, 900, 0, TRUE, TRUE, FALSE);
        }
        if (PullEntityIntoBlackHole(ped, playerTarget)) ++affected;
    }

    count = worldGetAllObjects(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        if (PullEntityIntoBlackHole(entities[index], playerTarget)) ++affected;
    }
    count = worldGetAllPickups(entities, maxEntities);
    for (int index = 0; index < count; ++index) {
        if (PullEntityIntoBlackHole(entities[index], playerTarget)) ++affected;
    }
    return affected;
}
void DrawBlackHole() {
    GRAPHICS::DRAW_MARKER(
        28,
        g_blackHoleCenter.x, g_blackHoleCenter.y, g_blackHoleCenter.z,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        52.0f, 52.0f, 52.0f,
        0, 0, 0, 245,
        FALSE, TRUE, 2, TRUE, nullptr, nullptr, FALSE);
    GRAPHICS::DRAW_MARKER(
        6,
        g_blackHoleCenter.x, g_blackHoleCenter.y, g_blackHoleCenter.z,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        66.0f, 66.0f, 66.0f,
        36, 0, 58, 210,
        FALSE, TRUE, 2, TRUE, nullptr, nullptr, FALSE);
}
void DeleteTrainVehicle() {
    if (g_trainVehicle && ENTITY::DOES_ENTITY_EXIST(g_trainVehicle)) {
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(g_trainVehicle, TRUE, TRUE);
        VEHICLE::DELETE_VEHICLE(&g_trainVehicle);
    }
    g_trainVehicle = 0;
    g_trainTarget = 0;
    g_trainUntil = 0;
    g_trainApproachAt = 0;
    g_trainImpactAt = 0;
    g_trainImpactApplied = false;
    g_trainSpawnPosition = {0.0f, 0, 0.0f, 0, 0.0f, 0};
}
Result StartTrainHit(Ped playerPed) {
    DeleteTrainVehicle();
    Hash model = HashName("freight");
    Result loaded = LoadModel(model, "La locomotive");
    if (loaded.status != 0) return loaded;

    Entity target = PlayerTarget(playerPed);
    Vector3 targetPosition = ENTITY::GET_ENTITY_COORDS(target, TRUE);
    Vector3 forward = GameplayCameraForward();
    float horizontalLength = std::max(0.01f, std::sqrt(forward.x * forward.x + forward.y * forward.y));
    forward.x /= horizontalLength;
    forward.y /= horizontalLength;
    Vector3 spawn = {
        targetPosition.x + forward.x * 54.0f, 0,
        targetPosition.y + forward.y * 54.0f, 0,
        targetPosition.z + 1.5f, 0
    };
    float heading = CAM::GET_GAMEPLAY_CAM_ROT(2).z + 180.0f;
    Vehicle train = VEHICLE::CREATE_VEHICLE(
        model,
        spawn.x,
        spawn.y,
        spawn.z,
        heading,
        FALSE,
        FALSE
    );
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!train || !ENTITY::DOES_ENTITY_EXIST(train)) {
        return {5, "La locomotive n'a pas pu apparaitre."};
    }

    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(train, TRUE, TRUE);
    ENTITY::SET_ENTITY_COLLISION(train, TRUE, TRUE);
    ENTITY::SET_ENTITY_DYNAMIC(train, TRUE);
    ENTITY::SET_ENTITY_LOAD_COLLISION_FLAG(train, TRUE);
    ENTITY::SET_ENTITY_INVINCIBLE(train, TRUE);
    ENTITY::SET_ENTITY_VISIBLE(train, TRUE, FALSE);
    ENTITY::SET_ENTITY_ALPHA(train, 255, FALSE);
    ENTITY::SET_ENTITY_LOD_DIST(train, 1000);
    ENTITY::FREEZE_ENTITY_POSITION(train, TRUE);
    g_trainVehicle = train;
    g_trainTarget = target;
    g_trainDirection = {-forward.x, 0, -forward.y, 0, 0.0f, 0};
    g_trainSpawnPosition = spawn;
    g_trainImpactApplied = false;
    ULONGLONG now = GetTickCount64();
    g_trainApproachAt = now + kTrainTelegraphMs;
    g_trainImpactAt = g_trainApproachAt + kTrainApproachMs;
    g_trainUntil = g_trainImpactAt + 3200;
    ENTITY::SET_ENTITY_VELOCITY(train, 0.0f, 0.0f, 0.0f);
    return {0, "Une locomotive apparait face a la camera avant de foncer sur le joueur."};
}
void UpdateTrainHit(ULONGLONG now, Ped playerPed) {
    if (!g_trainVehicle) return;
    if (now >= g_trainUntil || !ENTITY::DOES_ENTITY_EXIST(g_trainVehicle)) {
        DeleteTrainVehicle();
        return;
    }
    Entity target = g_trainTarget;
    if (!target || !ENTITY::DOES_ENTITY_EXIST(target) || ENTITY::IS_ENTITY_DEAD(target)) {
        target = PlayerTarget(playerPed);
        g_trainTarget = target;
    }
    if (!target || !ENTITY::DOES_ENTITY_EXIST(target)) return;

    Vector3 trainPosition = ENTITY::GET_ENTITY_COORDS(g_trainVehicle, TRUE);
    Vector3 targetPosition = ENTITY::GET_ENTITY_COORDS(target, TRUE);
    if (now < g_trainApproachAt) {
        ENTITY::FREEZE_ENTITY_POSITION(g_trainVehicle, TRUE);
        ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
            g_trainVehicle,
            g_trainSpawnPosition.x,
            g_trainSpawnPosition.y,
            g_trainSpawnPosition.z,
            FALSE,
            FALSE,
            TRUE
        );
        int seconds = static_cast<int>(
            (g_trainApproachAt - now + 999ULL) / 1000ULL
        );
        DrawHudText(
            "TRAIN EN APPROCHE  -  " + std::to_string(seconds),
            255,
            196,
            64
        );
        return;
    }
    ENTITY::FREEZE_ENTITY_POSITION(g_trainVehicle, FALSE);
    float dx = targetPosition.x - trainPosition.x;
    float dy = targetPosition.y - trainPosition.y;
    float distance = std::max(0.01f, std::sqrt(dx * dx + dy * dy));
    g_trainDirection = {dx / distance, 0, dy / distance, 0, 0.0f, 0};
    float progress = std::min(
        1.0f,
        static_cast<float>(now - g_trainApproachAt)
            / static_cast<float>(kTrainApproachMs)
    );
    Vector3 approachPosition = {
        g_trainSpawnPosition.x
            + (targetPosition.x - g_trainSpawnPosition.x) * progress,
        0,
        g_trainSpawnPosition.y
            + (targetPosition.y - g_trainSpawnPosition.y) * progress,
        0,
        g_trainSpawnPosition.z
            + (targetPosition.z + 1.0f - g_trainSpawnPosition.z) * progress,
        0
    };
    ENTITY::SET_ENTITY_COORDS_NO_OFFSET(
        g_trainVehicle,
        approachPosition.x,
        approachPosition.y,
        approachPosition.z,
        FALSE,
        FALSE,
        TRUE
    );
    DrawHudText("IMPACT DU TRAIN", 255, 90, 64);

    if (!g_trainImpactApplied && (now >= g_trainImpactAt || distance <= 7.0f)) {
        g_trainImpactApplied = true;
        ENTITY::SET_ENTITY_VELOCITY(
            g_trainVehicle,
            g_trainDirection.x * 42.0f,
            g_trainDirection.y * 42.0f,
            0.0f
        );
        if (target == playerPed) {
            PED::SET_PED_CAN_RAGDOLL(playerPed, TRUE);
            PED::SET_PED_TO_RAGDOLL(playerPed, 4200, 4200, 0, TRUE, TRUE, FALSE);
        }
        ENTITY::SET_ENTITY_VELOCITY(
            target,
            g_trainDirection.x * 74.0f,
            g_trainDirection.y * 74.0f,
            22.0f
        );
        ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(
            target,
            1,
            g_trainDirection.x * 130.0f,
            g_trainDirection.y * 130.0f,
            42.0f,
            TRUE,
            TRUE,
            TRUE,
            TRUE
        );
        FIRE::ADD_EXPLOSION(
            targetPosition.x,
            targetPosition.y,
            targetPosition.z,
            29,
            0.6f,
            FALSE,
            TRUE,
            0.8f
        );
    }
}
Result SpawnVehicleAbovePlayer(Ped playerPed, Hash model, const char* label) {
    Result loaded = LoadModel(model, label);
    if (loaded.status != 0) return loaded;
    Vector3 origin = ENTITY::GET_ENTITY_COORDS(playerPed, TRUE);
    Vehicle vehicle = VEHICLE::CREATE_VEHICLE(model, origin.x, origin.y, origin.z + 28.0f, ENTITY::GET_ENTITY_HEADING(playerPed), FALSE, FALSE);
    STREAMING::SET_MODEL_AS_NO_LONGER_NEEDED(model);
    if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) return {5, std::string(label) + " n'a pas pu apparaitre."};
    ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
    ENTITY::SET_ENTITY_VELOCITY(vehicle, 0.0f, 0.0f, -8.0f);
    return {0, std::string(label) + " est tombe du ciel."};
}
Result Execute(std::string code) {
    std::transform(code.begin(), code.end(), code.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    if (code == "overlay_win_x2") {
        g_nativeWinMultiplier = 2;
        g_nativeWinMultiplierUntil = GetTickCount64() + 60000;
        g_counterHudText = "MULTIPLICATEUR WINS X2  -  60 SEC";
        g_counterHudUntil = GetTickCount64() + 5000;
        return {0, "Le multiplicateur WINS X2 est visible et actif pendant 60 secondes."};
    }
    if (code == "chaos_exit_prison") {
        EndPrison();
        return {0, "Le joueur est sorti de prison."};
    }
    Player player = 0;
    Ped ped = 0;
    if (!PlayerReady(player, ped)) return {kEffectRetryStatus, kGameNotReadyMessage};
    if (code == "chaos_upupaway") {
        Entity target = PlayerTarget(ped);
        Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(target);
        ENTITY::SET_ENTITY_VELOCITY(target, velocity.x, velocity.y, std::max(velocity.z, 0.0f) + 28.0f);
        return {0, "Le joueur a ete propulse."};
    }
    if (code == "chaos_tp_mountchilliad") {
        ResetVictoryZoneEntry();
        TeleportPlayer(ped, kMont);
        return {0, "Le joueur a ete envoye au Mont Chiliad."};
    }
    if (code == "chaos_tp_random") {
        size_t count = sizeof(kTeleports) / sizeof(kTeleports[0]);
        TeleportPlayer(ped, kTeleports[(GetTickCount64() ^ GetCurrentProcessId()) % count]);
        return {0, "Le joueur a ete teleporte."};
    }
    if (code == "chaos_time_night") { TIME::SET_CLOCK_TIME(0, 0, 0); return {0, "La nuit est tombee."}; }
    if (code == "chaos_time_day") { TIME::SET_CLOCK_TIME(12, 0, 0); return {0, "Le jour s'est leve."}; }
    if (code == "chaos_invincible") {
        if (!g_restoreInvincibility) {
            g_wasInvincible = PLAYER::GET_PLAYER_INVINCIBLE(player) != FALSE;
            g_restoreInvincibility = true;
        }
        PLAYER::SET_PLAYER_INVINCIBLE(player, TRUE);
        ENTITY::SET_ENTITY_INVINCIBLE(ped, TRUE);
        g_invincibleUntil = GetTickCount64() + 20000;
        return {0, "Le joueur est invincible pendant 20 secondes."};
    }
    if (code == "chaos_5stars") {
        PLAYER::SET_PLAYER_WANTED_LEVEL(player, 5, FALSE);
        PLAYER::SET_PLAYER_WANTED_LEVEL_NOW(player, FALSE);
        return {0, "Le niveau de recherche est passe a 5 etoiles."};
    }
    if (code == "chaos_random_weapons") return ArmPeds(ped);
    if (code == "chaos_playerveh_explode") {
        Vehicle vehicle = PED::GET_VEHICLE_PED_IS_IN(ped, FALSE);
        if (!vehicle || !ENTITY::DOES_ENTITY_EXIST(vehicle)) return {3, "Le joueur doit etre dans un vehicule pour cet effet."};
        Vector3 p = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        FIRE::ADD_EXPLOSION(p.x, p.y, p.z, 2, 1.0f, TRUE, FALSE, 1.0f);
        return {0, "Le vehicule du joueur a explose."};
    }
    if (code == "chaos_tp_lsairport") {
        TeleportPlayer(ped, kAirport);
        return {0, "Le joueur a ete envoye a l'aeroport."};
    }
    if (code == "chaos_player_suicide") {
        ENTITY::SET_ENTITY_HEALTH(ped, 0);
        return {0, "Le joueur a ete elimine."};
    }
    if (code == "chaos_vehicle_random") {
        const char* bicycles[] = {
            "bmx", "cruiser", "fixter", "scorcher", "tribike", "tribike2", "tribike3"
        };
        const char* motorcycles[] = {
            "akuma", "bati", "bati2", "bagger", "blazer", "blazer3", "daemon", "double",
            "faggio2", "hakuchou", "hexer", "innovation", "nemesis", "pcj", "ruffian",
            "sanchez", "sanchez2", "sovereign", "thrust", "vader"
        };
        const char* watercraft[] = {
            "seashark", "seashark2", "seashark3", "dinghy", "dinghy2", "dinghy3",
            "jetmax", "speeder", "speeder2", "squalo", "suntrap", "tropic", "tropic2"
        };
        const char* offroad[] = {
            "bfinjection", "bifta", "bodhi2", "dubsta3", "dune", "dune2", "guardian",
            "insurgent", "kalahari", "mesa3", "monster", "monster3", "rancherxl",
            "rebel", "rebel2", "sandking", "sandking2", "technical", "trophytruck"
        };
        const char* unusual[] = {
            "airtug", "bulldozer", "caddy", "caddy2", "caddy3", "docktug", "dump",
            "forklift", "handler", "mixer", "mixer2", "mower", "ripley", "scrap",
            "tractor", "tractor2", "tractor3", "utillitruck", "utillitruck2", "utillitruck3"
        };
        const char* classics[] = {
            "btype", "btype2", "btype3", "casco", "cheetah2", "coquette2", "coquette3",
            "hotknife", "jb700", "mamba", "manana", "manana2", "monroe", "peyote",
            "pigalle", "roosevelt", "roosevelt2", "tornado", "tornado2", "voodoo2", "ztype"
        };
        const char* performance[] = {
            "adder", "banshee", "banshee2", "bullet", "carbonizzare", "cheetah", "comet2",
            "comet3", "coquette", "elegy2", "entityxf", "feltzer2", "furoregt", "infernus",
            "jester", "jester2", "massacro", "osiris", "penetrator", "reaper", "seven70",
            "t20", "tempesta", "turismo2", "turismor", "vacca", "voltic", "zentorno"
        };
        const char* emergency[] = {
            "ambulance", "fbi", "fbi2", "firetruk", "lguard", "police", "police2",
            "police3", "police4", "policeb", "policeold1", "policeold2", "policet",
            "pranger", "riot", "sheriff", "sheriff2"
        };
        const char* heavyAndPublic[] = {
            "bison", "boxville", "boxville2", "burrito3", "bus", "camper", "coach",
            "journey", "minivan", "mule", "packer", "paradise", "phantom", "pony",
            "pounder", "rumpo", "stockade", "stretch", "taxi", "tourbus", "towtruck", "trash"
        };
        const char* aircraft[] = {
            "annihilator", "buzzard", "buzzard2", "cargobob", "duster", "frogger",
            "mammatus", "maverick", "stunt", "velum", "cuban800"
        };

        const char** selectedPool = nullptr;
        size_t selectedCount = 0;
        const char* selectedLabel = "vehicule";
        switch (RandomChoiceIndex(10)) {
            case 0:
                selectedPool = bicycles;
                selectedCount = sizeof(bicycles) / sizeof(bicycles[0]);
                selectedLabel = "velo";
                break;
            case 1:
                selectedPool = motorcycles;
                selectedCount = sizeof(motorcycles) / sizeof(motorcycles[0]);
                selectedLabel = "moto ou quad";
                break;
            case 2:
                selectedPool = watercraft;
                selectedCount = sizeof(watercraft) / sizeof(watercraft[0]);
                selectedLabel = "jet-ski ou bateau";
                break;
            case 3:
                selectedPool = offroad;
                selectedCount = sizeof(offroad) / sizeof(offroad[0]);
                selectedLabel = "tout-terrain";
                break;
            case 4:
                selectedPool = unusual;
                selectedCount = sizeof(unusual) / sizeof(unusual[0]);
                selectedLabel = "vehicule insolite";
                break;
            case 5:
                selectedPool = classics;
                selectedCount = sizeof(classics) / sizeof(classics[0]);
                selectedLabel = "vehicule de collection";
                break;
            case 6:
                selectedPool = performance;
                selectedCount = sizeof(performance) / sizeof(performance[0]);
                selectedLabel = "sportive ou supercar";
                break;
            case 7:
                selectedPool = emergency;
                selectedCount = sizeof(emergency) / sizeof(emergency[0]);
                selectedLabel = "vehicule d'urgence";
                break;
            case 8:
                selectedPool = heavyAndPublic;
                selectedCount = sizeof(heavyAndPublic) / sizeof(heavyAndPublic[0]);
                selectedLabel = "poids lourd ou transport public";
                break;
            default:
                selectedPool = aircraft;
                selectedCount = sizeof(aircraft) / sizeof(aircraft[0]);
                selectedLabel = "aeronef";
                break;
        }
        const char* modelName = selectedPool[RandomChoiceIndex(selectedCount)];
        return SpawnVehicleForPlayer(HashName(modelName), selectedLabel);
    }
    if (code == "chaos_vehicle_supercar") return SpawnVehicleForPlayer(HashName("adder"), "supercar Adder");
    if (code == "chaos_vehicle_motorcycle") return SpawnVehicleForPlayer(0xF9300CC5);
    if (code == "chaos_vehicle_tank") return SpawnVehicleForPlayer(0x2EA68690);
    if (code == "chaos_vehicle_helicopter") return SpawnVehicleForPlayer(0x2F03547B);
    if (code == "chaos_vehicle_repair") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        VEHICLE::SET_VEHICLE_FIXED(vehicle);
        VEHICLE::SET_VEHICLE_ENGINE_HEALTH(vehicle, 1000.0f);
        VEHICLE::SET_VEHICLE_BODY_HEALTH(vehicle, 1000.0f);
        VEHICLE::SET_VEHICLE_PETROL_TANK_HEALTH(vehicle, 1000.0f);
        VEHICLE::SET_VEHICLE_DIRT_LEVEL(vehicle, 0.0f);
        VEHICLE::SET_VEHICLE_UNDRIVEABLE(vehicle, FALSE);
        VEHICLE::SET_VEHICLE_ENGINE_ON(vehicle, TRUE, TRUE, FALSE);
        return {0, "Le vehicule du joueur a ete repare."};
    }
    if (code == "chaos_vehicle_boost") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        VEHICLE::SET_VEHICLE_FORWARD_SPEED(vehicle, 85.0f);
        return {0, "Le vehicule du joueur a recu un boost."};
    }
    if (code == "chaos_vehicle_flip") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        Vector3 position = ENTITY::GET_ENTITY_COORDS(vehicle, TRUE);
        Vector3 rotation = ENTITY::GET_ENTITY_ROTATION(vehicle, 2);
        Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(vehicle);
        position.z += 1.6f;
        ENTITY::SET_ENTITY_COORDS_NO_OFFSET(vehicle, position.x, position.y, position.z, FALSE, FALSE, TRUE);
        ENTITY::SET_ENTITY_VELOCITY(
            vehicle,
            velocity.x,
            velocity.y,
            std::max(velocity.z, 0.0f) + 9.0f
        );
        g_flippingVehicle = vehicle;
        g_vehicleFlipStartRotation = rotation;
        g_vehicleFlipStartedAt = GetTickCount64();
        g_vehicleFlipUntil = g_vehicleFlipStartedAt + kVehicleFlipDurationMs;
        g_vehicleFlipHalfLogged = false;
        return {0, "Le vehicule du joueur effectue un tonneau complet."};
    }
    if (code == "chaos_vehicle_random_color") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        int primary = static_cast<int>((GetTickCount64() / 7) % 160);
        int secondary = static_cast<int>((GetTickCount64() / 13 + 53) % 160);
        VEHICLE::SET_VEHICLE_COLOURS(vehicle, primary, secondary);
        return {0, "La couleur du vehicule a change."};
    }
    if (code == "chaos_vehicle_eject") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        AI::TASK_LEAVE_VEHICLE(ped, vehicle, 16);
        ULONGLONG deadline = GetTickCount64() + 550;
        while (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE) && GetTickCount64() < deadline) WAIT(0);
        if (!PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) {
            PED::SET_PED_TO_RAGDOLL(ped, 2200, 2200, 0, TRUE, TRUE, FALSE);
            Vector3 forward = ENTITY::GET_ENTITY_FORWARD_VECTOR(vehicle);
            ENTITY::SET_ENTITY_VELOCITY(ped, forward.x * 18.0f, forward.y * 18.0f, 8.0f);
        } else {
            ENTITY::APPLY_FORCE_TO_ENTITY_CENTER_OF_MASS(vehicle, 1, 0.0f, 0.0f, 34.0f, TRUE, TRUE, TRUE, TRUE);
        }
        return {0, "Le joueur a ete ejecte du vehicule."};
    }
    if (code == "chaos_heal") {
        ENTITY::SET_ENTITY_HEALTH(ped, ENTITY::GET_ENTITY_MAX_HEALTH(ped));
        return {0, "La vie du joueur a ete restauree."};
    }
    if (code == "chaos_damage") {
        int health = ENTITY::GET_ENTITY_HEALTH(ped);
        ENTITY::SET_ENTITY_HEALTH(ped, std::max(1, health - 50));
        return {0, "Le joueur a perdu de la vie."};
    }
    if (code == "chaos_armor") {
        PED::SET_PED_ARMOUR(ped, 100);
        return {0, "L'armure du joueur a ete remplie."};
    }
    if (code == "chaos_clear_wanted") {
        PLAYER::CLEAR_PLAYER_WANTED_LEVEL(player);
        return {0, "La police ne recherche plus le joueur."};
    }
    if (code == "chaos_wanted_up") {
        int wanted = std::min(5, PLAYER::GET_PLAYER_WANTED_LEVEL(player) + 1);
        PLAYER::SET_PLAYER_WANTED_LEVEL(player, wanted, FALSE);
        PLAYER::SET_PLAYER_WANTED_LEVEL_NOW(player, FALSE);
        return {0, "Le niveau de recherche a augmente."};
    }
    if (code == "chaos_ragdoll") {
        return ForcePlayerRagdoll(ped, 5000);
    }
    if (code == "chaos_drunk") {
        return StartDrunkEffect(ped, 15000);
    }
    if (code == "chaos_super_jump") {
        return StartSuperJumpEffect(ped, 20000);
    }
    if (code == "chaos_explosive_ammo") {
        g_explosiveAmmoUntil = GetTickCount64() + 20000;
        return {0, "Les munitions sont explosives pendant 20 secondes."};
    }
    if (code == "chaos_explosive_melee") {
        g_explosiveMeleeUntil = GetTickCount64() + 20000;
        return {0, "Les coups sont explosifs pendant 20 secondes."};
    }
    if (code == "chaos_infinite_ammo") {
        WEAPON::SET_PED_INFINITE_AMMO_CLIP(ped, TRUE);
        g_infiniteAmmoActive = true;
        g_infiniteAmmoUntil = GetTickCount64() + 20000;
        return {0, "Les munitions sont infinies pendant 20 secondes."};
    }
    if (code == "chaos_remove_weapons") {
        WEAPON::REMOVE_ALL_PED_WEAPONS(ped, TRUE);
        return {0, "Toutes les armes du joueur ont ete retirees."};
    }
    if (code == "chaos_give_minigun") {
        WEAPON::GIVE_WEAPON_TO_PED(ped, 0x42BF8A85, 999, FALSE, TRUE);
        return {0, "Le joueur a recu un minigun."};
    }
    if (code == "chaos_weather_rain") {
        GAMEPLAY::SET_WEATHER_TYPE_NOW_PERSIST(const_cast<char*>("RAIN"));
        return {0, "La pluie s'est installee."};
    }
    if (code == "chaos_weather_thunder") {
        GAMEPLAY::SET_WEATHER_TYPE_NOW_PERSIST(const_cast<char*>("THUNDER"));
        return {0, "Un orage a commence."};
    }
    if (code == "chaos_weather_clear") {
        GAMEPLAY::CLEAR_OVERRIDE_WEATHER();
        GAMEPLAY::CLEAR_WEATHER_TYPE_PERSIST();
        GAMEPLAY::SET_WEATHER_TYPE_NOW_PERSIST(const_cast<char*>("CLEAR"));
        return {0, "Le ciel s'est degage."};
    }
    if (code == "chaos_slow_motion") {
        GAMEPLAY::SET_TIME_SCALE(0.35f);
        g_slowMotionActive = true;
        g_slowMotionUntil = GetTickCount64() + 10000;
        return {0, "Le jeu est ralenti pendant 10 secondes."};
    }
    if (code == "chaos_freeze_player") {
        if (g_frozenEntity && ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) {
            ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, FALSE);
        }
        g_frozenEntity = PlayerTarget(ped);
        ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, TRUE);
        g_frozenUntil = GetTickCount64() + 5000;
        return {0, "Le joueur est immobilise pendant 5 secondes."};
    }
    if (code == "chaos_explode_nearby_vehicles") return AffectNearbyVehicles(ped, true, false);
    if (code == "chaos_launch_nearby_vehicles") return AffectNearbyVehicles(ped, false, true);
    if (code == "chaos_prison") {
        return StartPrison(ped);
    }
    if (code == "chaos_black_hole") {
        Entity target = PlayerTarget(ped);
        Vector3 position = ENTITY::GET_ENTITY_COORDS(target, TRUE);
        Vector3 forward = GameplayCameraForward();
        float horizontalLength = std::max(
            0.01f,
            std::sqrt(forward.x * forward.x + forward.y * forward.y)
        );
        forward.x /= horizontalLength;
        forward.y /= horizontalLength;
        g_blackHoleCenter = {
            position.x + forward.x * 70.0f,
            0,
            position.y + forward.y * 70.0f,
            0,
            position.z + 38.0f,
            0
        };
        g_blackHoleStartedAt = GetTickCount64();
        g_blackHolePullStartsAt =
            g_blackHoleStartedAt + kBlackHoleTelegraphMs;
        g_blackHoleUntil =
            g_blackHoleStartedAt + kBlackHoleDurationMs;
        g_nextBlackHolePullAt = g_blackHolePullStartsAt;
        return {0, "Un enorme trou noir apparait face a la camera avant d'attirer progressivement tout le monde."};
    }
    if (code == "chaos_meteor") {
        Vector3 p = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(PlayerTarget(ped), 0.0f, 10.0f, 4.0f);
        FIRE::ADD_EXPLOSION(p.x, p.y, p.z, 29, 4.0f, TRUE, FALSE, 1.0f);
        return {0, "Une meteorite est tombee pres du joueur."};
    }
    if (code == "chaos_zombie_horde") {
        const Hash models[] = { HashName("u_m_y_zombie_01") };
        return SpawnHostilePeds(ped, models, sizeof(models) / sizeof(models[0]), 7, "zombie(s)");
    }
    if (code == "chaos_spawn_alien") {
        const Hash models[] = { HashName("s_m_m_movalien_01"), HashName("s_m_m_movspace_01") };
        return SpawnHostilePeds(ped, models, sizeof(models) / sizeof(models[0]), 3, "alien(s)");
    }
    if (code == "chaos_magnetic_storm") {
        g_magneticStormUntil = GetTickCount64() + 7000;
        return PullNearbyVehicles(ped, true, true);
    }
    if (code == "chaos_half_turn") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        ENTITY::SET_ENTITY_HEADING(vehicle, ENTITY::GET_ENTITY_HEADING(vehicle) + 180.0f);
        return {0, "Le vehicule a fait demi-tour."};
    }
    if (code == "chaos_dance") {
        Vehicle vehicle = 0;
        if (CurrentPlayerVehicle(ped, vehicle)) {
            AI::TASK_LEAVE_VEHICLE(ped, vehicle, 4160);
            ULONGLONG deadline = GetTickCount64() + 1200;
            while (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE) && GetTickCount64() < deadline) WAIT(0);
            if (PED::IS_PED_IN_ANY_VEHICLE(ped, FALSE)) {
                Vector3 exit = ENTITY::GET_OFFSET_FROM_ENTITY_IN_WORLD_COORDS(vehicle, 3.2f, 0.0f, 0.8f);
                Teleport(ped, exit);
                WAIT(0);
            }
        }
        AI::CLEAR_PED_TASKS(ped);
        AI::TASK_START_SCENARIO_IN_PLACE(ped, const_cast<char*>("WORLD_HUMAN_PARTYING"), 0, TRUE);
        g_dancePed = ped;
        g_danceUntil = GetTickCount64() + 30000;
        return {0, "Le joueur danse pendant 30 secondes."};
    }
    if (code == "chaos_propulsion") {
        Entity target = PlayerTarget(ped);
        Vector3 forward = ENTITY::GET_ENTITY_FORWARD_VECTOR(target);
        ENTITY::SET_ENTITY_VELOCITY(target, forward.x * 50.0f, forward.y * 50.0f, 10.0f);
        return {0, "Le joueur a ete propulse vers l'avant."};
    }
    if (code == "chaos_tank_on_head") return SpawnVehicleAbovePlayer(ped, HashName("rhino"), "Un tank");
    if (code == "chaos_animal_random") return SpawnFriendlyAnimal(ped);
    if (code == "chaos_tp_sky") {
        Entity target = PlayerTarget(ped);
        Vector3 p = ENTITY::GET_ENTITY_COORDS(target, TRUE);
        p.z += 220.0f;
        TeleportPlayer(ped, p);
        return {0, "Le joueur a ete teleporte dans le ciel."};
    }
    if (code == "chaos_train_hit") {
        return StartTrainHit(ped);
    }
    if (code == "chaos_delete_vehicle") {
        Vehicle vehicle = 0;
        Result required = RequireVehicle(ped, vehicle);
        if (required.status != 0) return required;
        ENTITY::SET_ENTITY_AS_MISSION_ENTITY(vehicle, TRUE, TRUE);
        VEHICLE::DELETE_VEHICLE(&vehicle);
        return {0, "Le vehicule du joueur a ete supprime."};
    }
    if (code.rfind("gift_show", 0) == 0 || code.rfind("gift_drop_", 0) == 0) return SpawnTikTokGiftObject(ped, code);
    return {4, "Cette interaction Mont Chiliad n'est pas reconnue."};
}
void Reply(int id, const Result& result) {
    std::ostringstream json;
    json << "{\"id\":" << id << ",\"status\":" << result.status << ",\"message\":\"" << Escape(result.message) << "\"}";
    Send(json.str());
}
long long UnixMs() {
    FILETIME ft = {};
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER value = {};
    value.LowPart = ft.dwLowDateTime;
    value.HighPart = ft.dwHighDateTime;
    return static_cast<long long>((value.QuadPart - 116444736000000000ULL) / 10000ULL);
}
void StartRound(const char* eventName) {
    ++g_roundId;
    g_roundActive = true;
    g_won = false;
    g_autoTeleportedWinner = false;
    g_roundStart = GetTickCount64();
    g_airportTeleportAt = 0;
    if (!g_inZone) g_zoneStart = 0;
    g_lastEvent = eventName;
    g_lastState = 0;
}
void UpdateVehicleFlip(ULONGLONG now) {
    if (!g_flippingVehicle || !g_vehicleFlipStartedAt) return;
    if (!ENTITY::DOES_ENTITY_EXIST(g_flippingVehicle)
        || ENTITY::IS_ENTITY_DEAD(g_flippingVehicle)) {
        Log("Vehicle flip cancelled because the vehicle no longer exists.");
        g_flippingVehicle = 0;
        g_vehicleFlipStartedAt = 0;
        g_vehicleFlipUntil = 0;
        g_vehicleFlipHalfLogged = false;
        return;
    }
    if (now < g_vehicleFlipStartedAt) return;

    float progress = std::min(
        1.0f,
        static_cast<float>(now - g_vehicleFlipStartedAt)
            / static_cast<float>(kVehicleFlipDurationMs)
    );
    float easedProgress = progress * progress * (3.0f - 2.0f * progress);
    ENTITY::SET_ENTITY_ROTATION(
        g_flippingVehicle,
        g_vehicleFlipStartRotation.x,
        g_vehicleFlipStartRotation.y + 360.0f * easedProgress,
        g_vehicleFlipStartRotation.z,
        2,
        TRUE
    );

    if (!g_vehicleFlipHalfLogged && progress >= 0.5f) {
        Vector3 observed = ENTITY::GET_ENTITY_ROTATION(g_flippingVehicle, 2);
        std::ostringstream midpoint;
        midpoint << "Vehicle flip midpoint rotation: "
                 << observed.x << ", " << observed.y << ", " << observed.z << ".";
        Log(midpoint.str());
        g_vehicleFlipHalfLogged = true;
    }
    if (now < g_vehicleFlipUntil && progress < 1.0f) return;

    Log("Vehicle flip completed through 360 degrees.");
    g_flippingVehicle = 0;
    g_vehicleFlipStartedAt = 0;
    g_vehicleFlipUntil = 0;
    g_vehicleFlipHalfLogged = false;
}
void UpdateTimedEffects(ULONGLONG now) {
    Player player = PLAYER::PLAYER_ID();
    Ped ped = PLAYER::PLAYER_PED_ID();
    bool pedExists = ped && ENTITY::DOES_ENTITY_EXIST(ped);

    CleanupGiftObjects(now);
    UpdateVehicleFlip(now);

    if (now < g_superJumpUntil) {
        GAMEPLAY::SET_SUPER_JUMP_THIS_FRAME(player);
        bool jumpRequested =
            CONTROLS::IS_CONTROL_JUST_PRESSED(0, 22)
            || PED::IS_PED_JUMPING(ped);
        if (pedExists
            && PED::IS_PED_ON_FOOT(ped)
            && jumpRequested
            && now >= g_nextSuperJumpBoostAt) {
            Vector3 velocity = ENTITY::GET_ENTITY_VELOCITY(ped);
            ENTITY::SET_ENTITY_VELOCITY(
                ped,
                velocity.x,
                velocity.y,
                std::max(velocity.z, 0.0f) + 28.0f
            );
            g_nextSuperJumpBoostAt = now + 1200;
        }
    }
    if (now < g_explosiveAmmoUntil) GAMEPLAY::SET_EXPLOSIVE_AMMO_THIS_FRAME(player);
    if (now < g_explosiveMeleeUntil) GAMEPLAY::SET_EXPLOSIVE_MELEE_THIS_FRAME(player);

    if (g_restoreInvincibility && now >= g_invincibleUntil) {
        PLAYER::SET_PLAYER_INVINCIBLE(player, g_wasInvincible ? TRUE : FALSE);
        if (pedExists) ENTITY::SET_ENTITY_INVINCIBLE(ped, g_wasInvincible ? TRUE : FALSE);
        g_restoreInvincibility = false;
        g_invincibleUntil = 0;
    }
    if (g_infiniteAmmoActive && now >= g_infiniteAmmoUntil) {
        if (pedExists) WEAPON::SET_PED_INFINITE_AMMO_CLIP(ped, FALSE);
        g_infiniteAmmoActive = false;
        g_infiniteAmmoUntil = 0;
    }
    if (g_drunkActive && now >= g_drunkUntil) {
        CAM::STOP_GAMEPLAY_CAM_SHAKING(TRUE);
        GRAPHICS::CLEAR_TIMECYCLE_MODIFIER();
        if (g_drunkPed && ENTITY::DOES_ENTITY_EXIST(g_drunkPed)) {
            PED::RESET_PED_MOVEMENT_CLIPSET(g_drunkPed, 0.5f);
        }
        STREAMING::REMOVE_ANIM_SET(
            const_cast<char*>("move_m@drunk@verydrunk")
        );
        g_drunkPed = 0;
        g_drunkActive = false;
        g_drunkUntil = 0;
    }
    if (g_slowMotionActive && now >= g_slowMotionUntil) {
        GAMEPLAY::SET_TIME_SCALE(1.0f);
        g_slowMotionActive = false;
        g_slowMotionUntil = 0;
    }
    if (g_danceUntil && now >= g_danceUntil) {
        if (g_dancePed && ENTITY::DOES_ENTITY_EXIST(g_dancePed)) {
            AI::CLEAR_PED_TASKS_IMMEDIATELY(g_dancePed);
        }
        g_dancePed = 0;
        g_danceUntil = 0;
    }
    if (g_prisonUntil && now >= g_prisonUntil) {
        EndPrison();
    } else if (g_frozenEntity && now >= g_frozenUntil) {
        if (ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, FALSE);
        g_frozenEntity = 0;
        g_frozenUntil = 0;
    }
    if (g_prisonUntil) {
        if (g_frozenEntity && ENTITY::DOES_ENTITY_EXIST(g_frozenEntity)) {
            ENTITY::FREEZE_ENTITY_POSITION(g_frozenEntity, TRUE);
        }
        if (g_prisonPed && ENTITY::DOES_ENTITY_EXIST(g_prisonPed)) {
            if (!PED::IS_PED_IN_ANY_VEHICLE(g_prisonPed, FALSE)) {
                ENTITY::FREEZE_ENTITY_POSITION(g_prisonPed, TRUE);
                AI::UPDATE_TASK_HANDS_UP_DURATION(g_prisonPed, static_cast<int>(std::min<ULONGLONG>(60000ULL, g_prisonUntil > now ? g_prisonUntil - now : 0ULL)));
            }
        }
        DrawPrisonStatus(now);
    }
    if (pedExists && !ENTITY::IS_ENTITY_DEAD(ped)) {
        if (now < g_blackHoleUntil) {
            DrawBlackHole();
            if (
                now >= g_blackHolePullStartsAt
                && now >= g_nextBlackHolePullAt
            ) {
                PullWorldIntoBlackHole(ped);
                g_nextBlackHolePullAt = now + 120;
            }
            if (now < g_blackHolePullStartsAt) {
                int seconds = static_cast<int>(
                    (g_blackHolePullStartsAt - now + 999ULL) / 1000ULL
                );
                DrawHudText(
                    "TROU NOIR  -  ASPIRATION DANS "
                        + std::to_string(seconds),
                    196,
                    116,
                    255
                );
            } else {
                DrawHudText("TROU NOIR  -  ASPIRATION", 180, 92, 255);
            }
        }
        if (now < g_magneticStormUntil) {
            PullNearbyVehicles(ped, true);
            DrawHudText("TEMPETE MAGNETIQUE", 92, 225, 255);
        }
        UpdateTrainHit(now, ped);
    } else if (g_trainVehicle) {
        UpdateTrainHit(now, ped);
    }
}
void DrawHudText(const std::string& message, int red, int green, int blue) {
    char stringCommand[] = "STRING";
    std::string text = message;
    GRAPHICS::DRAW_RECT(0.5f, 0.84f, 0.52f, 0.095f, 0, 0, 0, 205);
    UI::SET_TEXT_FONT(0);
    UI::SET_TEXT_SCALE(0.0f, 0.82f);
    UI::SET_TEXT_COLOUR(red, green, blue, 255);
    UI::SET_TEXT_CENTRE(TRUE);
    UI::SET_TEXT_DROP_SHADOW();
    UI::SET_TEXT_OUTLINE();
    UI::_SET_TEXT_ENTRY(stringCommand);
    UI::_ADD_TEXT_COMPONENT_STRING(&text[0]);
    UI::_DRAW_TEXT(0.5f, 0.80f);
}
int VictorySecondsRemaining(ULONGLONG now) {
    if (!g_roundActive) return 0;
    if (!g_inZone || !g_zoneStart || now <= g_zoneStart) {
        return kVictoryHoldSeconds;
    }
    ULONGLONG elapsed = now - g_zoneStart;
    ULONGLONG duration =
        static_cast<ULONGLONG>(kVictoryHoldSeconds) * 1000ULL;
    if (elapsed >= duration) return 0;
    return static_cast<int>((duration - elapsed + 999ULL) / 1000ULL);
}
std::string FormatRoundTime(int seconds) {
    int safeSeconds = std::max(0, seconds);
    int minutes = safeSeconds / 60;
    int remainder = safeSeconds % 60;
    std::ostringstream output;
    output << minutes << ":";
    if (remainder < 10) output << "0";
    output << remainder;
    return output.str();
}
void DrawVictoryZone(ULONGLONG now, const Vector3& playerPosition, bool playerExists) {
    if (!playerExists) return;

    float dx = playerPosition.x - kVictoryCenter.x;
    float dy = playerPosition.y - kVictoryCenter.y;
    if (dx * dx + dy * dy > 250000.0f) return;

    int red = g_won ? 255 : (g_inZone ? 46 : 25);
    int green = g_won ? 196 : (g_inZone ? 230 : 210);
    int blue = g_won ? 45 : (g_inZone ? 120 : 255);
    int alpha = g_inZone ? 110 : 72;
    GRAPHICS::DRAW_MARKER(
        1,
        kVictoryCenter.x, kVictoryCenter.y, kVictoryCenter.z - 1.15f,
        0.0f, 0.0f, 0.0f,
        0.0f, 0.0f, 0.0f,
        kVictoryRadius * 2.0f, kVictoryRadius * 2.0f, 1.15f,
        red, green, blue, alpha,
        FALSE, FALSE, 2, FALSE, nullptr, nullptr, FALSE);

    if (g_won && now < g_winDisplayUntil) {
        DrawHudText(
            g_counterHudText.empty() ? "VICTOIRE ENREGISTREE" : g_counterHudText,
            255,
            216,
            74
        );
    } else if (g_roundActive && g_inZone) {
        DrawHudText(
            "RESTE DANS LE CERCLE  -  "
                + FormatRoundTime(VictorySecondsRemaining(now)),
            108,
            255,
            178
        );
    } else if (g_roundActive) {
        DrawHudText(
            "ENTRE DANS LE CERCLE  -  "
                + FormatRoundTime(VictorySecondsRemaining(now)),
            255,
            176,
            72
        );
    }
}
void UpdateVictory(ULONGLONG now) {
    Player player = PLAYER::PLAYER_ID();
    Ped ped = PLAYER::PLAYER_PED_ID();
    bool exists = ped && ENTITY::DOES_ENTITY_EXIST(ped);
    Vector3 p = {0.0f, 0, 0.0f, 0, 0.0f, 0};
    if (exists) p = ENTITY::GET_ENTITY_COORDS(ped, TRUE);
    std::string eventName = "heartbeat";
    bool force = false;

    if (
        g_airportTeleportAt
        && now >= g_airportTeleportAt
        && exists
        && !ENTITY::IS_ENTITY_DEAD(ped)
    ) {
        TeleportPlayer(ped, kAirport);
        g_airportTeleportAt = 0;
        g_autoTeleportedWinner = true;
        eventName = g_lastEvent = "winner-teleported";
        force = true;
    }

    int playerHealth = exists ? ENTITY::GET_ENTITY_HEALTH(ped) : 0;
    bool previousPedDied =
        g_lastObservedPlayerPed
        && g_lastObservedPlayerPed != ped
        && (
            g_lastObservedPlayerHealth <= 0
            || (
                ENTITY::DOES_ENTITY_EXIST(g_lastObservedPlayerPed)
                && (
                    ENTITY::IS_ENTITY_DEAD(g_lastObservedPlayerPed)
                    || ENTITY::GET_ENTITY_HEALTH(
                        g_lastObservedPlayerPed
                    ) <= 0
                    || PED::IS_PED_FATALLY_INJURED(
                        g_lastObservedPlayerPed
                    )
                )
            )
        );
    bool playerDead =
        PLAYER::IS_PLAYER_DEAD(player)
        || previousPedDied
        || (
            exists
            && (
                playerHealth <= 0
                || ENTITY::IS_ENTITY_DEAD(ped)
                || PED::IS_PED_FATALLY_INJURED(ped)
                || PED::IS_PED_DEAD_OR_DYING(ped, TRUE)
            )
        );
    if (playerDead) {
        g_playerAliveSince = 0;
        if (
            g_playerAliveObserved
            && !g_playerWasDead
            && (!g_lastDeathAt || now - g_lastDeathAt >= 4000ULL)
        ) {
            g_playerWasDead = true;
            g_lastDeathAt = now;
            RegisterCounterEvent(-1, "death");
            if (g_inZone) {
                g_inZone = false;
                g_zoneStart = 0;
            }
            if (g_roundActive) {
                g_roundActive = false;
                g_airportTeleportAt = 0;
            }
            eventName = g_lastEvent = "death";
            force = true;
        }
    } else {
        bool playerAlive =
            exists
            && playerHealth > 0
            && PLAYER::IS_PLAYER_PLAYING(player);
        if (playerAlive) {
            if (!g_playerAliveSince) g_playerAliveSince = now;
            if (now - g_playerAliveSince >= 750ULL) {
                g_playerAliveObserved = true;
                g_playerWasDead = false;
            }
        } else {
            g_playerAliveSince = 0;
        }
        bool inZone = exists && PlayerInsideVictoryZone(ped, p);
        if (inZone != g_inZone) {
            g_inZone = inZone;
            g_zoneStart = inZone ? now : 0;
            if (inZone) {
                ++g_zoneEventId;
                if (!g_roundActive && !g_airportTeleportAt) {
                    StartRound("natural-zone-entered");
                    eventName = "natural-zone-entered";
                } else {
                    eventName = "zone-entered";
                }
            } else {
                eventName = "zone-left";
            }
            g_lastEvent = eventName;
            force = true;
        }
        if (
            g_roundActive
            && playerAlive
            && g_playerAliveObserved
            && g_inZone
            && g_zoneStart
            && !g_playerWasDead
            && now - g_zoneStart
                >= static_cast<ULONGLONG>(kVictoryHoldSeconds) * 1000ULL
        ) {
            g_roundActive = false;
            g_won = true;
            ++g_winId;
            RegisterCounterEvent(1, "win");
            g_winDisplayUntil =
                now
                + static_cast<ULONGLONG>(
                    kWinCelebrationSeconds
                ) * 1000ULL;
            g_airportTeleportAt = now + kAirportTeleportDelayMs;
            eventName = g_lastEvent = "win";
            force = true;
        }
    }
    g_lastObservedPlayerPed = ped;
    g_lastObservedPlayerHealth = playerHealth;

    DrawVictoryZone(now, p, exists);
    if (now < g_counterHudUntil && !g_counterHudText.empty()) {
        bool deathHud = g_counterHudText.rfind("MORT", 0) == 0;
        DrawHudText(
            g_counterHudText,
            255,
            deathHud ? 82 : 216,
            deathHud ? 110 : 74
        );
    }
    if (!force && now - g_lastState < 250) return;
    g_lastState = now;
    int remaining = VictorySecondsRemaining(now);
    std::ostringstream json;
    json << "{\"type\":\"montchiliad:victory\",\"event\":\"" << eventName
         << "\",\"lastEvent\":\"" << Escape(g_lastEvent) << "\",\"sessionId\":\"" << Escape(g_sessionId)
         << "\",\"version\":\"" << kVersion << "\",\"edition\":\"enhanced\",\"roundId\":" << g_roundId
         << ",\"winId\":" << g_winId << ",\"roundActive\":" << (g_roundActive ? "true" : "false")
         << ",\"inZone\":" << (g_inZone ? "true" : "false") << ",\"won\":" << (g_won ? "true" : "false")
         << ",\"roundSeconds\":" << kVictoryHoldSeconds << ",\"secondsRemaining\":" << remaining
         << ",\"zoneSecondsRemaining\":" << VictorySecondsRemaining(now)
         << ",\"zoneEventId\":" << g_zoneEventId
         << ",\"holdSeconds\":" << kVictoryHoldSeconds << ",\"victoryRule\":\"hold-circle-10s\",\"winAmount\":1"
         << ",\"counterEventId\":" << g_counterEventId << ",\"counterDelta\":" << g_counterDelta
         << ",\"counterWinCount\":" << g_counterWinCount << ",\"counterDeathCount\":" << g_counterDeathCount
         << ",\"counterEvent\":\"" << Escape(g_counterEvent) << "\""
         << ",\"autoTeleported\":" << (g_autoTeleportedWinner ? "true" : "false")
         << ",\"x\":" << p.x << ",\"y\":" << p.y << ",\"z\":" << p.z << ",\"sentAt\":" << UnixMs() << "}";
    Send(json.str());
}
void ProcessQueue() {
    {
        std::lock_guard<std::mutex> guard(g_queueLock);
        if (g_queue.empty()) return;
    }

    for (int i = 0; i < 32; ++i) {
        Player player = 0;
        Ped ped = 0;
        bool playerReady = PlayerReady(player, ped);
        Request request = {};
        {
            std::lock_guard<std::mutex> guard(g_queueLock);
            if (g_queue.empty()) return;
            if (playerReady) {
                request = g_queue.front();
                g_queue.pop_front();
            } else {
                std::deque<Request>::iterator recovery = std::find_if(g_queue.begin(), g_queue.end(), [](const Request& queued) {
                    std::string code = queued.code;
                    std::transform(code.begin(), code.end(), code.begin(), [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
                    return code == "chaos_exit_prison";
                });
                if (recovery == g_queue.end()) return;
                request = *recovery;
                g_queue.erase(recovery);
            }
        }
        Result result;
        try { result = Execute(request.code); }
        catch (...) { result = {5, "L'interaction a echoue dans GTA Enhanced."}; }
        if (result.status == kEffectRetryStatus) {
            std::lock_guard<std::mutex> guard(g_queueLock);
            g_queue.push_front(request);
            return;
        }
        Reply(request.id, result);
        Log("Effect " + request.code + " returned status " + std::to_string(result.status) + ".");
    }
}
}
void ScriptMain() {
    g_running.store(true);
    g_sessionId = std::to_string(GetCurrentProcessId()) + "-" + std::to_string(UnixMs());
    g_lastEvent = "boot";
    bool expectedNetworkState = false;
    if (g_networkStarted.compare_exchange_strong(expectedNetworkState, true)) {
        HANDLE thread = CreateThread(nullptr, 0, NetworkLoop, nullptr, 0, nullptr);
        if (thread) CloseHandle(thread);
        else g_networkStarted.store(false);
    }
    Log(std::string("Plugin started, version ") + kVersion + ".");
    while (g_running.load()) {
        ULONGLONG now = GetTickCount64();
        ProcessQueue();
        UpdateTimedEffects(now);
        UpdateVictory(now);
        WAIT(0);
    }
    DeleteGiftObjects();
    DeleteTrainVehicle();
    EndPrison();
}
BOOL APIENTRY DllMain(HMODULE module, DWORD reason, LPVOID) {
    if (reason == DLL_PROCESS_ATTACH) {
        g_module = module;
        DisableThreadLibraryCalls(module);
        scriptRegister(module, ScriptMain);
    } else if (reason == DLL_PROCESS_DETACH) {
        g_running.store(false);
        scriptUnregister(module);
    }
    return TRUE;
}
