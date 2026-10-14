/** Dessine les cadeaux et déclencheurs, partagés entre les deux modèles. */

import { clamp, drawImageContainWithOutline, drawOutlinedText, formatCompactCount, initials, roundedRect } from "./canvas.mjs";
import { MINECRAFT_FONT_FAMILY } from "./constants.mjs";
import { mergeOverlayBadges } from "./model.mjs";

function drawTriggerBadges(ctx, badges, x, y, width, height, size, layout = "corners") {
  const orderedBadges = mergeOverlayBadges(badges).slice(0, 6);
  if (!orderedBadges.length) return;
  if (layout === "top-row" && orderedBadges.length > 1) {
    const gap = Math.max(2, size * 0.06);
    const availableWidth = width - 4;
    const badgeSize = Math.min(size * 0.82, (availableWidth - gap * (orderedBadges.length - 1)) / orderedBadges.length);
    const rowWidth = badgeSize * orderedBadges.length + gap * (orderedBadges.length - 1);
    const startX = x + (width - rowWidth) / 2;
    const badgeY = y - badgeSize * 0.14;
    orderedBadges.forEach((badge, index) => {
      drawTriggerBadge(ctx, badge, startX + index * (badgeSize + gap), badgeY, badgeSize);
    });
    return;
  }
  const singlePosition = [
    [x + width - size * 0.78, y - size * 0.12]
  ];
  const multiPositions = [
    [x - size * 0.08, y - size * 0.1],
    [x + width - size * 0.78, y - size * 0.12],
    [x + width - size * 0.72, y + height - size * 0.72],
    [x - size * 0.06, y + height - size * 0.7],
    [x + width * 0.5 - size / 2, y - size * 0.18],
    [x + width * 0.5 - size / 2, y + height - size * 0.64]
  ];
  const positions = orderedBadges.length === 1 ? singlePosition : multiPositions;
  orderedBadges.forEach((badge, index) => {
    const [badgeX, badgeY] = positions[index] || positions[positions.length - 1];
    drawTriggerBadge(ctx, badge, badgeX, badgeY, size);
  });
}

function drawTriggerBadge(ctx, badge, x, y, size) {
  if (badge.triggerType === "follow") {
    drawFollowBadge(ctx, x, y, size);
    return;
  }
  if (badge.triggerType === "likes") {
    drawLikesBadge(ctx, x, y, size, badge.likeAmount);
    return;
  }
  if (badge.triggerType === "share") {
    drawSymbolBadge(ctx, x, y, size, "#8b5cf6", "#38bdf8", ">");
    return;
  }
  if (badge.triggerType === "subscribe") {
    drawSymbolBadge(ctx, x, y, size, "#f59e0b", "#fb7185", "*");
    return;
  }
  if (badge.triggerType === "chat") {
    drawSymbolBadge(ctx, x, y, size, "#38bdf8", "#0f172a", "#");
    return;
  }
  if (badge.triggerType === "join") {
    drawSymbolBadge(ctx, x, y, size, "#14b8a6", "#164e63", "+");
    return;
  }
  if (badge.triggerType === "raid") {
    drawSymbolBadge(ctx, x, y, size, "#f97316", "#7c2d12", "!");
    return;
  }
  drawGiftBadge(ctx, badge, x, y, size);
}

function drawFollowBadge(ctx, x, y, size) {
  ctx.save();
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
  ctx.shadowBlur = size * 0.24;
  ctx.shadowOffsetY = size * 0.1;
  const gradient = ctx.createRadialGradient(cx - size * 0.18, cy - size * 0.2, size * 0.08, cx, cy, size * 0.62);
  gradient.addColorStop(0, "#ff4860");
  gradient.addColorStop(0.62, "#ff1f3d");
  gradient.addColorStop(1, "#9f1026");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, size * 0.42, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(3, size * 0.085);
  ctx.strokeStyle = "#020617";
  ctx.stroke();
  ctx.lineCap = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = Math.max(4, size * 0.11);
  ctx.beginPath();
  ctx.moveTo(cx - size * 0.2, cy);
  ctx.lineTo(cx + size * 0.2, cy);
  ctx.moveTo(cx, cy - size * 0.2);
  ctx.lineTo(cx, cy + size * 0.2);
  ctx.stroke();
  ctx.restore();
}

