/** Compose les deux modèles, leurs cartes et colonnes de victoires. */

import { drawTriggerBadge, drawTriggerBadges } from "./badges.mjs";
import { clamp, drawImageContain, drawOutlinedText, measureText, roundedRect } from "./canvas.mjs";
import { BOTTOM_PANEL, FONT_FAMILY, MINECRAFT_FONT_FAMILY, OVERLAY_HEIGHT, OVERLAY_WIDTH } from "./constants.mjs";
import { drawEffectIcon, drawSoftGroundShadow } from "./icons.mjs";
import { mergeOverlayActionLabels, mergeOverlayBadges } from "./model.mjs";

function modelOneBottomPanelBounds(itemCount) {
  const rows = Math.max(1, Math.ceil(Math.max(1, itemCount) / 6));
  const height = clamp(84 + rows * 158, 300, 900);
  return {
    height,
    width: OVERLAY_WIDTH,
    x: 0,
    y: OVERLAY_HEIGHT - height
  };
}

function drawModelOneBottomPanel(ctx, items, panel, logo, backgroundColor = "#082b63") {
  ctx.save();
  const selectedColor = normalizeOverlayBackgroundColor(backgroundColor);
  const background = ctx.createLinearGradient(0, panel.y, 0, panel.y + panel.height);
  background.addColorStop(0, mixOverlayColor(selectedColor, "#07152f", 0.24));
  background.addColorStop(0.42, mixOverlayColor(selectedColor, "#020817", 0.5));
  background.addColorStop(1, mixOverlayColor(selectedColor, "#01040d", 0.76));
  ctx.fillStyle = background;
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  const horizontalDepth = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y);
  horizontalDepth.addColorStop(0, "rgba(3, 10, 32, 0.38)");
  horizontalDepth.addColorStop(0.24, "rgba(30, 64, 175, 0.08)");
  horizontalDepth.addColorStop(0.52, "rgba(14, 116, 144, 0.1)");
  horizontalDepth.addColorStop(0.78, "rgba(30, 64, 175, 0.07)");
  horizontalDepth.addColorStop(1, "rgba(3, 10, 32, 0.42)");
  ctx.fillStyle = horizontalDepth;
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  const lowerShade = ctx.createLinearGradient(0, panel.y + panel.height * 0.42, 0, panel.y + panel.height);
  lowerShade.addColorStop(0, "rgba(0, 0, 0, 0)");
  lowerShade.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.fillStyle = lowerShade;
  ctx.fillRect(panel.x, panel.y, panel.width, panel.height);
  const topRim = ctx.createLinearGradient(panel.x, panel.y, panel.x + panel.width, panel.y);
  topRim.addColorStop(0, "rgba(125, 211, 252, 0.04)");
  topRim.addColorStop(0.5, "rgba(125, 211, 252, 0.28)");
  topRim.addColorStop(1, "rgba(125, 211, 252, 0.04)");
  ctx.fillStyle = topRim;
  ctx.fillRect(panel.x, panel.y, panel.width, 2);
  if (items.length) drawModelOneInteractionGrid(ctx, items, panel, logo);
  ctx.restore();
}

function drawModelOneBrand(ctx, panel, logo, brandY = panel.y + 7, brandWidth = 238, brandHeight = 46, opacity = 0.58) {
  const brandX = panel.x + (panel.width - brandWidth) / 2;
  ctx.save();
  ctx.globalAlpha = clamp(opacity, 0, 1);
  if (logo) {
    drawImageContain(ctx, logo, brandX, brandY, brandWidth, brandHeight);
  } else {
    drawOutlinedText(ctx, "SHENPULSE", panel.x + panel.width / 2, brandY + 33, {
      align: "center",
      color: "#ffffff",
      fontFamily: FONT_FAMILY,
      fontSize: 27,
      lineWidth: 3,
      maxWidth: brandWidth
    });
  }
  ctx.restore();
}

