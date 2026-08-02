package fr.shenpulse.minecraft;

import java.util.logging.Level;
import java.util.logging.LogRecord;

public final class NativeWinSignalContract {
  private NativeWinSignalContract() {}

  public static void main(String[] args) {
    assertSignal("win-up", true);
    assertSignal(" win-up ", true);
    assertSignal("bedrock_win", false);
    assertSignal("WIN", false);
    assertSignal("cancel", false);
    assertSignal("", false);
    if (ShenPulseBedrockNativeWinBridge.isAuthoritativeWin(null)) {
      throw new AssertionError("A null record must never count as a WIN.");
    }
    System.out.println("Native WIN signal contract: OK");
  }

  private static void assertSignal(String message, boolean expected) {
    LogRecord record = new LogRecord(Level.INFO, message);
    boolean actual = ShenPulseBedrockNativeWinBridge.isAuthoritativeWin(record);
    if (actual != expected) {
      throw new AssertionError(
          "Unexpected result for '" + message + "': " + actual + " (expected " + expected + ")");
    }
  }
}
