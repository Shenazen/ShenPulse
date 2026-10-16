"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const identity = require("../src/shared/gift-identity");
const display = require("../src/shared/gift-display");

const image = "https://p16-webcast.example.test/img/0123456789abcdef0123456789abcdef.png~tplv-obj.webp";
const rows = () => [
  { id: "1001", name: "Rose à main", cost: 1, imageUrl: image },
  { id: "1002", name: "Main Rose", cost: 1, imageUrl: image.replace("p16-", "p19-").replace(".png~tplv-obj.webp", "~tplv-other.webp") },
  { id: "1003", name: "Rose Hand", cost: 1, imageUrl: image },
  { id: "1004", name: "Rose à main", cost: 5, imageUrl: image },
  { id: "1005", name: "Rose à main", cost: 1, imageUrl: "https://cdn.example.test/another-image.webp" }
];
const currentState = () => ({ settings: { account: { uid: "account-fixture" }, tiktok: { username: "creator", roomId: "8001", status: "live" } },
  session: { profileId: "profile-fixture" } });
const result = (extra = {}) => ({ gifts: rows(), total: 5,
  room: { username: "creator", roomId: "8001", available: true, partial: false, fetchedAt: "2026-10-16T12:00:00Z" }, roomGifts: rows().slice(0, 3), ...extra });
function renderer(context) {
  const dom = new JSDOM('<datalist id="gift-catalog-options"></datalist><form id="form"></form>', { pretendToBeVisual: true });
  context.after(() => dom.window.close());
  const roomCalls = [], sandbox = vm.createContext({ document: dom.window.document, window: dom.window,
    ShenPulseGiftIdentity: identity, ShenPulseGiftDisplay: display, snapshot: { state: currentState() },
    giftCatalogById: new Map(), giftCatalogByName: new Map(), GIFT_CATALOG: [], giftRequestSequence: 0, giftSearchTimer: null,
    rendererFormatters: { integer: new Intl.NumberFormat("fr-FR") }, fieldLabelWithInfo: (label) => `<span>${label}</span>`,
    setTimeout, clearTimeout, api: { searchGifts: async () => result() } });
  for (const file of ["core/ui-foundations.js", "features/media/gift-picker.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/renderer/app", file), "utf8"), sandbox);
  }
  const rememberRoom = sandbox.rememberRoomGifts;
  sandbox.rememberRoomGifts = (...args) => { roomCalls.push(args); rememberRoom?.(...args); };
  const form = dom.window.document.querySelector("form");
  form.innerHTML = '<input name="draft" value="Unrelated unsaved draft">' + sandbox.giftPickerField("giftName", "Cadeau", "Cadeau historique", "", "", "retired-id", {
    giftImageUrl: "https://cdn.example.test/historical.webp", giftCost: 42, giftIds: ["retired-id", "saved-alias"]
  });
  const root = form.querySelector("[data-gift-picker-root]"), input = root.querySelector("[data-gift-picker]");
  return { dom, sandbox, roomCalls, form, root, input, list: dom.window.document.querySelector("datalist"), results: root.querySelector("[data-gift-results]") };
}

test("display grouping collapses translated artwork variants without merging technical IDs or changing source rows", () => {
  const gifts = rows(), original = JSON.stringify(gifts), groups = display.groupGiftDisplayRows(gifts);
  assert.equal(groups.length, 3); assert.equal(groups[0].variants.length, 3);
  assert.equal(groups[0].gift.id, "1001"); assert.deepEqual(groups[0].variants.map((gift) => gift.id), ["1001", "1002", "1003"]);
  assert.equal(JSON.stringify(gifts), original); assert.ok(gifts.every((gift) => gift.alternateIds === undefined));
  assert.equal(display.groupGiftDisplayRows(gifts, { preferredId: "1003" })[0].gift.id, "1003");
  assert.equal(display.groupGiftDisplayRows(gifts, { preferredId: "1003", query: "1002" })[0].gift.id, "1002");
});

