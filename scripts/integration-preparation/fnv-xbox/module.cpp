#define WIN32_LEAN_AND_MEAN
#define _WINSOCK_DEPRECATED_NO_WARNINGS
#include <winsock2.h>
#include <windows.h>
#include <stdio.h>
#include <string>
#include <mutex>
#include <deque>
#include <map>
#include <set>
#include <algorithm>
#include "vendor/json.hpp"
#include "effects.hpp"
#include "profile.hpp"
using json=nlohmann::json;
static HMODULE module;static HWND gameWindow;static WNDPROC prior;static UINT messageId=WM_APP+0x53b;static SOCKET client=INVALID_SOCKET;static std::mutex wire,queueLock;static std::deque<json> queue;static std::map<int,json> completed;static std::string consolePath;
static bool godActive=false,godBefore=false,slowActive=false;static float speedBefore=1;static ULONGLONG godUntil=0,slowUntil=0;
typedef void(__thiscall* VoidFn)(void*);typedef void(__thiscall* TextFn)(void*,const char*);typedef void*(__cdecl* GetFn)(bool);typedef void(__thiscall* RunFn)(void*,void*,bool,void*);typedef bool(__cdecl* BoolFn)();typedef void(__cdecl* SetBoolFn)(bool);typedef void(__thiscall* SpeedFn)(void*,float,bool);
static bool profile(){return matchesProfile((unsigned char*)GetModuleHandleW(nullptr));}
static bool nativeLine(const char* line){alignas(16) unsigned char script[0x60]={};void* console=((GetFn)0x71afe0)(true);if(!console)return false;((VoidFn)0x5aab40)(script);((VoidFn)0x484c60)(script);((TextFn)0x5ac8d0)(script,line);((RunFn)0x5ace80)(script,*(void**)console,true,nullptr);unsigned length=*(unsigned*)(script+0x20);((VoidFn)0x5aabf0)(script);return length>4;}
static bool safeLine(const char* line,bool echo=false){bool before=*(bool*)0x11ee3cc;bool result=false;__try{__try{*(bool*)0x11ee3cc=echo;result=nativeLine(line);}__finally{*(bool*)0x11ee3cc=before;}}__except(EXCEPTION_EXECUTE_HANDLER){return false;}return result;}
static bool menu(){return ((BoolFn)0x702150)();}static bool god(){return ((BoolFn)0x951b90)();}static float speed(){return *(float*)0x11a91c8;}
static void restoreGod(){if(!godActive)return;((SetBoolFn)0x951b80)(godBefore);godActive=false;}
static void restoreSpeed(){if(!slowActive)return;if(speed()==0.5f)((SpeedFn)0xaa1d70)((void*)0x11f2fcc,speedBefore,true);slowActive=false;}
static std::string output(){FILE*f=nullptr;fopen_s(&f,consolePath.c_str(),"rb");if(!f)return "";std::string result;char text[1024];size_t n;while((n=fread(text,1,sizeof(text),f))&&result.size()<16000)result.append(text,n);fclose(f);return result;}
static json response(int id,int status,const std::string& message){return {{"id",id},{"status",status},{"message",message}};}
static json execute(const json& request){
 int id=request.value("id",-1);std::string code=request.value("code","");if(id<0)return response(id,1,"Requête invalide");
 unsigned duration=(unsigned)std::clamp(request.value("duration",30000),1000,600000);bool diagnostic=code=="shenpulse_status";if(!diagnostic&&completed.count(id))return completed[id];
 if(!diagnostic&&menu())return response(id,3,"Chargez une partie et fermez les menus.");
 if(code=="playerkill"&&god())return response(id,3,"Attendez la fin de l’invincibilité avant cet effet.");auto entry=effects.find(code);if(!diagnostic&&entry==effects.end()&&code!="godmode"&&code!="slowmo")return response(id,1,"Interaction inconnue");
 void* console=((GetFn)0x71afe0)(true);if(!console)return response(id,3,"Moteur indisponible");
 char previous[260]={};memcpy(previous,(char*)console+0x810,259);((TextFn)0x71dc00)(console,consolePath.c_str());FILE*reset=nullptr;fopen_s(&reset,consolePath.c_str(),"wb");if(reset)fclose(reset);
 bool applied=true;
 if(diagnostic){
  if(!menu()){
   auto p=request.value("parameters",json::object());std::string form=p.value("form","0000000F");
   if(forms.count(form))applied=safeLine(("player.getitemcount "+form).c_str(),true);
   applied=safeLine("player.getav health",true)&&applied;applied=safeLine("player.getdead",true)&&applied;
   if(p.value("limbs",false))for(auto limb:{"leftattackcondition","rightattackcondition","leftmobilitycondition","rightmobilitycondition"})applied=safeLine((std::string("player.getav ")+limb).c_str(),true)&&applied;
  }
 }else if(code=="godmode"){
  if(!godActive)godBefore=god();((SetBoolFn)0x951b80)(true);godActive=true;godUntil=GetTickCount64()+duration;applied=god();
 }else if(code=="slowmo"){
  if(!slowActive)speedBefore=speed();((SpeedFn)0xaa1d70)((void*)0x11f2fcc,0.5f,true);slowActive=true;slowUntil=GetTickCount64()+duration;applied=speed()==0.5f;
 }else for(auto&line:entry->second)if(!safeLine(line.c_str())){applied=false;break;}
 std::string text=output();((TextFn)0x71dc00)(console,previous[0]?previous:nullptr);
 if(diagnostic)return response(id,applied?0:1,json({{"menu",menu()},{"godmode",god()},{"timeScale",speed()},{"godActive",godActive},{"slowActive",slowActive},{"console",text}}).dump(-1,' ',false,json::error_handler_t::replace));
 json result=response(id,applied?0:1,applied?"Interaction appliquée":"Commande refusée par le moteur");result["console"]=text;if(applied){completed[id]=result;if(completed.size()>128)completed.erase(completed.begin());}return result;
}
static void sendResponse(const json& message){std::string bytes=message.dump(-1,' ',false,json::error_handler_t::replace);bytes.push_back(0);std::lock_guard<std::mutex> guard(wire);if(client==INVALID_SOCKET)return;size_t p=0;while(p<bytes.size()){int n=send(client,bytes.data()+p,(int)(bytes.size()-p),0);if(n<=0)break;p+=n;}}
static void tick(){ULONGLONG now=GetTickCount64();if(godActive&&now>=godUntil)restoreGod();if(slowActive&&now>=slowUntil)restoreSpeed();json request;{std::lock_guard<std::mutex> guard(queueLock);if(queue.empty())return;request=queue.front();queue.pop_front();}try{if(request.value("code","")=="shenpulse_disconnect"){restoreGod();restoreSpeed();completed.clear();return;}sendResponse(execute(request));}catch(...){sendResponse(response(request.value("id",-1),1,"Requête invalide"));}}
static VOID CALLBACK timer(HWND,UINT,UINT_PTR,DWORD){tick();}
static LRESULT CALLBACK hook(HWND h,UINT m,WPARAM w,LPARAM l){if(m==messageId){if(SetTimer(h,0x5350,100,timer)){wchar_t name[100];swprintf_s(name,L"Local\\ShenPulse.Fnv.Ready.%u",GetCurrentProcessId());HANDLE ready=CreateEventW(nullptr,TRUE,FALSE,name);if(ready)SetEvent(ready);}return 0;}return CallWindowProcW(prior,h,m,w,l);}
static BOOL CALLBACK findWindow(HWND h,LPARAM){DWORD pid=0;GetWindowThreadProcessId(h,&pid);if(pid==GetCurrentProcessId()&&IsWindowVisible(h)&&GetWindow(h,GW_OWNER)==nullptr){gameWindow=h;return FALSE;}return TRUE;}
static DWORD WINAPI start(void*){
 if(!profile())return 0;wchar_t file[MAX_PATH];GetModuleFileNameW(module,file,MAX_PATH);wchar_t* p=wcsrchr(file,L'\\');if(!p)return 0;wcscpy_s(p+1,MAX_PATH-(p+1-file),L"console.log");char ansi[1024];WideCharToMultiByte(CP_ACP,0,file,-1,ansi,sizeof(ansi),nullptr,nullptr);consolePath=ansi;
 EnumWindows(findWindow,0);if(!gameWindow)return 0;prior=(WNDPROC)SetWindowLongPtrW(gameWindow,GWLP_WNDPROC,(LONG_PTR)hook);if(!prior)return 0;PostMessageW(gameWindow,messageId,0,0);
 WSADATA data;if(WSAStartup(MAKEWORD(2,2),&data))return 0;
 while(IsWindow(gameWindow)){
  SOCKET s=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);sockaddr_in addr={};addr.sin_family=AF_INET;addr.sin_port=htons(5422);addr.sin_addr.s_addr=inet_addr("127.0.0.1");if(connect(s,(sockaddr*)&addr,sizeof(addr))){closesocket(s);Sleep(1500);continue;}
  DWORD timeout=500;setsockopt(s,SOL_SOCKET,SO_SNDTIMEO,(const char*)&timeout,sizeof(timeout));{std::lock_guard<std::mutex> guard(wire);client=s;}std::string buffer;char bytes[8192];int n;
  while((n=recv(s,bytes,sizeof(bytes),0))>0){buffer.append(bytes,n);if(buffer.size()>65536)break;size_t end;while((end=buffer.find('\0'))!=std::string::npos){std::string frame=buffer.substr(0,end);buffer.erase(0,end+1);try{json request=json::parse(frame);if(request.is_object()&&request.contains("id")){std::lock_guard<std::mutex> guard(queueLock);if(queue.size()<64)queue.push_back(request);}}catch(...){}}}
  {std::lock_guard<std::mutex> guard(wire);client=INVALID_SOCKET;}closesocket(s);{std::lock_guard<std::mutex> guard(queueLock);queue.clear();queue.push_back({{"id",0},{"code","shenpulse_disconnect"}});}Sleep(1500);
 }
 return 0;
}
BOOL WINAPI DllMain(HMODULE h,DWORD reason,LPVOID){if(reason==DLL_PROCESS_ATTACH){module=h;DisableThreadLibraryCalls(h);HANDLE t=CreateThread(nullptr,0,start,nullptr,0,nullptr);if(t)CloseHandle(t);}return TRUE;}
