/** Orchestre les quatre API publiques historiques de rendu et téléchargement. */

import { canvasToBlob, defaultOverlayFilename, ensureMinecraftOverlayFont, loadOverlayImage } from "./assets.mjs";
import { INTERACTION_SPRITES_SRC, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "./constants.mjs";
import { sortWinItems } from "./effects.mjs";
import { drawBottomPanel, drawModelOneBottomPanel, drawWinColumn, modelOneBottomPanelBounds } from "./layout.mjs";
import { groupOverlayEffectItems, prepareMinecraftStyledOverlayItems, prepareOverlayItems } from "./model.mjs";

async function downloadMinecraftBedrockOverlay(options) {
  const canvas = await renderMinecraftBedrockOverlay(options);
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename || defaultOverlayFilename();
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function downloadMinecraftStyledOverlay(options) {
  const canvas = await renderMinecraftStyledOverlay(options);
  const blob = await canvasToBlob(canvas);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = options.filename || `shenpulse-game-overlay-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1200);
}

async function renderMinecraftStyledOverlay(options) {
  const canvas = document.createElement("canvas");
  canvas.width = OVERLAY_WIDTH;
  canvas.height = OVERLAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  const entries = options.entries.filter((entry) => String(entry.label || "").trim());
  if (!entries.length) throw new Error("Active au moins une interaction complete avant de telecharger l overlay.");
  await ensureMinecraftOverlayFont();
  const preparedItems = await prepareMinecraftStyledOverlayItems(entries);
  const winItems = preparedItems.filter((item) => item.effect.kind === "win");
  const effectItems = groupOverlayEffectItems(
    preparedItems.filter((item) => item.effect.kind !== "win")
  ).slice(0, Math.max(0, 42 - winItems.length));
  const positiveWins = sortWinItems(winItems.filter((item) => item.effect.winTone !== "negative" && item.effect.winTone !== "random"));
  const negativeWins = sortWinItems(winItems.filter((item) => item.effect.winTone === "negative" || item.effect.winTone === "random"));
  if (options.model === 1) {
    const logo2 = await loadOverlayImage("assets/brand/shenpulse-banner-transparent.png");
    const panel = modelOneBottomPanelBounds(effectItems.length);
    ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
    drawWinColumn(ctx, positiveWins, "left", panel.y);
    drawWinColumn(ctx, negativeWins, "right", panel.y);
    drawModelOneBottomPanel(ctx, effectItems, panel, logo2, options.backgroundColor);
    return canvas;
  }
  const effectIconUrls = Array.from(new Set(effectItems.map((item) => item.effect.imageUrl).filter((url) => Boolean(url))));
  const [logo, effectIconEntries] = await Promise.all([
    loadOverlayImage("assets/brand/shenpulse-banner-transparent.png"),
    Promise.all(effectIconUrls.map(async (url) => [url, await loadOverlayImage(url)]))
  ]);
  const assets = {
    effectIcons: new Map(effectIconEntries),
    interactionSprites: null
  };
  ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
  drawWinColumn(ctx, positiveWins, "left");
  drawWinColumn(ctx, negativeWins, "right");
  drawBottomPanel(ctx, effectItems, logo, assets);
  return canvas;
}

async function renderMinecraftBedrockOverlay(options) {
  const canvas = document.createElement("canvas");
  canvas.width = OVERLAY_WIDTH;
  canvas.height = OVERLAY_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas indisponible.");
  const [items] = await Promise.all([
    prepareOverlayItems(options.mappings, options.giftOptions),
    ensureMinecraftOverlayFont()
  ]);
  const winItems = items.filter((item) => item.effect.kind === "win");
  const effectItems = groupOverlayEffectItems(
    items.filter((item) => item.effect.kind !== "win")
  ).slice(0, Math.max(0, 42 - winItems.length));
  const positiveWins = sortWinItems(winItems.filter((item) => item.effect.winTone !== "negative" && item.effect.winTone !== "random"));
  const negativeWins = sortWinItems(winItems.filter((item) => item.effect.winTone === "negative" || item.effect.winTone === "random"));
  if (options.model === 1) {
    const logo2 = await loadOverlayImage("assets/brand/shenpulse-banner-transparent.png");
    const panel = modelOneBottomPanelBounds(effectItems.length);
    ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
    drawWinColumn(ctx, positiveWins, "left", panel.y);
    drawWinColumn(ctx, negativeWins, "right", panel.y);
    drawModelOneBottomPanel(ctx, effectItems, panel, logo2, options.backgroundColor);
    return canvas;
  }
  const effectIconUrls = Array.from(new Set(effectItems.map((item) => item.effect.imageUrl).filter((url) => Boolean(url))));
  const [logo, interactionSprites, effectIconEntries] = await Promise.all([
    loadOverlayImage("assets/brand/shenpulse-banner-transparent.png"),
    loadOverlayImage(INTERACTION_SPRITES_SRC),
    Promise.all(effectIconUrls.map(async (url) => [url, await loadOverlayImage(url)]))
  ]);
  const assets = {
    effectIcons: new Map(effectIconEntries),
    interactionSprites
  };
  ctx.clearRect(0, 0, OVERLAY_WIDTH, OVERLAY_HEIGHT);
  drawWinColumn(ctx, positiveWins, "left");
  drawWinColumn(ctx, negativeWins, "right");
  drawBottomPanel(ctx, effectItems, logo, assets);
  return canvas;
}

export { downloadMinecraftBedrockOverlay, downloadMinecraftStyledOverlay, renderMinecraftStyledOverlay, renderMinecraftBedrockOverlay };

