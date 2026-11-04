using System;
using System.Reflection;
using BepInEx.Unity.IL2CPP;
using UnityEngine;
using Last.Management;
using Last.Battle;
using Last.Data.User;

namespace ShenPulse.FinalFantasy;
public static class Runtime {
 public static bool InBattle()=>BattlePlugManager.instance!=null&&BattlePlugManager.instance.IsBattle();
 public static bool MissingMember(int position)=>UserDataManager.Instance().GetMemberData(position)==null;
 public static bool ChangeFieldHp(int position,int value,bool allowZero) {
  var user=UserDataManager.Instance();var member=user.GetMemberData(position);
  if(member==null)return false;
  int before=member.parameter.currentHP,max=member.parameter.ConfirmedMaxHp();
  int target=Math.Clamp(before+value,allowZero?0:1,max);
  if(before==target)return false;
  var client=new OwnedCharacterClient();
  if(target>before)client.AddHp(member.Id,target-before);
  else client.SubtractionHp(member.Id,before-target,allowZero);
  return user.GetMemberData(position).parameter.currentHP!=before;
 }
 public static bool SetFieldHp(int position,int value) {
  var member=UserDataManager.Instance().GetMemberData(position);
  if(member==null)return false;
  return ChangeFieldHp(position,value-member.parameter.currentHP,true);
 }
 public static string ItemName(OwnedItemData item)=>item==null?"vide":item.NaturalName;
 public static void RenameMember(OwnedCharacterClient client,int position,string name) {
  var member=UserDataManager.Instance().GetMemberData(position-1);
  if(member==null)throw new InvalidOperationException("Le personnage ciblé n’est pas dans l’équipe.");
  client.UpdateName(member.Id,name);
 }
 internal static object Plugin;
 internal static MethodInfo Tick;
 public static void Initialize(object plugin) {
  Plugin=plugin;Tick=plugin.GetType().GetMethod("Update");
  ((BasePlugin)plugin).AddComponent<Heartbeat>();
  ((BasePlugin)plugin).Log.LogInfo("ShenPulse Game Pass runtime initialized.");
 }
 public static int State() {
  try {
   var game=UnityEngine.Object.FindObjectOfType<MainGame>();
   if(game==null||!game.FieldReady||!game.SubScenesReady)return -13;
   var state=game.CurrentState<SubSceneManagerMainGame.State>();
   if(state==SubSceneManagerMainGame.State.Player||state==SubSceneManagerMainGame.State.Transport||state==SubSceneManagerMainGame.State.Battle)return 1;
   return state==SubSceneManagerMainGame.State.Event||state==SubSceneManagerMainGame.State.Message?-11:-13;
  }catch{return -6;}
 }
 public static bool CanEncounter(){
  try { var game=UnityEngine.Object.FindObjectOfType<MainGame>();return State()==1&&game.CurrentState<SubSceneManagerMainGame.State>()==SubSceneManagerMainGame.State.Player&&BattlePlugManager.instance!=null&&!BattlePlugManager.instance.IsBattle(); }catch{return false;}
 }
}
public sealed class Heartbeat : MonoBehaviour {
 public Heartbeat(IntPtr p):base(p){}
 private float nextError;
 public void Update(){try{Runtime.Tick?.Invoke(Runtime.Plugin,null);}catch(Exception e){if(Time.realtimeSinceStartup>nextError){nextError=Time.realtimeSinceStartup+10;((BasePlugin)Runtime.Plugin).Log.LogError(e.InnerException??e);}}}
}
