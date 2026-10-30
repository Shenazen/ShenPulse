// Loads only the adjacent verified ShenPulse module into the selected owned Xbox game.
#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <tlhelp32.h>
#include <bcrypt.h>
#include <stdio.h>
#include <string>
#include "profile.hpp"
#include "module-hash.hpp"

static std::wstring normalized(const std::wstring& value) {
 HANDLE h=CreateFileW(value.c_str(),0,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,nullptr,OPEN_EXISTING,FILE_FLAG_BACKUP_SEMANTICS,nullptr);
 wchar_t result[4096]={};DWORD n=h==INVALID_HANDLE_VALUE?0:GetFinalPathNameByHandleW(h,result,4096,0);
 if(h!=INVALID_HANDLE_VALUE)CloseHandle(h);
 if(!n||n>=4096)return L"";
 std::wstring out=result;for(auto& c:out)c=(wchar_t)towlower(c);while(out.back()==L'\\')out.pop_back();return out;
}
static bool verifiedModule(const std::wstring& file) {
 FILE* f=nullptr;if(_wfopen_s(&f,file.c_str(),L"rb")||!f)return false;
 BCRYPT_ALG_HANDLE algorithm=nullptr;BCRYPT_HASH_HANDLE hash=nullptr;unsigned char digest[32];bool ok=false;
 if(BCryptOpenAlgorithmProvider(&algorithm,BCRYPT_SHA256_ALGORITHM,nullptr,0)>=0&&BCryptCreateHash(algorithm,&hash,nullptr,0,nullptr,0,0)>=0){
  unsigned char bytes[8192];size_t n;ok=true;while((n=fread(bytes,1,sizeof(bytes),f))>0)if(BCryptHashData(hash,bytes,(ULONG)n,0)<0){ok=false;break;}
  if(ferror(f)||BCryptFinishHash(hash,digest,32,0)<0)ok=false;
  char text[65]={};for(int i=0;i<32;i++)sprintf_s(text+i*2,3,"%02x",digest[i]);ok=ok&&strcmp(text,moduleHash)==0;
 }
 if(hash)BCryptDestroyHash(hash);if(algorithm)BCryptCloseAlgorithmProvider(algorithm,0);fclose(f);return ok;
}
static bool knownGame(HANDLE game) {
 unsigned char header[4096];SIZE_T got=0;if(!ReadProcessMemory(game,(void*)0x400000,header,sizeof(header),&got)||got!=sizeof(header))return false;
 auto dos=(IMAGE_DOS_HEADER*)header;if(dos->e_magic!=IMAGE_DOS_SIGNATURE||dos->e_lfanew<64||dos->e_lfanew>3500)return false;
 auto pe=(IMAGE_NT_HEADERS*)(header+dos->e_lfanew);if(pe->Signature!=IMAGE_NT_SIGNATURE||pe->FileHeader.Machine!=IMAGE_FILE_MACHINE_I386||pe->OptionalHeader.SizeOfImage!=0x1006000)return false;
 for(auto p:fingerprints){unsigned char bytes[32];if(!ReadProcessMemory(game,(void*)p.address,bytes,32,&got)||got!=32||fingerprint(bytes)!=p.hash)return false;}
 return true;
}
static int load(const std::wstring& root,const std::wstring& dll,DWORD& pid) {
 FILE* config=nullptr;if(_wfopen_s(&config,(root+L"\\MicrosoftGame.Config").c_str(),L"rb")||!config)return 10;
 char text[65537]={};size_t got=fread(text,1,65536,config);fclose(config);
 if(got>=65536||!strstr(text,"Name=\"BethesdaSoftworks.FalloutNewVegas\""))return 10;
 const std::wstring expected=normalized(root);if(expected.empty()||!verifiedModule(dll))return 13;
 PROCESSENTRY32W entry={sizeof(entry)};HANDLE snapshot=CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS,0);
 if(snapshot==INVALID_HANDLE_VALUE)return 11;
 HANDLE game=nullptr;
 if(Process32FirstW(snapshot,&entry))do{
  if(_wcsicmp(entry.szExeFile,L"FalloutNV.exe"))continue;
  HANDLE candidate=OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION|PROCESS_CREATE_THREAD|PROCESS_VM_OPERATION|PROCESS_VM_READ|PROCESS_VM_WRITE,FALSE,entry.th32ProcessID);
  if(!candidate)continue;
  wchar_t path[4096]={};DWORD length=4096;
  if(QueryFullProcessImageNameW(candidate,0,path,&length)){
   std::wstring full=path;size_t leaf=full.find_last_of(L'\\');std::wstring parent=leaf==std::wstring::npos?L"":full.substr(0,leaf);
   size_t language=parent.find_last_of(L'\\');std::wstring actual=normalized(language==std::wstring::npos?L"":parent.substr(0,language));
   if(actual==expected){if(game){CloseHandle(candidate);CloseHandle(game);CloseHandle(snapshot);return 11;}game=candidate;pid=entry.th32ProcessID;continue;}
  }
  CloseHandle(candidate);
 }while(Process32NextW(snapshot,&entry));CloseHandle(snapshot);
 if(!game)return 11;if(!knownGame(game)){CloseHandle(game);return 12;}
 wchar_t eventName[100];swprintf_s(eventName,L"Local\\ShenPulse.Fnv.Ready.%u",pid);HANDLE ready=CreateEventW(nullptr,TRUE,FALSE,eventName);
 if(!ready){CloseHandle(game);return 14;}
 // LoadLibrary is idempotent for the same module; no second TCP client is started.
 const SIZE_T length=(dll.size()+1)*sizeof(wchar_t);void* remote=VirtualAllocEx(game,nullptr,length,MEM_COMMIT|MEM_RESERVE,PAGE_READWRITE);SIZE_T written=0;
 if(!remote||!WriteProcessMemory(game,remote,dll.c_str(),length,&written)||written!=length){if(remote)VirtualFreeEx(game,remote,0,MEM_RELEASE);CloseHandle(ready);CloseHandle(game);return 14;}
 HANDLE thread=CreateRemoteThread(game,nullptr,0,(LPTHREAD_START_ROUTINE)GetProcAddress(GetModuleHandleW(L"kernel32.dll"),"LoadLibraryW"),remote,0,nullptr);
 DWORD result=0,waited=thread?WaitForSingleObject(thread,20000):WAIT_FAILED;
 if(waited==WAIT_OBJECT_0){GetExitCodeThread(thread,&result);VirtualFreeEx(game,remote,0,MEM_RELEASE);}if(thread)CloseHandle(thread);
 const bool active=result&&WaitForSingleObject(ready,15000)==WAIT_OBJECT_0;
 CloseHandle(ready);CloseHandle(game);return active?0:14;
}
int wmain(int argc,wchar_t** argv) {
 if(argc!=3||wcslen(argv[1])>2000||wcslen(argv[2])!=32)return 1;
 for(const wchar_t* p=argv[2];*p;p++)if(!iswxdigit(*p))return 1;
 wchar_t self[4096];if(!GetModuleFileNameW(nullptr,self,4096))return 1;wchar_t* end=wcsrchr(self,L'\\');if(!end)return 1;end[1]=0;
 const std::wstring dir=self;DWORD pid=0;const int code=load(argv[1],dir+L"ShenPulse.Fnv.Xbox.dll",pid);
 FILE* output=nullptr;if(!_wfopen_s(&output,(dir+L"launch-result.json").c_str(),L"wb")&&output){
  char nonce[33]={};WideCharToMultiByte(CP_UTF8,0,argv[2],-1,nonce,33,nullptr,nullptr);
  fprintf(output,"{\"requestId\":\"%s\",\"code\":%d,\"pid\":%u}",nonce,code,pid);fclose(output);
 }
 return code;
}