test("generic images, absent images and unrelated ordinary filenames cannot merge different gifts", () => {
  for (const imageUrl of ["", "https://cdn.example.test/gift.png", "https://cdn.example.test/placeholder.webp"]) {
    assert.equal(display.groupGiftDisplayRows([{ id: "a", name: "Lion", cost: 1, imageUrl }, { id: "b", name: "Rose", cost: 1, imageUrl }]).length, 2);
    assert.equal(display.groupGiftDisplayRows([{ id: "a", name: "Rose", cost: 1, imageUrl }, { id: "b", name: "Rose", cost: 1, imageUrl }]).length, 2,
      "Matching translated names are not a proven common artwork");
  }
  assert.equal(display.groupGiftDisplayRows([{ id: "a", name: "Lion", cost: 1, imageUrl: "https://first.example.test/lion.webp" },
    { id: "b", name: "Rose", cost: 1, imageUrl: "https://second.example.test/lion.webp" }]).length, 2);
  assert.equal(display.groupGiftDisplayRows([{ id: "a", name: "Rose", cost: 1, imageUrl: "https://cdn.example.test/a/image.png" },
    { id: "b", name: "Rose", cost: 1, imageUrl: "https://cdn.example.test/b/image.png" }]).length, 2);
});

test("the common picker defaults to the current creator while all raw IDs remain available to historical lookups", async (context) => {
  const f = renderer(context); await f.sandbox.hydrateGiftCatalog("", f.input);
  assert.equal(f.list.options.length, 1); assert.equal(f.results.querySelectorAll(":scope > [data-gift-choice]").length, 1);
  assert.match(f.results.textContent, /Cadeaux du LIVE de @creator/); assert.equal(f.roomCalls.length, 1);
  assert.equal(f.sandbox.GIFT_CATALOG.length, 5); assert.equal(f.sandbox.giftForIdentity("Main Rose", "1002").id, "1002");
  assert.equal(f.root.querySelector("[data-gift-id-input]").value, "retired-id"); assert.equal(f.input.value, "Cadeau historique");
  assert.equal(f.form.querySelector('[name="draft"]').value, "Unrelated unsaved draft");
  assert.equal(f.root.querySelector("[data-gift-selected] img").getAttribute("src"), "https://cdn.example.test/historical.webp");
  assert.deepEqual(JSON.parse(f.root.dataset.giftReference).giftIds, ["retired-id", "saved-alias"]);
});

test("an explicit global fallback is clearly labelled and switching back cannot change the selected gift or draft", async (context) => {
  const f = renderer(context); await f.sandbox.hydrateGiftCatalog("", f.input);
  f.results.querySelector("[data-gift-catalog-view]").click();
  assert.equal(f.list.options.length, 3); assert.match(f.results.textContent, /Catalogue global/); assert.match(f.results.textContent, /disponibilité.*non garantie/);
  f.results.querySelector("[data-gift-catalog-view]").click();
  assert.equal(f.list.options.length, 1); assert.equal(f.root.querySelector("[data-gift-id-input]").value, "retired-id");
  assert.equal(f.form.querySelector('[name="draft"]').value, "Unrelated unsaved draft");
});

test("raw variants remain individually selectable behind a closed disclosure without acquiring each other's aliases", async (context) => {
  const f = renderer(context); await f.sandbox.hydrateGiftCatalog("", f.input);
  const details = f.results.querySelector("details"); assert.ok(details); assert.equal(details.open, false);
  assert.equal(details.querySelectorAll("[data-gift-choice]").length, 2);
  const choice = details.querySelector('[data-gift-id="1002"]'); assert.ok(choice); assert.match(choice.textContent, /ID 1002/);
  assert.equal(f.sandbox.giftForIdentity("Main Rose", "1002").alternateIds, undefined);
});

test("an exact ID search chooses that variant's own ID as the representative, never a different regional ID", async (context) => {
  const f = renderer(context); await f.sandbox.hydrateGiftCatalog("1002", f.input);
  assert.equal(f.results.querySelector(":scope > [data-gift-choice]").dataset.giftId, "1002");
  assert.equal(f.list.options[0].value, "Main Rose"); assert.equal(f.root.querySelector("[data-gift-id-input]").value, "retired-id");
});

