"use strict";

const STUDIO_HERO_ASSETS = Object.freeze({
  dashboard: "dashboard", actions: "actions", studio: "overlays", overlays: "overlays",
  users: "users", voice: "voice", music: "music", controllers: "actions",
  connections: "users", games: "dashboard", commands: "chatbot", chatbot: "chatbot", irl: "actions", matches: "dashboard", membership: "actions"
});

function renderStudioHero(id, title, description) {
  const asset = STUDIO_HERO_ASSETS[id] || "dashboard";
  return `<section class="studio-hero page-hero" data-studio-hero="${escapeHtml(id)}">
    <img class="studio-hero-art" src="assets/studio/${asset}.webp" alt="" decoding="async" fetchpriority="high" width="2048" height="768">
    <div class="studio-hero-copy"><span class="hero-chip">SHENPULSE · CREATOR STUDIO</span><h2>${escapeHtml(title)}</h2><p>${escapeHtml(description)}</p></div>
    <span class="studio-hero-signature" aria-hidden="true">STREAM. PLAY. CONNECT.</span>
  </section>`;
}

function renderCreatorCapacity() {
  const count = snapshot.state.rules.reduce((total, rule) => total + (rule.actions || []).filter((action) => action.type !== "action.group").length, 0);
  const proAccess = hasProAccess();
  return `<aside class="creator-capacity"><span class="badge ${proAccess ? "success" : "cyan"}">${proAccess ? "PRO" : "FREE"}</span><span>${proAccess ? `${count} actions · profils illimités` : `${count} / 3 actions · 1 profil`}</span>${proAccess ? "" : '<button class="button small ghost" data-navigate="membership">Découvrir Pro</button>'}</aside>`;
}

function readStudioPreference(key, fallback) {
  try { return localStorage.getItem(key) || fallback; } catch { return fallback; }
}

let studioLocaleOverride = readStudioPreference("shenpulse.interface-locale", "");
let studioLightMode = readStudioPreference("shenpulse.light-mode", "false") === "true";

function studioLocale() {
  return studioLocaleOverride || snapshot?.state.settings.locale || "fr-FR";
}

function syncStudioPreferences() {
  if (typeof synchronizeOverlayAssetWarmup === "function") synchronizeOverlayAssetWarmup();
  document.documentElement.lang = studioLocale().startsWith("en") ? "en" : "fr";
  document.body.classList.toggle("studio-light-mode", studioLightMode);
  const language = document.getElementById("studio-language");
  if (language) language.textContent = studioLocale().startsWith("en") ? "EN" : "FR";
  const light = document.getElementById("studio-light-mode");
  if (light) light.setAttribute("aria-pressed", String(studioLightMode));
}
