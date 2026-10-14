/** Tests executables du JSON SimpleTCP ; aucun SDK GTA ni connexion reseau. */
#include "../src/protocol-json.h"
#include <cassert>
#include <cstdio>
using namespace ShenPulse::MontChiliad;

int main() {
    int value = 0;
    std::string text;
    assert(ReadInt("{\"id\":42}", "id", value) && value == 42);
    assert(ReadInt("{\"id\": -17}", "id", value) && value == -17);
    assert(ReadInt("{\"id\":2147483647}", "id", value) && value == 2147483647);
    assert(!ReadInt("{\"id\":2147483648}", "id", value));
    assert(!ReadInt("{\"id\":-2147483648}", "id", value));
    assert(!ReadInt("{\"id\":\"42\"}", "id", value));
    assert(!ReadInt("{}", "id", value));
    assert(ReadString("{\"code\":\"a\\n\\r\\t\\\"\\\\\\/b\"}", "code", text));
    assert(text == "a\n\r\t\"\\/b");
    assert(!ReadString("{\"code\":\"\\u0041\"}", "code", text));
    assert(!ReadString("{\"code\":\"unfinished}", "code", text));
    assert(Escape("a\n\r\t\"\\") == "a\\n\\r\\t\\\"\\\\");
    assert(Escape(std::string("a\x01") + "b") == "ab");
    std::puts("GTA JSON : 13 assertions reussies.");
    return 0;
}