function drawModelOneInteractionGrid(ctx, items, panel, logo) {
  const columns = Math.max(1, Math.min(6, items.length));
  const rows = Math.ceil(items.length / columns);
  const paddingX = 10;
  const paddingTop = 12;
  const paddingBottom = 14;
  const gapX = 8;
  const gapY = 10;
  const cellWidth = (panel.width - paddingX * 2 - gapX * (columns - 1)) / columns;
  const cellHeight = (panel.height - paddingTop - paddingBottom - gapY * (rows - 1)) / rows;
  if (rows >= 2) {
    const firstRowBottom = panel.y + paddingTop + cellHeight;
    const secondRowTop = firstRowBottom + gapY;
    const brandHeight = Math.min(104, cellHeight * 0.62);
    drawModelOneBrand(
      ctx,
      panel,
      logo,
      (firstRowBottom + secondRowTop - brandHeight) / 2,
      Math.min(500, panel.width * 0.48),
      brandHeight,
      0.24
    );
  } else {
    const brandHeight = Math.min(92, cellHeight * 0.58);
    drawModelOneBrand(
      ctx,
      panel,
      logo,
      panel.y + paddingTop + (cellHeight - brandHeight) / 2,
      Math.min(440, panel.width * 0.44),
      brandHeight,
      0.2
    );
  }
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawModelOneInteractionCard(
      ctx,
      item,
      panel.x + paddingX + column * (cellWidth + gapX),
      panel.y + paddingTop + row * (cellHeight + gapY),
      cellWidth,
      cellHeight
    );
  });
}

function normalizeOverlayBackgroundColor(value) {
  const normalized = String(value || "").trim();
  if (/^#[0-9a-f]{6}$/i.test(normalized)) return normalized.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(normalized)) {
    return `#${normalized.slice(1).split("").map((character) => character + character).join("")}`.toLowerCase();
  }
  return "#082b63";
}

function mixOverlayColor(source, target, targetWeight) {
  const from = overlayHexToRgb(source);
  const to = overlayHexToRgb(target);
  const weight = clamp(targetWeight, 0, 1);
  const red = Math.round(from.red + (to.red - from.red) * weight);
  const green = Math.round(from.green + (to.green - from.green) * weight);
  const blue = Math.round(from.blue + (to.blue - from.blue) * weight);
  return `rgb(${red}, ${green}, ${blue})`;
}

function overlayHexToRgb(value) {
  const normalized = normalizeOverlayBackgroundColor(value).slice(1);
  return {
    red: Number.parseInt(normalized.slice(0, 2), 16),
    green: Number.parseInt(normalized.slice(2, 4), 16),
    blue: Number.parseInt(normalized.slice(4, 6), 16)
  };
}

function drawModelOneInteractionCard(ctx, item, x, y, width, height) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.3)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 5;
  roundedRect(ctx, x, y, width, height, Math.min(7, height * 0.08));
  const tile = ctx.createLinearGradient(x, y, x, y + height);
  tile.addColorStop(0, "rgba(3, 17, 47, 0.38)");
  tile.addColorStop(0.55, "rgba(1, 11, 33, 0.28)");
  tile.addColorStop(1, "rgba(0, 5, 21, 0.46)");
  ctx.fillStyle = tile;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(148, 163, 184, 0.055)";
  ctx.stroke();
  const actionLines = overlayActionTextLines(item);
  const badges = mergeOverlayBadges(item.badges).slice(0, 6);
  const badgeHeightRatio = actionLines.length > 2 ? 0.4 : 0.5;
  const badgeWidthRatio = badges.length > 1 ? 0.9 / badges.length : 0.46;
  const badgeSize = clamp(Math.min(height * badgeHeightRatio, width * badgeWidthRatio), 18, 78);
  const badgeGap = Math.max(3, badgeSize * 0.06);
  const badgesWidth = badges.length * badgeSize + Math.max(0, badges.length - 1) * badgeGap;
  const badgeStartX = x + (width - badgesWidth) / 2;
  const badgeY = y + clamp(height * 0.05, 4, 9);
  badges.forEach((badge, badgeIndex) => {
    drawTriggerBadge(ctx, badge, badgeStartX + badgeIndex * (badgeSize + badgeGap), badgeY, badgeSize);
  });
  drawOverlayActionLines(
    ctx,
    actionLines,
    x + width / 2,
    y + height - clamp(height * 0.09, 7, 13),
    width - 8,
    {
      cardHeight: height,
      fontFamily: FONT_FAMILY,
      lineWidthRatio: 0.18,
      maxFontSize: 22
    }
  );
  ctx.restore();
}

