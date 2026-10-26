"use strict";
const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), net = require("node:net");
const { JSDOM } = require("jsdom");
const { createGamePackOverlay, gamePackOverlayTrigger, PACK_ID } = require("../src/shared/game-pack-overlay");
const { createRelayState, publicOverlayUrls } = require("../src/shared/public-overlay-protocol");
const { OverlayServer } = require("../src/main/overlay-server");
const catalog = require("../resources/overlays/overlay-catalog");
const effects = require("../resources/catalogs/supermarket-simulator-effects.json");
function fixture() {
  const rule = { id: "customer", enabled: true, trigger: { enabled: true, type: "gift" },
    conditions: [{ field: "data.giftName", value: "Rose", giftCost: 1, giftImageUrl: "https://example.test/rose.png" }, { field: "user.id", value: "private-user" }],
    gameInteraction: { title: "+1 client", marketColumn: "help" },
    cooldown: { perUserSeconds: 3 }, actions: [{ id: "first", type: "game.effect", config: { packId: PACK_ID, effectId: effects.find(e => e.code === "SpawnCustomers").id, secret: "private-action" } }, { id: "second", type: "game.effect", config: { packId: PACK_ID, effectId: effects[0].id } }] };
  const state = { session: { profileId: "profile-a" }, game: { interactionRulesByPack: { [PACK_ID]: [rule] } }, commerce: { subscription: { tier: "pro", status: "active", source: "paid" } }, settings: { apiToken: "private-token" } };
  return { state, rule };
}
test("projection publique: cartes automatiques, une carte par règle, aucune donnée privée", () => {
  const { state, rule } = fixture();
  let result = createGamePackOverlay(state); assert.equal(result.cards.length, 1); assert.equal(result.cards[0].title, "+1 client"); assert.equal(result.profileId, "profile-a");
  assert.doesNotMatch(JSON.stringify(createRelayState(state)), /private-user|private-action|private-token|cooldown|conditions/);
  rule.trigger.enabled = false; assert.equal(createGamePackOverlay(state).cards.length, 0);
  rule.trigger.enabled = true; rule.enabled = false; assert.equal(createGamePackOverlay(state).cards.length, 0);
  rule.enabled = true; state.commerce.subscription.tier = "free"; state.commerce.subscription.status = "free"; assert.equal(createGamePackOverlay(state).cards.length, 0);
});
test("source: changements de titre, cadeau, colonne, follow et likes suivent la règle", () => {
  const { state, rule } = fixture(); rule.gameInteraction.title = "Mon client"; rule.gameInteraction.marketColumn = "trap";
  rule.conditions[0].value = "Corgi"; rule.conditions[0].giftImageUrl = "file:///private/image.png";
  let card = createGamePackOverlay(state).cards[0]; assert.equal(card.title, "Mon client"); assert.equal(card.column, "trap"); assert.equal(card.giftName, "Corgi"); assert.equal(card.giftImageUrl, "");
  rule.trigger = { type: "like", threshold: 350 }; card = createGamePackOverlay(state).cards[0]; assert.equal(card.threshold, 350); assert.equal(card.triggerType, "like");
  rule.trigger.type = "follow"; assert.equal(createGamePackOverlay(state).cards[0].triggerType, "follow");
});
test("animation: uniquement une action réussie, une seule fois pour une carte avec plusieurs effets", () => {
  const { rule } = fixture(), args = { ok: true, rule, action: structuredClone(rule.actions[0]), profileId: "profile-a", event: { user: { displayName: "Camille" } } };
  assert.equal(gamePackOverlayTrigger(args).viewer, "Camille"); assert.equal(gamePackOverlayTrigger({ ...args, ok: false }), null);
  assert.equal(gamePackOverlayTrigger({ ...args, action: rule.actions[1] }), null);
});
test("URL dédiée publique et locale, droits Pro et filtrage des canaux", () => {
  const url = new URL(publicOverlayUrls({ channelId: "abc" }).gamePack); assert.equal(url.pathname, "/game-pack.html"); assert.equal(url.searchParams.get("channel"), "abc");
  assert.equal(publicOverlayUrls({ channelId: "abc", proAccess: false }).gamePack, "");
  assert.equal(catalog.acceptsChannel({ view: "game-pack", channel: "game-pack-trigger" }), true);
  assert.equal(catalog.acceptsChannel({ view: "game-pack", channel: "configuration" }), false);
});
test("rendu navigateur: toutes les cartes, aucun HTML injecté, changement de profil masqué", () => {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "../resources/overlays/game-pack.html"), "utf8"), { runScripts: "outside-only", url: "https://overlay.test/game-pack.html?profile=profile-a" });
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/game-pack.js"), "utf8"));
  const { state } = fixture(), projection = createGamePackOverlay(state); projection.cards[0].title = '<img src=x onerror="evil()">';
  projection.cards.push({ ...projection.cards[0], id: "second", title: "Piège", column: "trap" });
  dom.window.ShenPulseGamePack.render(projection); const doc = dom.window.document;
  assert.equal(doc.querySelectorAll(".gift-card").length, 2); assert.equal(doc.querySelector("h2").textContent, projection.cards[0].title); assert.equal(doc.querySelectorAll(".art img").length, 2); assert.equal(doc.querySelectorAll(".brand img").length, 1);
  dom.window.ShenPulseGamePack.trigger({ profileId: "profile-a", packId: PACK_ID, ruleId: "customer", viewer: "Camille" }); assert.match(doc.getElementById("reaction").textContent, /Camille/);
  dom.window.ShenPulseGamePack.render({ ...projection, profileId: "profile-b" }); assert.equal(doc.querySelectorAll(".gift-card").length, 0); dom.window.close();
});
async function freePort() { return new Promise((resolve) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const port = s.address().port; s.close(() => resolve(port)); }); }); }
test("serveur réel: document, projection authentifiée et mise à jour sans redémarrage", async () => {
  const { state, rule } = fixture(); Object.assign(state.settings, { overlayPort: await freePort(), apiPort: await freePort(), overlayToken: "test-token", apiToken: "api-token" });
  const server = new OverlayServer({ store: { getState: () => structuredClone(state) }, staticDirectory: path.join(__dirname, "../resources/overlays"), onInboundEvent: async () => {} });
  try {
    await server.start(); const base = "http://127.0.0.1:" + state.settings.overlayPort;
    assert.equal((await fetch(base + "/api/game-pack")).status, 401);
    assert.equal((await fetch(server.urls().gamePack)).status, 200);
    assert.equal((await fetch(base + "/overlay/runtime/game-pack.js")).status, 200);
    const font=await fetch(base+"/overlay/fonts/game-pack-pixel.ttf");assert.equal(font.status,200);assert.equal(font.headers.get("content-type"),"font/ttf");
    const art = createGamePackOverlay(state).cards[0].effectImageUrl;
    const artwork = await fetch(base + "/overlay/" + art);
    assert.equal(artwork.status, 200); assert.equal(artwork.headers.get("content-type"), "image/png");
    assert.deepEqual(Buffer.from(await artwork.arrayBuffer()), fs.readFileSync(path.join(__dirname, "../resources/overlays", art)));
    assert.equal((await fetch(base + "/overlay/media/custom.png")).status, 401);
    assert.equal((await fetch(base + "/overlay/media/video/match.mp4")).status, 403);
    const endpoint = base + "/api/game-pack?token=test-token";
    assert.equal((await (await fetch(endpoint)).json()).cards[0].title, "+1 client");
    rule.gameInteraction.title = "Nouvelle carte"; assert.equal((await (await fetch(endpoint)).json()).cards[0].title, "Nouvelle carte");
    state.settings.overlayConfigs={gameInteractionOverlays:{[PACK_ID]:{model:3,motion:"fixed",backgroundColor:"#abcdef"}}};assert.equal((await (await fetch(endpoint)).json()).presentation.model,3);
  } finally { await server.stop(); }
});

