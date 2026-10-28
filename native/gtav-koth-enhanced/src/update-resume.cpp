#include "runtime.h"
namespace ShenPulse { namespace Koth {
// Used only by an explicitly prepared, short-lived update checkpoint. It never
// alters the ramp settings and is consumed once after the new ramp is ready.
bool RestoreAfterUpdate(){
 wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return false;std::wstring file=std::wstring(local)+L"\\ShenPulse\\GtaMode\\update-resume.ini";
 if(GetFileAttributesW(file.c_str())==INVALID_FILE_ATTRIBUTES)return false;
 int percent=GetPrivateProfileIntW(L"Resume",L"basisPoints",-1,file.c_str()),expectedAngle=GetPrivateProfileIntW(L"Resume",L"angle",-1,file.c_str()),expectedSections=GetPrivateProfileIntW(L"Resume",L"sections",-1,file.c_str());
 wchar_t expiry[32];GetPrivateProfileStringW(L"Resume",L"expires",L"0",expiry,32,file.c_str());unsigned long long expires=_wcstoui64(expiry,nullptr,10);FILETIME ft;GetSystemTimeAsFileTime(&ft);ULARGE_INTEGER time;time.LowPart=ft.dwLowDateTime;time.HighPart=ft.dwHighDateTime;unsigned long long now=(time.QuadPart-116444736000000000ULL)/10000000ULL;
 DeleteFileW(file.c_str());if(percent<0||percent>9700||expires<now||expires>now+1800||expectedAngle!=static_cast<int>(ramp.angle)||expectedSections!=sections)return false;
 Ped ped=PLAYER::PLAYER_PED_ID();Point p=ramp.at(0,ramp.length*percent/10000.0f,1.5f);ENTITY::SET_ENTITY_COORDS_NO_OFFSET(ped,p.x,p.y,p.z,FALSE,FALSE,TRUE);ENTITY::SET_ENTITY_HEADING(ped,0);ENTITY::SET_ENTITY_VELOCITY(ped,0,0,0);Log("Update checkpoint restored without changing ramp settings");return true;
}
} }
