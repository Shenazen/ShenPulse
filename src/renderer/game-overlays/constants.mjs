/** Dimensions, ressources et conventions visuelles partagées des exports. */


const OVERLAY_WIDTH = 1080;

const OVERLAY_HEIGHT = 1920;

const BOTTOM_PANEL = {
  height: 428,
  padding: 42,
  radius: 0,
  width: 1064,
  x: 8,
  y: 1484
};

const FONT_FAMILY = '"Arial Black", Impact, Inter, Arial, sans-serif';

const MINECRAFT_FONT_FACE = "ShenPulse Minecraft Pixel";

const MINECRAFT_FONT_SRC = "assets/game-overlays/minecraft-bedrock/PressStart2P-Regular.ttf";

const MINECRAFT_FONT_FAMILY = `"${MINECRAFT_FONT_FACE}", "Minecraft Ten", Minecraft, Minecrafter, Minecraftia, "Press Start 2P", "Arial Black", Impact, sans-serif`;

const INTERACTION_SPRITES_SRC = "/overlay-assets/minecraft-bedrock/interaction-sprites.png";

const STREAM_TO_EARN_EFFECT_ICON_BASE = "/overlay-assets/minecraft-bedrock/interaction-icons";

const INTERACTION_ICON_URLS = {
  autoReplace: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-auto-replace-ai.png",
  blackhole: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-blackhole.webp",
  clear: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-clear-ai.png",
  comets: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-comets.webp",
  diamond: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-diamond-ai.png",
  fakeTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fake-tnt-ai.png",
  fill: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fill-ai.png",
  fillBlock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fill-block-ai.png",
  fillRows: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fill-rows-ai.png",
  fireworks: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-fireworks-ai.png",
  glass: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-glass-ai.png",
  glassPrison: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-glass-prison-ai.png",
  heightDown: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-height-down-ai.png",
  heightUp: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-height-up-ai.png",
  longhands: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-longhands-ai.png",
  enderman: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-enderman.webp",
  meteor: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-meteor.webp",
  radiusDown: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-radius-down-ai.png",
  radiusUp: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-radius-up-ai.png",
  randomTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-random-tnt-ai.png",
  reset: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-reset-ai.png",
  rock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-rock-ai.png",
  superTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-super-tnt-ai.png",
  timer: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-timer-ai.png",
  tnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-ai.png",
  tntRocket: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-rocket-ai.png",
  tntRing: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-ring-ai.png",
  tntStep: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tnt-step-ai.png",
  topLock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-top-lock-ai.png",
  tp: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-tp-ai.png",
  weakTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-weak-tnt-ai.png",
  winAdd: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-add-ai.png",
  winBedrock: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-bedrock-ai.png",
  winRandom: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-random-ai.png",
  winRemove: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-remove-ai.png",
  winX2: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-win-x2-ai.png",
  wood: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-wood-ai.png",
  zeusTnt: STREAM_TO_EARN_EFFECT_ICON_BASE + "/bedrock-zeus-tnt.webp"
};

const SANDBOX_OVERLAY_COLOR_IDS = [
  "white",
  "orange",
  "magenta",
  "light-blue",
  "yellow",
  "lime",
  "pink",
  "gray-gravel",
  "random",
  "gray",
  "light-gray",
  "cyan",
  "purple",
  "blue",
  "brown",
  "green",
  "red",
  "black",
  "red-sand"
];

const INTERACTION_SPRITE_COLUMNS = 3;

const INTERACTION_SPRITE_ROWS = 2;

const INTERACTION_SPRITE_CELLS = {
  blocks: [2, 0],
  command: [2, 1],
  diamond: [0, 1],
  fill: [2, 0],
  reset: [1, 1],
  "super-tnt": [1, 0],
  tnt: [0, 0]
};

export { OVERLAY_WIDTH, OVERLAY_HEIGHT, BOTTOM_PANEL, FONT_FAMILY, MINECRAFT_FONT_FACE, MINECRAFT_FONT_SRC, MINECRAFT_FONT_FAMILY, INTERACTION_SPRITES_SRC, STREAM_TO_EARN_EFFECT_ICON_BASE, INTERACTION_ICON_URLS, SANDBOX_OVERLAY_COLOR_IDS, INTERACTION_SPRITE_COLUMNS, INTERACTION_SPRITE_ROWS, INTERACTION_SPRITE_CELLS };

