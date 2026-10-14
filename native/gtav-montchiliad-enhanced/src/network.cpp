/** Domaine network ; comportements natifs conserves. */
#include "runtime.h"
namespace ShenPulse { namespace MontChiliad {
void CloseSocket(SOCKET expected) {
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

void Reply(int id, const Result& result) {
    std::ostringstream json;
    json << "{\"id\":" << id << ",\"status\":" << result.status << ",\"message\":\"" << Escape(result.message) << "\"}";
    Send(json.str());
}
} }
