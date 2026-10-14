/** Domaine platform ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
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

long long UnixMs() {
    FILETIME ft = {};
    GetSystemTimeAsFileTime(&ft);
    ULARGE_INTEGER value = {};
    value.LowPart = ft.dwLowDateTime;
    value.HighPart = ft.dwHighDateTime;
    return static_cast<long long>((value.QuadPart - 116444736000000000ULL) / 10000ULL);
}
} }
