/** Dessine les icônes de jeux et leurs variantes procédurales. */

import { drawOutlinedText, shadeColor } from "./canvas.mjs";
import { INTERACTION_SPRITE_CELLS, INTERACTION_SPRITE_COLUMNS, INTERACTION_SPRITE_ROWS } from "./constants.mjs";

function drawEffectIcon(ctx, effect, cx, cy, size, assets) {
  const effectImage = effect.imageUrl ? assets.effectIcons.get(effect.imageUrl) : null;
  if (effectImage) {
    drawEffectImage(ctx, effectImage, cx, cy, size * 1.28);
    return;
  }
  const spriteCell = INTERACTION_SPRITE_CELLS[effect.kind];
  if (assets.interactionSprites && spriteCell) {
    const scale = effect.kind === "tnt" || effect.kind === "super-tnt" ? 1.3 : 1.18;
    drawInteractionSprite(ctx, assets.interactionSprites, spriteCell, cx, cy, size * scale);
    return;
  }
  if (effect.kind === "tnt" || effect.kind === "super-tnt") {
    drawTntCluster(ctx, cx, cy, size, effect.amount || 1, effect.kind === "super-tnt");
    return;
  }
  if (effect.kind === "blocks" || effect.kind === "fill") {
    drawBlockStack(ctx, cx, cy, size, effect.kind === "fill" ? "#4ade80" : "#d92517");
    return;
  }
  if (effect.kind === "diamond") {
    drawBlockStack(ctx, cx, cy, size, "#5eead4");
    return;
  }
  if (effect.kind === "reset") {
    drawResetIcon(ctx, cx, cy, size);
    return;
  }
  if (effect.kind === "glass") {
    drawGlassIcon(ctx, cx, cy, size);
    return;
  }
  if (effect.kind === "timer") {
    drawTimerIcon(ctx, cx, cy, size);
    return;
  }
  if (effect.kind === "tp") {
    drawPortalIcon(ctx, cx, cy, size);
    return;
  }
  drawCommandIcon(ctx, cx, cy, size);
}

function drawEffectImage(ctx, image, cx, cy, size) {
  const ratio = image.naturalWidth && image.naturalHeight ? image.naturalWidth / image.naturalHeight : 1;
  const drawWidth = ratio >= 1 ? size : size * ratio;
  const drawHeight = ratio >= 1 ? size / ratio : size;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.54)";
  ctx.shadowBlur = size * 0.18;
  ctx.shadowOffsetY = size * 0.08;
  ctx.drawImage(image, cx - drawWidth / 2, cy - drawHeight / 2, drawWidth, drawHeight);
  ctx.restore();
}

function drawInteractionSprite(ctx, image, cell, cx, cy, size) {
  const sourceWidth = image.naturalWidth / INTERACTION_SPRITE_COLUMNS;
  const sourceHeight = image.naturalHeight / INTERACTION_SPRITE_ROWS;
  const drawSize = Math.min(size, sourceWidth, sourceHeight);
  const sourceX = cell[0] * sourceWidth;
  const sourceY = cell[1] * sourceHeight;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.48)";
  ctx.shadowBlur = drawSize * 0.16;
  ctx.shadowOffsetY = drawSize * 0.08;
  ctx.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    cx - drawSize / 2,
    cy - drawSize / 2,
    drawSize,
    drawSize
  );
  ctx.restore();
}

function drawTntCluster(ctx, cx, cy, size, amount, superTnt) {
  const blockCount = tntBlockCount(amount);
  const blockSize = blockCount === 1 ? size * 0.9 : blockCount <= 3 ? size * 0.66 : size * 0.56;
  const offsets = tntClusterOffsets(blockCount, blockSize);
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.42)";
  ctx.shadowBlur = size * 0.16;
  ctx.shadowOffsetY = size * 0.08;
  offsets.forEach(([offsetX, offsetY], index) => {
    drawMinecraftTntBlock(ctx, cx + offsetX, cy + offsetY, blockSize, {
      highlight: index === offsets.length - 1,
      superTnt
    });
  });
  ctx.restore();
}

function tntBlockCount(amount) {
  if (amount >= 300) return 5;
  if (amount >= 80) return 4;
  if (amount >= 20) return 3;
  if (amount >= 3) return 2;
  return 1;
}

function tntClusterOffsets(count, size) {
  if (count <= 1) return [[0, 0]];
  if (count === 2) return [[-size * 0.26, size * 0.1], [size * 0.26, -size * 0.06]];
  if (count === 3) return [[-size * 0.34, size * 0.14], [size * 0.32, size * 0.12], [0, -size * 0.2]];
  if (count === 4) return [[-size * 0.36, size * 0.2], [size * 0.32, size * 0.18], [-size * 0.05, -size * 0.14], [size * 0.48, -size * 0.2]];
  return [[-size * 0.48, size * 0.24], [size * 0.12, size * 0.24], [size * 0.52, size * 0.02], [-size * 0.18, -size * 0.18], [size * 0.36, -size * 0.24]];
}