function drawLikesBadge(ctx, x, y, size, amount) {
  ctx.save();
  const cx = x + size * 0.46;
  const cy = y + size * 0.42;
  ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
  ctx.shadowBlur = size * 0.22;
  ctx.shadowOffsetY = size * 0.1;
  ctx.fillStyle = "#f43f5e";
  ctx.strokeStyle = "#020617";
  ctx.lineWidth = Math.max(3, size * 0.075);
  drawHeartPath(ctx, cx, cy, size * 0.74);
  ctx.fill();
  ctx.stroke();
  ctx.shadowBlur = 0;
  drawOutlinedText(ctx, `x${formatCompactCount(amount)}`, x + size * 0.54, y + size * 0.92, {
    align: "center",
    color: "#ffffff",
    fontFamily: MINECRAFT_FONT_FAMILY,
    fontSize: clamp(size * 0.18, 9, 15),
    lineWidth: Math.max(3, size * 0.05),
    maxWidth: size * 0.96
  });
  ctx.restore();
}

function drawSymbolBadge(ctx, x, y, size, colorA, colorB, symbol) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
  ctx.shadowBlur = size * 0.22;
  ctx.shadowOffsetY = size * 0.1;
  roundedRect(ctx, x + size * 0.08, y + size * 0.08, size * 0.84, size * 0.84, size * 0.18);
  const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
  gradient.addColorStop(0, colorA);
  gradient.addColorStop(1, colorB);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(3, size * 0.075);
  ctx.strokeStyle = "#020617";
  ctx.stroke();
  drawOutlinedText(ctx, symbol, x + size / 2, y + size * 0.66, {
    align: "center",
    color: "#ffffff",
    fontFamily: MINECRAFT_FONT_FAMILY,
    fontSize: size * 0.36,
    lineWidth: size * 0.07
  });
  ctx.restore();
}

function drawHeartPath(ctx, cx, cy, size) {
  const top = cy - size * 0.22;
  ctx.beginPath();
  ctx.moveTo(cx, cy + size * 0.36);
  ctx.bezierCurveTo(cx - size * 0.58, top + size * 0.2, cx - size * 0.38, top - size * 0.26, cx - size * 0.1, top);
  ctx.bezierCurveTo(cx, top + size * 0.06, cx, top + size * 0.06, cx + size * 0.1, top);
  ctx.bezierCurveTo(cx + size * 0.38, top - size * 0.26, cx + size * 0.58, top + size * 0.2, cx, cy + size * 0.36);
  ctx.closePath();
}

function drawGiftBadge(ctx, item, x, y, size) {
  ctx.save();
  if (item.giftImage) {
    drawImageContainWithOutline(ctx, item.giftImage, x, y, size, size, {
      outlineColor: "#020617",
      outlineSize: Math.max(3, size * 0.085),
      shadowBlur: size * 0.22,
      shadowColor: "rgba(0, 0, 0, 0.58)",
      shadowOffsetY: size * 0.1
    });
  } else {
    const colors = item.colors.length >= 2 ? item.colors : ["#14b8a6", "#0f172a"];
    const gradient = ctx.createLinearGradient(x, y, x + size, y + size);
    gradient.addColorStop(0, colors[0]);
    gradient.addColorStop(1, colors[1]);
    roundedRect(ctx, x, y, size, size, Math.max(6, size * 0.18));
    ctx.shadowColor = "rgba(0, 0, 0, 0.58)";
    ctx.shadowBlur = size * 0.2;
    ctx.shadowOffsetY = size * 0.1;
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = Math.max(3, size * 0.085);
    ctx.strokeStyle = "#020617";
    ctx.stroke();
    drawOutlinedText(ctx, initials(item.giftLabel), x + size / 2, y + size * 0.65, {
      align: "center",
      color: "#ffffff",
      fontSize: size * 0.42,
      lineWidth: size * 0.08
    });
  }
  ctx.restore();
}

export { drawTriggerBadges, drawTriggerBadge, drawFollowBadge, drawLikesBadge, drawSymbolBadge, drawHeartPath, drawGiftBadge };

