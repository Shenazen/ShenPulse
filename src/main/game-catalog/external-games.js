"use strict";

/** Catalogue de jeux : domaine « external-games », données et identifiants conservés. */
const { external } = require("./builders");

const EXTERNAL_GAMES = [
  external("blue-prince", "Blue Prince", "https://resources.crowdcontrol.live/images/BluePrince/box.jpg", "Crowd Control"),
  external("hollow-knight-silksong", "Hollow Knight: Silksong", "https://resources.crowdcontrol.live/images/HollowKnightSilksong/box.jpg", "Crowd Control + StreamToEarn"),
  external("hollow-knight", "Hollow Knight", "https://resources.crowdcontrol.live/images/HollowKnight/box.jpg", "Crowd Control + StreamToEarn"),
  external("supermarket-simulator", "Supermarket Simulator", "https://resources.crowdcontrol.live/images/SupermarketSimulator/box.jpg", "Crowd Control + StreamToEarn"),
  external("egging-on", "Egging On", "https://resources.crowdcontrol.live/images/EggingOn/box.jpg", "Crowd Control + StreamToEarn"),
  external("balatro", "Balatro", "https://resources.crowdcontrol.live/images/Balatro/box.jpg", "Crowd Control"),
  external("celeste", "Celeste", "https://resources.crowdcontrol.live/images/Celeste/box.jpg", "Crowd Control"),
  external("dead-by-daylight", "Dead by Daylight", "https://resources.crowdcontrol.live/images/DeadbyDaylight/box.jpg", "Crowd Control"),
  external("deep-rock-galactic", "Deep Rock Galactic", "https://resources.crowdcontrol.live/images/DeepRockGalactic/box.jpg", "Crowd Control"),
  external("dredge", "DREDGE", "https://resources.crowdcontrol.live/images/Dredge/box.jpg", "Crowd Control"),
  external("fallout-4", "Fallout 4", "https://resources.crowdcontrol.live/images/Fallout4/box.jpg", "Crowd Control"),
  external("hades", "Hades", "https://resources.crowdcontrol.live/images/Hades/box.jpg", "Crowd Control"),
  external("inscryption", "Inscryption", "https://resources.crowdcontrol.live/images/Inscryption/box.jpg", "Crowd Control"),
  external("no-mans-sky", "No Man's Sky", "https://resources.crowdcontrol.live/images/NoMansSky/box.jpg", "Crowd Control"),
  external("palworld", "Palworld", "https://resources.crowdcontrol.live/images/Palworld/box.jpg", "Crowd Control"),
  external("resident-evil-7-biohazard", "Resident Evil 7 Biohazard", "https://resources.crowdcontrol.live/images/ResidentEvil7/box.jpg", "Crowd Control"),
  external("vampire-survivors", "Vampire Survivors", "https://resources.crowdcontrol.live/images/VampireSurvivors/box.jpg", "Crowd Control"),
  external("ark-survival-ascended", "ARK: Survival Ascended", "https://resources.crowdcontrol.live/images/ARKSurvivalAscended/box.jpg", "Crowd Control"),
  external("cities-skylines", "Cities Skylines", "https://resources.crowdcontrol.live/images/CitiesSkylines/box.jpg", "Crowd Control"),
  external("kingdom-come-deliverance-2", "Kingdom Come: Deliverance II", "https://resources.crowdcontrol.live/images/KingdomComeDeliverance2/box.jpg", "Crowd Control"),
  external("deep-rock-galactic-survivor", "Deep Rock Galactic: Survivor", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1750320384724_Deep%20Rock%20Galactic%20Survivor.png", "StreamToEarn"),
  external("hades-ii", "Hades II", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1761054320515_Hades2_v2_.png", "StreamToEarn"),
  external("wobbly-life", "Wobbly Life", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1747850530522_WobblyLife_poster.png", "StreamToEarn")
];

module.exports = { EXTERNAL_GAMES };

