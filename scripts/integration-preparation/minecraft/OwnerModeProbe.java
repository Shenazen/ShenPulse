package fr.shenpulse.qa;

import com.google.gson.Gson;
import java.lang.reflect.*;
import java.util.*;
import org.bukkit.*;
import org.bukkit.entity.*;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

/** Sonde de recette isolée, jamais incluse dans un pack distribué. */
public final class OwnerModeProbe extends JavaPlugin {
  private Object value(Object instance, String name) {
    if (instance == null) return null;
    for (Class<?> type = instance.getClass(); type != null; type = type.getSuperclass()) {
      try { Field field = type.getDeclaredField(name); field.setAccessible(true); return field.get(instance); }
      catch (NoSuchFieldException ignored) {} catch (Exception error) { throw new IllegalStateException(error); }
    }
    return null;
  }
  private int size(Object instance) { return instance instanceof Map<?,?> map ? map.size() : 0; }
  @Override public void onEnable() {
    getCommand("shenpulseqa").setExecutor((sender, command, label, args) -> {
      if (sender instanceof Player) return false;
      try {
        if (args.length > 1 && args[0].equals("health")) {
          for (Player player : Bukkit.getOnlinePlayers()) player.setHealth(Double.parseDouble(args[1]));
        }
        Map<String,Object> state = new LinkedHashMap<>();
        World world = Bukkit.getWorlds().get(0);
        Plugin diamond = Bukkit.getPluginManager().getPlugin("ShenPulse-DiamondRush");
        Plugin box = Bukkit.getPluginManager().getPlugin("ShenPulse-BoxCyber");
        state.put("diamondEnabled", diamond != null && diamond.isEnabled());
        state.put("boxEnabled", box != null && box.isEnabled());
        if (diamond != null) {
          for (String key : List.of("totalDiamonds", "totalWins", "diamondMultiplier", "diamondMultiTimer", "winMultiplier", "winMultiTimer", "arenaReady")) state.put(key, value(diamond, key));
          state.put("prisons", size(value(diamond, "prisonTimes")));
        }
        if (box != null) {
          Object manager = box.getClass().getMethod("getCountdownManager").invoke(box);
          for (String key : List.of("winCount", "shenMultiplier", "countdown", "isCountingDown")) state.put(key, value(manager, key));
          Object prison = value(((JavaPlugin)box).getCommand("prison1").getExecutor(), "prisonManager");
          state.put("prisons", size(value(prison, "prisonTimers")));
          state.put("parkourPrisons", size(value(prison, "prison2Players")));
        }
        Map<String,Integer> blocks = new TreeMap<>();
        int minX = diamond != null ? -19 : -4, maxX = diamond != null ? 19 : 4;
        int minZ = diamond != null ? -19 : -26, maxZ = diamond != null ? 19 : -18;
        int minY = diamond != null ? -8 : 15, maxY = diamond != null ? 45 : 26;
        for (int x = minX; x <= maxX; x++) for (int y = minY; y <= maxY; y++) for (int z = minZ; z <= maxZ; z++) {
          String name = world.getBlockAt(x,y,z).getType().name(); blocks.merge(name, 1, Integer::sum);
        }
        state.put("blocks", blocks);
        Map<String,Integer> entities = new TreeMap<>();
        for (Entity entity : world.getEntities()) entities.merge(entity.getType().name(), 1, Integer::sum);
        state.put("entities", entities);
        List<Object> players = new ArrayList<>();
        for (Player player : Bukkit.getOnlinePlayers()) {
          Map<String,Object> data = new LinkedHashMap<>();
          data.put("name", player.getName()); data.put("x", player.getLocation().getX()); data.put("y", player.getLocation().getY()); data.put("z", player.getLocation().getZ());
          data.put("health", player.getHealth()); data.put("mode", player.getGameMode().name()); data.put("hand", player.getInventory().getItemInMainHand().getType().name());
          data.put("effects", player.getActivePotionEffects().stream().map(effect -> Map.of("type", effect.getType().getName(), "ticks", effect.getDuration())).toList());
          players.add(data);
        }
        state.put("players", players);
        getLogger().info("SHENPULSE_QA " + new Gson().toJson(state));
      } catch (Exception error) { getLogger().severe("SHENPULSE_QA_ERROR " + error); }
      return true;
    });
  }
}
