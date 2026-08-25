function loadGtaOverlayImage(source, timeoutMs = 4500) {
  const url = String(source || "").trim();
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => finish(image);
    image.onerror = () => finish(null);
    image.src = url;
  });
}

function roundedCanvasRect(context, x, y, width, height, radius) {
  const safeRadius = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function drawGtaOverlayImage(context, image, x, y, width, height) {
  if (!image?.naturalWidth || !image?.naturalHeight) return false;
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight
  );
  return true;
}

function drawGtaOverlayText(context, value, x, y, maxWidth, size, color = "#ffffff") {
  let fontSize = size;
  context.font = `900 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  while (fontSize > 16 && context.measureText(String(value)).width > maxWidth) {
    fontSize -= 1;
    context.font = `900 ${fontSize}px "Segoe UI", Arial, sans-serif`;
  }
  context.fillStyle = color;
  context.textBaseline = "middle";
  context.fillText(String(value), x, y, maxWidth);
}

function drawGtaOverlayOutlinedText(
  context,
  value,
  x,
  y,
  maxWidth,
  size,
  color = "#ffffff",
  align = "left"
) {
  let fontSize = size;
  const text = String(value || "");
  context.font = `900 ${fontSize}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  while (fontSize > 15 && context.measureText(text).width > maxWidth) {
    fontSize -= 1;
    context.font = `900 ${fontSize}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  }
  context.textAlign = align;
  context.textBaseline = "middle";
  context.lineJoin = "round";
  context.strokeStyle = "#020617";
  context.lineWidth = Math.max(4, fontSize * 0.16);
  context.strokeText(text, x, y, maxWidth);
  context.fillStyle = color;
  context.fillText(text, x, y, maxWidth);
}

function splitGtaOverlayTitle(context, value, maxWidth, size) {
  const words = String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  context.font = `900 ${size}px Impact, "Arial Black", "Segoe UI", sans-serif`;
  if (!words.length) return [""];
  const lines = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= 2) return lines;
  return [lines[0], lines.slice(1).join(" ")];
}

function drawGtaOverlayInteractionCard(
  context,
  entry,
  x,
  y,
  width,
  height,
  model
) {
  roundedCanvasRect(context, x, y, width, height, model === 1 ? 9 : 6);
  const gradient = context.createLinearGradient(x, y, x, y + height);
  gradient.addColorStop(0, "rgba(10, 49, 77, .98)");
  gradient.addColorStop(1, "rgba(1, 18, 33, .99)");
  context.fillStyle = gradient;
  context.fill();
  context.strokeStyle =
    model === 1 ? "rgba(29, 196, 220, .24)" : "rgba(148, 163, 184, .22)";
  context.lineWidth = 2;
  context.stroke();

  const imageHeight = model === 1
    ? Math.min(78, height * 0.55)
    : Math.min(60, height * 0.52);
  const imageWidth = Math.min(width - 30, imageHeight * 1.45);
  const imageX = x + (width - imageWidth) / 2;
  const imageY = y + 8;
  drawGtaOverlayImage(
    context,
    entry.effectImage || entry.giftImage,
    imageX,
    imageY,
    imageWidth,
    imageHeight
  );
  if (entry.giftImage && entry.effectImage) {
    const giftSize = model === 1 ? 34 : 27;
    drawGtaOverlayImage(
      context,
      entry.giftImage,
      x + width - giftSize - 7,
      y + 6,
      giftSize,
      giftSize
    );
  }

  const fontSize = model === 1 ? 22 : 17;
  const lines = splitGtaOverlayTitle(
    context,
    entry.title,
    width - 12,
    fontSize
  );
  const textY = y + height - (lines.length === 1 ? 21 : 34);
  lines.slice(0, 2).forEach((line, index) => {
    drawGtaOverlayOutlinedText(
      context,
      line,
      x + width / 2,
      textY + index * (fontSize + 3),
      width - 10,
      fontSize,
      "#ffffff",
      "center"
    );
  });
}

function gtaWinOverlayColor(effectId) {
  if (effectId === "overlay_win_x2") return "#fff51a";
  if (effectId === "overlay_win_random_200") return "#ffffff";
  return effectId.includes("_remove_") ? "#ff173d" : "#0787ff";
}

function drawGtaOverlayWinRule(context, entry, side, index, model) {
  const yStart = model === 1 ? 650 : 655;
  const rowGap = model === 1 ? 128 : 142;
  const y = yStart + index * rowGap;
  const imageWidth = model === 1 ? 94 : 86;
  const imageHeight = model === 1 ? 72 : 68;
  const left = side === "left";
  const centerX = left ? 86 : 994;
  drawGtaOverlayImage(
    context,
    entry.giftImage || entry.effectImage,
    centerX - imageWidth / 2,
    y,
    imageWidth,
    imageHeight
  );
  drawGtaOverlayOutlinedText(
    context,
    String(entry.title || "").replace(/\s+/g, " "),
    left ? 8 : 1072,
    y + imageHeight + 22,
    model === 1 ? 190 : 184,
    model === 1 ? 37 : 34,
    gtaWinOverlayColor(entry.effectId),
    left ? "left" : "right"
  );
}

function drawGtaInteractionOverlayLayout(context, prepared, model) {
  const selectedModel = Number(model) === 2 ? 2 : 1;
  context.fillStyle = gtaInteractionOverlayBackground();
  context.fillRect(0, 0, 1080, 1920);

  const winById = new Map(
    prepared
      .filter((entry) => entry.isWinEffect)
      .map((entry) => [entry.effectId, entry])
  );
  const positiveIds = [
    "overlay_win_add_1",
    "overlay_win_add_3",
    "overlay_win_add_20",
    "overlay_win_add_45",
    "overlay_win_x2"
  ];
  const negativeIds = [
    "overlay_win_remove_1",
    "overlay_win_remove_3",
    "overlay_win_remove_20",
    "overlay_win_remove_50",
    "overlay_win_random_200"
  ];
  positiveIds
    .map((effectId) => winById.get(effectId))
    .filter(Boolean)
    .forEach((entry, index) =>
      drawGtaOverlayWinRule(context, entry, "left", index, selectedModel)
    );
  negativeIds
    .map((effectId) => winById.get(effectId))
    .filter(Boolean)
    .forEach((entry, index) =>
      drawGtaOverlayWinRule(context, entry, "right", index, selectedModel)
    );

  const interactionEntries = prepared
    .filter((entry) => !entry.isWinEffect)
    .slice(0, selectedModel === 1 ? 24 : 32);
  const columns = selectedModel === 1 ? 6 : 8;
  const gap = selectedModel === 1 ? 8 : 5;
  const padding = selectedModel === 1 ? 10 : 13;
  const rows = Math.max(1, Math.ceil(interactionEntries.length / columns));
  const panelY = selectedModel === 1 ? 1360 : 1482;
  const panelBottom = 1914;
  const panelPadding = selectedModel === 1 ? 10 : 12;
  const panelHeight = panelBottom - panelY;
  const cardHeight =
    (panelHeight - panelPadding * 2 - gap * (rows - 1)) / rows;
  const cardWidth =
    (1080 - padding * 2 - gap * (columns - 1)) / columns;

  if (selectedModel === 1) {
    const panelGradient = context.createLinearGradient(0, panelY, 0, panelBottom);
    panelGradient.addColorStop(0, "rgba(0, 74, 88, .97)");
    panelGradient.addColorStop(1, "rgba(1, 21, 38, .99)");
    context.fillStyle = panelGradient;
    context.fillRect(0, panelY, 1080, panelHeight + 6);
    context.fillStyle = "rgba(34, 211, 238, .28)";
    context.fillRect(0, panelY, 1080, 3);
  } else {
    context.fillStyle = "#e2e8f0";
    context.fillRect(4, panelY - 7, 1072, panelHeight + 14);
    context.fillStyle = "#061e33";
    context.fillRect(11, panelY, 1058, panelHeight);
  }

  context.save();
  context.globalAlpha = 0.13;
  drawGtaOverlayOutlinedText(
    context,
    "ShenPulse",
    540,
    panelY + panelHeight / 2,
    520,
    72,
    "#22d3ee",
    "center"
  );
  context.restore();

  interactionEntries.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    drawGtaOverlayInteractionCard(
      context,
      entry,
      padding + column * (cardWidth + gap),
      panelY + panelPadding + row * (cardHeight + gap),
      cardWidth,
      cardHeight,
      selectedModel
    );
  });
}

async function downloadGameInteractionOverlay(packId, model = 1) {
  const pack = snapshot.packs.find((item) => item.id === packId);
  if (!pack) throw new Error("Jeu introuvable.");
  const entries = gameInteractionOverlayEntries(pack);
  if (!entries.length) {
    throw new Error("Activez au moins une interaction avant de télécharger l’overlay.");
  }
  if (
    typeof ShenPulseGameOverlay === "undefined" ||
    !ShenPulseGameOverlay.renderMinecraftStyledOverlay
  ) {
    throw new Error("Le générateur partagé d’overlays n’est pas disponible.");
  }
  const selectedModel = Number(model) === 2 ? 2 : 1;
  const canvas = await ShenPulseGameOverlay.renderMinecraftStyledOverlay({
    backgroundColor: gameInteractionOverlayBackground(pack.id),
    entries: entries.map((entry) => ({
      effectImageUrl: entry.effectImageUrl,
      giftImageUrl: entry.giftImageUrl,
      giftLabel: entry.giftLabel,
      groupKey: entry.groupKey,
      label: entry.title,
      likeAmount: entry.likeAmount,
      triggerKey: entry.triggerKey,
      triggerType: entry.triggerType
    })),
    model: selectedModel
  });
  window.__lastGameInteractionOverlayPng = canvas.toDataURL("image/png");
  window.__lastGameInteractionOverlayMeta = {
    gameId: pack.id,
    height: canvas.height,
    model: selectedModel,
    width: canvas.width
  };
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) =>
        result
          ? resolve(result)
          : reject(new Error("Export PNG impossible.")),
      "image/png"
    );
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download =
    `${pack.id}-overlay-interactions-modele-${selectedModel}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
}

async function downloadGtaInteractionOverlay(packId, model = 1) {
  const pack = snapshot.packs.find((item) => item.id === packId);
  if (!pack) throw new Error("Jeu GTA introuvable.");
  const entries = gtaInteractionOverlayEntries(pack);
  if (!entries.length) {
    throw new Error("Activez au moins une interaction GTA avant de télécharger l’overlay.");
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1920;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Création de l’image indisponible.");
  const prepared = await Promise.all(entries.map(async (entry) => ({
    ...entry,
    effectImage: await loadGtaOverlayImage(entry.effectImageUrl),
    giftImage: await loadGtaOverlayImage(entry.giftImageUrl)
  })));
  drawGtaInteractionOverlayLayout(context, prepared, model);
  if (!prepared.length) {
  const columns = 3;
  const gap = 14;
  const padding = 30;
  const cardWidth = (canvas.width - padding * 2 - gap * (columns - 1)) / columns;
  const cardHeight = model === 1 ? 150 : 164;
  const rows = Math.ceil(prepared.length / columns);
  const panelHeight = Math.min(910, rows * (cardHeight + gap) + 104);
  const panelY = canvas.height - panelHeight - 16;
  if (Number(model) === 1) {
    const gradient = context.createLinearGradient(0, panelY, canvas.width, canvas.height);
    gradient.addColorStop(0, gtaInteractionOverlayBackground());
    gradient.addColorStop(1, "#030712");
    roundedCanvasRect(context, 8, panelY, canvas.width - 16, panelHeight, 34);
    context.fillStyle = gradient;
    context.fill();
    context.strokeStyle = "rgba(245, 158, 11, .72)";
    context.lineWidth = 4;
    context.stroke();
  }
  context.textAlign = "left";
  drawGtaOverlayText(
    context,
    "INTERACTIONS GTA",
    padding,
    panelY + 42,
    canvas.width - padding * 2,
    30,
    Number(model) === 1 ? "#fbbf24" : "#ffffff"
  );
  prepared.forEach((entry, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const x = padding + column * (cardWidth + gap);
    const y = panelY + 72 + row * (cardHeight + gap);
    roundedCanvasRect(context, x, y, cardWidth, cardHeight, 18);
    context.fillStyle = Number(model) === 1
      ? "rgba(2, 6, 23, .72)"
      : "rgba(4, 7, 18, .92)";
    context.fill();
    context.strokeStyle = Number(model) === 1
      ? "rgba(251, 191, 36, .45)"
      : "rgba(34, 211, 238, .5)";
    context.lineWidth = 2;
    context.stroke();
    const giftX = x + 16;
    const giftY = y + 14;
    if (!drawGtaOverlayImage(context, entry.giftImage, giftX, giftY, 50, 50)) {
      context.fillStyle = "#f59e0b";
      context.beginPath();
      context.arc(giftX + 25, giftY + 25, 23, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = "#ffffff";
      context.font = '700 24px "Segoe UI Emoji"';
      context.fillText("🎁", giftX + 10, giftY + 28);
    }
    if (!drawGtaOverlayImage(context, entry.effectImage, x + cardWidth - 78, y + 12, 62, 62)) {
      context.fillStyle = "rgba(255,255,255,.12)";
      context.fillRect(x + cardWidth - 70, y + 20, 48, 48);
    }
    drawGtaOverlayText(context, entry.title, x + 16, y + 96, cardWidth - 32, 23);
    drawGtaOverlayText(context, entry.trigger, x + 16, y + 128, cardWidth - 32, 18, "#cbd5e1");
  });
  }
  window.__lastGtaInteractionOverlayPng = canvas.toDataURL("image/png");
  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      (result) => result ? resolve(result) : reject(new Error("Export PNG impossible.")),
      "image/png"
    );
  });
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = `${pack.id}-overlay-interactions-modele-${Number(model) === 1 ? 1 : 2}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 1500);
}
