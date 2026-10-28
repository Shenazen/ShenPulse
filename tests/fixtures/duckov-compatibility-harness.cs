using System;
using System.Linq;
using System.Reflection;
namespace MelonLoader {
 public class MelonMod { public Log LoggerInstance=new Log();public virtual void OnInitializeMelon(){} }
 public class Log { public void Msg(string value){} public void Error(string value){} }
 public class MelonGameAttribute:Attribute { public MelonGameAttribute(string a,string b){} }
 public class MelonInfoAttribute:Attribute { public MelonInfoAttribute(Type t,string n,string v,string a){} }
 public class MelonPriorityAttribute:Attribute { public MelonPriorityAttribute(int value){} }
}
namespace HarmonyLib {
 public class Harmony { public Harmony(string id){} public void Patch(MethodInfo method,HarmonyMethod prefix=null,HarmonyMethod finalizer=null){} }
 public class HarmonyMethod { public HarmonyMethod(Type type,string name){} }
 public class AccessTools { public static MethodInfo Method(Type type,string name){return type.GetMethod(name);} }
}
namespace UnityEngine { public class Object { public static CharacterMainControl[] Actors=new CharacterMainControl[0];public static T[] FindObjectsOfType<T>() {return Actors.Cast<T>().ToArray();} } }
namespace ItemStatsSystem { public class Item {} }
namespace ItemStatsSystem.Items {
 public class Slot {
  public ItemStatsSystem.Item Master,Displaced;public bool Accepts;public int Calls;
  public bool CanPlug(ItemStatsSystem.Item item){return Accepts;}
  public bool Plug(ItemStatsSystem.Item item,out ItemStatsSystem.Item displaced){Calls++;displaced=Displaced;return Accepts;}
 }
}
public class CharacterMainControl {
 public ItemStatsSystem.Item CharacterItem=new ItemStatsSystem.Item();public bool IsMainCharacter;
 public ItemStatsSystem.Items.Slot Primary=new ItemStatsSystem.Items.Slot(),Melee=new ItemStatsSystem.Items.Slot();
 public ItemStatsSystem.Items.Slot PrimWeaponSlot(){return Primary;}
 public ItemStatsSystem.Items.Slot MeleeWeaponSlot(){return Melee;}
}
public class DuckovLocalEndpoint { public static string CV_HOST="127.0.0.1";public static int CV_PORT=58440; }
public class DuckovMissingEndpoint { }
public class DuckovCompatibilityHarness {
 static BindingFlags Flags=BindingFlags.NonPublic|BindingFlags.Static;
 static object Call(string method,params object[] args){return typeof(ShenPulseDuckovCompatibility).GetMethod(method,Flags).Invoke(null,args);}
 static void Assert(bool result,string message){if(!result)throw new Exception(message);}
 static bool Plug(ItemStatsSystem.Items.Slot slot,out object[] args){args=new object[]{slot,new ItemStatsSystem.Item(),null,false};return (bool)Call("PlugSpawnWeapon",args);}
 public static void Main(){
  Assert((bool)Call("IsLocalEndpoint",typeof(DuckovLocalEndpoint)),"ShenPulse loopback port must be accepted");
  DuckovLocalEndpoint.CV_PORT=51337;Assert(!(bool)Call("IsLocalEndpoint",typeof(DuckovLocalEndpoint)),"The original external port must not be adapted");DuckovLocalEndpoint.CV_PORT=58440;
  DuckovLocalEndpoint.CV_HOST="example.test";Assert(!(bool)Call("IsLocalEndpoint",typeof(DuckovLocalEndpoint)),"Non-local hosts must be refused");DuckovLocalEndpoint.CV_HOST="127.0.0.1";
  Assert(!(bool)Call("IsLocalEndpoint",typeof(DuckovMissingEndpoint)),"Unknown module metadata must be refused");
  object[] gate=new object[]{false};Assert(!(bool)Call("UseLocalBridge",gate)&&(bool)gate[0],"The local TCP loop must run without any third-party client process");
  CharacterMainControl npc=new CharacterMainControl();npc.Melee.Master=npc.CharacterItem;npc.Primary.Accepts=true;npc.Primary.Displaced=new ItemStatsSystem.Item();UnityEngine.Object.Actors=new[]{npc};object[] result;
  Assert(Plug(npc.Melee,out result)&&npc.Primary.Calls==0,"Normal inventory must be untouched");
  Call("EnterSpawn");Assert(!Plug(npc.Melee,out result)&&(bool)result[3]&&npc.Primary.Calls==1&&result[2]==npc.Primary.Displaced,"Spawn firearm must use primary slot and return displaced item");
  npc.Melee.Accepts=true;Assert(Plug(npc.Melee,out result)&&npc.Primary.Calls==1,"Melee weapon must keep valid original slot");npc.Melee.Accepts=false;
  npc.IsMainCharacter=true;Assert(Plug(npc.Melee,out result)&&npc.Primary.Calls==1,"Player equipment must be untouched");npc.IsMainCharacter=false;
  ItemStatsSystem.Items.Slot other=new ItemStatsSystem.Items.Slot();other.Master=npc.CharacterItem;Assert(Plug(other,out result)&&npc.Primary.Calls==1,"Other slots must be untouched");
  npc.Primary.Accepts=false;Assert(Plug(npc.Melee,out result)&&npc.Primary.Calls==1,"Unsupported equipment must keep upstream validation");npc.Primary.Accepts=true;
  Call("EnterSpawn");Call("LeaveSpawn",new object[]{null});Assert(!Plug(npc.Melee,out result)&&npc.Primary.Calls==2,"Nested spawn tracking must remain active");
  Exception sentinel=new Exception("sentinel");Assert(Call("LeaveSpawn",sentinel)==sentinel,"Upstream exceptions must be preserved");Assert(Plug(npc.Melee,out result)&&npc.Primary.Calls==2,"Spawn scope must end after exception");
  Console.WriteLine("Duckov enemy weapon compatibility: eight behavior checks passed; five local connection checks passed.");
 }
}