function drawMinecraftTntBlock(ctx, cx, cy, size, options = {}) {
  const frontWidth = size * 0.96;
  const frontHeight = size * 0.7;
  const depthX = size * 0.22;
  const depthY = size * 0.22;
  const x = cx - frontWidth / 2 - depthX * 0.16;
  const y = cy - frontHeight / 2 + depthY * 0.36;
  const red = options.superTnt ? "#e94724" : "#d7271e";
  const redDark = options.superTnt ? "#7c150f" : "#81110e";
  const redLight = options.superTnt ? "#ff743d" : "#f14a32";
  const outline = "#120304";
  ctx.save();
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2.2, size * 0.04);
  ctx.strokeStyle = outline;
  const topGradient = ctx.createLinearGradient(x, y - depthY, x + frontWidth, y);
  topGradient.addColorStop(0, redLight);
  topGradient.addColorStop(0.45, "#ff8a45");
  topGradient.addColorStop(1, "#b91c1c");
  ctx.fillStyle = topGradient;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depthX, y - depthY);
  ctx.lineTo(x + frontWidth + depthX, y - depthY);
  ctx.lineTo(x + frontWidth, y);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  drawTntTopPixels(ctx, x, y, frontWidth, depthX, depthY);
  const sideGradient = ctx.createLinearGradient(x + frontWidth, y, x + frontWidth + depthX, y + frontHeight);
  sideGradient.addColorStop(0, "#a51d15");
  sideGradient.addColorStop(1, redDark);
  ctx.fillStyle = sideGradient;
  ctx.beginPath();
  ctx.moveTo(x + frontWidth, y);
  ctx.lineTo(x + frontWidth + depthX, y - depthY);
  ctx.lineTo(x + frontWidth + depthX, y + frontHeight - depthY);
  ctx.lineTo(x + frontWidth, y + frontHeight);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  const frontGradient = ctx.createLinearGradient(x, y, x, y + frontHeight);
  frontGradient.addColorStop(0, redLight);
  frontGradient.addColorStop(0.22, red);
  frontGradient.addColorStop(1, redDark);
  ctx.fillStyle = frontGradient;
  ctx.fillRect(x, y, frontWidth, frontHeight);
  ctx.strokeRect(x, y, frontWidth, frontHeight);
  drawTntPixels(ctx, x, y, frontWidth, frontHeight, depthX, depthY, options.superTnt === true);
  const bandHeight = frontHeight * 0.31;
  const bandY = y + frontHeight * 0.36;
  const bandX = x + frontWidth * 0.06;
  const bandWidth = frontWidth * 0.88;
  ctx.fillStyle = "#f5f1e8";
  ctx.fillRect(bandX, bandY, bandWidth, bandHeight);
  ctx.fillStyle = "rgba(203, 213, 225, 0.7)";
  ctx.fillRect(bandX, bandY + bandHeight * 0.62, bandWidth, bandHeight * 0.18);
  ctx.strokeStyle = "#18181b";
  ctx.lineWidth = Math.max(1.4, size * 0.022);
  ctx.strokeRect(bandX, bandY, bandWidth, bandHeight);
  drawOutlinedText(ctx, options.superTnt ? "TNT+" : "TNT", x + frontWidth / 2, bandY + bandHeight * 0.76, {
    align: "center",
    color: "#111111",
    fontSize: size * 0.24,
    lineWidth: size * 0.018,
    stroke: "#ffffff"
  });
  if (options.highlight) {
    ctx.globalAlpha = 0.24;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + frontWidth * 0.08, y + frontHeight * 0.08, frontWidth * 0.18, frontHeight * 0.2);
  }
  ctx.restore();
}

function drawTntTopPixels(ctx, x, y, width, depthX, depthY) {
  ctx.save();
  ctx.lineWidth = Math.max(1, width * 0.018);
  ctx.strokeStyle = "rgba(35, 5, 5, 0.78)";
  for (let index = 0; index < 6; index += 1) {
    const stripeX = x + width * (0.12 + index * 0.145);
    ctx.beginPath();
    ctx.moveTo(stripeX, y - depthY * 0.1);
    ctx.lineTo(stripeX + depthX * 0.36, y - depthY * 0.72);
    ctx.stroke();
  }
  ctx.fillStyle = "rgba(255, 220, 150, 0.32)";
  ctx.fillRect(x + width * 0.18, y - depthY * 0.56, width * 0.16, depthY * 0.2);
  ctx.restore();
}

