#pragma once
#include "koth.h"
#include "geometry.h"
#include "control-policy.h"
#include "motion-policy.h"
#include "round-policy.h"
#include "../../gtav-montchiliad-enhanced/src/runtime.h"
#include <fstream>
namespace ShenPulse { namespace Koth {
using MontChiliad::Result;
using MontChiliad::Escape;
using MontChiliad::ReadInt;
using MontChiliad::ReadString;
struct Request { int id;std::string code;int quantity;int duration=0;int angle=-1,sections=-1,design=-1,animated=-1,audit=0,restartRound=0; };
struct Obstacle {
 Entity entity=0;ULONGLONG expires=0;bool sliding=false,vehicle=false,audit=false;
 std::string model;ULONGLONG born=0,nextSample=0,lastNudge=0,lastDrive=0,lastUpdate=0,nextBounds=0,fallenAt=0,positionCheck=0;
 float spawnProgress=0,lastProgress=0,maxDownhill=0,onRampTravel=0,support=2,observedSpeed=0,checkedProgress=0;
 int requestId=0;Vector3 low{},high{};ObstacleBounds bounds;
};
struct ObstacleModel {std::string name;bool vehicle;};
bool TrackObstacle(Entity);Result SpawnObstacle(const Request&,const std::string&,bool);Result SpawnObstacleBatch(const Request&,const std::vector<ObstacleModel>&);Result SpawnRandomObstacles(const Request&);void TickObstacles(ULONGLONG);void AuditObstacle(const Obstacle&,const char*);bool RestoreAfterUpdate();

extern std::atomic<bool> running,connected;
extern std::mutex queueLock,sendLock;
extern std::deque<Request> requests;
extern SOCKET socketHandle;
extern Ramp ramp;
struct RampTile {Object entity;float side,distance,height,roll;Point roof[4]{};float lift=0;};
extern std::vector<RampTile> rampTiles;
extern int sections;extern bool animated;
const char* DesignName(int);void LoadSettings();void SaveSettings();void AnimateRamp(ULONGLONG);void DrawRampDesign(Ped);
void EndJail();Result StartJail(const Request&);
extern std::vector<Object> tiles;
extern std::vector<Obstacle> obstacles;
extern std::string session;
extern float width;
extern bool active,won,wasDead;
extern int roundId,eventId,eventDelta,wins,deaths,design;
extern std::string eventName;
extern ULONGLONG lastState,finishSince,restartAt,jumpUntil,shieldUntil,freezeUntil,sprintUntil,jailUntil;
extern bool restoreInvincible,previousInvincible,sprintActive;
extern Entity frozen;
extern std::vector<Object> jail;
extern RoundClock roundClock;extern int roundDurationSeconds;extern bool roundAutoRestart,rampProtection;
void ReadRoundSettings(ULONGLONG);void StartRound(ULONGLONG,bool);void StopRound();const char* RoundStatus();void ReleaseRampProtection();void UpdateRampProtection(Ped,Point);void TickRound(ULONGLONG,Ped,bool,Point,bool);
bool Send(const std::string&);
void Network();
void Log(const std::string&);
Result Execute(const Request&);
Result Build();
void ClearRamp();
void ClearObstacles();
void Teleport(bool finish);
void Tick(ULONGLONG);
bool Ready(Ped&);
bool Load(Hash);
Hash HashOf(const std::string&);
void Register(int,const char*);
void Publish();
void DrawText(const std::string&,float,float,float,int=255,int=255,int=255);
void Menu();
} }
