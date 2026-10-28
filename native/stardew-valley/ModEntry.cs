using System;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using Microsoft.Xna.Framework;
using StardewModdingAPI;
using StardewModdingAPI.Events;
using StardewValley;
using StardewValley.Tools;
using StardewValley.Monsters;
using ShenPulse.LocalGames;
namespace ShenPulse.Stardew {
 public sealed class ModEntry : Mod {
  LocalEffectClient client;
  readonly HashSet<string> ownedBuffs=new HashSet<string>();
  readonly Dictionary<string,long> deadlines=new Dictionary<string,long>();
  readonly Dictionary<string,Buff> previousBuffs=new Dictionary<string,Buff>();
  static readonly Dictionary<string,string> buffIds=new Dictionary<string,string>{{"give_buff_adrenaline","22"},{"give_buff_darkness","26"},{"give_buff_frozen","19"},{"give_buff_nauseous","25"},{"give_buff_tipsy","17"},{"give_buff_slime","13"},{"give_buff_invincibility","21"}};
  public override void Entry(IModHelper helper){client=new LocalEffectClient(58432);helper.Events.GameLoop.UpdateTicked+=Update;helper.Events.GameLoop.ReturnedToTitle+=(s,e)=>ClearBuffs();helper.Events.GameLoop.DayEnding+=(s,e)=>ClearBuffs();AppDomain.CurrentDomain.ProcessExit+=(s,e)=>client.Dispose();Monitor.Log("Pont ShenPulse local prêt sur 58432.",LogLevel.Info);}
  void ClearBuffs(){if(Game1.player!=null)foreach(var id in ownedBuffs){Game1.player.buffs.Remove(id);Buff original;if(previousBuffs.TryGetValue(id,out original)&&original.millisecondsDuration>0)Game1.player.applyBuff(original);}ownedBuffs.Clear();previousBuffs.Clear();deadlines.Clear();}
  void Update(object sender,UpdateTickedEventArgs e){if(Context.IsWorldReady&&Game1.shouldTimePass())foreach(var old in previousBuffs.Values)if(old.millisecondsDuration>0)old.millisecondsDuration=Math.Max(0,old.millisecondsDuration-(int)Game1.currentGameTime.ElapsedGameTime.TotalMilliseconds);if(Context.IsWorldReady)foreach(var id in deadlines.Keys.ToArray()){int remaining=(int)Math.Max(0,(deadlines[id]-Stopwatch.GetTimestamp())*1000/Stopwatch.Frequency);Buff buff;if(remaining<=0){Game1.player.buffs.Remove(id);Buff old;if(previousBuffs.TryGetValue(id,out old)&&(old.millisecondsDuration>0||old.millisecondsDuration==-2))Game1.player.applyBuff(old);previousBuffs.Remove(id);deadlines.Remove(id);ownedBuffs.Remove(id);}else if(Game1.player.buffs.AppliedBuffs.TryGetValue(id,out buff))buff.millisecondsDuration=remaining;}client.Drain(Execute);}
  void Done(LocalEffectClient.Request r,string message){client.Reply(r,0,message);Game1.addHUDMessage(new HUDMessage(r.Viewer+" : "+message,2));Monitor.Log(r.Code+" : "+message,LogLevel.Trace);}
  void Execute(LocalEffectClient.Request r){if((int?)r.Data["type"]!=1){client.Reply(r,0,"ShenPulse prêt.");return;}if(!Context.IsWorldReady||!Context.IsPlayerFree||Game1.isTimePaused||Context.IsMultiplayer||Game1.isFestival()){client.Reply(r,3,"Chargez une partie solo, fermez les menus et terminez les dialogues avant de réessayer.");return;}
   var f=Game1.player;string code=r.Code;string buff;
   if(buffIds.TryGetValue(code,out buff)){int duration=r.Number("duration",15000,1000,600000);if(!ownedBuffs.Contains(buff)){Buff old;if(f.buffs.AppliedBuffs.TryGetValue(buff,out old))previousBuffs[buff]=old;}ownedBuffs.Add(buff);Buff active;int left=f.buffs.AppliedBuffs.TryGetValue(buff,out active)&&!previousBuffs.ContainsKey(buff)?Math.Max(0,active.millisecondsDuration):0;f.buffs.Remove(buff);int total=Math.Min(600000,left+duration);deadlines[buff]=Stopwatch.GetTimestamp()+total*Stopwatch.Frequency/1000;f.applyBuff(new Buff(buff,duration:total));Done(r,"Effet actif pendant "+(duration/1000)+" s.");return;}
   if(code=="heal_full"){f.health=f.maxHealth;Done(r,"Santé restaurée.");return;}
   if(code.StartsWith("hurt_")){f.health=Math.Max(0,f.health-r.Number("amount",Suffix(code,25),10,50));Done(r,"Dégâts appliqués.");return;}
   if(code.StartsWith("energize_")){f.Stamina=code=="energize_full"?f.MaxStamina:Math.Min(f.MaxStamina,f.Stamina+r.Number("amount",Suffix(code,50),10,100));Done(r,"Énergie restaurée.");return;}
   if(code.StartsWith("tire_")){f.Stamina=Math.Max(0,f.Stamina-r.Number("amount",Suffix(code,50),10,50));Done(r,"Énergie retirée.");return;}
   if(code.StartsWith("give_money_")){f.Money=Math.Min(99999999,f.Money+r.Number("amount",Suffix(code,1000),100,10000));Done(r,"Argent ajouté.");return;}
   if(code.StartsWith("remove_money_")){f.Money=Math.Max(0,f.Money-r.Number("amount",Suffix(code,1000),100,10000));Done(r,"Argent retiré.");return;}
   if(code=="give_diamond"){var item=ItemRegistry.Create("(O)72",r.Number("quantity",1,1,99));if(!f.couldInventoryAcceptThisItem(item)){client.Reply(r,3,"Libérez de la place dans l’inventaire.");return;}f.addItemToInventory(item);Done(r,"Diamants ajoutés.");return;}
   if(code=="spawn_slime"){int count=r.Number("quantity",1,1,20);var positions=new List<Vector2>();var origin=f.Tile;for(int radius=2;radius<=9&&positions.Count<count;radius++)for(int x=-radius;x<=radius&&positions.Count<count;x++)for(int y=-radius;y<=radius&&positions.Count<count;y++){if(Math.Max(Math.Abs(x),Math.Abs(y))!=radius)continue;var tile=origin+new Vector2(x,y);if(Game1.currentLocation.isTileOnMap(tile)&&Game1.currentLocation.isTilePassable(tile)&&Game1.currentLocation.CanItemBePlacedHere(tile))positions.Add(tile*64f);}if(positions.Count<count){client.Reply(r,3,"Pas assez de place pour faire apparaître les monstres.");return;}foreach(var pos in positions)Game1.currentLocation.addCharacter(new GreenSlime(pos));Done(r,count+" slime(s) apparu(s).");return;}
   if(code=="warp_farm"){Game1.warpFarmer("Farm",64,15,false);Done(r,"Retour à la ferme.");return;}
   if(code=="hair_style"){int old=f.hair.Value;var choices=Farmer.GetAllHairstyleIndices().Where(i=>i!=old).ToArray();if(choices.Length==0){client.Reply(r,1,"Aucune autre coiffure disponible.");return;}f.changeHairStyle(choices[Game1.random.Next(choices.Length)]);Done(r,"Coiffure changée.");return;}
   if(code.StartsWith("upgrade_")||code.StartsWith("downgrade_")){bool up=code.StartsWith("upgrade_");string kind=code.Substring(code.IndexOf('_')+1);var tool=f.Items.OfType<Tool>().FirstOrDefault(t=>(kind=="axe"&&t is Axe)||(kind=="pickaxe"&&t is Pickaxe)||(kind=="hoe"&&t is Hoe)||(kind=="wateringcan"&&t is WateringCan)||(kind=="fishingrod"&&t is FishingRod));if(tool==null){client.Reply(r,3,"Gardez l’outil concerné dans votre inventaire.");return;}int level=tool.UpgradeLevel;int next=Math.Max(0,Math.Min(4,level+(up?1:-1)));if(next==level){client.Reply(r,1,up?"L’outil est déjà au niveau maximal.":"L’outil est déjà au niveau minimal.");return;}if(tool is FishingRod){string[] ids={"BambooPole","TrainingRod","FiberglassRod","IridiumRod","AdvancedIridiumRod"};f.Items[f.Items.IndexOf(tool)]=ItemRegistry.Create("(T)"+ids[next]);}else tool.UpgradeLevel=next;Done(r,up?"Outil amélioré.":"Outil rétrogradé.");return;}
   if(code=="kill"){f.health=0;Done(r,"Joueur K.-O.");return;}client.Reply(r,1,"Interaction inconnue : "+code);
  }
  static int Suffix(string code,int fallback){int result;return int.TryParse(code.Substring(code.LastIndexOf('_')+1),out result)?result:fallback;}
 }
}
