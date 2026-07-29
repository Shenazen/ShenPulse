package fr.shenpulse.minecraft;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import org.bukkit.Bukkit;
import org.bukkit.ChatColor;
import org.bukkit.Color;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.NamespacedKey;
import org.bukkit.Particle;
import org.bukkit.Registry;
import org.bukkit.Sound;
import org.bukkit.World;
import org.bukkit.attribute.Attribute;
import org.bukkit.attribute.AttributeInstance;
import org.bukkit.block.Block;
import org.bukkit.block.data.BlockData;
import org.bukkit.configuration.file.YamlConfiguration;
import org.bukkit.entity.Entity;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Display;
import org.bukkit.entity.FallingBlock;
import org.bukkit.entity.Player;
import org.bukkit.entity.TNTPrimed;
import org.bukkit.entity.TextDisplay;
import org.bukkit.event.EventHandler;
import org.bukkit.event.EventPriority;
import org.bukkit.event.Listener;
import org.bukkit.event.block.BlockBreakEvent;
import org.bukkit.event.block.BlockExplodeEvent;
import org.bukkit.event.block.BlockPlaceEvent;
import org.bukkit.event.entity.EntityExplodeEvent;
import org.bukkit.event.player.PlayerCommandPreprocessEvent;
import org.bukkit.event.server.ServerCommandEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.potion.PotionEffect;
import org.bukkit.potion.PotionEffectType;
import org.bukkit.util.Transformation;
import org.bukkit.util.Vector;
import org.joml.AxisAngle4f;
import org.joml.Vector3f;

