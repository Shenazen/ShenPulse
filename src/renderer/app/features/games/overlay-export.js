"use strict";

/** Orchestration du téléchargement ; les cartes et formulaires ont leurs modules. */

async function downloadGameInteractionOverlay(packId, model = 1) {
  return downloadComposedGameInteractionOverlay(packId, model, []);
}

async function downloadComposedGameInteractionOverlay(
  packId,
  model = 1,
  additionalEntries = []
) {
  const pack = snapshot.packs.find((item) => item.id === packId);
  if (!pack) throw new Error("Jeu introuvable.");
  const entries = groupGameOverlayEntriesByGift(
    mergeGameOverlayEntries(
      gameInteractionOverlayEntries(pack),
      additionalEntries
    )
  );
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
      actionLabels: entry.actionLabels,
      effectImageUrl: entry.effectImageUrl,
      badgeLayout: entry.badgeLayout,
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
