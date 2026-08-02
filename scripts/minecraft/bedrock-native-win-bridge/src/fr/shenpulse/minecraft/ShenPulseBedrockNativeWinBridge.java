package fr.shenpulse.minecraft;

import java.util.concurrent.atomic.AtomicBoolean;
import java.util.logging.Handler;
import java.util.logging.LogRecord;
import java.util.logging.Logger;
import org.bukkit.Bukkit;
import org.bukkit.command.ConsoleCommandSender;
import org.bukkit.event.server.ServerCommandEvent;
import org.bukkit.plugin.Plugin;
import org.bukkit.plugin.java.JavaPlugin;

/**
 * Relays only the authoritative win signal emitted by s2e-bedrock-box.
 *
 * <p>The original game deliberately keeps its final countdown seconds on
 * screen longer. The {@code win-up} log entry is emitted only after that
 * countdown has fully completed and the box is still full.</p>
 */
public final class ShenPulseBedrockNativeWinBridge extends JavaPlugin {
  static final String NATIVE_PLUGIN_NAME = "s2e-bedrock-box";
  static final String NATIVE_WIN_SIGNAL = "win-up";
  static final String GUARDED_WIN_COMMAND = "bedrock win 1";

  private final AtomicBoolean nativeWinQueued = new AtomicBoolean(false);
  private Logger nativeLogger;
  private Handler nativeWinHandler;

  @Override
  public void onEnable() {
    Bukkit.getScheduler().runTaskLater(this, this::attachNativeWinHandler, 1L);
  }

  @Override
  public void onDisable() {
    detachNativeWinHandler();
    nativeWinQueued.set(false);
  }

  static boolean isAuthoritativeWin(LogRecord record) {
    return record != null
        && NATIVE_WIN_SIGNAL.equals(String.valueOf(record.getMessage()).trim());
  }

  private void attachNativeWinHandler() {
    detachNativeWinHandler();
    Plugin nativePlugin = Bukkit.getPluginManager().getPlugin(NATIVE_PLUGIN_NAME);
    if (nativePlugin == null || !nativePlugin.isEnabled()) {
      getLogger().warning(
          "Le plugin s2e-bedrock-box est absent : le relais des victoires natives reste inactif.");
      return;
    }

    nativeLogger = nativePlugin.getLogger();
    nativeWinHandler = new Handler() {
      @Override
      public void publish(LogRecord record) {
        if (!isAuthoritativeWin(record) || !nativeWinQueued.compareAndSet(false, true)) {
          return;
        }
        Bukkit.getScheduler().runTask(
            ShenPulseBedrockNativeWinBridge.this,
            ShenPulseBedrockNativeWinBridge.this::relayAuthoritativeWin);
      }

      @Override
      public void flush() {
        // Nothing to flush.
      }

      @Override
      public void close() {
        // Nothing to close.
      }
    };
    nativeLogger.addHandler(nativeWinHandler);
    getLogger().info(
        "Relais de victoire native actif : aucune WIN n'est comptée avant le signal win-up.");
  }

  private void relayAuthoritativeWin() {
    try {
      ConsoleCommandSender console = Bukkit.getConsoleSender();
      ServerCommandEvent guardedWin =
          new ServerCommandEvent(console, GUARDED_WIN_COMMAND);
      Bukkit.getPluginManager().callEvent(guardedWin);
      if (!guardedWin.isCancelled()) {
        getLogger().severe(
            "Le garde ShenPulse n'a pas confirmé la victoire native ; aucune WIN n'a été ajoutée.");
      }
    } finally {
      nativeWinQueued.set(false);
    }
  }

  private void detachNativeWinHandler() {
    if (nativeLogger != null && nativeWinHandler != null) {
      nativeLogger.removeHandler(nativeWinHandler);
    }
    nativeLogger = null;
    nativeWinHandler = null;
  }
}