function drawTntPixels(ctx, x, y, width, height, depthX, depthY, superTnt) {
  const pixel = Math.max(2, width * 0.052);
  const light = superTnt ? "#ffb169" : "#ff765e";
  const dark = "#4c0908";
  ctx.fillStyle = light;
  for (let index = 0; index < 5; index += 1) {
    ctx.fillRect(x + width * (0.1 + index * 0.18), y + height * 0.1, pixel, pixel * 1.6);
  }
  ctx.fillStyle = dark;
  for (let index = 0; index < 4; index += 1) {
    ctx.fillRect(x + width * (0.17 + index * 0.19), y + height * 0.23, pixel * 0.85, pixel * 1.35);
    ctx.fillRect(x + width + depthX * 0.35, y + height * (0.15 + index * 0.15) - depthY * 0.35, pixel * 0.78, pixel * 1.3);
  }
  ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
  ctx.fillRect(x + width * 0.06, y + height * 0.05, width * 0.12, height * 0.18);
}

function drawBlockStack(ctx, cx, cy, size, color) {
  drawCube(ctx, cx - size * 0.16, cy + size * 0.12, size * 0.62, color);
  drawCube(ctx, cx + size * 0.16, cy - size * 0.1, size * 0.62, color);
}

function drawCube(ctx, cx, cy, size, color) {
  const half = size / 2;
  const depth = size * 0.22;
  const x = cx - half;
  const y = cy - half;
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.34)";
  ctx.shadowBlur = size * 0.12;
  ctx.shadowOffsetY = size * 0.06;
  ctx.fillStyle = shadeColor(color, 18);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + depth, y - depth);
  ctx.lineTo(x + size + depth, y - depth);
  ctx.lineTo(x + size, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shadeColor(color, -18);
  ctx.beginPath();
  ctx.moveTo(x + size, y);
  ctx.lineTo(x + size + depth, y - depth);
  ctx.lineTo(x + size + depth, y + size - depth);
  ctx.lineTo(x + size, y + size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, size, size);
  ctx.lineWidth = size * 0.035;
  ctx.strokeStyle = "rgba(0, 0, 0, 0.62)";
  ctx.strokeRect(x, y, size, size);
  ctx.restore();
}

function drawResetIcon(ctx, cx, cy, size) {
  drawCube(ctx, cx, cy, size * 0.76, "#f8fafc");
  drawOutlinedText(ctx, "?", cx, cy + size * 0.18, {
    align: "center",
    color: "#111827",
    fontSize: size * 0.5,
    lineWidth: size * 0.06,
    stroke: "#ffffff"
  });
  ctx.save();
  ctx.strokeStyle = "#38bdf8";
  ctx.lineWidth = size * 0.07;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.5, -0.8, 1.65);
  ctx.stroke();
  ctx.fillStyle = "#38bdf8";
  ctx.beginPath();
  ctx.moveTo(cx + size * 0.48, cy + size * 0.23);
  ctx.lineTo(cx + size * 0.62, cy + size * 0.38);
  ctx.lineTo(cx + size * 0.4, cy + size * 0.43);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGlassIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.globalAlpha = 0.82;
  drawCube(ctx, cx, cy, size * 0.82, "#7dd3fc");
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#e0f2fe";
  ctx.lineWidth = size * 0.05;
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.24, cy + size * 0.23);
  ctx.lineTo(cx + size * 0.26, cy - size * 0.28);
  ctx.stroke();
  ctx.restore();
}

function drawTimerIcon(ctx, cx, cy, size) {
  ctx.save();
  ctx.fillStyle = "#f8fafc";
  ctx.strokeStyle = "#111827";
  ctx.lineWidth = size * 0.06;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = "#0f172a";
  ctx.lineWidth = size * 0.055;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx, cy - size * 0.25);
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + size * 0.2, cy + size * 0.14);
  ctx.stroke();
  ctx.restore();
}

function drawPortalIcon(ctx, cx, cy, size) {
  ctx.save();
  const gradient = ctx.createRadialGradient(cx, cy, size * 0.08, cx, cy, size * 0.5);
  gradient.addColorStop(0, "#67e8f9");
  gradient.addColorStop(0.46, "#a855f7");
  gradient.addColorStop(1, "#312e81");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, size * 0.4, size * 0.5, -0.18, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#e9d5ff";
  ctx.lineWidth = size * 0.05;
  ctx.stroke();
  ctx.restore();
}

function drawCommandIcon(ctx, cx, cy, size) {
  drawCube(ctx, cx, cy, size * 0.78, "#f59e0b");
  drawOutlinedText(ctx, "/", cx, cy + size * 0.19, {
    align: "center",
    color: "#fff7ed",
    fontSize: size * 0.54,
    lineWidth: size * 0.07
  });
}

function drawSoftGroundShadow(ctx, cx, cy, width, height) {
  ctx.save();
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, width / 2);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.36)");
  gradient.addColorStop(0.68, "rgba(0, 0, 0, 0.16)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, width / 2, height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export { drawEffectIcon, drawEffectImage, drawInteractionSprite, drawTntCluster, tntBlockCount, tntClusterOffsets, drawMinecraftTntBlock, drawTntTopPixels, drawTntPixels, drawBlockStack, drawCube, drawResetIcon, drawGlassIcon, drawTimerIcon, drawPortalIcon, drawCommandIcon, drawSoftGroundShadow };