test("le relais publie les changements de règles et de profil, puis les animations sans configuration privée", async () => {
  const { state, rule } = fixture();
  const { createDefaultState } = require("../src/main/defaults");
  const { PublicOverlayRelay } = require("../src/main/public-overlay-relay");
  const { selectStatePaths } = require("../src/main/state-projection");
  const full = createDefaultState(); full.session.profileId = state.session.profileId; full.commerce = state.commerce; full.game.interactionRulesByPack = state.game.interactionRulesByPack;
  const secrets = new Map(), writes = [];
  const store = { getState: () => full, getStateProjection: paths => selectStatePaths(full, paths), mutate: fn => fn(full), getSecret: id => secrets.get(id) || "", setSecret: (id, value) => { id ||= "secret"; secrets.set(id, value); return id; } };
  const relay = new PublicOverlayRelay({ store, fetchImpl: async (url, options = {}) => {
    if (options.body && options.method === "PATCH") writes.push(JSON.parse(options.body));
    const body = String(url).includes("accounts:signUp") ? { idToken: "id", refreshToken: "refresh", expiresIn: "3600", localId: "installation" } : {};
    return { ok: true, status: 200, text: async () => JSON.stringify(body) };
  } });
  try {
    await relay.start(); assert.equal(writes.find(w => w.state)?.state.gamePacks.cards.length, 1);
    rule.gameInteraction.title = "Client modifié"; relay.publishState(); await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(writes.filter(w => w.state).at(-1).state.gamePacks.cards[0].title, "Client modifié");
    relay.publish("game-pack-trigger", { profileId: full.session.profileId, packId: PACK_ID, ruleId: rule.id, viewer: "Camille" });
    await new Promise(resolve => setTimeout(resolve, 50)); assert.equal(writes.filter(w => w.lastBatch).at(-1).lastBatch.messages[0].channel, "game-pack-trigger");
    full.settings.overlayConfigs.gameInteractionOverlays={[PACK_ID]:{model:2,motion:"fixed",backgroundColor:"#abcdef"}};relay.publishState();await new Promise(resolve=>setTimeout(resolve,70));assert.equal(writes.filter(w=>w.state).at(-1).state.gamePacks.presentation.model,2);
    full.session.profileId = "profile-b"; full.game.interactionRulesByPack = {}; relay.publishState(); await new Promise(resolve => setTimeout(resolve, 70));
    assert.equal(writes.filter(w => w.state).at(-1).state.gamePacks.profileId, "profile-b"); assert.equal(writes.filter(w => w.state).at(-1).state.gamePacks.cards.length, 0);
    assert.doesNotMatch(JSON.stringify(writes), /private-user|private-action|private-token/);
  } finally { await relay.stop(); }
});

