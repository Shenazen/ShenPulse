"use strict";

/** Textes centrés et apparence des modèles de bocal. */

function applyCoinJarAppearance(payload = null) {
  const style = document.documentElement.style;
  const previous = Number(style.getPropertyValue("--coin-jar-title-scale")) * 100 || Number(parameters.get("coinJarTitleScale")) || 100;
  const scale = payload ? previewNumber(payload, "coinJarTitleScale", previous, 50, 400) : previous;
  style.setProperty("--coin-jar-title-scale", String(Math.min(400, Math.max(50, scale)) / 100));
  const color = payload?.coinJarTitleColor || style.getPropertyValue("--coin-jar-title-color") || parameters.get("coinJarTitleColor") || parameters.get("textColor") || "#ffffff";
  style.setProperty("--coin-jar-title-color", color);
}

function fitCoinJarText() {
  if (viewName !== "coin-jar") return;
  const zone = document.getElementById("coin-jar-title");
  const text = zone?.firstElementChild;
  if (!text || !zone.clientWidth || !zone.clientHeight) return;
  zone.style.setProperty("--coin-jar-text-fit", "1");
  const fit = Math.min(1,
    Math.max(1, zone.clientWidth - 8) / Math.max(1, text.offsetWidth),
    Math.max(1, zone.clientHeight - 2) / Math.max(1, text.offsetHeight));
  zone.style.setProperty("--coin-jar-text-fit", String(fit));
}

