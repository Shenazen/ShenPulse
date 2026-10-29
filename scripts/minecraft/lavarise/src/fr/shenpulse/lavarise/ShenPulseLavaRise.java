package fr.shenpulse.lavarise;

import fr.shenpulse.lavarise.engine.LavaRiseEngine;
import fr.shenpulse.lavarise.engine.game.a;
import java.util.*;
import java.lang.reflect.*;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.event.*;
import org.bukkit.event.player.PlayerJoinEvent;
import org.bukkit.scheduler.BukkitTask;

/** Local console integration. No HTTP service, account or external application is required. */
public final class ShenPulseLavaRise extends LavaRiseEngine implements CommandExecutor,Listener {
  private static ShenPulseLavaRise instance;
  private BukkitTask multiplierTask;
  private BukkitTask lavaWatch;
  @Override public void onEnable(){
    instance=this;super.onEnable();getCommand("shenpulse_lava").setExecutor(this);getCommand("shenpulse_win").setExecutor(this);
    Bukkit.getPluginManager().registerEvents(this,this);getLogger().info("ShenPulse Lava Rise prêt : connexion par console locale.");
    // A stationary player must also lose when the lava reaches them.
    lavaWatch=Bukkit.getScheduler().runTaskTimer(this,()->{
      a game=a();if(!game.p()||!game.o())return;
      for(Player player:Bukkit.getOnlinePlayers()){
        Location location=player.getLocation();
        if(!game.r().c(location))continue;
        if(location.getY()<=game.r().i()||location.getBlock().getType()==Material.LAVA||location.clone().subtract(0,0.5,0).getBlock().getType()==Material.LAVA){
          if(game.G()&&!game.J())game.g(player);else if(!game.J())game.c();
          break;
        }
      }
    },5L,5L);
  }
  @Override public void onDisable(){if(multiplierTask!=null)multiplierTask.cancel();if(lavaWatch!=null)lavaWatch.cancel();super.onDisable();instance=null;}
  @EventHandler public void grantGameControls(PlayerJoinEvent event){event.getPlayer().addAttachment(this,"shenpulse.lavarise.use",true);}
  public static void afterWin(Object manager){
    if(instance==null)return;instance.getLogger().info("SHENPULSE_WIN_COUNTER current="+((a)manager).g()+" source=auto-win");
  }
  public static void beforeStop(Object manager,boolean restart){
    if(instance==null||!restart)return;
    try{
      a game=(a)manager;Field victory=game.getClass().getDeclaredField("D");victory.setAccessible(true);
      if((game.p()||game.q())&&!victory.getBoolean(game)){
        game.b(game.g()-Math.max(1,game.j()));instance.getLogger().info("SHENPULSE_WIN_COUNTER current="+game.g()+" source=lava-loss");
      }
    }catch(ReflectiveOperationException error){instance.getLogger().severe("Défaite non synchronisée : "+error.getClass().getSimpleName());}
  }
  @Override public boolean onCommand(CommandSender sender,Command command,String label,String[] args){
    if(sender instanceof Player&&!sender.hasPermission("shenpulse.lavarise.admin")){sender.sendMessage("Cette commande est réservée à ShenPulse.");return true;}
    a game=a();
    try{
      if(args.length==0||args[0].equals("state")){
        getLogger().info("SHENPULSE_LAVA_STATE running="+game.p()+" countdown="+game.q()+" arena="+game.o()+" wins="+game.g()+" multiplier="+game.j()+" freeze="+game.f()+" mobs="+game.y()+" players="+Bukkit.getOnlinePlayers().size());
        for(Player p:Bukkit.getOnlinePlayers())getLogger().info("SHENPULSE_LAVA_PLAYER name="+p.getName()+" y="+p.getLocation().getBlockY()+" effects="+p.getActivePotionEffects().size()+" gear="+p.getInventory().getItemInMainHand().getType());
        return true;
      }
      switch(args[0]){
        case "effect":{
          if(args.length<3||!Set.of("boost","slow","jump","blind","glow").contains(args[1]))throw new IllegalArgumentException("Effet invalide");
          game.a(args[1],args.length>3?String.join(" ",Arrays.copyOfRange(args,3,args.length)):"ShenPulse",integer(args,2,1,300));break;
        }
        case "sync":{
          int current=integer(args,1,-1000000,1000000),factor=integer(args,2,1,100),seconds=integer(args,3,0,3600),target=integer(args,4,0,1000000);
          game.b(current);game.e(target);game.g(factor);if(multiplierTask!=null)multiplierTask.cancel();
          if(seconds>0&&factor>1)multiplierTask=Bukkit.getScheduler().runTaskLater(this,()->game.g(1),seconds*20L);
          break;
        }
        case "set":game.b(integer(args,1,-1000000,1000000));break;
        case "x2":game.g(2);if(multiplierTask!=null)multiplierTask.cancel();multiplierTask=Bukkit.getScheduler().runTaskLater(this,()->game.g(1),integer(args,1,1,3600)*20L);break;
        case "timer":case "show":case "hide":break;
        case "prepare":if(!game.p()&&!game.q())Bukkit.dispatchCommand(Bukkit.getConsoleSender(),"lavarise start");break;
        case "stop":Bukkit.dispatchCommand(Bukkit.getConsoleSender(),"lavarise stop");break;
        default:throw new IllegalArgumentException("Commande locale inconnue");
      }
      getLogger().info("SHENPULSE_LAVA_COMMAND ok="+args[0]);
    }catch(RuntimeException error){sender.sendMessage("Commande Lava Rise refusée : "+error.getMessage());getLogger().warning("SHENPULSE_LAVA_COMMAND refused="+args[0]);}
    return true;
  }
  private static int integer(String[] args,int index,int min,int max){if(args.length<=index)throw new IllegalArgumentException("Paramètre manquant");return Math.max(min,Math.min(max,Integer.parseInt(args[index])));}
}