test("les rayons, reflets, cadeaux flottants et le logo survivent aux mises à jour sans redémarrer à chaque sondage", () => {
  const dom = new JSDOM(fs.readFileSync(path.join(__dirname, "../resources/overlays/game-pack.html"), "utf8"), { runScripts: "outside-only", url: "https://overlay.test/game-pack.html?profile=profile-a&motion=animated" });
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/game-pack.js"), "utf8"));
  const { state } = fixture(), projection = createGamePackOverlay(state), runtime = dom.window.ShenPulseGamePack, doc = dom.window.document;
  runtime.render(projection); const node = doc.querySelector(".gift-card");
  assert.ok(doc.body.classList.contains("animated")); assert.ok(node.querySelector(".card-rays")); assert.ok(node.querySelector(".card-foil"));
  const logo = doc.querySelector(".brand img"); assert.match(logo.src, /brand\/shenpulse-logo.png/); assert.equal(logo.alt, "ShenPulse");
  assert.ok(doc.querySelector(".brand-line.left")); assert.ok(doc.querySelector(".brand-line.right"));
  runtime.render(structuredClone(projection)); assert.equal(doc.querySelector(".gift-card"), node, "Le sondage ne redémarre aucune animation");
  projection.cards[0].column = "trap"; projection.cards[0].title = "Client modifié"; runtime.render(projection);
  assert.equal(doc.querySelector("h2").textContent, "Client modifié"); assert.equal(doc.querySelectorAll(".brand").length, 1, "Le logo reste présent avec des pièges seulement");
  assert.equal(doc.querySelector(".brand").parentElement, doc.querySelector(".pack-page").parentElement);
  dom.window.close();
});
test("le mode fixe garde logo, cartes et cadeaux sans mouvement ; le choix animé explicite prime sur la préférence système", () => {
  for (const mode of ["fixed", "animated"]) {
    const dom = new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>', { runScripts: "outside-only", url: "https://overlay.test/game-pack.html?motion=" + mode });
    dom.window.matchMedia = () => ({ matches: true });
    dom.window.eval(fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/game-pack.js"), "utf8"));
    dom.window.ShenPulseGamePack.render(createGamePackOverlay(fixture().state));
    assert.ok(dom.window.document.body.classList.contains(mode)); assert.equal(dom.window.document.querySelectorAll(".gift-card").length, 1); dom.window.close();
  }
});

function paginationFixture({ top = 7, bottom = 8, neutral = 0, motion = "animated" } = {}) {
  const dom = new JSDOM('<main id="pack"><div id="cards"></div><div id="reaction"></div></main>', { runScripts: "outside-only", url: "https://overlay.test/game-pack.html?profile=profile-a&motion=" + motion });
  let now = 0, sequence = 0; const timers = new Map();
  dom.window.setInterval = (callback, interval) => { const id = ++sequence; timers.set(id, { callback, interval, next: now + interval }); return id; };
  dom.window.clearInterval = id => timers.delete(id);
  const base = createGamePackOverlay(fixture().state), card = base.cards[0];
  base.cards = [["help", top], ["neutral", neutral], ["trap", bottom]].flatMap(([column, count]) => Array.from({ length: count }, (_, index) => ({ ...card, id: column + "-" + index, title: column + " " + index, column })));
  dom.window.eval(fs.readFileSync(path.join(__dirname, "../resources/overlays/runtime/game-pack.js"), "utf8"));
  const runtime = dom.window.ShenPulseGamePack; runtime.render(base);
  function advance(ms) { const end = now + ms; for (;;) { const next = [...timers.values()].sort((a, b) => a.next - b.next)[0]; if (!next || next.next > end) break; now = next.next; next.next += next.interval; next.callback(); } now = end; }
  const active = () => dom.window.document.querySelector(".pack-page.is-current");
  const visible = () => [...active().querySelectorAll(".gift-card")].map(node => node.dataset.rule);
  return { dom, runtime, state: base, timers, advance, active, visible };
}
test("pagination: six cartes par rangée, pages synchronisées toutes les 8 secondes et retour au début", () => {
  const f = paginationFixture({ top: 13, bottom: 8 });
  try {
    const pages = f.dom.window.document.querySelectorAll(".pack-page"); assert.equal(pages.length, 3);
    for (const row of f.dom.window.document.querySelectorAll(".pack-row")) assert.ok(row.children.length <= 6);
    assert.equal(f.active().dataset.pageIndex, "0"); assert.equal(f.visible().length, 12); f.advance(7999); assert.equal(f.active().dataset.pageIndex, "0");
    f.advance(1); assert.equal(f.active().dataset.pageIndex, "1"); assert.deepEqual(f.visible(), ["help-6", "help-7", "help-8", "help-9", "help-10", "help-11", "trap-6", "trap-7"]);
    f.advance(8000); assert.equal(f.active().dataset.pageIndex, "2"); assert.deepEqual(f.visible(), ["help-12"]); assert.equal(f.active().querySelector(".pack-row.trap").children.length, 0);
    f.advance(8000); assert.equal(f.active().dataset.pageIndex, "0"); assert.equal(f.visible().length, 12);
    assert.equal(f.dom.window.document.querySelectorAll('.pack-page[aria-hidden="false"]').length, 1);
  } finally { f.dom.window.close(); }
});
test("un sondage ou un titre modifié ne remet pas le compteur de page à zéro ; réduction et changement de profil arrêtent les pages inutiles", () => {
  const f = paginationFixture();
  try {
    const first = f.active(); f.advance(5000); f.runtime.render(structuredClone(f.state)); assert.equal(f.active(), first);
    f.advance(2000); f.state.cards[0].title = "Titre modifié"; f.runtime.render(f.state); f.advance(999); assert.equal(f.active().dataset.pageIndex, "0"); f.advance(1); assert.equal(f.active().dataset.pageIndex, "1");
    f.state.cards = f.state.cards.filter(c => c.id !== "help-6" && !["trap-6", "trap-7"].includes(c.id)); f.runtime.render(f.state);
    assert.equal(f.active().dataset.pageIndex, "0"); assert.equal(f.timers.size, 0); f.advance(40000); assert.equal(f.active().dataset.pageIndex, "0");
    f.runtime.render({ ...f.state, profileId: "profile-b" }); assert.equal(f.dom.window.document.querySelectorAll(".gift-card").length, 0); assert.equal(f.timers.size, 0);
  } finally { f.dom.window.close(); }
});
test("les reflets suivent le décalage de la référence : 0,9 seconde par carte et 2,7 secondes de plus en bas", () => {
  const f = paginationFixture();
  try {
    const delays = row => [...f.active().querySelectorAll(".pack-row." + row + " .gift-card")].map(c => c.style.getPropertyValue("--foil-delay"));
    assert.deepEqual(delays("help"), ["0.0s", "0.9s", "1.8s", "2.7s", "3.6s", "4.5s"]);
    assert.deepEqual(delays("trap"), ["2.7s", "3.6s", "4.5s", "5.4s", "6.3s", "7.2s"]);
    f.advance(8000); assert.equal(f.active().querySelector(".gift-card").style.getPropertyValue("--foil-delay"), "0.0s");
  } finally { f.dom.window.close(); }
});
test("une interaction sur une autre page affiche sa carte et lui laisse huit secondes avant la rotation", () => {
  const f = paginationFixture();
  try {
    f.advance(5000); f.runtime.trigger({ profileId: "profile-a", packId: PACK_ID, ruleId: "help-6", viewer: "Camille" });
    assert.equal(f.active().dataset.pageIndex, "1"); assert.match(f.dom.window.document.getElementById("reaction").textContent, /Camille/);
    f.advance(7999); assert.equal(f.active().dataset.pageIndex, "1"); f.advance(1); assert.equal(f.active().dataset.pageIndex, "0");
  } finally { f.dom.window.close(); }
});
test("les neutres restent accessibles sans troisième rangée ; en mode Fixe les pages changent aussi sans perdre de carte", () => {
  const f = paginationFixture({ top: 3, neutral: 5, bottom: 6, motion: "fixed" });
  try {
    assert.equal(f.dom.window.document.querySelectorAll(".brand").length, 1); assert.equal(f.active().querySelectorAll(".pack-row").length, 2);
    assert.deepEqual(f.visible().slice(0, 3), ["help-0", "help-1", "help-2"]);
    assert.equal(f.active().querySelector(".pack-row.trap .neutral")!==null,true);
    f.advance(8000); assert.deepEqual(f.visible(), ["trap-1", "trap-2", "trap-3", "trap-4", "trap-5"]); assert.ok(f.dom.window.document.body.classList.contains("fixed"));
  } finally { f.dom.window.close(); }
});

test("l’image publique suit l’effet sélectionné même si le titre personnalisé ne change pas", () => {
  const { state, rule } = fixture(), before = structuredClone(rule);
  const initial = createGamePackOverlay(state).cards[0];
  assert.equal(initial.effectImageUrl, "media/game-interactions/supermarket-simulator/" + effects.find(e => e.code === "SpawnCustomers").id + ".png");
  rule.actions[0].config.effectId = effects.find(e => e.code === "FillShelves").id;
  const next = createGamePackOverlay(state).cards[0];
  assert.equal(next.title, initial.title);
  assert.notEqual(next.effectImageUrl, initial.effectImageUrl);
  assert.equal(next.effectImageUrl, "media/game-interactions/supermarket-simulator/" + rule.actions[0].config.effectId + ".png");
  assert.deepEqual(rule.conditions, before.conditions);
  assert.equal(next.giftImageUrl, initial.giftImageUrl);
  assert.doesNotMatch(next.effectImageUrl, /file:|https:|\.\./);
});


test('Follow et Likes ont une illustration vectorielle colorée et les cartes neutres restent sous le logo',()=>{
 const f=paginationFixture({top:2,neutral:1,bottom:0});try{
 f.state.cards.find(c=>c.id==='help-0').triggerType='follow';f.state.cards.find(c=>c.id==='help-1').triggerType='like';f.runtime.render(f.state);
 const page=f.active();assert.ok(page.querySelector('.help .follow-art circle'));assert.ok(page.querySelector('.help .likes-art path'));assert.equal(page.querySelector('.help .art').textContent.includes('♡'),false);assert.equal(page.querySelector('.trap .neutral').dataset.rule,'neutral-0');assert.equal(new Set([...page.querySelectorAll('svg [id]')].map(n=>n.id)).size,2);
 }finally{f.dom.window.close();}
});
