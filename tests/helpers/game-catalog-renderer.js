"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const categories = require("../../src/shared/game-categories");
const visibilityTools = require("../../src/shared/visibility-catalog");
const root = path.resolve(__dirname, "../..");

/** Rendu réel du catalogue sans IPC, lancement de jeu ou modification de réglages. */
function gameCatalogRenderer(packs, { owner = false, hidden = [] } = {}) {
  const dom = new JSDOM("<main></main>");
  const context = vm.createContext({
    window: dom.window, document: dom.window.document, content: dom.window.document.querySelector("main"),
    ShenPulseGameCategories: categories, ShenPulseGamePassCatalog: require("../../src/shared/game-pass-catalog"), visibilityTools,
    siteVisibility: { schemaVersion: visibilityTools.VISIBILITY_SCHEMA_VERSION, games: Object.fromEntries(hidden.map(id => [id, { scope: "hidden" }])) },
    snapshot: { packs, state: { session: {}, settings: {}, commerce: {} } },
    gameFilter: "all", gameCategory: "all", gameSearch: "", gamePageMode: "catalog", pages: [],
    MINECRAFT_MODE_IDS: ["minecraft-bedrock-box", "minecraft-sandbox-3", "minecraft-survival-plugin"], MINECRAFT_LAUNCHER_ID: "minecraft",
    GTA_MODE_IDS: ["gtav-montchiliad", "gtav-koth-enhanced"], GTA_LAUNCHER_ID: "gta-enhanced",
    isVerifiedAdminSession: () => owner, registerActionHandler() {}, ACTION_NOT_HANDLED: Symbol("unhandled"),
    renderStudioHero: (_id, title) => `<header><h2>${title}</h2></header>`,
    emptyInline: text => `<p class="empty-inline">${text}</p>`
  });
  for (const file of ["core/ui-foundations.js", "core/access-navigation.js", "features/games/access.js", "features/games/categories.js", "actions/handlers/navigation-games.js"]) {
    vm.runInContext(fs.readFileSync(path.join(root, "src/renderer/app", file), "utf8"), context, { filename: file });
  }
  context.hasProAccess = () => true;
  context.isVerifiedAdminSession = () => owner;
  context.isGameUnlocked = () => true;
  context.gameArtwork = () => "";
  context.gameAccessLabel = () => "Inclus avec Pro";
  context.gameTileCaption = pack => `<div class="tile-caption"><h3>${context.escapeHtml(pack.name)}</h3></div>`;
  context.gameTileActionLabel = () => "Ouvrir";
  context.render = () => { context.content.innerHTML = context.renderGamesV2(); return context.content; };
  return { context, dom, render: context.render, close: () => dom.window.close() };
}

module.exports = { gameCatalogRenderer };
