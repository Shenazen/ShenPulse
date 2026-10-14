/** Definitions uniques : valeurs historiques conservees. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
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
} }
