#include "runtime.h"
// Points d entree ScriptHook et Windows : ABI conservee.
using namespace ShenPulse::MontChiliad;
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