test("observed-only room rows are labelled as received and partial, never as a complete availability list", async (context) => {
  const f = renderer(context); f.sandbox.api.searchGifts = async () => result({ room: { username: "creator", roomId: "8001", available: false, partial: true } });
  await f.sandbox.hydrateGiftCatalog("", f.input);
  assert.equal(f.list.options.length, 1); assert.match(f.results.textContent, /Cadeaux reçus/); assert.match(f.results.textContent, /Liste partielle/);
  assert.doesNotMatch(f.results.querySelector(".gift-results-scope").textContent, /Cadeaux du LIVE/);
});

test("missing or mismatched creator metadata uses only an explicitly uncertain global fallback", async (context) => {
  for (const room of [null, { username: "creator", roomId: "8001", available: false },
    { username: "other", roomId: "8001", available: true }, { username: "creator", roomId: "8002", available: true }]) {
    const f = renderer(context); f.sandbox.api.searchGifts = async () => result({ room }); await f.sandbox.hydrateGiftCatalog("", f.input);
    assert.equal(f.list.options.length, 3); assert.match(f.results.textContent, /Catalogue global/); assert.match(f.results.textContent, /non garantie/);
    assert.equal(f.roomCalls.length, room?.username === "creator" && room.roomId === "8001" ? 1 : 0);
  }
});

test("an empty verified room search never silently substitutes global gifts", async (context) => {
  const f = renderer(context); f.sandbox.api.searchGifts = async () => result({ roomGifts: [] });
  await f.sandbox.hydrateGiftCatalog("rare-gift", f.input);
  assert.equal(f.list.options.length, 0); assert.match(f.results.textContent, /Aucun cadeau correspondant/);
  assert.ok(f.results.querySelector('[data-gift-catalog-view="global"]'));
});

test("account, profile, username and room changes invalidate pending search responses", async (context) => {
  for (const mutate of [state => { state.settings.account.uid = "other"; }, state => { state.session.profileId = "other"; },
    state => { state.settings.tiktok.username = "other"; }, state => { state.settings.tiktok.roomId = "other"; }]) {
    const f = renderer(context); let complete; f.sandbox.api.searchGifts = () => new Promise((resolve) => { complete = resolve; });
    const pending = f.sandbox.hydrateGiftCatalog("", f.input); mutate(f.sandbox.snapshot.state); complete(result()); await pending;
    assert.equal(f.list.options.length, 0); assert.equal(f.roomCalls.length, 0); assert.equal(f.sandbox.GIFT_CATALOG.length, 0);
    assert.equal(f.root.querySelector("[data-gift-id-input]").value, "retired-id");
  }
});

test("a connection-status transition alone cannot discard a valid catalogue for the same account, profile and creator room", async (context) => {
  for (const [before, after] of [["checking", "live"], ["disconnected", "live"], ["live", "disconnected"]]) {
    const f = renderer(context); let complete; f.sandbox.snapshot.state.settings.tiktok.status = before;
    f.sandbox.api.searchGifts = () => new Promise((resolve) => { complete = resolve; });
    const pending = f.sandbox.hydrateGiftCatalog("", f.input);
    f.sandbox.snapshot.state.settings.tiktok.status = after; complete(result()); await pending;
    assert.equal(f.list.options.length, 1); assert.equal(f.roomCalls.length, 1);
    assert.equal(f.sandbox.GIFT_CATALOG.length, 5); assert.equal(f.root.querySelector("[data-gift-id-input]").value, "retired-id");
  }
});

test("out-of-order and detached-picker responses cannot replace newer results or warm a stale identity cache", async (context) => {
  const f = renderer(context), complete = [];
  f.sandbox.api.searchGifts = () => new Promise((resolve) => complete.push(resolve));
  const first = f.sandbox.hydrateGiftCatalog("old", f.input), second = f.sandbox.hydrateGiftCatalog("new", f.input);
  complete[1](result()); await second; complete[0](result({ gifts: [{ id: "stale", name: "Stale", cost: 1 }] })); await first;
  assert.equal(f.sandbox.giftForIdentity("Stale", "stale"), null); assert.equal(f.list.options.length, 1);
  const pending = f.sandbox.hydrateGiftCatalog("detached", f.input); f.root.remove(); complete[2](result({ gifts: [{ id: "detached", name: "Detached", cost: 1 }] }));
  await pending; assert.equal(f.sandbox.giftForIdentity("Detached", "detached"), null);
});

