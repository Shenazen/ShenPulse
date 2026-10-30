#pragma once
#include <stdint.h>
struct Fingerprint {uintptr_t address;uint32_t hash;};
static const Fingerprint fingerprints[]={{0x5aab40,0x7270b1d3},{0x484c60,0xf63833c3},{0x5ac8d0,0xb03b34cd},{0x5ace80,0x53c737ea},{0x5aabf0,0x7270b1d3},{0x71afe0,0xa55637cd},{0x71dc00,0xe9401d6b},{0x702150,0xe2cfe5fc},{0x951b80,0x4a4fb908},{0x951b90,0x3b61b144},{0xaa1d70,0xe1f32017}};
static uint32_t fingerprint(const unsigned char* p){uint32_t h=2166136261u;for(int i=0;i<32;i++)h=(h^p[i])*16777619u;return h;}
static bool matchesProfile(const unsigned char* b){if(b!=(void*)0x400000)return false;auto dos=(IMAGE_DOS_HEADER*)b;if(dos->e_magic!=IMAGE_DOS_SIGNATURE||dos->e_lfanew<64||dos->e_lfanew>4096)return false;auto pe=(IMAGE_NT_HEADERS*)(b+dos->e_lfanew);if(pe->Signature!=IMAGE_NT_SIGNATURE||pe->OptionalHeader.SizeOfImage!=0x1006000)return false;for(auto p:fingerprints)if(fingerprint((unsigned char*)p.address)!=p.hash)return false;return true;}
