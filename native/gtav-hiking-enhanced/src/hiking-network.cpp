#include "runtime.h"
namespace ShenPulse { namespace Hiking {
std::atomic<bool> running{true},connected{false};
std::mutex queueLock,sendLock;
std::deque<Request> requests;
SOCKET socketHandle=INVALID_SOCKET;
std::string session;
static bool overflow=false;
void Log(const std::string& value){
 wchar_t local[MAX_PATH];if(!GetEnvironmentVariableW(L"LOCALAPPDATA",local,MAX_PATH))return;std::wstring path=std::wstring(local)+L"\\ShenPulse\\GtaMode\\ShenPulseHiking.log";std::ofstream file(path.c_str(),std::ios::app);file<<GetTickCount64()<<" "<<value<<std::endl;
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
 if(requests.size()>=250){Send("{\"id\":"+std::to_string(id)+",\"status\":3,\"message\":\"File Hiking pleine, reessayez.\"}");return;}
 Request request;request.id=id;request.code=code;request.quantity=quantity;request.duration=std::max(0,std::min(3600,duration));
 ReadString(json,"viewer",request.viewer);request.viewer=request.viewer.substr(0,40);request.viewer.erase(std::remove(request.viewer.begin(),request.viewer.end(),'~'),request.viewer.end());ReadInt(json,"restartRound",request.restartRound);requests.push_back(request);
}
void Network(){
 WSADATA wsa{};if(WSAStartup(MAKEWORD(2,2),&wsa)!=0)return;
 while(running){
  SOCKET next=socket(AF_INET,SOCK_STREAM,IPPROTO_TCP);if(next==INVALID_SOCKET){Sleep(500);continue;}
  DWORD timeout=1000;BOOL yes=TRUE;
  setsockopt(next,SOL_SOCKET,SO_RCVTIMEO,reinterpret_cast<char*>(&timeout),sizeof(timeout));
  setsockopt(next,SOL_SOCKET,SO_SNDTIMEO,reinterpret_cast<char*>(&timeout),sizeof(timeout));
  setsockopt(next,IPPROTO_TCP,TCP_NODELAY,reinterpret_cast<char*>(&yes),sizeof(yes));
  sockaddr_in addr{};addr.sin_family=AF_INET;addr.sin_port=htons(58470);inet_pton(AF_INET,"127.0.0.1",&addr.sin_addr);
  if(connect(next,reinterpret_cast<sockaddr*>(&addr),sizeof(addr))==SOCKET_ERROR){closesocket(next);Sleep(500);continue;}
  {std::lock_guard<std::mutex> lock(sendLock);socketHandle=next;}
  connected=true;Log("Connected to ShenPulse 127.0.0.1:58470");
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
 if(std::wstring(mode)!=L"hiking")return false;
 GetPrivateProfileStringW(L"ShenPulse",L"installation",L"",installation,32768,config.c_str());
 if(!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(&Selected),&module))return false;
 GetModuleFileNameW(module,modulePath,32768);
 std::wstring root=modulePath;root=root.substr(0,root.find_last_of(L"\\/"));
 return !root.empty()&&_wcsicmp(root.c_str(),installation)==0;
}
void Stop(){running=false;}

void Run(){session=std::to_string(GetCurrentProcessId())+"-"+std::to_string(GetTickCount64());LoadRoute();ReadSettings(GetTickCount64());HANDLE thread=CreateThread(nullptr,0,[](LPVOID)->DWORD{Network();return 0;},nullptr,0,nullptr);if(thread)CloseHandle(thread);Log("SHENPULSE_GTA_HIKING_1 - native Hiking active");while(running){Ped ped;if(Ready(ped)){Menu();for(int i=0;i<4;i++){Request request;{std::lock_guard<std::mutex> lock(queueLock);if(requests.empty())break;request=requests.front();requests.pop_front();}auto result=Execute(request);Send("{\"id\":"+std::to_string(request.id)+",\"status\":"+std::to_string(result.status)+",\"message\":\""+Escape(result.message)+"\"}");Log(request.code+" status="+std::to_string(result.status)+" "+result.message);}}Tick(GetTickCount64());WAIT(0);}ClearActors();if(checkpointBlip)UI::REMOVE_BLIP(&checkpointBlip);}
void Publish(){const auto now=GetTickCount64();Ped ped=PLAYER::PLAYER_PED_ID();Point p=Position(ped);const char* status=progress.running?"running":progress.outcome==1?"won":progress.outcome==-2?"timeout":progress.outcome==-1?"lost":"stopped";auto remaining=[&](ULONGLONG until){return until>now?until-now:0;};std::ostringstream out;out<<"{\"type\":\"hiking:state\",\"sessionId\":\""<<Escape(session)<<"\",\"counterEventId\":"<<eventId<<",\"counterDelta\":"<<eventDelta<<",\"counterEvent\":\""<<eventName<<"\",\"roundId\":"<<roundId<<",\"roundStatus\":\""<<status<<"\",\"roundDurationSeconds\":"<<durationSeconds<<",\"roundRemainingMs\":"<<progress.remaining(now)<<",\"roundElapsedMs\":"<<(progress.running?now-progress.started:0)<<",\"roundAutoRestart\":"<<(autoRestart?"true":"false")<<",\"checkpoint\":"<<progress.passed<<",\"checkpointCount\":"<<route.size()<<",\"playerHealth\":"<<ENTITY::GET_ENTITY_HEALTH(ped)<<",\"playerInvincible\":"<<(PLAYER::GET_PLAYER_INVINCIBLE(PLAYER::PLAYER_ID())?"true":"false")<<",\"playerRagdoll\":"<<(PED::IS_PED_RAGDOLL(ped)?"true":"false")<<",\"playerX\":"<<p.x<<",\"playerY\":"<<p.y<<",\"playerZ\":"<<p.z<<",\"allowDriving\":"<<(allowDriving?"true":"false")<<",\"actors\":[";bool first=true;for(const auto& a:actors){if(!first)out<<",";first=false;out<<"{\"pedType\":"<<PED::GET_PED_TYPE(a.ped)<<",\"distance\":"<<Distance(Position(a.ped),p)<<",\"combat\":"<<(PED::IS_PED_IN_COMBAT(a.ped,ped)?"true":"false")<<",\"model\":"<<ENTITY::GET_ENTITY_MODEL(a.ped)<<",\"name\":\""<<Escape(a.name)<<"\",\"friendly\":"<<(a.friendly?"true":"false")<<",\"onFire\":"<<(FIRE::IS_ENTITY_ON_FIRE(a.ped)?"true":"false")<<"}";}out<<"],\"effectState\":{\"sprintRemainingMs\":"<<remaining(sprintUntil)<<",\"quakeRemainingMs\":"<<remaining(quakeUntil)<<",\"jumpRemainingMs\":"<<remaining(MontChiliad::g_superJumpUntil)<<",\"shieldRemainingMs\":"<<remaining(MontChiliad::g_invincibleUntil)<<",\"blackHoleRemainingMs\":"<<remaining(MontChiliad::g_blackHoleUntil)<<"}}";Send(out.str());}
} }