test("failed lookups retain the saved technical gift and clearly report catalogue unavailability", async (context) => {
  const f = renderer(context); f.sandbox.api.searchGifts = async () => { throw new Error("fixture-only"); };
  await f.sandbox.hydrateGiftCatalog("", f.input); assert.match(f.results.textContent, /Catalogue indisponible/);
  assert.equal(f.input.value, "Cadeau historique"); assert.equal(f.root.querySelector("[data-gift-id-input]").value, "retired-id");
});

test("both application and historical game host load the pure grouping module before their gift controls", () => {
  for (const [file, module, controls] of [["src/renderer/index.html", '../shared/gift-display.js', 'app/features/media/gift-picker.js'],
    ["src/renderer/games/host.html", '../../shared/gift-display.js', 'game-host/common.js']]) {
    const html = fs.readFileSync(path.join(__dirname, "..", file), "utf8");
    assert.ok(html.indexOf(module) >= 0 && html.indexOf(module) < html.indexOf(controls));
  }
});

test("the historical game's scoped options use the same groups but keep all raw name lookups and settings", () => {
  const sandbox = vm.createContext({ ShenPulseGiftDisplay: display, snapshot: { state: currentState() }, giftCatalogResult: result(),
    giftCatalog: rows(), hostGiftCatalogView: "room" });
  vm.runInContext(fs.readFileSync(path.join(__dirname, "..", "src/renderer/games/game-host/common.js"), "utf8"), sandbox);
  assert.equal((sandbox.hostGiftOptionsMarkup().match(/<option /g) || []).length, 1);
  assert.match(sandbox.hostGiftCatalogLabel(), /Cadeaux du LIVE de @creator/);
  assert.equal(sandbox.giftForName("Rose Hand").id, "1003");
  sandbox.hostGiftCatalogView = "global"; assert.equal((sandbox.hostGiftOptionsMarkup().match(/<option /g) || []).length, 3);
  assert.match(sandbox.hostGiftCatalogLabel(), /non garantie/); sandbox.snapshot.state.settings.tiktok.username = "other";
  sandbox.hostGiftCatalogView = "room"; assert.match(sandbox.hostGiftCatalogLabel(), /Catalogue global/);
});

const personalImage = "https://cdn.example.test/resource/composed.fixture-blue-person.webp";
const pretzelImage = "https://cdn.example.test/pretzel.webp";
function separateHeartRows() {
  return [{ id: "7934", name: "Envoie-moi un cœur", cost: 1, imageUrl: personalImage, alternateIds: ["heart-me"] },
    { id: "17712", name: "Cœur de la communauté", cost: 1, imageUrl: pretzelImage, selectable: false },
    { id: "157842", name: "Shenazen Pulse", cost: 1, combo: true, imageUrl: personalImage }];
}

test("the true red heart and the distinct provider-named blue gift stay separate in both new-choice catalogues", async (context) => {
  const f = renderer(context), gifts = separateHeartRows(), original = JSON.stringify(gifts);
  f.sandbox.api.searchGifts = async () => result({ gifts, roomGifts: gifts });
  await f.sandbox.hydrateGiftCatalog("", f.input);
  for (const view of ["room", "global"]) {
    if (view === "global") f.results.querySelector("[data-gift-catalog-view]").click();
    const red = f.results.querySelector('[data-gift-id="7934"]'), blue = f.results.querySelector('[data-gift-id="157842"]');
    assert.equal(f.results.querySelectorAll(":scope > [data-gift-choice]").length, 2);
    assert.equal(red.dataset.giftChoice, "Cœur sur moi"); assert.equal(red.dataset.giftImage, identity.COMMUNITY_HEART_IMAGE_URL);
    assert.equal(blue.dataset.giftChoice, "Shenazen Pulse"); assert.equal(blue.dataset.giftImage, personalImage);
    assert.equal(f.results.querySelector('[data-gift-id="17712"]'), null);
    assert.equal([...f.list.options].some((option) => option.textContent.includes("17712")), false);
  }
  assert.equal(JSON.stringify(gifts), original, "Presentation never rewrites raw provider evidence");
});

