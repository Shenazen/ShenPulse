/** Contrats internes GTA : etat unique partage et domaines compiles separement. */
#pragma once
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


#include "protocol-json.h"
namespace ShenPulse { namespace MontChiliad {
struct Request { int id; std::string code; };
struct Result { int status; std::string message; };
struct TimedGiftObject { Entity entity; };
extern const char* kVersion;
extern const unsigned short kPort;
extern const size_t kMaxQueuedRequests;
extern const int kEffectRetryStatus;
extern const char* kGameNotReadyMessage;
extern const Vector3 kMont;
extern const Vector3 kVictoryCenter;
extern const float kVictoryRadius;
extern const float kVictoryMinZ;
extern const float kVictoryMaxZ;
extern const int kWinCelebrationSeconds;
extern const int kVictoryHoldSeconds;
extern const int kAirportTeleportDelayMs;
extern const int kBlackHoleTelegraphMs;
extern const int kBlackHoleDurationMs;
extern const int kTrainTelegraphMs;
extern const int kTrainApproachMs;
extern const int kVehicleFlipDurationMs;
extern const Vector3 kAirport;
extern const Vector3 kTeleports[6];
extern HMODULE g_module;
extern std::atomic<bool> g_running, g_connected, g_networkStarted;
extern SOCKET g_socket;
extern std::mutex g_socketLock, g_queueLock, g_logLock;
extern std::deque<Request> g_queue;
extern std::string g_sessionId, g_lastEvent;
extern ULONGLONG g_lastState, g_roundStart, g_zoneStart, g_airportTeleportAt, g_winDisplayUntil, g_invincibleUntil;
extern ULONGLONG g_superJumpUntil, g_nextSuperJumpBoostAt, g_explosiveAmmoUntil, g_explosiveMeleeUntil;
extern ULONGLONG g_infiniteAmmoUntil, g_drunkUntil, g_slowMotionUntil, g_frozenUntil;
extern ULONGLONG g_prisonUntil, g_blackHoleStartedAt, g_blackHolePullStartsAt, g_blackHoleUntil, g_nextBlackHolePullAt, g_magneticStormUntil, g_danceUntil;
extern ULONGLONG g_trainUntil, g_trainApproachAt, g_trainImpactAt;
extern ULONGLONG g_vehicleFlipStartedAt, g_vehicleFlipUntil;
extern ULONGLONG g_nativeWinMultiplierUntil, g_counterHudUntil;
extern ULONGLONG g_lastDeathAt;
extern ULONGLONG g_playerAliveSince;
extern Entity g_frozenEntity;
extern Entity g_trainTarget;
extern Vehicle g_trainVehicle;
extern Vehicle g_flippingVehicle;
extern Ped g_prisonPed, g_dancePed, g_drunkPed;
extern Vector3 g_prisonCenter;
extern Vector3 g_blackHoleCenter;
extern Vector3 g_trainDirection;
extern Vector3 g_trainSpawnPosition;
extern Vector3 g_vehicleFlipStartRotation;
extern std::vector<Object> g_prisonObjects;
extern std::vector<TimedGiftObject> g_giftObjects;
extern const size_t kMaxGiftObjects;
extern bool g_restoreInvincibility, g_wasInvincible, g_infiniteAmmoActive;
extern bool g_drunkActive, g_slowMotionActive, g_roundActive, g_inZone, g_won;
extern bool g_playerWasDead, g_autoTeleportedWinner;
extern bool g_trainImpactApplied;
extern bool g_vehicleFlipHalfLogged;
extern bool g_playerAliveObserved;
extern Ped g_lastObservedPlayerPed;
extern int g_lastObservedPlayerHealth;
extern int g_roundId, g_winId, g_counterDelta, g_counterEventId, g_zoneEventId;
extern int g_counterWinCount, g_counterDeathCount;
extern int g_nativeWinMultiplier;
extern std::string g_counterEvent;
extern std::string g_counterHudText;
size_t RandomChoiceIndex(size_t count);
Vector3 GameplayCameraForward();
std::string ModuleDir();
void Log(const std::string& message);
void CloseSocket(SOCKET expected = INVALID_SOCKET);
bool Send(const std::string& json);
void QueueFrame(const std::string& frame);
DWORD WINAPI NetworkLoop(LPVOID);
bool PlayerReady(Player& player, Ped& ped);
bool CurrentPlayerVehicle(Ped ped, Vehicle& vehicle);
Entity PlayerTarget(Ped ped);
void Teleport(Entity target, const Vector3& p);
void TeleportPlayer(Ped ped, const Vector3& p);
bool PointInsideVictoryZone(const Vector3& p);
bool PlayerInsideVictoryZone(Ped ped, Vector3& trackedPosition);
void RegisterCounterEvent(int amount, const char* eventName);
void ResetVictoryZoneEntry();
float Distance2D(const Vector3& a, const Vector3& b);
void DeletePrisonObjects();
void DeleteGiftObject(Entity entity);
void DeleteGiftObjects();
void CleanupGiftObjects(ULONGLONG);
void EndPrison();
bool TryCreatePrisonPanel(Hash model, const Vector3& center, float x, float y, float heading);
void CreatePrisonCage(const Vector3& center);
Result StartPrison(Ped ped);
void DrawPrisonStatus(ULONGLONG now);
Result ArmPeds(Ped playerPed);
Vehicle CurrentVehicle(Ped ped);
Result RequireVehicle(Ped ped, Vehicle& vehicle);
Result ForcePlayerRagdoll(Ped ped, int durationMs);
Result StartDrunkEffect(Ped ped, int durationMs);
Result StartSuperJumpEffect(Ped ped, int durationMs);
Result SpawnVehicleForPlayer(Hash model, const char* label = nullptr);
Result AffectNearbyVehicles(Ped playerPed, bool explode, bool launch);
Hash HashName(const char* name);
Hash RandomHash(const Hash* values, size_t count);
Result LoadModel(Hash model, const char* label);
int SpawnAmbientChaosVehicles(Ped playerPed, std::vector<Vehicle>& targets, int requestedCount);
Result SpawnHostilePeds(Ped playerPed, const Hash* models, size_t modelCount, int requestedCount, const char* label);
int GiftTier(const std::string& code);
bool GiftCodeContainsAny(const std::string& code, const char* const* keywords, size_t keywordCount);
float GiftMarkerScale(int tier, float baseScale = 0.55f);
void AddGiftEntity(Entity entity, int red, int green, int blue, float markerScale);
Entity GiftTarget(Ped playerPed);
Vector3 GiftPosition(Entity target, float forward, float up, float sideStep);
Result SpawnGiftObject(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale = 0.55f, float forward = 4.2f, float up = 1.25f);
Result SpawnGiftPed(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward, float up);
Result SpawnGiftVehicle(Ped playerPed, const char* label, const char* const* modelNames, size_t modelCount, int red, int green, int blue, float markerScale, float forward = 7.0f, float up = 1.0f, bool airborne = false);
Result SpawnGiftPedOrObject(Ped playerPed, const char* label, const char* const* pedModels, size_t pedModelCount, const char* const* objectModels, size_t objectModelCount, int red, int green, int blue, float markerScale, float forward, float up);
Result SpawnGiftVehicleOrObject(Ped playerPed, const char* label, const char* const* vehicleModels, size_t vehicleModelCount, const char* const* objectModels, size_t objectModelCount, int red, int green, int blue, float markerScale, float forward = 7.0f, float up = 1.0f, bool airborne = false);
Result SpawnTikTokGiftObject(Ped playerPed, const std::string& code);
Result SpawnFriendlyAnimal(Ped playerPed);
Result PullNearbyVehicles(Ped playerPed, bool upward, bool ensureTargets = false);
bool PullEntityIntoBlackHole(Entity entity, Entity playerTarget);
int PullWorldIntoBlackHole(Ped playerPed);
void DrawBlackHole();
void DeleteTrainVehicle();
Result StartTrainHit(Ped playerPed);
void UpdateTrainHit(ULONGLONG now, Ped playerPed);
Result SpawnVehicleAbovePlayer(Ped playerPed, Hash model, const char* label);
Result Execute(std::string code);
void Reply(int id, const Result& result);
long long UnixMs();
void StartRound(const char* eventName);
void UpdateVehicleFlip(ULONGLONG now);
void UpdateTimedEffects(ULONGLONG now);
void DrawHudText(const std::string& message, int red, int green, int blue);
int VictorySecondsRemaining(ULONGLONG now);
std::string FormatRoundTime(int seconds);
void DrawVictoryZone(ULONGLONG now, const Vector3& playerPosition, bool playerExists);
void UpdateVictory(ULONGLONG now);
void ProcessQueue();
} }