public final class ShenPulseBedrockEffectsPatch extends JavaPlugin
    implements Listener {
  private boolean topLockEnabled;
  private boolean autoReplaceEnabled;
  private final Map<UUID, double[]> longHandsRanges = new HashMap<>();

  @Override
  public void onEnable() {
    topLockEnabled = getConfig().getBoolean("top-lock", false);
    autoReplaceEnabled = getConfig().getBoolean("auto-replace", false);
    Bukkit.getPluginManager().registerEvents(this, this);
    getLogger().info("Bedrock Box effects patch enabled.");
  }

  @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = false)
  public void onServerCommand(ServerCommandEvent event) {
    handleCommand(event.getCommand());
  }

  @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = false)
  public void onPlayerCommand(PlayerCommandPreprocessEvent event) {
    handleCommand(event.getMessage());
  }

  private void handleCommand(String rawCommand) {
    String clean = String.valueOf(rawCommand == null ? "" : rawCommand)
        .trim()
        .replaceFirst("^/+", "");
    String[] args = clean.split("\\s+");
    if (args.length < 2 || !"bedrock".equalsIgnoreCase(args[0])) return;
    String operation = args[1]
        .toLowerCase(Locale.ROOT)
        .replace("-", "")
        .replace("_", "");
    switch (operation) {
      case "supertnt" -> runSuperTnt(
          intArg(args, 2, 1, 1, 200),
          intArg(args, 3, 4, 2, 20)
      );
      case "faketnt" -> runFakeTnt(intArg(args, 2, 1, 1, 1000));
      case "blackhole", "trounoir" ->
          runBlackHole(intArg(args, 2, 10, 1, 300));
      case "meteor", "meteore" -> runMeteor();
      case "comets", "cometes" -> runComets(
          intArg(args, 2, 10, 1, 300),
          intArg(args, 3, 2, 1, 60)
      );
      case "longhands", "longhand" ->
          runLongHands(intArg(args, 2, 10, 1, 300));
      case "tp" -> teleportToBox();
      case "toplock" -> toggleTopLock();
      case "autoreplace" -> toggleAutoReplace();
      default -> {
        // This plugin augments only interactions rejected during validation.
      }
    }
  }

  private void runSuperTnt(int count, int power) {
    Location center = arenaTop(7.0D);
    if (center == null) return;
    World world = center.getWorld();
    int visibleCount = Math.max(1, count);
    for (int index = 0; index < visibleCount; index += 1) {
      Location spawn = center.clone().add(
          random(-4.0D, 4.0D),
          random(0.5D, 5.0D),
          random(-4.0D, 4.0D)
      );
      TNTPrimed tnt = (TNTPrimed) world.spawnEntity(
          spawn,
          EntityType.TNT
      );
      tnt.setFuseTicks(48 + index % 12);
      tnt.setYield((float)Math.max(4, power));
      tnt.setIsIncendiary(false);
      tnt.setCustomName(ChatColor.RED + "SUPER TNT ×" + power);
      tnt.setCustomNameVisible(true);
      tnt.setGlowing(true);
      tnt.setVelocity(new Vector(
          random(-0.14D, 0.14D),
          random(0.15D, 0.45D),
          random(-0.14D, 0.14D)
      ));
    }
    world.spawnParticle(
        Particle.FLAME,
        center,
        180,
        4.0D,
        3.0D,
        4.0D,
        0.08D
    );
    world.playSound(center, Sound.ENTITY_WITHER_SPAWN, 1.4F, 0.65F);
    announce("SUPER TNT", visibleCount + " TNT · puissance " + power);
  }

  private void runFakeTnt(int count) {
    Location center = arenaTop(7.0D);
    if (center == null) return;
    World world = center.getWorld();
    int visibleCount = Math.max(3, Math.min(48, count * 3));
    for (int index = 0; index < visibleCount; index += 1) {
      Location spawn = center.clone().add(
          random(-4.5D, 4.5D),
          random(1.0D, 5.5D),
          random(-4.5D, 4.5D)
      );
      TNTPrimed fake = (TNTPrimed) world.spawnEntity(spawn, EntityType.TNT);
      fake.setFuseTicks(75);
      fake.setYield(0.0F);
      fake.setCustomName(ChatColor.YELLOW + "FAKE TNT");
      fake.setCustomNameVisible(true);
      fake.setGlowing(true);
      fake.setVelocity(new Vector(
          random(-0.09D, 0.09D),
          random(0.05D, 0.22D),
          random(-0.09D, 0.09D)
      ));
      UUID id = fake.getUniqueId();
      Bukkit.getScheduler().runTaskLater(this, () -> {
        Entity entity = Bukkit.getEntity(id);
        if (entity == null) return;
        Location burst = entity.getLocation();
        entity.remove();
        world.spawnParticle(
            Particle.POOF,
            burst,
            100,
            1.5D,
            1.5D,
            1.5D,
            0.12D
        );
        world.spawnParticle(
            Particle.SMOKE,
            burst,
            80,
            1.2D,
            1.2D,
            1.2D,
            0.08D
        );
        world.playSound(
            burst,
            Sound.ENTITY_FIREWORK_ROCKET_BLAST,
            1.3F,
            1.75F
        );
      }, 52L + index % 8);
    }
    announce("FAKE TNT", "Elles vont disparaître sans dégâts");
  }

  private void runBlackHole(int seconds) {
    Location center = arenaTop(11.0D);
    if (center == null) return;
    World world = center.getWorld();
    TextDisplay core = (TextDisplay)world.spawnEntity(
        center,
        EntityType.TEXT_DISPLAY
    );
    core.setText(ChatColor.BLACK + "●");
    core.setBillboard(Display.Billboard.CENTER);
    core.setBackgroundColor(Color.fromARGB(255, 0, 0, 0));
    core.setDefaultBackground(false);
    core.setSeeThrough(false);
    core.setShadowed(false);
    core.setViewRange(96.0F);
    core.setTransformation(new Transformation(
        new Vector3f(),
        new AxisAngle4f(),
        new Vector3f(9.0F, 9.0F, 9.0F),
        new AxisAngle4f()
    ));
    world.playSound(center, Sound.ENTITY_WITHER_SPAWN, 1.5F, 0.35F);
    tickBlackHole(core, center, seconds * 10);
    announce("TROU NOIR", seconds + " secondes · aspiration active");
  }

  private void tickBlackHole(
      TextDisplay core,
      Location center,
      int stepsRemaining
  ) {
    if (stepsRemaining <= 0 || !core.isValid()) {
      if (core.isValid()) core.remove();
      center.getWorld().spawnParticle(
          Particle.EXPLOSION_EMITTER,
          center,
          2
      );
      return;
    }
    World world = center.getWorld();
    for (int index = 0; index < 80; index += 1) {
      double theta = random(0.0D, Math.PI * 2.0D);
      double phi = random(-Math.PI / 2.0D, Math.PI / 2.0D);
      double radius = random(3.0D, 7.0D);
      Location particle = center.clone().add(
          Math.cos(theta) * Math.cos(phi) * radius,
          Math.sin(phi) * radius,
          Math.sin(theta) * Math.cos(phi) * radius
      );
      world.spawnParticle(Particle.SQUID_INK, particle, 2, 0, 0, 0, 0);
      world.spawnParticle(
          Particle.REVERSE_PORTAL,
          particle,
          2,
          0.15D,
          0.15D,
          0.15D,
          0.04D
      );
    }
    for (Entity entity : world.getNearbyEntities(
        center,
        30.0D,
        40.0D,
        30.0D
    )) {
      if (entity.equals(core) || entity.isDead()) continue;
      Vector pull = center.toVector().subtract(entity.getLocation().toVector());
      double distance = pull.length();
      if (distance < 0.5D) continue;
      double strength = Math.min(1.25D, 6.0D / Math.max(1.0D, distance));
      entity.setVelocity(
          entity.getVelocity().multiply(0.22D)
              .add(pull.normalize().multiply(strength))
      );
    }
    if (stepsRemaining % 10 == 0) {
      world.playSound(center, Sound.BLOCK_PORTAL_AMBIENT, 1.2F, 0.35F);
    }
    Bukkit.getScheduler().runTaskLater(
        this,
        () -> tickBlackHole(core, center, stepsRemaining - 1),
        2L
    );
  }

  private void runMeteor() {
    Location target = arenaTop(1.0D);
    if (target == null) return;
    spawnMeteor(target, true);
    announce("MÉTÉORITE", "Impact imminent sur la box");
  }

  private void runComets(int durationSeconds, int intervalSeconds) {
    Location target = arenaTop(1.0D);
    if (target == null) return;
    int count = Math.max(
        2,
        Math.min(80, durationSeconds / Math.max(1, intervalSeconds))
    );
    for (int index = 0; index < count; index += 1) {
      int delay = index * Math.max(5, intervalSeconds * 20);
      Bukkit.getScheduler().runTaskLater(
          this,
          () -> spawnMeteor(
              target.clone().add(
                  random(-5.0D, 5.0D),
                  0.0D,
                  random(-5.0D, 5.0D)
              ),
              false
          ),
          delay
      );
    }
    announce(
        "COMÈTES",
        count + " impacts pendant " + durationSeconds + " secondes"
    );
  }

  private void spawnMeteor(Location target, boolean large) {
    World world = target.getWorld();
    Location start = target.clone().add(
        random(-5.0D, 5.0D),
        large ? 22.0D : 17.0D,
        random(-5.0D, 5.0D)
    );
    List<UUID> blocks = new ArrayList<>();
    int size = large ? 7 : 3;
    for (int index = 0; index < size; index += 1) {
      Location spawn = start.clone().add(
          random(-1.4D, 1.4D),
          random(-1.4D, 1.4D),
          random(-1.4D, 1.4D)
      );
      FallingBlock block = world.spawnFallingBlock(
          spawn,
          (index % 3 == 0 ? Material.OBSIDIAN : Material.MAGMA_BLOCK)
              .createBlockData()
      );
      block.setDropItem(false);
      block.setCancelDrop(true);
      block.setGlowing(true);
      block.setHurtEntities(true);
      block.setVelocity(
          target.toVector().subtract(spawn.toVector()).normalize()
              .multiply(large ? 1.15D : 1.35D)
      );
      blocks.add(block.getUniqueId());
    }
    world.playSound(start, Sound.ENTITY_FIREWORK_ROCKET_LAUNCH, 1.5F, 0.4F);
    meteorTrail(start, target, blocks, large ? 34 : 27, large);
  }

  private void meteorTrail(
      Location start,
      Location target,
      List<UUID> blocks,
      int ticks,
      boolean large
  ) {
    if (ticks <= 0) {
      for (UUID id : blocks) {
        Entity entity = Bukkit.getEntity(id);
        if (entity != null) entity.remove();
      }
      World world = target.getWorld();
      world.spawnParticle(
          Particle.EXPLOSION_EMITTER,
          target,
          large ? 4 : 2,
          1.0D,
          1.0D,
          1.0D,
          0.0D
      );
      world.spawnParticle(
          Particle.FLAME,
          target,
          large ? 320 : 140,
          3.0D,
          2.0D,
          3.0D,
          0.12D
      );
      world.playSound(target, Sound.ENTITY_GENERIC_EXPLODE, 1.8F, 0.55F);
      world.createExplosion(target, large ? 6.0F : 3.5F, false, false);
      return;
    }
    for (UUID id : blocks) {
      Entity entity = Bukkit.getEntity(id);
      if (entity == null) continue;
      Location location = entity.getLocation();
      location.getWorld().spawnParticle(
          Particle.FLAME,
          location,
          14,
          0.45D,
          0.45D,
          0.45D,
          0.05D
      );
      location.getWorld().spawnParticle(
          Particle.LARGE_SMOKE,
          location,
          8,
          0.35D,
          0.35D,
          0.35D,
          0.03D
      );
    }
    Bukkit.getScheduler().runTaskLater(
        this,
        () -> meteorTrail(start, target, blocks, ticks - 1, large),
        1L
    );
  }

  private void runLongHands(int seconds) {
    for (Player player : Bukkit.getOnlinePlayers()) {
      AttributeInstance blockRange = attribute(
          player,
          "player.block_interaction_range"
      );
      AttributeInstance entityRange = attribute(
          player,
          "player.entity_interaction_range"
      );
      double oldBlock = blockRange == null ? 0.0D : blockRange.getBaseValue();
      double oldEntity =
          entityRange == null ? 0.0D : entityRange.getBaseValue();
      longHandsRanges.put(
          player.getUniqueId(),
          new double[] { oldBlock, oldEntity }
      );
      if (blockRange != null) blockRange.setBaseValue(Math.max(12.0D, oldBlock));
      if (entityRange != null) {
        entityRange.setBaseValue(Math.max(10.0D, oldEntity));
      }
      player.addPotionEffect(new PotionEffect(
          PotionEffectType.HASTE,
          seconds * 20,
          4,
          true,
          true,
          true
      ));
      player.sendMessage(
          ChatColor.LIGHT_PURPLE
              + "Long Hands actif : portée de 12 blocs pendant "
              + seconds
              + "s."
      );
      UUID playerId = player.getUniqueId();
      Bukkit.getScheduler().runTaskLater(
          this,
          () -> restoreLongHands(playerId),
          seconds * 20L
      );
    }
    announce("LONG HANDS", "Portée augmentée à 12 blocs");
  }

  private void restoreLongHands(UUID playerId) {
    double[] values = longHandsRanges.remove(playerId);
    Player player = Bukkit.getPlayer(playerId);
    if (values == null || player == null) return;
    AttributeInstance blockRange = attribute(
        player,
        "player.block_interaction_range"
    );
    AttributeInstance entityRange = attribute(
        player,
        "player.entity_interaction_range"
    );
    if (blockRange != null) blockRange.setBaseValue(values[0]);
    if (entityRange != null) entityRange.setBaseValue(values[1]);
  }

  private AttributeInstance attribute(Player player, String key) {
    Attribute attribute = Registry.ATTRIBUTE.get(NamespacedKey.minecraft(key));
    return attribute == null ? null : player.getAttribute(attribute);
  }

  private void teleportToBox() {
    Location target = arenaTop(3.0D);
    if (target == null) return;
    int teleported = 0;
    for (Player player : Bukkit.getOnlinePlayers()) {
      player.teleport(target);
      player.setFallDistance(0.0F);
      player.getWorld().spawnParticle(
          Particle.PORTAL,
          player.getLocation().add(0.0D, 1.0D, 0.0D),
          90,
          0.8D,
          1.2D,
          0.8D,
          0.18D
      );
      player.playSound(
          player.getLocation(),
          Sound.ENTITY_ENDERMAN_TELEPORT,
          1.0F,
          1.0F
      );
      teleported += 1;
    }
    announce(
        "TÉLÉPORTATION BOX",
        teleported + " joueur(s) replacé(s) au-dessus de la box"
    );
  }

  private void toggleTopLock() {
    topLockEnabled = !topLockEnabled;
    getConfig().set("top-lock", topLockEnabled);
    saveConfig();
    announce(
        "TOP LOCK : " + (topLockEnabled ? "ACTIF" : "INACTIF"),
        topLockEnabled
            ? "Les blocs au-dessus de la limite sont refusés"
            : "La construction au-dessus de la box est autorisée"
    );
  }

  private void toggleAutoReplace() {
    autoReplaceEnabled = !autoReplaceEnabled;
    getConfig().set("auto-replace", autoReplaceEnabled);
    saveConfig();
    announce(
        "AUTO REPLACE : " + (autoReplaceEnabled ? "ACTIF" : "INACTIF"),
        autoReplaceEnabled
            ? "Les blocs détruits dans la box réapparaissent"
            : "Les blocs détruits restent supprimés"
    );
  }

  @EventHandler(priority = EventPriority.HIGHEST, ignoreCancelled = false)
  public void onBlockPlace(BlockPlaceEvent event) {
    if (!topLockEnabled || !isInsideBox(event.getBlockPlaced())) return;
    if (event.getBlockPlaced().getY() <= arena().topY()) return;
    event.setCancelled(true);
    event.getPlayer().sendMessage(
        ChatColor.RED + "Top Lock actif : hauteur maximale atteinte."
    );
  }

  @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
  public void onBlockBreak(BlockBreakEvent event) {
    if (!autoReplaceEnabled || !isInsideBox(event.getBlock())) return;
    scheduleReplacement(event.getBlock(), event.getBlock().getBlockData());
  }

  @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
  public void onEntityExplode(EntityExplodeEvent event) {
    if (!autoReplaceEnabled) return;
    for (Block block : new ArrayList<>(event.blockList())) {
      if (isInsideBox(block)) {
        scheduleReplacement(block, block.getBlockData());
      }
    }
  }

  @EventHandler(priority = EventPriority.MONITOR, ignoreCancelled = true)
  public void onBlockExplode(BlockExplodeEvent event) {
    if (!autoReplaceEnabled) return;
    for (Block block : new ArrayList<>(event.blockList())) {
      if (isInsideBox(block)) {
        scheduleReplacement(block, block.getBlockData());
      }
    }
  }

  private void scheduleReplacement(Block block, BlockData data) {
    Location location = block.getLocation();
    Bukkit.getScheduler().runTaskLater(this, () -> {
      Block target = location.getBlock();
      if (target.isEmpty()) target.setBlockData(data, false);
      target.getWorld().spawnParticle(
          Particle.HAPPY_VILLAGER,
          target.getLocation().add(0.5D, 0.5D, 0.5D),
          14,
          0.35D,
          0.35D,
          0.35D,
          0.0D
      );
    }, 12L);
  }

  private boolean isInsideBox(Block block) {
    Arena arena = arena();
    return block.getWorld().getName().equals(arena.worldName())
        && Math.abs(block.getX() - arena.centerX()) <= arena.radius()
        && Math.abs(block.getZ() - arena.centerZ()) <= arena.radius()
        && block.getY() >= arena.centerY()
        && block.getY() <= arena.topY() + 12;
  }

  private Location arenaTop(double above) {
    Arena arena = arena();
    World world = Bukkit.getWorld(arena.worldName());
    if (world == null) {
      Player player = Bukkit.getOnlinePlayers().stream().findFirst().orElse(null);
      return player == null
          ? null
          : player.getLocation().add(0.0D, above, 0.0D);
    }
    return new Location(
        world,
        arena.centerX() + 0.5D,
        arena.topY() + above,
        arena.centerZ() + 0.5D
    );
  }

  private Arena arena() {
    Plugin plugin = Bukkit.getPluginManager().getPlugin("s2e-bedrock-box");
    File dataFolder = plugin == null
        ? new File(getDataFolder().getParentFile(), "s2e-bedrock-box")
        : plugin.getDataFolder();
    YamlConfiguration config = YamlConfiguration.loadConfiguration(
        new File(dataFolder, "config.yml")
    );
    String[] location = config
        .getString("arena", "world,0,64,0")
        .split(",");
    String worldName = location.length > 0 ? location[0].trim() : "world";
    int centerX = location.length > 1 ? parseInt(location[1], 0) : 0;
    int centerY = location.length > 2 ? parseInt(location[2], 64) : 64;
    int centerZ = location.length > 3 ? parseInt(location[3], 0) : 0;
    int radius = Math.max(1, config.getInt("radius", 6));
    int height = Math.max(1, config.getInt("height", 9));
    return new Arena(worldName, centerX, centerY, centerZ, radius, height);
  }

  private void announce(String title, String subtitle) {
    for (Player player : Bukkit.getOnlinePlayers()) {
      player.sendTitle(
          ChatColor.GOLD + title,
          ChatColor.WHITE + subtitle,
          5,
          45,
          10
      );
    }
    getLogger().info(title + " — " + subtitle);
  }

  private static int intArg(
      String[] args,
      int index,
      int fallback,
      int minimum,
      int maximum
  ) {
    if (args.length <= index) return fallback;
    return Math.max(
        minimum,
        Math.min(maximum, parseInt(args[index], fallback))
    );
  }

  private static int parseInt(String value, int fallback) {
    try {
      return Integer.parseInt(String.valueOf(value).trim());
    } catch (RuntimeException error) {
      return fallback;
    }
  }

  private static double random(double minimum, double maximum) {
    return ThreadLocalRandom.current().nextDouble(minimum, maximum);
  }

  private record Arena(
      String worldName,
      int centerX,
      int centerY,
      int centerZ,
      int radius,
      int height
  ) {
    int topY() {
      return centerY + height;
    }
  }
}
