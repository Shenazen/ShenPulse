using System;
using System.Linq;
using System.Diagnostics;
using System.Collections.Generic;
using Microsoft.Xna.Framework;
using Terraria;
using Terraria.DataStructures;
using Terraria.ID;
using Terraria.ModLoader;
using Terraria.GameContent.ItemDropRules;
using ShenPulse.LocalGames;
namespace ShenPulseTerraria {
 public sealed class ShenPulseTerraria : Mod { }
 public sealed class Effects : ModSystem {
  LocalEffectClient client; readonly Dictionary<string,long> active=new Dictionary<string,long>(); readonly Dictionary<string,int> buffs=new Dictionary<string,int>{{"buff_blind",BuffID.Blackout},{"buff_confuse",BuffID.Confused},{"buff_freeze",BuffID.Frozen},{"buff_treasure",BuffID.Spelunker},{"buff_shimmer",BuffID.Shimmer},{"buff_invisible",BuffID.Invisibility}}; readonly List<Point> webs=new List<Point>(); int webTicks;
  public override void Load(){if(!Main.dedServ)client=new LocalEffectClient(58433);}
  public override void Unload(){client?.Dispose();client=null;active.Clear();}
  public override void OnWorldUnload(){foreach(var code in active.Keys)if(buffs.ContainsKey(code))Main.LocalPlayer.ClearBuff(buffs[code]);active.Clear();webs.Clear();webTicks=0;}
  public override void PostUpdateEverything(){if(Main.dedServ)return;if(!Main.gameMenu&&!Main.gamePaused){if(webTicks>0&&--webTicks==0){foreach(var pos in webs)if(Main.tile[pos.X,pos.Y].HasTile&&Main.tile[pos.X,pos.Y].TileType==TileID.Cobweb)WorldGen.KillTile(pos.X,pos.Y,false,false,true);webs.Clear();}ApplyTimed();}}
  public override void PostUpdateInput(){if(!Main.gameMenu){foreach(var code in active.Keys.ToArray()){long left=active[code]-Stopwatch.GetTimestamp();int buff;if(left<=0){if(buffs.TryGetValue(code,out buff))Main.LocalPlayer.ClearBuff(buff);active.Remove(code);}else if(buffs.TryGetValue(code,out buff)){var f=Main.LocalPlayer;f.buffImmune[buff]=false;int ticks=(int)Math.Max(1,left*60/Stopwatch.Frequency);int idx=f.FindBuffIndex(buff);if(idx>=0)f.buffTime[idx]=ticks;else f.AddBuff(buff,ticks);}}}client?.Drain(Execute);}
  void ApplyTimed(){var f=Main.LocalPlayer;if(active.ContainsKey("buff_levitate"))f.velocity.Y=MathHelper.Clamp(f.velocity.Y-0.8f,-2f,2f);if(active.ContainsKey("rainbow_feet")&&Main.GameUpdateCount%5==0)Dust.NewDust(f.Bottom-Vector2.One*6,12,6,DustID.RainbowMk2,0,0,0,Main.DiscoColor,1.4f);if(active.ContainsKey("shoot_bombs")&&Main.GameUpdateCount%30==0)Projectile.NewProjectile(f.GetSource_Misc("ShenPulse"),f.Center-new Vector2(0,100),new Vector2(Main.rand.NextFloat(-2,2),2),ProjectileID.Bomb,50,3,f.whoAmI);}
  void Done(LocalEffectClient.Request r,string message){client.Reply(r,0,message);Main.NewText(r.Viewer+" : "+message,Color.Cyan);}
  void Execute(LocalEffectClient.Request r){if((int?)r.Data["type"]!=1){client.Reply(r,0,"ShenPulse prêt.");return;}if(Main.gameMenu||Main.gamePaused||Main.LocalPlayer.dead||Main.LocalPlayer.ghost||Main.netMode!=NetmodeID.SinglePlayer||Main.playerInventory||Main.LocalPlayer.talkNPC>=0){client.Reply(r,3,"Chargez un monde solo, fermez l’inventaire et les dialogues, puis réessayez.");return;}var f=Main.LocalPlayer;string code=r.Code;int duration=r.Number("duration",15000,1000,600000),ticks=duration*60/1000;var source=f.GetSource_Misc("ShenPulse");

   int buff;if(buffs.TryGetValue(code,out buff)){f.buffImmune[buff]=false;f.AddBuff(buff,ticks);active[code]=Stopwatch.GetTimestamp()+duration*Stopwatch.Frequency/1000;Done(r,"Effet actif pendant "+duration/1000+" s.");return;}
   if(code=="buff_levitate"||code=="rainbow_feet"||code=="shoot_bombs"||code=="screen_shake"){active[code]=Math.Min(Stopwatch.GetTimestamp()+600*Stopwatch.Frequency,Math.Max(Stopwatch.GetTimestamp(),active.ContainsKey(code)?active[code]:0)+duration*Stopwatch.Frequency/1000);Done(r,"Effet actif pendant "+duration/1000+" s.");return;}
   if(code=="heal_player"){int amount=r.Number("amount",50,10,500);f.statLife=Math.Min(f.statLifeMax2,f.statLife+amount);f.HealEffect(amount);Done(r,"Santé restaurée.");return;}
   if(code=="damage_player"){int amount=r.Number("amount",50,10,500);f.statLife=Math.Max(0,f.statLife-amount);CombatText.NewText(f.Hitbox,Color.Red,amount);if(f.statLife==0)f.KillMe(PlayerDeathReason.ByCustomReason(f.name+" a succombé à une interaction ShenPulse."),amount,0);Done(r,"Dégâts appliqués.");return;}
   if(code=="explode_player"){int idx=Projectile.NewProjectile(source,f.Center,Vector2.Zero,ProjectileID.Dynamite,250,10,f.whoAmI);if(idx>=Main.maxProjectiles){client.Reply(r,3,"Trop de projectiles actifs.");return;}Main.projectile[idx].timeLeft=3;Done(r,"Dynamite déclenchée.");return;}
   if(code=="random_teleport"){f.TeleportationPotion();Done(r,"Téléportation effectuée.");return;}
   if(code=="give_sword"){int count=r.Number("quantity",1,1,99);int sword=Main.hardMode?ItemID.AdamantiteSword:ItemID.IronBroadsword;for(int i=0;i<count;i++)f.QuickSpawnItem(source,sword,1);Done(r,count+" épée(s) donnée(s).");return;}
   if(code=="spawn_critters"){int count=r.Number("quantity",1,1,50);var ids=new[]{NPCID.Bunny,NPCID.Bird,NPCID.Squirrel};int available=Main.npc.Count(n=>!n.active);if(available<count){client.Reply(r,3,"Pas assez d’emplacements libres pour les créatures.");return;}for(int i=0;i<count;i++)NPC.NewNPC(source,(int)f.Center.X+Main.rand.Next(-120,121),(int)f.Bottom.Y-24,ids[Main.rand.Next(ids.Length)]);Done(r,count+" créature(s) apparue(s).");return;}
   if(code=="spawn_town_npc"){var ids=new[]{NPCID.Guide,NPCID.Merchant,NPCID.Nurse,NPCID.Demolitionist,NPCID.DyeTrader,NPCID.Angler,NPCID.BestiaryGirl};var available=ids.Where(i=>!NPC.AnyNPCs(i)).ToArray();if(available.Length==0){client.Reply(r,1,"Tous les PNJ proposés sont déjà présents.");return;}int idx=NPC.NewNPC(source,(int)f.Center.X+120,(int)f.Center.Y,available[Main.rand.Next(available.Length)]);if(idx>=Main.maxNPCs){client.Reply(r,3,"Trop de PNJ actifs.");return;}Done(r,"PNJ apparu.");return;}
   if(code=="golden_slime_rain"){int available=Main.npc.Count(n=>!n.active);if(available<12){client.Reply(r,3,"Trop de PNJ actifs.");return;}for(int i=0;i<12;i++)NPC.NewNPC(source,(int)f.Center.X+Main.rand.Next(-400,401),Math.Max(64,(int)f.Center.Y-450-Main.rand.Next(300)),ModContent.NPCType<GoldenSlime>());Done(r,"Pluie de slimes dorés.");return;}
   if(code=="not_the_bees"){for(int i=0;i<12;i++)Projectile.NewProjectile(source,f.Center,new Vector2(Main.rand.NextFloat(-5,5),Main.rand.NextFloat(-5,5)),ProjectileID.Bee,15,1,f.whoAmI);Done(r,"Essaim d’abeilles.");return;}
   if(code=="random_boss"){if(Main.npc.Any(n=>n.active&&n.boss)){client.Reply(r,3,"Terminez le combat de boss en cours.");return;}var ids=new List<int>{NPCID.KingSlime};if(!Main.dayTime)ids.Add(NPCID.EyeofCthulhu);if(f.ZoneJungle)ids.Add(NPCID.QueenBee);if(f.ZoneCorrupt)ids.Add(NPCID.EaterofWorldsHead);if(f.ZoneCrimson)ids.Add(NPCID.BrainofCthulhu);if(Main.hardMode){ids.Add(NPCID.QueenSlimeBoss);if(!Main.dayTime){ids.Add(NPCID.TheDestroyer);ids.Add(NPCID.SkeletronPrime);}}NPC.SpawnOnPlayer(f.whoAmI,ids[Main.rand.Next(ids.Count)]);Done(r,"Boss invoqué.");return;}
   if(code=="weather_rain"){Main.StartRain();Done(r,"Pluie déclenchée.");return;}
   if(code=="cobweb_trap"||code=="sand_trap"){Point tile=f.Center.ToTileCoordinates();int type=code=="cobweb_trap"?TileID.Cobweb:TileID.Sand;int placed=0;for(int x=-3;x<=3;x++)for(int y=-4;y<=1;y++){int tx=tile.X+x,ty=tile.Y+y;if(!WorldGen.InWorld(tx,ty,10)||Main.tile[tx,ty].HasTile)continue;if(type==TileID.Sand&&y> -2)continue;bool created=WorldGen.PlaceTile(tx,ty,type,mute:true,forced:type==TileID.Sand);if(created){placed++;if(type==TileID.Cobweb)webs.Add(new Point(tx,ty));}}if(placed==0){client.Reply(r,3,"Pas assez de place pour le piège.");return;}if(type==TileID.Cobweb)webTicks=900;Done(r,"Piège créé.");return;}
   client.Reply(r,1,"Interaction inconnue : "+code);
  }
  public bool IsActive(string id){return active.ContainsKey(id);}
 }
 public sealed class CameraEffects : ModPlayer {
  public override void ModifyScreenPosition(){if(ModContent.GetInstance<Effects>().IsActive("screen_shake"))Main.screenPosition+=new Vector2(Main.rand.NextFloat(-8,8),Main.rand.NextFloat(-8,8));}
 }
 public sealed class GoldenSlime : ModNPC {
  public override string Texture {get{return "Terraria/Images/NPC_1";}}
  public override void SetDefaults(){NPC.CloneDefaults(NPCID.BlueSlime);AIType=NPCID.BlueSlime;AnimationType=NPCID.BlueSlime;NPC.color=Color.Gold;NPC.value=10000;}
  public override void ModifyNPCLoot(NPCLoot loot){loot.Add(ItemDropRule.Common(ItemID.GoldCoin));}
 }
}
