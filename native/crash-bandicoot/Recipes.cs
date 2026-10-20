using System;
using System.Collections.Generic;

namespace ShenPulse.Crash
{
    public sealed class Edit
    {
        public long offset;
        public byte[] expected, value, original;
        public Edit(long offset, byte[] expected, byte[] value) { this.offset = offset; this.expected = expected; this.value = value; }
    }
    public sealed class Recipe
    {
        public string group;
        public int seconds;
        public Edit[] edits;
        public Recipe(string group, int seconds, params Edit[] edits) { this.group = group; this.seconds = seconds; this.edits = edits; }
    }
    public static class Recipes
    {
        static Edit B(long offset, byte before, byte after) { return new Edit(offset, new[] { before }, new[] { after }); }
        static Edit F(long offset, float value) { return new Edit(offset, BitConverter.GetBytes(1f), BitConverter.GetBytes(value)); }
        static Edit Data(long offset, float value) { return new Edit(offset, null, BitConverter.GetBytes(value)); }
        static byte[] Hex(string text) { var parts = text.Split(' '); return Array.ConvertAll(parts, p => Convert.ToByte(p, 16)); }
        static Edit Code(long offset, string before, string after) { return new Edit(offset, Hex(before), Hex(after)); }
        public static readonly string[] Counters = { "givelife", "takelife", "givefruit", "takefruit", "giveboxes", "takeboxes" };
        public static Recipe For(string code)
        {
            switch (code)
            {
                case "infinitejump": return new Recipe("jump", 10, B(0x589A17, 1, 0));
                case "invisiblefloor": return new Recipe("floor", 10, B(0xAFAA4C, 0x60, 0x80));
                case "groundspeed_300": case "groundspeed_50": case "groundspeed_m100":
                    float speed = code == "groundspeed_300" ? 3f : code == "groundspeed_50" ? .5f : -1f;
                    return new Recipe("speed", 15, F(0x13A65D0, speed), F(0x13A65D4, speed));
                case "nojump": return new Recipe("jump", 5, B(0x4A90B0, 0x48, 0xC3));
                case "nospin": return new Recipe("spin", 10, B(0x48E8EF, 1, 0));
                case "burnorcalmeyes_300": case "burnorcalmeyes_20":
                    return new Recipe("light", 20, new Edit(0x18BE838, BitConverter.GetBytes(.01f), BitConverter.GetBytes(code.EndsWith("300") ? .03f : .002f)));
                case "fov_30": case "fov_150": case "fov_280":
                    float degrees = code == "fov_30" ? 30f : code == "fov_150" ? 150f : 280f;
                    return new Recipe("camera", 15, Data(0x1ABEFC8, degrees * (float)Math.PI / 180f),
                        Code(0x32B244, "F3 0F 59 35 CC B1 07 01", "66 0F 6E 35 7C 3D 79 01"));
                case "funnycolorone": return new Recipe("color", 20, B(0x32BA20, 0x6C, 0x70));
                case "fadedreality": return new Recipe("fade", 10, B(0xAFA6F0, 0x7C, 0x6C));
                case "floatyjump": return new Recipe("jump", 10, B(0x4ADD5D, 0xA3, 0xE3));
                case "jumpspeed_300": case "jumpspeed_70":
                    return new Recipe("jump", 10, Data(0x1ABEFCC, code.EndsWith("300") ? 3f : .7f),
                        Code(0x4AD54E, "F3 44 0F 10 25 19 13 41 01", "F3 44 0F 10 25 75 1A 61 01"));
                case "crashsize_0": case "crashsize_200": case "crashsize_50":
                    return new Recipe("size", 10, Data(0x1ABEFD0, code == "crashsize_0" ? 0f : code == "crashsize_200" ? 2f : .5f),
                        Code(0x482146, "F3 0F 59 83 BC 00 00 00", "F3 0F 10 05 82 CE 63 01"),
                        Code(0x48209C, "F3 0F 10 80 BC 00 00 00", "F3 0F 10 05 2C CF 63 01"));
                default: return null;
            }
        }
    }
}
