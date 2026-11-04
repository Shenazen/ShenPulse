package fr.shenpulse.box;

import java.util.*;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.Player;
import org.bukkit.event.*;
import org.bukkit.event.player.PlayerQuitEvent;
import org.bukkit.potion.*;
import org.bukkit.scheduler.BukkitTask;

/** Commandes locales ShenPulse ; aucun service externe ni compte tiers. */
public final class BoxBridge extends ShenPulseBox implements Listener {
  private BukkitTask multiplierReset;
  private final Map<UUID,BukkitTask> rocketReturns = new HashMap<>();
  @Override public void onEnable() {
    prepareArena(); super.onEnable();
    Bukkit.getPluginManager().registerEvents(this, this);
    getCommand("shenpulse_box").setExecutor(this::handle);
  }
  private boolean handle(CommandSender sender, Command command, String label, String[] args) {
    if (sender instanceof Player) { sender.sendMessage("Commande réservée à ShenPulse."); return true; }
    try {
      if (args.length == 0) throw new IllegalArgumentException("Interaction manquante");
      if (args[0].equals("sync")) {
        int wins = Integer.parseInt(args[1]), factor = Math.max(1,Integer.parseInt(args[2])), seconds = Math.max(0,Integer.parseInt(args[3]));
        var manager = getCountdownManager();
        manager.shenSetState(wins, seconds > 0 ? factor : 1);
        if (multiplierReset != null) multiplierReset.cancel();
        if (seconds > 0) multiplierReset = Bukkit.getScheduler().runTaskLater(this, () -> manager.shenSetState(manager.getWinCount(),1), seconds * 20L);
      } else {
        if (Bukkit.getOnlinePlayers().isEmpty()) throw new IllegalStateException("Rejoignez le serveur Minecraft avant de tester une interaction.");
        Set<String> allowed = Set.of("step1","step2","step3","step4","step5","reset","prison1","noprison1","prison2","noprison2","shenfill","fusee");
        if (!allowed.contains(args[0])) throw new IllegalArgumentException("Interaction inconnue");
        if (args[0].equals("fusee")) launchRocket(args);
        else {
          if (args[0].equals("reset")) ((FillCommand)getCommand("shenfill").getExecutor()).shenCancelFill();
          if (args[0].equals("prison1") || args[0].equals("prison2")) for (Player player : Bukkit.getOnlinePlayers()) stopRocket(player, false);
          Bukkit.dispatchCommand(Bukkit.getConsoleSender(),String.join(" ",args));
        }
      }
      getLogger().info("SHENPULSE_BOX_COMMAND ok=" + args[0]);
    } catch (Exception error) { sender.sendMessage("Interaction Box Cyber refusée : " + error.getMessage()); }
    return true;
  }
  private void launchRocket(String[] args) {
    int seconds = 8, start = 1;
    if (args.length > 1 && args[1].matches("\\d+")) { seconds = Math.max(1,Math.min(30,Integer.parseInt(args[1]))); start = 2; }
    String viewer = args.length > start ? String.join(" ",Arrays.copyOfRange(args,start,args.length)) : "Un viewer";
    World world = Bukkit.getWorlds().get(0);
    world.getBlockAt(-4 + new Random().nextInt(9),26,-26 + new Random().nextInt(9)).setType(Material.AIR,false);
    if (getCountdownManager().isCountingDown()) getCountdownManager().reset();
    for (Player player : Bukkit.getOnlinePlayers()) {
      // Un joueur enfermé conserve sa prison et ne s'en échappe pas par une fusée.
      if (player.getLocation().getX() > 900 || player.getLocation().getZ() > -15) continue;
      stopRocket(player,false);
      player.setFlying(false);
      player.addPotionEffect(new PotionEffect(PotionEffectType.LEVITATION, seconds * 20, 10, true, false, false));
      player.setFallDistance(0);
      player.sendTitle("§dFUSÉE", "§f" + viewer,5,40,10);
      player.playSound(player.getLocation(),Sound.ENTITY_FIREWORK_ROCKET_LAUNCH,1,1);
      world.spawnParticle(Particle.FLAME, player.getLocation(),40,.3,.3,.3,.04);
      rocketReturns.put(player.getUniqueId(),Bukkit.getScheduler().runTaskLater(this,() -> stopRocket(player,true),seconds * 20L + 2));
    }
  }
  private void stopRocket(Player player, boolean returnToBox) {
    BukkitTask task = rocketReturns.remove(player.getUniqueId());
    if (task != null) { task.cancel(); player.removePotionEffect(PotionEffectType.LEVITATION); }
    if (returnToBox && player.isOnline()) {
      player.removePotionEffect(PotionEffectType.LEVITATION); player.setFallDistance(0); player.teleport(safeSpawn());
    }
  }
  private Location safeSpawn() {
    World world = Bukkit.getWorlds().get(0); int y = 15;
    while (y <= 26 && world.getBlockAt(0,y,-22).getType() != Material.AIR) y++;
    return new Location(world,.5,y,-22,0,0);
  }
  @EventHandler public void quit(PlayerQuitEvent event) { stopRocket(event.getPlayer(),false); }
  @Override public void onDisable() {
    if (multiplierReset != null) multiplierReset.cancel();
    for (Player player : Bukkit.getOnlinePlayers()) stopRocket(player,false);
    super.onDisable();
  }
  private void prepareArena() {
    World world = Bukkit.getWorlds().get(0); world.setGameRule(GameRule.DO_MOB_SPAWNING,false); world.setSpawnLocation(0,15,-22);
    for (int x=-5;x<=5;x++) for (int z=-27;z<=-17;z++) for (int y=14;y<=31;y++) {
      boolean wall=x==-5 || x==5 || z==-27 || z==-17;
      world.getBlockAt(x,y,z).setType(y==14 ? Material.BEDROCK : wall ? Material.TINTED_GLASS : Material.AIR,false);
    }
    for (int x=-1;x<=3;x++) for (int z=-9;z<=-5;z++) for (int y=36;y<=40;y++) world.getBlockAt(x,y,z).setType(y==36||y==40 ? Material.SMOOTH_QUARTZ : x==-1||x==3||z==-9||z==-5 ? Material.GLASS : Material.AIR,false);
    for (int i=0;i<5;i++) platform(world,1000+i*3,60,1000,Material.IRON_BLOCK);
    for (int z=1004;z<=1013;z++) world.getBlockAt(1013,60,z).setType(Material.AIR,false);
    platform(world,1013,60,1016,Material.IRON_BLOCK);
    for (int z=1019,i=0;z<=1046;z+=3,i++) platform(world,1013-(i%5)*3,60,z,Material.IRON_BLOCK);
    platform(world,1002,60,1048,Material.GOLD_BLOCK); platform(world,1002,60,1051,Material.QUARTZ_BLOCK);
  }
  private void platform(World world,int x,int y,int z,Material material) { world.getBlockAt(x,y,z).setType(material,false); }
}