function overlayActionTextLines(item) {
  const labels = mergeOverlayActionLabels(
    item.actionLabels?.length ? item.actionLabels : [item.effect.label]
  );
  const firstWords = String(labels[0] || "ACTION").split(" ").filter(Boolean);
  const primary = firstWords.shift() || "ACTION";
  const secondary = firstWords.join(" ");
  if (labels.length === 1) {
    return [
      { color: "#ff354d", label: primary },
      ...(secondary ? [{ color: "#ffffff", label: secondary }] : [])
    ];
  }
  if (labels.length === 2 && secondary) {
    return [
      { color: "#ff354d", label: primary },
      { color: "#ffffff", label: secondary },
      { color: "#f4da3d", label: labels[1] }
    ];
  }
  const visibleLabels = labels.length <= 3
    ? labels
    : [...labels.slice(0, 2), `ET ${labels.length - 2} AUTRES ACTIONS`];
  return visibleLabels.map((label, index) => ({
    color: index === 1 ? "#ffffff" : index === 2
      ? "#f4da3d"
      : "#ff354d",
    label
  }));
}

function drawOverlayActionLines(ctx, lines, x, baselineY, maxWidth, options) {
  const lineCount = Math.max(1, lines.length);
  let fontSize = clamp(
    Math.min(options.cardHeight * 0.145, options.cardHeight * 0.42 / lineCount),
    9,
    options.maxFontSize
  );
  while (
    lines.some((line) =>
      measureText(ctx, line.label, fontSize, options.fontFamily) > maxWidth
    ) && fontSize > 9
  ) {
    fontSize -= 1;
  }
  const lineHeight = fontSize * 1.12;
  const startY = baselineY - (lineCount - 1) * lineHeight;
  lines.forEach((line, index) => {
    drawOutlinedText(ctx, line.label, x, startY + index * lineHeight, {
      align: "center",
      color: line.color,
      fontFamily: options.fontFamily,
      fontSize,
      lineWidth: clamp(fontSize * options.lineWidthRatio, 2.5, 5),
      maxWidth
    });
  });
}

function drawBottomPanel(ctx, items, logo, assets) {
  ctx.save();
  const gradient = ctx.createLinearGradient(0, BOTTOM_PANEL.y, 0, BOTTOM_PANEL.y + BOTTOM_PANEL.height);
  gradient.addColorStop(0, "#072a47");
  gradient.addColorStop(0.48, "#041f39");
  gradient.addColorStop(1, "#02172a");
  roundedRect(ctx, BOTTOM_PANEL.x, BOTTOM_PANEL.y, BOTTOM_PANEL.width, BOTTOM_PANEL.height, BOTTOM_PANEL.radius);
  ctx.fillStyle = gradient;
  ctx.fill();
  const centerGlow = ctx.createRadialGradient(
    OVERLAY_WIDTH / 2,
    BOTTOM_PANEL.y + BOTTOM_PANEL.height * 0.46,
    80,
    OVERLAY_WIDTH / 2,
    BOTTOM_PANEL.y + BOTTOM_PANEL.height * 0.48,
    520
  );
  centerGlow.addColorStop(0, "rgba(22, 212, 229, 0.18)");
  centerGlow.addColorStop(0.46, "rgba(14, 116, 144, 0.08)");
  centerGlow.addColorStop(1, "rgba(2, 6, 23, 0)");
  ctx.fillStyle = centerGlow;
  ctx.fillRect(BOTTOM_PANEL.x, BOTTOM_PANEL.y, BOTTOM_PANEL.width, BOTTOM_PANEL.height);
  const topSheen = ctx.createLinearGradient(0, BOTTOM_PANEL.y, 0, BOTTOM_PANEL.y + 72);
  topSheen.addColorStop(0, "rgba(255, 255, 255, 0.1)");
  topSheen.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = topSheen;
  ctx.fillRect(BOTTOM_PANEL.x + 8, BOTTOM_PANEL.y + 8, BOTTOM_PANEL.width - 16, 72);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.globalAlpha = 0.82;
  if (logo) {
    const logoWidth = 610;
    const logoHeight = logoWidth / (logo.naturalWidth / logo.naturalHeight);
    drawImageContain(
      ctx,
      logo,
      (OVERLAY_WIDTH - logoWidth) / 2,
      BOTTOM_PANEL.y + BOTTOM_PANEL.height / 2 - logoHeight / 2 + 8,
      logoWidth,
      logoHeight
    );
  } else {
    drawOutlinedText(ctx, "SHENPULSE", OVERLAY_WIDTH / 2, BOTTOM_PANEL.y + BOTTOM_PANEL.height / 2 + 18, {
      align: "center",
      color: "#ffffff",
      fontSize: 78,
      lineWidth: 8
    });
  }
  ctx.globalAlpha = 1;
  drawEffectGrid(ctx, items, assets);
  ctx.restore();
}

