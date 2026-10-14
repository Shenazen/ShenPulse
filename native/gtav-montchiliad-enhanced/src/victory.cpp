/** Domaine victory ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
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
} }
