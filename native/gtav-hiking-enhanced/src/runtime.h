#pragma once
#include "hiking.h"
#include "policy.h"
#include "../../gtav-koth-enhanced/src/runtime.h"
#include <iomanip>
namespace ShenPulse { namespace Hiking {
using MontChiliad::Result;using MontChiliad::Escape;using MontChiliad::ReadInt;using MontChiliad::ReadString;
struct Request {int id=0;std::string code;int quantity=1,duration=0,restartRound=0;std::string viewer;};
struct Actor {Ped ped=0;std::string name;ULONGLONG until=0;bool friendly=false;ULONGLONG nextTask=0;};
extern std::atomic<bool> running,connected;extern std::mutex queueLock,sendLock;extern std::deque<Request> requests;extern SOCKET socketHandle;
extern std::string session,eventName;extern int roundId,eventId,eventDelta,durationSeconds;extern bool autoRestart,allowDriving,showCounter,active;
extern Progress progress;extern Point startPoint;extern std::vector<Point> route;extern std::vector<Actor> actors;
extern ULONGLONG restartAt,lastState,sprintUntil,quakeUntil,nextQuake;extern Blip checkpointBlip;
std::wstring SettingsPath(const wchar_t*);void ReadSettings(ULONGLONG);void SaveRoute();void DefaultRoute();void LoadRoute();bool Ready(Ped&);Point Position(Ped);void Teleport(Point);void Start(ULONGLONG,bool=true);void Tick(ULONGLONG);void Publish();void Menu();void ClearActors();void DrawText(const std::string&,float,float,float,int=255,int=255,int=255);Result Execute(const Request&);Result SpawnActors(const Request&,const char*,bool);void TickActors(ULONGLONG);void Network();bool Send(const std::string&);void Log(const std::string&);
} }
