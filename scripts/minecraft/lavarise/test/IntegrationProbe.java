package fr.shenpulse.lavarise.test;

import fr.shenpulse.lavarise.ShenPulseLavaRise;
import fr.shenpulse.lavarise.engine.game.a;
import java.util.*;
import org.bukkit.*;
import org.bukkit.command.*;
import org.bukkit.entity.*;
import org.bukkit.inventory.ItemStack;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.*;

/** Disposable local-server integration checks. This plugin is never shipped to users. */
public final class IntegrationProbe extends JavaPlugin implements CommandExecutor {
  private a game;
  private Player player;
  private int passed;
  private int failed;
  private ItemStack[] inventory;
  private double previousY;
  private int lava;
  private int initialWins;
  private Location anchor;
  private org.bukkit.scheduler.BukkitTask hold;
  private final List<String> results = new ArrayList<>();

  @Override public void onEnable() { getCommand("lavaprobe").setExecutor(this); }
  @Override public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
    if (!(sender instanceof ConsoleCommandSender)) return true;
    if (player != null) { sender.sendMessage("Probe already started"); return true; }
    player = Bukkit.getOnlinePlayers().stream().findFirst().orElse(null);
    if (player == null) { sender.sendMessage("Player required"); return true; }
    game = ((ShenPulseLavaRise) Bukkit.getPluginManager().getPlugin("ShenPulse-LavaRise")).a();
    passed = failed = 0;
    player.setInvulnerable(true);
    player.setOp(false);
    hold = Bukkit.getScheduler().runTaskTimer(this, () -> { if (anchor != null) { player.teleport(anchor); player.setVelocity(new org.bukkit.util.Vector()); } }, 1, 1);
    cmd("shenpulse_lava sync 0 1 0 10");
    cmd("lavarise lava speed 1");
    cmd("lavarise start");
    later(130, this::basic);
    return true;
  }
  private void basic() {
    check("round-start", game.p() && !game.q());
    check("player-command-without-op", player.hasPermission("shenpulse.lavarise.use") && !player.isOp());
    cmd("lavarise tp 15 TestViewer");
    previousY = player.getLocation().getY();
    check("tp-level", previousY > game.r().e().getY());
    cmd("lavarise tp up 2 TestViewer");
    check("tp-up", player.getLocation().getY() > previousY);
    previousY = player.getLocation().getY();
    cmd("lavarise tp down 1 TestViewer");
    check("tp-down", player.getLocation().getY() < previousY);
    anchor = player.getLocation().clone();
    lava = game.r().i();
    cmd("lavarise lava up 2 TestViewer");
    check("lava-up", game.r().i() == lava + 2);
    cmd("lavarise lava down 1 TestViewer");
    check("lava-down", game.r().i() == lava + 1);
    check("lava-speed", game.s() == 1);
    for (String effect : List.of("boost", "slow", "jump", "blind", "glow")) cmd("shenpulse_lava effect " + effect + " 3 TestViewer");
    for (PotionEffectType effect : List.of(PotionEffectType.SPEED, PotionEffectType.SLOWNESS, PotionEffectType.JUMP_BOOST, PotionEffectType.BLINDNESS, PotionEffectType.GLOWING)) {
      PotionEffect active = player.getPotionEffect(effect);
      check("potion-" + effect.getKey().getKey(), active != null && active.getDuration() > 0 && active.getDuration() <= 60);
    }
    cmd("lavarise effect levitation TestViewer");
    PotionEffect levitation = player.getPotionEffect(PotionEffectType.LEVITATION);
    check("levitation", levitation != null && levitation.getDuration() <= 40);
    cmd("lavarise freeze 5 TestViewer");
    check("freeze", game.e() && game.f() == 5);
    cmd("lavarise unfreeze 2 TestViewer");
    check("unfreeze", game.f() == 3);
    later(90, this::afterPotions);
  }
  private void afterPotions() {
    check("potions-expire", List.of(PotionEffectType.SPEED, PotionEffectType.SLOWNESS, PotionEffectType.JUMP_BOOST, PotionEffectType.BLINDNESS, PotionEffectType.GLOWING, PotionEffectType.LEVITATION).stream().noneMatch(player::hasPotionEffect));
    check("freeze-expires", !game.e() && game.f() == 0);
    cmd("lavarise jump 5 3 TestViewer");
    PotionEffect jump = player.getPotionEffect(PotionEffectType.JUMP_BOOST);
    check("mega-jump", jump != null && jump.getAmplifier() == 4 && jump.getDuration() <= 60);
    for (String mob : List.of("ghost", "skeleton", "mixed")) {
      int before = game.y();
      cmd("lavarise mobs spawn 2 " + mob + " TestViewer");
      check("mobs-" + mob, game.y() >= before + 2);
    }
    cmd("lavarise mobs clear TestViewer");
    check("mobs-clear", game.y() == 0);
    cmd("lavarise ice 5 TestViewer");
    check("ice", game.z() && game.A() == 5);
    cmd("lavarise moving 10 TestViewer");
    check("moving", game.B() && game.C() == 10);
    inventory = player.getInventory().getContents().clone();
    cmd("lavarise gear 10 TestViewer");
    check("gear", game.D() && !Arrays.equals(inventory, player.getInventory().getContents()));
    later(225, this::afterGear);
  }
  private void afterGear() {
    check("ice-expires", !game.z());
    check("moving-expires", !game.B());
    check("gear-restores", !game.D() && Arrays.equals(inventory, player.getInventory().getContents()));
    inventory = player.getInventory().getContents().clone();
    cmd("lavarise gear5 10 TestViewer");
    check("hero-gear", game.G() && !Arrays.equals(inventory, player.getInventory().getContents()));
    cmd("shenpulse_lava sync 7 3 3 20");
    check("wins-sync", game.g() == 7 && game.j() == 3 && game.h() == 20);
    later(225, this::victory);
  }
  private void victory() {
    check("hero-restores", !game.G() && Arrays.equals(inventory, player.getInventory().getContents()));
    check("multiplier-expires", game.j() == 1);
    cmd("lavarise wintimer 10");
    check("victory-duration", game.i() == 10);
    cmd("shenpulse_lava sync 7 2 120 20");
    cmd("lavarise tp 60 TestViewer");
    anchor = player.getLocation().clone();
    initialWins = game.g();
    later(230, () -> {
      check("native-victory-multiplied", game.g() == initialWins + 2);
      anchor = game.r().e().clone().add(0, 10, 0);
      // The next round restarts after five seconds. Wait for its countdown too.
      later(230, this::loss);
    });
  }
  private void loss() {
    if (!game.p()) { cmd("lavarise start"); later(125, this::loss); return; }
    initialWins = game.g();
    anchor = null;
    hold.cancel();
    player.teleport(game.r().f().clone().add(0.5, 1, 0.5));
    cmd("lavarise lava up 10 TestViewer");
    later(30, () -> {
      check("native-loss-multiplied-once", game.g() == initialWins - 2);
      player.setInvulnerable(false);
      cmd("lavarise stop");
      cmd("shenpulse_lava sync 0 1 0 10");
      getLogger().info("SHENPULSE_LAVA_TEST_SUMMARY passed=" + passed + " failed=" + failed);
      try { getDataFolder().mkdirs(); java.nio.file.Files.writeString(getDataFolder().toPath().resolve("results.txt"), String.join("\n", results)); } catch (Exception error) { throw new RuntimeException(error); }
    });
  }
  private void check(String name, boolean success) {
    if (success) passed++; else failed++;
    String result = "SHENPULSE_LAVA_TEST " + (success ? "PASS " : "FAIL ") + name;
    results.add(result); getLogger().info(result);
  }
  private void cmd(String command) { Bukkit.dispatchCommand(Bukkit.getConsoleSender(), command); }
  private void later(long ticks, Runnable action) { Bukkit.getScheduler().runTaskLater(this, () -> { try { action.run(); } catch (Throwable error) { check("uncaught-" + error.getClass().getSimpleName(), false); error.printStackTrace(); } }, ticks); }
}
