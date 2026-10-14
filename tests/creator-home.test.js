"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const { createDefaultState } = require("../src/main/defaults");
const { loadShenazenGameCatalog } = require("../src/main/game-catalog");
const visibility = require("../src/shared/visibility-catalog");

const rendererDirectory = path.join(__dirname, "..", "src", "renderer");
const featuresDirectory = path.join(rendererDirectory, "app", "features");

function homeContext(t, { hiddenPages = [], hiddenGames = [], authenticated = true, liveMarkup } = {}) {
  const dom = new JSDOM('<main id="content"></main>');
  t.after(() => dom.window.close());
  const state = createDefaultState();
  const packs = loadShenazenGameCatalog(path.join(__dirname, "..", "resources"));
  state.settings.siteVisibility = {
    schemaVersion: 8,
    navigation: Object.fromEntries(hiddenPages.map((id) => [id, { scope: "hidden" }])),
    games: Object.fromEntries(hiddenGames.map((id) => [id, { scope: "hidden" }]))
  };
  const canAccess = (section, id) => visibility.canAccessScope(visibility.scopeFor(state.settings.siteVisibility, section, id), false);
  const context = vm.createContext({
    document: dom.window.document,
    window: dom.window,
    content: dom.window.document.getElementById("content"),
    snapshot: { state, packs },
    isAccountAuthenticated: () => authenticated,
    canNavigateTo: (page) => canAccess("navigation", page),
    visibleGamePacks: () => packs.filter((pack) => pack.ownerOnly !== true && canAccess("games", pack.id)),
    navigationIcon: () => '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16M12 4v16"></path></svg>',
    eventIconMarkup: () => '<span class="event-visual"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h16v10H4z"></path></svg></span>',
    escapeHtml: (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
  });
  if (liveMarkup !== undefined) context.renderCreatorHomeLive = () => liveMarkup;
  for (const name of ["games/access.js", "games/community.js", "creator-home.js"]) {
    vm.runInContext(fs.readFileSync(path.join(featuresDirectory, name), "utf8"), context, { filename: name });
  }
  context.content.innerHTML = context.renderCreatorHome();
  return context;
}

test("l’accueil présente quatre cartes colorées à CTA unique et trois étapes numérotées sur une image locale", (t) => {
  const context = homeContext(t);
  const cards = [...context.content.querySelectorAll(".home-feature")];
  assert.equal(cards.length, 4);
  assert.deepEqual(cards.map((card) => card.dataset.navigate), ["actions", "games", "overlays", "users"]);
  for (const [index, accent] of ["pink", "cyan", "purple", "green"].entries()) {
    const card = cards[index];
    assert.equal(card.tagName, "BUTTON");
    assert.equal(card.type, "button");
    assert.ok(card.classList.contains(`home-accent-${accent}`));
    assert.ok(card.querySelector(".home-feature-heading .home-feature-icon svg"));
    assert.ok(card.querySelector(".home-feature-heading strong").textContent.trim());
    assert.ok(card.querySelector(".home-feature-description").textContent.trim());
    assert.ok(card.querySelector(".home-feature-cta").textContent.trim());
    assert.equal(card.querySelector("button"), null, "Le CTA visuel ne crée pas de bouton imbriqué");
    assert.equal(card.hasAttribute("data-action"), false, "Les cartes sont des raccourcis, pas des déclencheurs de live");
  }
  const steps = [...context.content.querySelectorAll(".home-start-step")];
  assert.equal(steps.length, 3);
  assert.deepEqual(steps.map((step) => step.dataset.navigate), ["connections", "actions", "dashboard"]);
  assert.deepEqual(steps.map((step) => step.querySelector(".home-step-number").textContent), ["1", "2", "3"]);
  assert.ok(steps.every((step) => step.querySelector(".home-step-symbol svg")));
  assert.equal(context.content.querySelector("#home-steps-heading").textContent, "Comment ça marche ?");
  const image = context.content.querySelector(".home-start-art");
  assert.equal(image.getAttribute("src"), "assets/studio/home-steps.webp");
  assert.equal(image.getAttribute("loading"), "lazy");
  assert.equal(image.getAttribute("decoding"), "async");
  assert.equal(image.getAttribute("width"), "1800");
  assert.equal(image.getAttribute("height"), "600");
  assert.ok(fs.existsSync(path.join(rendererDirectory, image.getAttribute("src"))));
});

test("l’accueil ne charge plus de galerie, mais conserve les raccourcis et le catalogue Jeux", (t) => {
  const context = homeContext(t, { hiddenGames: ["thiercelieux", "connect-four"] });
  const catalogue = [...context.creatorCommunityGames()];
  assert.ok(catalogue.length > 8, "Les jeux restent disponibles dans leur catalogue");
  context.creatorCommunityGames = () => { throw new Error("L’accueil ne doit pas lire le catalogue"); };
  context.gameArtwork = () => { throw new Error("Aucun artwork de jeu ne doit être demandé"); };
  context.content.innerHTML = context.renderCreatorHome();
  assert.equal(context.content.querySelector(".home-games"), null);
  assert.equal(context.content.querySelector(".home-game-card, [data-home-game]"), null);
  const links = [...context.content.querySelectorAll('[data-navigate="games"]')];
  assert.equal(links.length, 2, "Hero et carte outils gardent un raccourci vers Jeux");
  assert.ok(links.every((link) => !link.hasAttribute("data-action")));
});

test("les routes et jeux masqués restent absents de l’accueil et le module live est un slot optionnel", (t) => {
  const context = homeContext(t, { hiddenPages: ["studio", "games", "overlays", "connections"] });
  assert.deepEqual([...context.content.querySelectorAll(".home-feature")].map((card) => card.dataset.navigate), ["actions", "users"]);
  assert.deepEqual([...context.content.querySelectorAll(".home-start-step")].map((step) => step.dataset.navigate), ["actions", "dashboard"]);
  assert.equal(context.content.querySelector(".home-games"), null);
  assert.equal(context.content.querySelector('[data-navigate="studio"]'), null);
  assert.equal(context.content.querySelector('[data-home-live-slot]').innerHTML, "");

  const withLive = homeContext(t, { liveMarkup: '<section data-live-probe>Contenu du module live</section>' });
  const copy = withLive.content.querySelector(".home-hero-copy");
  const hero = withLive.content.querySelector(".home-hero");
  const slot = hero.querySelector("[data-home-live-slot]");
  assert.ok(slot.querySelector("[data-live-probe]"));
  assert.equal(slot.previousElementSibling, copy, "La section live reste sous la présentation, à la largeur du hero");
  assert.equal(copy.lastElementChild.className, "home-platforms", "Les cartes live viennent immédiatement après les plateformes");
  assert.ok(copy.querySelector(".home-platforms").compareDocumentPosition(slot) & withLive.window.Node.DOCUMENT_POSITION_FOLLOWING);
});

test("les cartes échappent les textes et gardent un seul bouton accessible sans opération LIVE", (t) => {
  const context = homeContext(t);
  context.content.innerHTML = context.creatorHomeFeature("actions", 'Titre <img src=x>', 'Texte <script>bad()</script>', "pink", 'Ouvrir & voir');
  const card = context.content.querySelector("button");
  assert.equal(card.querySelector("img, script, button"), null);
  assert.equal(card.querySelector("strong").textContent, 'Titre <img src=x>');
  assert.equal(card.querySelector(".home-feature-description").textContent, 'Texte <script>bad()</script>');
  assert.equal(card.querySelector(".home-feature-cta").textContent, 'Ouvrir & voir→');
  assert.equal(card.dataset.navigate, "actions");
  assert.equal(card.hasAttribute("data-action"), false);
});