function drawEffectGrid(ctx, items, assets) {
  if (!items.length) return;
  const count = items.length;
  const columns = count <= 5 ? count : count <= 15 ? 5 : Math.min(8, Math.ceil(Math.sqrt(count * 1.7)));
  const rows = Math.ceil(count / columns);
  const gridX = BOTTOM_PANEL.x + BOTTOM_PANEL.padding;
  const gridY = BOTTOM_PANEL.y + 34;
  const gridWidth = BOTTOM_PANEL.width - BOTTOM_PANEL.padding * 2;
  const gridHeight = BOTTOM_PANEL.height - 58;
  const cellWidth = gridWidth / columns;
  const cellHeight = gridHeight / rows;
  const cardWidth = Math.min(cellWidth * 0.86, 170);
  const cardHeight = Math.min(cellHeight * 0.94, rows >= 3 ? 118 : 136);
  items.forEach((item, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawEffectCard(
      ctx,
      item,
      gridX + column * cellWidth + (cellWidth - cardWidth) / 2,
      gridY + row * cellHeight + (cellHeight - cardHeight) / 2,
      cardWidth,
      cardHeight,
      assets
    );
  });
}

function drawEffectCard(ctx, item, x, y, width, height, assets) {
  ctx.save();
  drawInteractionTile(ctx, x, y, width, height);
  const iconSize = clamp(Math.min(width * 0.92, height * 0.82), 58, 126);
  const giftSize = clamp(Math.min(width, height) * 0.43, 38, 64);
  const centerX = x + width / 2;
  const centerY = y + height * 0.4;
  drawSoftGroundShadow(ctx, centerX, y + height * 0.72, iconSize * 0.92, iconSize * 0.18);
  drawEffectIcon(ctx, item.effect, centerX, centerY, iconSize, assets);
  drawTriggerBadges(ctx, item.badges, x, y, width, height, giftSize, item.badgeLayout);
  drawOverlayActionLines(ctx, overlayActionTextLines(item), centerX, y + height - clamp(height * 0.08, 8, 18), width - 4, {
    cardHeight: height,
    fontFamily: MINECRAFT_FONT_FAMILY,
    lineWidthRatio: 0.2,
    maxFontSize: clamp(Math.min(width * 0.19, height * 0.24), 16, 34)
  });
  ctx.restore();
}

function drawInteractionTile(ctx, x, y, width, height) {
  ctx.save();
  const radius = Math.min(10, height * 0.13);
  ctx.shadowColor = "rgba(0, 0, 0, 0.54)";
  ctx.shadowBlur = 22;
  ctx.shadowOffsetY = 10;
  roundedRect(ctx, x, y, width, height, radius);
  const gradient = ctx.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "rgba(9, 45, 73, 0.72)");
  gradient.addColorStop(0.42, "rgba(4, 28, 50, 0.62)");
  gradient.addColorStop(1, "rgba(1, 13, 26, 0.76)");
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  const rim = ctx.createLinearGradient(x, y, x, y + height);
  rim.addColorStop(0, "rgba(125, 211, 252, 0.22)");
  rim.addColorStop(0.5, "rgba(14, 116, 144, 0.08)");
  rim.addColorStop(1, "rgba(0, 0, 0, 0.32)");
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = rim;
  ctx.stroke();
  roundedRect(ctx, x + 3, y + 3, width - 6, height - 6, Math.max(5, radius - 2));
  ctx.clip();
  const shine = ctx.createRadialGradient(x + width * 0.5, y, 0, x + width * 0.5, y, width * 0.72);
  shine.addColorStop(0, "rgba(255, 255, 255, 0.08)");
  shine.addColorStop(0.42, "rgba(56, 189, 248, 0.05)");
  shine.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = shine;
  ctx.fillRect(x, y, width, height);
  const lowerShade = ctx.createLinearGradient(x, y + height * 0.45, x, y + height);
  lowerShade.addColorStop(0, "rgba(0, 0, 0, 0)");
  lowerShade.addColorStop(1, "rgba(0, 0, 0, 0.22)");
  ctx.fillStyle = lowerShade;
  ctx.fillRect(x, y, width, height);
  ctx.restore();
}