test("a retired pretzel stays intact in historical selections while it disappears from every new-choice row and variant", async (context) => {
  const f = renderer(context), gifts = separateHeartRows();
  f.input.value = "Cœur de la communauté"; f.root.querySelector("[data-gift-id-input]").value = "17712";
  f.root.dataset.giftReference = JSON.stringify({ giftId: "17712", giftName: f.input.value, giftImageUrl: pretzelImage, giftCost: 1 });
  f.sandbox.api.searchGifts = async () => result({ gifts, roomGifts: gifts }); await f.sandbox.hydrateGiftCatalog("", f.input);
  assert.equal(f.root.querySelector("[data-gift-id-input]").value, "17712"); assert.equal(f.input.value, "Cœur de la communauté");
  assert.equal(f.root.querySelector("[data-gift-selected] img").getAttribute("src"), pretzelImage);
  assert.equal(f.sandbox.giftForIdentity("Cœur de la communauté", "17712").id, "17712");
  assert.equal(display.groupGiftDisplayRows(gifts).flatMap((group) => group.variants).some((gift) => gift.id === "17712"), false);
});

test("an explicit click from an old menu cannot recolor the true heart or mislabel the distinct creator gift", async (context) => {
  const f = renderer(context), gifts = separateHeartRows();
  f.sandbox.api.searchGifts = async () => result({ gifts, roomGifts: gifts }); await f.sandbox.hydrateGiftCatalog("", f.input);
  const idInput = f.root.querySelector("[data-gift-id-input]");
  idInput.value = "7934"; f.input.value = "Envoie-moi un cœur";
  f.sandbox.updateGiftPickerSelection(f.root, { id: "7934", name: f.input.value, imageUrl: personalImage, cost: 1 });
  assert.equal(f.input.value, "Cœur sur moi"); assert.equal(idInput.value, "7934");
  assert.equal(f.root.querySelector("[data-gift-selected] img").getAttribute("src"), identity.COMMUNITY_HEART_IMAGE_URL);
  assert.equal(JSON.parse(f.root.dataset.giftReference).giftImageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  idInput.value = "157842"; f.input.value = "Cœur sur moi";
  f.sandbox.updateGiftPickerSelection(f.root, { id: "157842", name: "Cœur sur moi", imageUrl: identity.COMMUNITY_HEART_IMAGE_URL, cost: 1 });
  assert.equal(f.input.value, "Shenazen Pulse"); assert.equal(idInput.value, "157842");
  assert.equal(f.root.querySelector("[data-gift-selected] img").getAttribute("src"), personalImage);
});

test("refreshing a formerly poisoned heart alias cannot transfer the red ID to the separate blue gift", async (context) => {
  const f = renderer(context), old = { id: "7934", name: "Cœur sur moi", imageUrl: personalImage, cost: 1,
    alternateIds: ["157842", "17712", "heart-me"], alternateNames: ["Shenazen Pulse"], giftFamily: "community-heart" };
  const before = JSON.stringify(old);
  for (const id of ["7934", "heart-me", "157842", "17712"]) f.sandbox.giftCatalogById.set(id, old);
  f.sandbox.GIFT_CATALOG = [old];
  const gifts = separateHeartRows(); f.sandbox.api.searchGifts = async () => result({ gifts, roomGifts: gifts });
  await f.sandbox.hydrateGiftCatalog("", f.input);
  assert.equal(f.sandbox.giftForIdentity("Cœur sur moi", "7934").id, "7934");
  assert.equal(f.sandbox.giftForIdentity("Cœur sur moi", "7934").imageUrl, identity.COMMUNITY_HEART_IMAGE_URL);
  const blue = f.sandbox.giftForIdentity("Shenazen Pulse", "157842");
  assert.equal(blue.id, "157842"); assert.equal(blue.name, "Shenazen Pulse"); assert.notEqual(blue.giftFamily, "community-heart");
  const saved = f.sandbox.giftReferenceForSave("Shenazen Pulse", "157842");
  assert.equal(saved.giftId, "157842"); assert.notEqual(saved.giftFamily, "community-heart");
  assert.ok(!(saved.giftIds || []).some((id) => id === "7934" || id === "heart-me")); assert.equal(JSON.stringify(old), before);
});
