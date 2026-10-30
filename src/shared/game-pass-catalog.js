"use strict";

/** Disponibilité vérifiée dans le catalogue Microsoft PC, marché France. */
(function exposeGamePassCatalog(root, factory) {
  const catalog = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = catalog;
  else root.ShenPulseGamePassCatalog = catalog;
})(typeof globalThis === "undefined" ? this : globalThis, () => {
  const verifiedAt = "2026-10-21";
  const source = "https://www.xbox.com/en-US/games/browse/pc-game-pass-all-games";
  const catalogUrl = "https://catalog.gamepass.com/sigls/v2?id=fdd9e2a7-0fee-49f6-ad69-4354098401ff&language=en-us&market=FR";
  const products = Object.freeze({
    "halo-combat-evolved": "9NTM9HXNLSZX",
    "ball-x-pit": "9MWXF3SRD7QN",
    "brotato": "9P9VNSQK1W3K",
    "cloverpit": "9P8V7HR160B4",
    "fallout-new-vegas": "9MZR11JRF7BX",
    "frog-sqwad": "9N16RZ0S50V2",
    "microsoft-flight-simulator-2024": "9P2VGCTBMM52",
    "resident-evil-2": "BWMH951M3G3P",
    "resident-evil-village": "9N2S04LGXXH4",
    "roadside-research": "9PFNXM9G4N83",
    "rv-there-yet": "9MW79BJVF3QX",
    "skyrim-special-edition": "9P03JGQ4S1GC",
    "totally-accurate-battle-simulator": "9PC4RWP34M2D",
    "vampire-crawlers": "9NMPVJ7TCFD0",
    "farming-simulator-25": "9PM709J61828",
    "escape-the-backrooms": "9MW15L8FRT9P",
    "snowrunner": "9NP6WL1XQDBW",
    "final-fantasy-1-pixel-remaster": "9P20JCF7BV93",
    "final-fantasy-2-pixel-remaster": "9P8S1MN4066K",
    "final-fantasy-3-pixel-remaster": "9NWDPFPPK30V",
    "final-fantasy-4-pixel-remaster": "9N8C07SS8C9D",
    "final-fantasy-5-pixel-remaster": "9N9C8SV0S16W",
    "minecraft-diamond-rush": "9NXP44L49SHJ",
    "minecraft-box-cyber": "9NXP44L49SHJ",
    "ark-survival-ascended": "9P33VJGVPHVP",
    balatro: "9PK087LNGJC5",
    "blue-prince": "9PFRTPRQ569Q",
    "cities-skylines": "9NWVC7XP3PFD",
    "crash-bandicoot-n-sane-trilogy": "9NJ2FD5HJ7SB",
    "dead-by-daylight": "9NMS4SFNBGBH",
    "deep-rock-galactic": "9NHFVWX1V7QJ",
    dredge: "9MSVVM5NS9L6",
    "egging-on": "9PDKDBQGG2N2",
    "fallout-4": "C3KLDKZBHNCZ",
    hades: "9P8DL6W0JBB8",
    "hades-ii": "9PCR3Z2MSM4T",
    "hollow-knight": "9MW9469V91LM",
    "hollow-knight-silksong": "9N116V0599HB",
    inscryption: "9P8NSTDMZ11P",
    "kingdom-come-deliverance-2": "9N4W31HSMVVD",
    minecraft: "9NXP44L49SHJ",
    "minecraft-java": "9NXP44L49SHJ",
    "minecraft-lavarise": "9NXP44L49SHJ",
    "minecraft-bedrock-box": "9NXP44L49SHJ",
    "minecraft-sandbox-3": "9NXP44L49SHJ",
    "minecraft-survival-plugin": "9NXP44L49SHJ",
    "no-mans-sky": "BQVQTL3PCH05",
    palworld: "9NKV34XDW014",
    "resident-evil-3": "9P7T44TTDL7M",
    "resident-evil-7-biohazard": "9NBLGGH4SPK6",
    "stardew-valley": "9MWR1NC6VQ6L",
    "supermarket-simulator": "9NR0GCBSLDW4",
    "vampire-survivors": "9PD5BM2Z8C4L",
    "wobbly-life": "9NS86BQ33SPX"
  });
  // Ces jeux gratuits proposent des avantages Ultimate, et non un achat du jeu.
  const benefits = Object.freeze({ fortnite: "BT5P2X999VH2", "rocket-league": "C125W9BG2K0V" });

  function offerFor(pack = {}) {
    const kind = Object.hasOwn(products, pack.id) ? "game" : Object.hasOwn(benefits, pack.id) ? "benefits" : "";
    if (!kind) return null;
    return Object.freeze({ productId: products[pack.id] || benefits[pack.id], kind, verifiedAt, source });
  }

  return Object.freeze({ verifiedAt, source, catalogUrl, products, benefits, offerFor });
});
