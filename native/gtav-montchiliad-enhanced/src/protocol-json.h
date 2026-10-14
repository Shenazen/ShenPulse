/** JSON SimpleTCP sans dependance au jeu. */
#pragma once
#include <string>
namespace ShenPulse { namespace MontChiliad {
std::string Escape(const std::string& value);
bool ReadInt(const std::string& json, const char* key, int& value);
bool ReadString(const std::string& json, const char* key, std::string& value);
} }
