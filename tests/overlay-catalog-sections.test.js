"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const overlayCatalog = require("../resources/overlays/overlay-catalog");
const { createDefaultState } = require("../src/main/defaults");

const rendererRoot = path.join(__dirname, "..", "src", "renderer");
const escape = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Exécute les vraies sections et cartes, sans ouvrir de source ni écrire l'état. */
function overlayPage(t, { authenticated = true, pro = true, hiddenKeys = [] } = {}) {
  const dom = new JSDOM('<main id="content"></main>');
  t.after(() => dom.window.close());
  const state = createDefaultState();
  const context = vm.createContext({
    content: dom.window.document.getElementById("content"),
    document: dom.window.document,
    NodeFilter: dom.window.NodeFilter,
    snapshot: { state },
    overlaySearch: "",
    overlayCategory: "all",
    escapeHtml: escape,
    isAccountAuthenticated: () => authenticated,
    canAccessOverlay: (item) => !hiddenKeys.includes(item.key),
    overlayUnlocked: (item) => !item.requiresPro || pro,
    overlayDefinitions: () => overlayCatalog.definitions,
    overlayConfig: (key) => overlayCatalog.defaultConfig(key),
    selectedOverlayDesign: (item) => item.defaultOption || item.options?.[0]?.[0] || "",
    overlayRuntimeFrame: (item) => `<span data-placeholder="${escape(item.key)}"></span>`,
    overlayCardPlaceholder: () => "",
    overlayUrl: (item) => `https://overlays.example.test/${item.key}`,
    creatorMatchesStudioSourceUrl: () => authenticated && pro
      ? "https://overlays.example.test/m/123456789012/abcdefghijklmnopqrstuvwx?transport=local"
      : "",
    localOverlayUrl: (item) => `http://127.0.0.1:17654/${item.key}`,
    renderStudioHero: (id, title) => `<section data-hero="${escape(id)}">${escape(title)}</section>`,
    emptyInline: (message) => `<p class="empty-inline">${escape(message)}</p>`,
    api: new Proxy({}, { get() { throw new Error("Le catalogue ne doit effectuer aucun appel API."); } }),
    fetch() { throw new Error("Les ornements ne doivent effectuer aucune requête distante."); },
    setTimeout() { throw new Error("Le rendu des sections n'ajoute aucun timer."); }
  });
  for (const file of ["cards.js", "editor.js"]) {
    const filename = path.join(rendererRoot, "app", "features", "overlays", file);
    vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  }
  context.draw = ({ category = "all", search = "" } = {}) => {
    context.overlayCategory = category;
    context.overlaySearch = search;
    context.content.innerHTML = context.renderOverlaysV2();
    return context.content;
  };
  return context;
}

function sections(page) {
  return [...page.querySelectorAll(".overlay-category-section")];
}

test("chaque catégorie visible possède un cadre de titre et un ornement de fin après sa grille", (t) => {
  const context = overlayPage(t);
  const before = JSON.stringify(context.snapshot.state);
  const page = context.draw();
  const groups = sections(page);
  assert.deepEqual(groups.map((section) => section.dataset.overlayCategory), [
    "counters", "rankings", "interactions", "actions", "gifts", "matches"
  ]);
  for (const section of groups) {
    const heading = section.querySelector(":scope > .overlay-category-heading");
    const grid = section.querySelector(":scope > .overlay-catalog-grid");
    const divider = section.querySelector(":scope > .overlay-category-divider");
    const frame = heading.querySelector(".overlay-category-frame");
    assert.equal(heading, section.firstElementChild);
    assert.equal(divider, section.lastElementChild);
    assert.equal(grid.nextElementSibling, divider);
    assert.equal(frame.getAttribute("src"), "assets/studio/overlay-section-frame.webp");
    assert.equal(divider.getAttribute("src"), "assets/studio/overlay-section-divider.webp");
    assert.equal(frame.getAttribute("width"), "1600");
    assert.equal(frame.getAttribute("height"), "307");
    assert.equal(divider.getAttribute("width"), "1600");
    assert.equal(divider.getAttribute("height"), "228");
    assert.equal(section.querySelectorAll(".overlay-category-frame").length, 1);
    assert.equal(section.querySelectorAll(".overlay-category-divider").length, 1);
    const cards = grid.querySelectorAll("[data-overlay-card]");
    assert.ok(cards.length);
    assert.equal(heading.querySelector(".overlay-category-count").textContent.trim(),
      `· ${cards.length} overlay${cards.length > 1 ? "s" : ""}`);
    for (const image of [frame, divider]) {
      assert.equal(image.alt, "");
      assert.equal(image.getAttribute("aria-hidden"), "true");
      assert.equal(image.getAttribute("decoding"), "async");
      assert.ok(Number(image.getAttribute("width")) > 0);
      assert.ok(Number(image.getAttribute("height")) > 0);
    }
    assert.equal(divider.getAttribute("loading"), "lazy");
    assert.equal(grid.querySelector(".overlay-category-frame, .overlay-category-divider"), null,
      "Les ornements appartiennent à la section, pas à chaque carte.");
    const title = heading.querySelector("h3");
    assert.equal(frame.contains(title), false);
    assert.ok(title.firstChild.nodeType === 3 && title.firstChild.textContent.trim());
  }
  assert.equal(groups[0].querySelector("h3").firstChild.textContent, "Objectifs & compteurs");
  assert.equal(page.querySelectorAll("[data-overlay-card]").length,
    overlayCatalog.definitions.filter((item) => !item.catalogHidden).length);
  assert.equal(JSON.stringify(context.snapshot.state), before, "Le rendu ne modifie aucune configuration.");
});

