/** Primitives Canvas réutilisables : texte, images, couleurs et géométrie. */

import { FONT_FAMILY } from "./constants.mjs";

function drawImageContainWithOutline(ctx, image, x, y, width, height, options) {
  const rect = containImageRect(image, x, y, width, height);
  const offsets = outlineOffsets(options.outlineSize);
  ctx.save();
  ctx.shadowColor = options.shadowColor;
  ctx.shadowBlur = options.shadowBlur;
  ctx.shadowOffsetY = options.shadowOffsetY;
  ctx.filter = "brightness(0)";
  ctx.globalAlpha = 0.96;
  for (const [offsetX, offsetY] of offsets) {
    ctx.drawImage(image, rect.x + offsetX, rect.y + offsetY, rect.width, rect.height);
  }
  ctx.restore();
  ctx.save();
  ctx.shadowColor = options.shadowColor;
  ctx.shadowBlur = options.shadowBlur * 0.55;
  ctx.shadowOffsetY = options.shadowOffsetY * 0.7;
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function outlineOffsets(size) {
  const radius = Math.max(2, size);
  return [
    [-radius, 0],
    [radius, 0],
    [0, -radius],
    [0, radius],
    [-radius * 0.72, -radius * 0.72],
    [radius * 0.72, -radius * 0.72],
    [-radius * 0.72, radius * 0.72],
    [radius * 0.72, radius * 0.72]
  ];
}

function drawImageContain(ctx, image, x, y, width, height) {
  const rect = containImageRect(image, x, y, width, height);
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height);
}

function containImageRect(image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  return {
    height: drawHeight,
    width: drawWidth,
    x: x + (width - drawWidth) / 2,
    y: y + (height - drawHeight) / 2
  };
}

function drawOutlinedText(ctx, text, x, y, options) {
  ctx.save();
  ctx.font = `900 ${Math.round(options.fontSize)}px ${options.fontFamily || FONT_FAMILY}`;
  ctx.textAlign = options.align || "left";
  ctx.textBaseline = "alphabetic";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.strokeStyle = options.stroke || "#020617";
  ctx.lineWidth = options.lineWidth ?? Math.max(3, options.fontSize * 0.18);
  if (options.maxWidth) {
    ctx.strokeText(text, x, y, options.maxWidth);
  } else {
    ctx.strokeText(text, x, y);
  }
  ctx.fillStyle = options.color;
  if (options.maxWidth) {
    ctx.fillText(text, x, y, options.maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

function drawStackedOutlinedText(ctx, text, x, y, maxWidth, options) {
  const maxLines = options.maxLines || 2;
  let fontSize = options.fontSize;
  let lines = wrapText(ctx, text, maxWidth, fontSize, options.fontFamily);
  while ((lines.length > maxLines || lines.some((line) => measureText(ctx, line, fontSize, options.fontFamily) > maxWidth)) && fontSize > 9) {
    fontSize -= 1;
    lines = wrapText(ctx, text, maxWidth, fontSize, options.fontFamily);
  }
  lines = lines.slice(0, maxLines);
  const lineHeight = fontSize * 1.02;
  const startY = y - (lines.length - 1) * lineHeight;
  lines.forEach((line, index) => {
    drawOutlinedText(ctx, line, x, startY + index * lineHeight, {
      align: options.align || "center",
      color: options.color,
      fontFamily: options.fontFamily,
      fontSize,
      lineWidth: options.lineWidth
    });
  });
}

function wrapText(ctx, text, maxWidth, fontSize, fontFamily = FONT_FAMILY) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  const lines = [];
  let current = words.shift() || "";
  for (const word of words) {
    const candidate = `${current} ${word}`.trim();
    if (measureText(ctx, candidate, fontSize, fontFamily) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function measureText(ctx, text, fontSize, fontFamily = FONT_FAMILY) {
  ctx.save();
  ctx.font = `900 ${Math.round(fontSize)}px ${fontFamily}`;
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function shadeColor(color, percent) {
  const clean = color.replace("#", "");
  const number = Number.parseInt(clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean, 16);
  if (!Number.isFinite(number)) return color;
  const amount = Math.round(2.55 * percent);
  const red = clamp((number >> 16) + amount, 0, 255);
  const green = clamp((number >> 8 & 255) + amount, 0, 255);
  const blue = clamp((number & 255) + amount, 0, 255);
  return `#${(16777216 + red * 65536 + green * 256 + blue).toString(16).slice(1)}`;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function initials(value) {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  const letters = words.length > 1 ? `${words[0][0] || ""}${words[1][0] || ""}` : (words[0] || "?").slice(0, 2);
  return letters.toUpperCase();
}

function formatCompactCount(value) {
  const amount = Math.max(0, Math.round(Number(value) || 0));
  if (amount >= 1e6) return `${Math.floor(amount / 1e6)}M`;
  if (amount >= 1e4) return `${Math.floor(amount / 1e3)}K`;
  if (amount >= 1e3) return `${Math.floor(amount / 100) / 10}K`.replace(".0K", "K");
  return String(amount);
}

function triggerLabel(mapping) {
  if (mapping.triggerType === "likes") return `${mapping.likeAmount} likes`;
  if (mapping.triggerType === "chat") return mapping.chatCommand || "Chat";
  if (mapping.triggerType === "follow") return "Follow";
  if (mapping.triggerType === "share") return "Share";
  if (mapping.triggerType === "subscribe") return "Subscribe";
  if (mapping.triggerType === "join") return "Join";
  if (mapping.triggerType === "raid") return "Raid";
  return "Gift";
}

function triggerColors(triggerType) {
  if (triggerType === "likes") return ["#ec4899", "#7f1d1d"];
  if (triggerType === "chat") return ["#38bdf8", "#0f172a"];
  if (triggerType === "follow") return ["#22c55e", "#064e3b"];
  if (triggerType === "share") return ["#a78bfa", "#312e81"];
  if (triggerType === "subscribe") return ["#f59e0b", "#7c2d12"];
  if (triggerType === "join") return ["#14b8a6", "#164e63"];
  if (triggerType === "raid") return ["#f97316", "#7c2d12"];
  return ["#14b8a6", "#0f172a"];
}

export { drawImageContainWithOutline, outlineOffsets, drawImageContain, containImageRect, drawOutlinedText, drawStackedOutlinedText, wrapText, measureText, roundedRect, shadeColor, clamp, initials, formatCompactCount, triggerLabel, triggerColors };

