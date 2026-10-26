"use strict";

/** Catalogue de jeux : domaine « external-games », données et identifiants conservés. */
const { external } = require("./builders");

const EXTERNAL_GAMES = [
  ...require("./shop-games"),
  require("./escape-from-duckov"),
  require("./crowd-control-games").BLUE_PRINCE,
  external("hollow-knight-silksong", "Hollow Knight: Silksong", "https://resources.crowdcontrol.live/images/HollowKnightSilksong/box.jpg", "Crowd Control + StreamToEarn"),
  external("hollow-knight", "Hollow Knight", "https://resources.crowdcontrol.live/images/HollowKnight/box.jpg", "Crowd Control + StreamToEarn"),
  require("./four-crowd-control-games").EGGING_ON,
  require("./crowd-control-games").BALATRO,
  external("celeste", "Celeste", "https://resources.crowdcontrol.live/images/Celeste/box.jpg", "Crowd Control"),
  require("./four-crowd-control-games").DEAD_BY_DAYLIGHT,
  external("deep-rock-galactic", "Deep Rock Galactic", "https://resources.crowdcontrol.live/images/DeepRockGalactic/box.jpg", "Crowd Control"),
  require("./four-crowd-control-games").DREDGE,
  require("./four-crowd-control-games").FALLOUT_4,
  external("hades", "Hades", "https://resources.crowdcontrol.live/images/Hades/box.jpg", "Crowd Control"),
  external("inscryption", "Inscryption", "https://resources.crowdcontrol.live/images/Inscryption/box.jpg", "Crowd Control"),
  external("no-mans-sky", "No Man's Sky", "https://resources.crowdcontrol.live/images/NoMansSky/box.jpg", "Crowd Control"),
  external("palworld", "Palworld", "https://resources.crowdcontrol.live/images/Palworld/box.jpg", "Crowd Control"),
  external("resident-evil-7-biohazard", "Resident Evil 7 Biohazard", "https://resources.crowdcontrol.live/images/ResidentEvil7/box.jpg", "Crowd Control"),
  external("vampire-survivors", "Vampire Survivors", "https://resources.crowdcontrol.live/images/VampireSurvivors/box.jpg", "Crowd Control"),
  require("./ark-survival-ascended").ARK_SURVIVAL_ASCENDED,
  external("cities-skylines", "Cities Skylines", "https://resources.crowdcontrol.live/images/CitiesSkylines/box.jpg", "Crowd Control"),
  external("kingdom-come-deliverance-2", "Kingdom Come: Deliverance II", "https://resources.crowdcontrol.live/images/KingdomComeDeliverance2/box.jpg", "Crowd Control"),
  external("deep-rock-galactic-survivor", "Deep Rock Galactic: Survivor", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1750320384724_Deep%20Rock%20Galactic%20Survivor.png", "StreamToEarn"),
  external("hades-ii", "Hades II", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1761054320515_Hades2_v2_.png", "StreamToEarn"),
  external("wobbly-life", "Wobbly Life", "https://d1jl7r3beoolrj.cloudfront.net/public/images/1747850530522_WobblyLife_poster.png", "StreamToEarn")
];

module.exports = { EXTERNAL_GAMES };

