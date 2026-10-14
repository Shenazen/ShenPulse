/** Domaine protocol-json ; comportements natifs conserves. */
#include "protocol-json.h"
#include <cctype>
namespace ShenPulse { namespace MontChiliad {
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
} }
