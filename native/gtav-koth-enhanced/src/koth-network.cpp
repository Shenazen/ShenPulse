#include "runtime.h"
namespace ShenPulse { namespace Koth {
std::atomic<bool> running{true},connected{false};
std::mutex queueLock,sendLock;
std::deque<Request> requests;
SOCKET socketHandle=INVALID_SOCKET;
std::string session;
static bool overflow=false;
void Log(const std::string& value){
 wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return;std::wstring path=std::wstring(local)+L"\\ShenPulse\\GtaMode\\ShenPulseKoth.log";std::ofstream file(path.c_str(),std::ios::app);file<<GetTickCount64()<<" "<<value<<std::endl;
}
bool Send(const std::string& value){
 std::lock_guard<std::mutex> lock(sendLock);
 if(socketHandle==INVALID_SOCKET)return false;
 std::string frame=value;frame.push_back(0);size_t offset=0;
 while(offset<frame.size()){int n=send(socketHandle,frame.data()+offset,static_cast<int>(frame.size()-offset),0);if(n<=0)return false;offset+=n;}return true;
}
static void Frame(const std::string& json){
 int id=-1,quantity=1,duration=0;std::string code;
 if(!ReadInt(json,"id",id)||id<0||!ReadString(json,"code",code)||code.size()>96)return;
 ReadInt(json,"quantity",quantity);ReadInt(json,"duration",duration);
 if(quantity<1||quantity>100){Send("{\"id\":"+std::to_string(id)+",\"status\":3,\"message\":\"Choisissez entre 1 et 100 obstacles par interaction.\"}");return;}
 std::lock_guard<std::mutex> lock(queueLock);
 if(requests.size()>=250){Send("{\"id\":"+std::to_string(id)+",\"status\":3,\"message\":\"File KOTH pleine, reessayez.\"}");return;}
 Request request{id,code,quantity,std::max(0,std::min(3600,duration))};
 ReadInt(json,"audit",request.audit);ReadInt(json,"restartRound",request.restartRound);ReadInt(json,"angle",request.angle);ReadInt(json,"sections",request.sections);ReadInt(json,"design",request.design);ReadInt(json,"animated",request.animated);requests.push_back(request);
}
void Network(){
 WSADATA wsa{};if(WSAStartup(MAKEWORD(2,2),&wsa)!=0)return;
 while(running){
  SOCKET next=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);if(next==INVALID_SOCKET){Sleep(500);continue;}
  DWORD timeout=1000;BOOL yes=TRUE;
  setsockopt(next,SOL_SOCKET,SO_RCVTIMEO,reinterpret_cast<char*>(&timeout),sizeof(timeout));
  setsockopt(next,SOL_SOCKET,SO_SNDTIMEO,reinterpret_cast<char*>(&timeout),sizeof(timeout));
  setsockopt(next,IPPROTO_TCP,TCP_NODELAY,reinterpret_cast<char*>(&yes),sizeof(yes));
  sockaddr_in addr{};addr.sin_family=AF_INET;addr.sin_port=htons(58469);inet_pton(AF_INET,"127.0.0.1",&addr.sin_addr);
  if(connect(next,reinterpret_cast<sockaddr*>(&addr),sizeof(addr))==SOCKET_ERROR){closesocket(next);Sleep(500);continue;}
  {std::lock_guard<std::mutex> lock(sendLock);socketHandle=next;}
  connected=true;Log("Connected to ShenPulse 127.0.0.1:58469");
  std::string buffer;char block[4096];overflow=false;
  while(running){
   int n=recv(next,block,sizeof(block),0);if(n==SOCKET_ERROR&&WSAGetLastError()==WSAETIMEDOUT)continue;if(n<=0)break;
   for(int i=0;i<n;i++){if(block[i]==0){if(!overflow)Frame(buffer);buffer.clear();overflow=false;}else if(!overflow){if(buffer.size()<65536)buffer+=block[i];else{buffer.clear();overflow=true;}}}
  }
  connected=false;
  {std::lock_guard<std::mutex> lock(sendLock);socketHandle=INVALID_SOCKET;}
  shutdown(next,SD_BOTH);closesocket(next);Sleep(500);
 }
 WSACleanup();
}
bool Selected(){
 wchar_t local[MAX_PATH],modulePath[32768],mode[32],installation[32768];HMODULE module=nullptr;
 if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return false;
 std::wstring config=std::wstring(local)+L"\\ShenPulse\\GtaMode\\selection.ini";
 GetPrivateProfileStringW(L"ShenPulse",L"mode",L"montchiliad",mode,32,config.c_str());
 if(std::wstring(mode)!=L"koth")return false;
 GetPrivateProfileStringW(L"ShenPulse",L"installation",L"",installation,32768,config.c_str());
 if(!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(&Selected),&module))return false;
 GetModuleFileNameW(module,modulePath,32768);
 std::wstring root=modulePath;root=root.substr(0,root.find_last_of(L"\\/"));
 return !root.empty()&&_wcsicmp(root.c_str(),installation)==0;
}
void Stop(){running=false;}
void Run(){
 session=std::to_string(GetCurrentProcessId())+"-"+std::to_string(GetTickCount64());
 LoadSettings();ReadRoundSettings(GetTickCount64());
 HANDLE thread=CreateThread(nullptr,0,[](LPVOID)->DWORD{Network();return 0;},nullptr,0,nullptr);if(thread)CloseHandle(thread);
 Log("SHENPULSE_GTA_KOTH_1 - native KOTH active");
 ULONGLONG nextBuild=0;
 while(running){
  Ped ped;bool ready=Ready(ped);
  if(ready){
   if(!active&&!won&&connected&&GetTickCount64()>=nextBuild){Result result=Build();nextBuild=GetTickCount64()+(result.status?30000:10000);if(result.status)Log(result.message);}
   Menu();
   for(int count=0;count<4;count++){
    Request request;
    {std::lock_guard<std::mutex> lock(queueLock);if(requests.empty())break;request=requests.front();requests.pop_front();}
    Result result=Execute(request);
    Send("{\"id\":"+std::to_string(request.id)+",\"status\":"+std::to_string(result.status)+",\"message\":\""+Escape(result.message)+"\"}");
    Log(request.code+" status="+std::to_string(result.status)+" "+result.message);
   }
  }else{
   // A menu or loading screen must not turn a temporary input effect into a permanent lock.
   if(frozen&&ENTITY::DOES_ENTITY_EXIST(frozen)){ENTITY::FREEZE_ENTITY_POSITION(frozen,FALSE);frozen=0;}
   freezeUntil=0;
  }
  Tick(GetTickCount64());WAIT(0);
 }
 ClearObstacles();ClearRamp();
}
} }
