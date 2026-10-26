-- ShenPulse: Hogwarts Legacy Game Pass (WinGDK 1.0.16.0). RIP-relative engine lookup.
function Register()
    return '41 8B 41 0C 3B 05 ?? ?? ?? ?? 7D 28 99 0F B7 D2 03 C2 8B C8 0F B7 C0 2B C2 C1 F9 10 48 63 D1 48 8B 0D ?? ?? ?? ?? 48 98 4C 8B 04 D1 48 8D 0C 40 49 8D 1C C8'
end
function OnMatchFound(address)
    local instruction = address + 31
    return instruction + 7 + DerefToInt32(instruction + 3) - 16
end