function drawWinColumn(ctx, items, side, panelTop = BOTTOM_PANEL.y) {
  if (!items.length) return;
  const availableTop = 650;
  const availableBottom = panelTop - 112;
  const availableHeight = availableBottom - availableTop;
  const itemHeight = clamp(availableHeight / items.length, 92, 142);
  const totalHeight = itemHeight * items.length;
  const startY = availableTop + Math.max(0, (availableHeight - totalHeight) / 2);
  const centerX = side === "left" ? 94 : OVERLAY_WIDTH - 94;
  items.forEach((item, index) => {
    const y = startY + index * itemHeight;
    const imageSize = clamp(itemHeight * 0.62, 62, 94);
    const imageX = centerX - imageSize / 2;
    const textY = y + imageSize + clamp(itemHeight * 0.17, 16, 25);
    drawTriggerBadge(ctx, item, imageX, y, imageSize);
    drawCompactWinText(ctx, item.effect.label, centerX, textY, {
      color: winTextColor(item.effect),
      fontFamily: MINECRAFT_FONT_FAMILY,
      fontSize: clamp(itemHeight * 0.24, 28, 36),
      lineWidth: 7,
      maxWidth: 188
    });
  });
}

function drawCompactWinText(ctx, label, x, y, options) {
  const match = String(label || "").trim().match(/^(.+?)\s+(WINS?)$/i);
  if (!match) {
    drawOutlinedText(ctx, label, x, y, {
      align: "center",
      color: options.color,
      fontFamily: options.fontFamily,
      fontSize: options.fontSize,
      lineWidth: options.lineWidth,
      maxWidth: options.maxWidth
    });
    return;
  }
  const value = match[1].trim();
  const suffix = match[2].toUpperCase();
  let fontSize = options.fontSize;
  let gap = compactWinTextGap(fontSize);
  while (measureText(ctx, value, fontSize, options.fontFamily) + gap + measureText(ctx, suffix, fontSize, options.fontFamily) > options.maxWidth && fontSize > 18) {
    fontSize -= 1;
    gap = compactWinTextGap(fontSize);
  }
  const valueWidth = measureText(ctx, value, fontSize, options.fontFamily);
  const suffixWidth = measureText(ctx, suffix, fontSize, options.fontFamily);
  const startX = x - (valueWidth + gap + suffixWidth) / 2;
  drawOutlinedText(ctx, value, startX, y, {
    align: "left",
    color: options.color,
    fontFamily: options.fontFamily,
    fontSize,
    lineWidth: options.lineWidth
  });
  drawOutlinedText(ctx, suffix, startX + valueWidth + gap, y, {
    align: "left",
    color: options.color,
    fontFamily: options.fontFamily,
    fontSize,
    lineWidth: options.lineWidth
  });
}

function compactWinTextGap(fontSize) {
  return clamp(fontSize * 0.12, 3, 5);
}

function winTextColor(effect) {
  if (effect.winTone === "negative") return "#ff1f16";
  if (effect.winTone === "random") return "#ffffff";
  if (effect.multiplier) return "#f5ff21";
  return "#0a82ff";
}

export { modelOneBottomPanelBounds, drawModelOneBottomPanel, drawModelOneBrand, drawModelOneInteractionGrid, normalizeOverlayBackgroundColor, mixOverlayColor, overlayHexToRgb, drawModelOneInteractionCard, overlayActionTextLines, drawOverlayActionLines, drawBottomPanel, drawEffectGrid, drawEffectCard, drawInteractionTile, drawWinColumn, drawCompactWinText, compactWinTextGap, winTextColor };

