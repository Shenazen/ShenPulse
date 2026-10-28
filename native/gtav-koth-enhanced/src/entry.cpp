#include "runtime.h"
#include "../../gtav-hiking-enhanced/src/hiking.h"
// Compile the existing Mont Chiliad entry unchanged under internal names.
// Only this entry is registered, so one GTA process runs exactly one mode.
#define ScriptMain MontChiliadScriptMain
#define DllMain MontChiliadDllMain
#include "../../gtav-montchiliad-enhanced/src/ShenPulseMontChiliadEnhanced.cpp"
#undef ScriptMain
#undef DllMain
void ScriptMain(){
 if(ShenPulse::Hiking::Selected())ShenPulse::Hiking::Run();
 else if(ShenPulse::Koth::Selected())ShenPulse::Koth::Run();
 else MontChiliadScriptMain();
}
BOOL APIENTRY DllMain(HMODULE module,DWORD reason,LPVOID){
 if(reason==DLL_PROCESS_ATTACH){
  ShenPulse::MontChiliad::g_module=module;
  DisableThreadLibraryCalls(module);scriptRegister(module,ScriptMain);
 }else if(reason==DLL_PROCESS_DETACH){
  ShenPulse::Hiking::Stop();ShenPulse::Koth::Stop();ShenPulse::MontChiliad::g_running.store(false);scriptUnregister(module);
 }
 return TRUE;
}