test("le filtre Matchs conserve ses huit cartes et son guide entre le titre et la grille", (t) => {
  const page = overlayPage(t).draw({ category: "matches" });
  const groups = sections(page);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].dataset.overlayCategory, "matches");
  assert.equal(groups[0].querySelectorAll("[data-overlay-card]").length, 8);
  const heading = groups[0].querySelector(".overlay-category-heading");
  const guide = groups[0].querySelector(".match-overlay-guide");
  assert.equal(heading.nextElementSibling, guide);
  assert.equal(guide.nextElementSibling.className, "overlay-catalog-grid");
  assert.equal(page.querySelector('[data-action="set-overlay-category"][data-value="matches"]').className, "active");
});

test("la recherche dans les designs conserve uniquement la section non vide correspondante", (t) => {
  const page = overlayPage(t).draw({ search: "Alchemy" });
  const groups = sections(page);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].dataset.overlayCategory, "gifts");
  assert.deepEqual([...page.querySelectorAll("[data-overlay-card]")].map((card) => card.dataset.overlayCard), ["coinJar"]);
  assert.equal(groups[0].querySelector(".overlay-category-count").textContent.trim(), "· 1 overlay");
  assert.equal(page.querySelector(".empty-inline"), null);
});

test("une recherche sans résultat n'affiche ni catégorie vide ni ornement isolé", (t) => {
  const page = overlayPage(t).draw({ search: "introuvable-aucun-overlay-987654" });
  assert.equal(sections(page).length, 0);
  assert.equal(page.querySelectorAll(".overlay-category-frame, .overlay-category-divider").length, 0);
  assert.match(page.querySelector(".empty-inline").textContent, /Aucun overlay/);
});

test("les catégories et commandes restent soumises aux droits et aux accès du catalogue", (t) => {
  const context = overlayPage(t, { pro: false, hiddenKeys: ["coinJar"] });
  const page = context.draw({ category: "gifts" });
  assert.equal(context.overlayCategory, "all", "Un filtre devenu inaccessible revient sur Tous.");
  assert.equal(page.querySelector('[data-overlay-category="gifts"]'), null);
  assert.equal(page.querySelector('[data-value="gifts"]'), null);
  assert.equal(page.querySelector('[data-overlay-card="coinJar"]'), null);
  const paid = overlayCatalog.definitions.find((item) => item.requiresPro && !item.catalogHidden);
  const card = page.querySelector(`[data-overlay-card="${paid.key}"]`);
  assert.ok(card.classList.contains("locked"));
  assert.ok(card.querySelector(".overlay-locked-actions"));
  assert.equal(card.querySelector(".overlay-card-footer"), null);
  assert.ok(page.querySelector('[data-overlay-card="likeGoal"] .overlay-card-footer'));
});

test("le mode invité conserve l'aperçu et le composant échappe ses titres sans image de texte", (t) => {
  const context = overlayPage(t, { authenticated: false, pro: false });
  const page = context.draw();
  assert.equal(page.querySelector("[data-public-overlay-relay]"), null);
  assert.ok(page.querySelector('[data-overlay-card="likeGoal"] [data-action="preview-overlay"]'));
  assert.equal(page.querySelector(".overlay-card-footer"), null);
  context.content.innerHTML = context.renderOverlayCategorySection({
    id: 'tools" data-foreign="injection',
    label: '<img src=x onerror="alert(1)"> & Outils',
    items: [{ key: "test", category: "tools", name: "Outil", description: "Test", icon: "◎" }]
  });
  assert.equal(context.content.querySelector("[data-foreign]"), null);
  assert.equal(context.content.querySelector("h3").firstChild.textContent, '<img src=x onerror="alert(1)"> & Outils');
  assert.equal(context.content.querySelector("h3 img"), null);
  assert.equal(context.renderOverlayCategorySection({ id: "tools", label: "Outils", items: [] }), "");
});

test("le titre HTML du cadre suit FR/EN sans toucher aux ressources ni aux textes privés", (t) => {
  const context = overlayPage(t);
  const page = context.draw({ category: "counters" });
  const protectedCopy = context.document.createElement("p");
  protectedCopy.setAttribute("data-studio-user-content", "");
  protectedCopy.textContent = "Objectifs & compteurs";
  page.append(protectedCopy);
  let locale = "fr-FR";
  context.studioLocale = () => locale;
  context.syncStudioPreferences = () => {};
  const filename = path.join(rendererRoot, "app", "features", "studio-language.js");
  vm.runInContext(fs.readFileSync(filename, "utf8"), context, { filename });
  const heading = page.querySelector(".overlay-category-heading h3");
  const imageSources = [...page.querySelectorAll("img")].map((image) => image.getAttribute("src"));
  locale = "en-US";
  context.applyStudioLanguage(page);
  assert.equal(heading.firstChild.textContent, "Goals & counters");
  assert.equal(protectedCopy.textContent, "Objectifs & compteurs");
  assert.deepEqual([...page.querySelectorAll("img")].map((image) => image.getAttribute("src")), imageSources);
  locale = "fr-FR";
  context.applyStudioLanguage(page);
  assert.equal(heading.firstChild.textContent, "Objectifs & compteurs");
  assert.equal(heading.querySelector(".overlay-category-count").textContent.trim(), "· 4 overlays");
});
