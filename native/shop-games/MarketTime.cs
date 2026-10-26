using System;
namespace ShenPulse.ShopGames {
 internal static class MarketTime {
  public static float AdvanceElapsed(float elapsed,float dayLength) { return Math.Min(Math.Max(0,dayLength),Math.Max(0,elapsed)+7200); }
  public static int SecondsOfDay(float elapsed,int start) { return (int)Math.Floor(Math.Max(0,elapsed))+(start>=0&&start<24?start*3600:start); }
 }
}
