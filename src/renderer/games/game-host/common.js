"use strict";

/** Hôte historique : domaine « common ». Déclarations chargées avant l’orchestrateur host.js. */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function numberList(value, fallback) {
  const result = String(value || "")
    .split(/[;,\n]+/)
    .map((entry) => Number(entry.trim()))
    .filter((entry) => Number.isFinite(entry) && entry >= 0);
  return result.length ? result : fallback;
}

function money(value) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: value < 10 ? 2 : 0
  }).format(Number(value || 0));
}

function formatNumber(value) {
  return new Intl.NumberFormat("fr-FR", {
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function giftForName(value) {
  const normalized = String(value || "").trim().toLocaleLowerCase("fr");
  return giftCatalog.find(
    (gift) => String(gift.name || "").trim().toLocaleLowerCase("fr") === normalized
  );
}

function giftField(name, label, value) {
  const gift = giftForName(value);
  return `<label class="field"><span>${escapeHtml(label)}</span><div class="host-gift-picker">
    <input name="${escapeHtml(name)}" value="${escapeHtml(value)}" list="host-gift-options" data-host-gift autocomplete="off">
    <span data-host-gift-image>${gift?.imageUrl ? `<img src="${escapeHtml(gift.imageUrl)}" alt="">` : "🎁"}</span>
  </div></label>`;
}

function updateGiftImage(input) {
  const image = input
    ?.closest(".host-gift-picker")
    ?.querySelector("[data-host-gift-image]");
  if (!image) return;
  const gift = giftForName(input.value);
  image.innerHTML = gift?.imageUrl
    ? `<img src="${escapeHtml(gift.imageUrl)}" alt="">`
    : "🎁";
}

function toast(message) {
  const node = document.createElement("div");
  node.className = "toast";
  node.textContent = message;
  toastRegion.appendChild(node);
  setTimeout(() => node.remove(), 3200);
}

function shuffled(values) {
  const copy = [...values];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const random = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[random]] = [copy[random], copy[index]];
  }
  return copy;
}

function renderGenericGame() {
  root.innerHTML = `<div class="game-shell">
    <section class="game-stage">
      <div class="stage-content">
        <header class="stage-header"><div><small>JEU INTÉGRÉ SHENPULSE</small><h1>${escapeHtml(
          pack.name
        )}</h1></div></header>
        <section class="banker-panel"><span class="phone">◆</span><div><small>MOTEUR LOCAL</small><strong>Prêt pour le LIVE</strong><p>Testez chaque interaction depuis cette fenêtre hôte.</p></div></section>
        <div class="generic-effects">${pack.effects
          .map(
            (effect) =>
              `<button data-effect="${escapeHtml(effect.id)}"><strong>${escapeHtml(
                effect.name
              )}</strong><p>${escapeHtml(effect.description)}</p></button>`
          )
          .join("")}</div>
      </div>
    </section>
    <aside class="settings-panel"><small>SHENPULSE</small><h2>${escapeHtml(
      pack.name
    )}</h2><p>Les réglages de connecteur et les associations de cadeaux restent accessibles dans la page principale.</p></aside>
  </div>`;
}

