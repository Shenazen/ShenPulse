"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");

const ROOT = path.join(__dirname, "..", "src", "renderer", "app", "features", "matches");
const SOURCE = "https://shenpulse-overlays.web.app/m/123456789012/fixture-private-match-channel-123";
const WIDGETS = [
  ["wins", "matchesWins", "Compteur de manches"], ["starDonor", "matchesStarDonor", "Dernier donateur"],
  ["topDonor", "matchesTopDonor", "Plus gros donateur"], ["donors", "matchesDonors", "Classement des donateurs"],
  ["timer", "matchesTimer", "Chronomètre de match"], ["victory", "matchesVictory", "Animation de victoire"],
  ["scoreboard", "matchesScoreboard", "Scores du match"]
];
const escapeHtml = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function fixture(t, { source = SOURCE, authenticated = true, pro = true } = {}) {
  const dom = new JSDOM('<main id="page"></main>'); t.after(() => dom.window.close());
  const model = { config: { widgets: Object.fromEntries(WIDGETS.map(([key], index) => [key, { enabled: index % 2 === 0, title: `Titre ${key}` }])) },
    runtime: { rounds: { own: 4 }, session: { wins: 5, winStreak: 2 }, result: "win", liveContributors: [] },
    participants: [{ id: "fixture-participant", displayName: "Créateur <privé>", score: 10 }], automations: [] };
  const access = { authenticated, pro };
  const context = vm.createContext({ URL, document: dom.window.document, escapeHtml,
    snapshot: { state: { settings: { account: { uid: "fixture-account" } }, session: { profileId: "fixture-profile" } },
      overlayUrls: { matchPlayer: source, ...Object.fromEntries(WIDGETS.map(([key, urlKey]) => [urlKey, `${SOURCE}?widget=${key}`])) },
      localOverlayUrls: { matchPlayer: "http://127.0.0.1/match?token=never-displayed" } },
    isAccountAuthenticated: () => access.authenticated, hasProAccess: () => access.pro,
    creatorMatchesModel: () => model, creatorMatchesIcon: () => '<svg aria-hidden="true"></svg>',
    creatorMatchesNumber: (value) => String(value || 0), creatorMatchesScore: (value) => String(value),
    creatorMatchesCountdown: () => "2:00", creatorMatchesAvatar: () => '<span class="fixture-avatar"></span>',
    overlayDefinitions: () => { throw new Error("The widget view must not render animation overlays."); },
    overlayPlaceholderMatch: () => { throw new Error("The widget view must not load animation posters."); },
    api: new Proxy({}, { get() { throw new Error("Rendering must not call IPC or copy a private URL."); } }),
    console: new Proxy({}, { get() { throw new Error("Rendering must not log protected source URLs."); } })
  });
  vm.runInContext(fs.readFileSync(path.join(ROOT, "widgets.js"), "utf8"), context, { filename: "widgets.js" });
  const page = dom.window.document.getElementById("page");
  const draw = (kind) => { page.innerHTML = kind === "widgets" ? context.creatorMatchesWidgetsMarkup() : context.creatorMatchesAutomationOnboardingMarkup(); return page; };
  return { context, model, access, page, draw };
}

test("Widgets keeps all seven real widgets and their own sources, settings and previews without animation cards or a player link", (t) => {
  const f = fixture(t), before = JSON.stringify({ snapshot: f.context.snapshot, model: f.model });
  const page = f.draw("widgets"), cards = [...page.querySelectorAll(".matches-widget-card")];
  assert.equal(cards.length, WIDGETS.length);
  for (const [index, [key, urlKey, name]] of WIDGETS.entries()) {
    const card = cards[index];
    assert.equal(card.querySelector("header h3").textContent, name);
    assert.equal(card.querySelector(`[data-matches-widget-preview="${key}"] h4`).textContent, `Titre ${key}`);
    for (const action of ["edit", "copy", "test"]) {
      const control = card.querySelector(`[data-action="matches-widget-${action}"]`);
      assert.equal(control.dataset.id, key); assert.equal(control.disabled, false);
    }
    assert.equal(card.querySelector(".matches-widget-status").textContent, index % 2 === 0 ? "ACTIF" : "INACTIF");
    assert.equal(f.context.creatorMatchesWidgetUrl({ urlKey }), `${SOURCE}?widget=${key}`);
  }
  assert.equal(page.querySelectorAll('.matches-animation-card, .matches-animations, .matches-player-source, [data-action="configure-overlay"], [data-action="matches-player-copy"], .matches-automation-source-input').length, 0);
  assert.doesNotMatch(page.innerHTML, /fixture-private-match-channel|127\.0\.0\.1|never-displayed/);
  assert.equal(JSON.stringify({ snapshot: f.context.snapshot, model: f.model }), before);
});

test("the automation onboarding has three accessible steps, one readonly protected Studio URL and the two existing copy routes", (t) => {
  const f = fixture(t), before = JSON.stringify(f.context.snapshot), page = f.draw("automation");
  assert.equal(page.querySelectorAll(".matches-automation-steps > li").length, 3);
  assert.deepEqual([...page.querySelectorAll(".matches-onboarding-step-number")].map((node) => node.textContent), ["1", "2", "3"]);
  const input = page.querySelector("#matches-automation-studio-source");
  assert.equal(input.value, `${SOURCE}?transport=local`); assert.equal(input.type, "url");
  assert.equal(input.readOnly, true); assert.equal(input.disabled, false); assert.equal(input.hasAttribute("name"), false);
  assert.equal(page.querySelector(`label[for="${input.id}"]`).textContent, "Lien protégé pour TikTok Studio sur ce PC");
  assert.ok(page.querySelector(`#${input.getAttribute("aria-describedby")}`));
  const controls = [...page.querySelectorAll('[data-action="matches-player-copy"]')];
  assert.equal(controls.length, 2); assert.equal(controls[0].dataset.transport, "local");
  assert.equal(controls[1].hasAttribute("data-transport"), false);
  assert.ok(controls.every((control) => !control.disabled && !control.hasAttribute("data-value")));
  assert.match(page.textContent, /Activez les bons moments/); assert.match(page.textContent, /Choisissez vos effets, puis testez/);
  assert.match(page.textContent, /ne le partagez pas/); assert.match(page.textContent, /après confirmation/);
  assert.equal(page.querySelector("iframe, video, audio, img, a[href]"), null);
  assert.equal(JSON.stringify(f.context.snapshot), before);
});

test("missing or invalid common URLs show an unavailable state without localhost, media exports or invented fallbacks", (t) => {
  for (const source of ["", "http://127.0.0.1/match?token=secret", "https://localhost/m/123456789012/abcdefghijklmnopqrstuvwx",
    "https://shenpulse-overlays.web.app/video/private.webm", `${SOURCE}?token=secret`, `${SOURCE}?widget=timer`,
    "https://username:secret@shenpulse-overlays.web.app/m/123456789012/abcdefghijklmnopqrstuvwx"]) {
    const page = fixture(t, { source }).draw("automation");
    assert.equal(page.querySelector(".matches-automation-source-input").value, "");
    assert.equal(page.querySelector(".matches-automation-source-input").disabled, true);
    assert.ok([...page.querySelectorAll('[data-action="matches-player-copy"]')].every((control) => control.disabled));
    assert.match(page.querySelector(".matches-source-warning").textContent, /Aucun lien local ou fictif/);
    assert.doesNotMatch(page.innerHTML, /127\.0\.0\.1|private\.webm|token=secret|username:secret|never-displayed/);
  }
});

test("anonymous or non-Pro views never expose a protected automation URL", (t) => {
  for (const access of [{ authenticated: false }, { pro: false }]) {
    const page = fixture(t, access).draw("automation");
    assert.equal(page.querySelector(".matches-automation-source-input").value, "");
    assert.ok([...page.querySelectorAll('[data-action="matches-player-copy"]')].every((control) => control.disabled));
    assert.doesNotMatch(page.innerHTML, /fixture-private-match-channel/);
  }
});

test("protected URL query text cannot become markup, links or an automatic action", (t) => {
  const source = `${SOURCE}?label=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&hint=1`;
  const page = fixture(t, { source }).draw("automation"), url = new URL(source); url.searchParams.set("transport", "local");
  assert.equal(page.querySelector(".matches-automation-source-input").value, url.toString());
  assert.equal(page.querySelector("img, script, [onerror]"), null);
  assert.equal(page.querySelectorAll("input").length, 1);
});

test("a fresh profile render uses only its current protected URL and access, never a cached player link", (t) => {
  const f = fixture(t); f.draw("automation");
  f.context.snapshot.state.session.profileId = "other-profile";
  const nextSource = SOURCE.replace("fixture-private-match-channel-123", "next-profile-private-channel-456");
  f.context.snapshot.overlayUrls.matchPlayer = nextSource;
  assert.equal(f.draw("automation").querySelector(".matches-automation-source-input").value, `${nextSource}?transport=local`);
  assert.doesNotMatch(f.page.innerHTML, /fixture-private-match-channel-123/);
  f.access.authenticated = false; f.draw("automation");
  assert.equal(f.page.querySelector(".matches-automation-source-input").value, "");
  assert.doesNotMatch(f.page.innerHTML, /next-profile-private-channel-456/);
});

test("the real automation view includes the common-source guide once and never embeds widget or animation-gallery settings", (t) => {
  const f = fixture(t);
  vm.runInContext(fs.readFileSync(path.join(ROOT, "editor.js"), "utf8"), f.context, { filename: "editor.js" });
  f.context.creatorMatchesAutomationCard = () => '<article class="fixture-automation"></article>';
  f.context.creatorMatchesMultiplierCard = () => '<article class="fixture-multipliers"></article>';
  f.page.innerHTML = f.context.creatorMatchesAutomationsMarkup();
  assert.equal(f.page.querySelectorAll(".matches-automations .matches-automation-onboarding").length, 1);
  assert.equal(f.page.querySelectorAll(".matches-automation-source-input").length, 1);
  assert.equal(f.page.querySelectorAll('[data-action="matches-player-copy"]').length, 2);
  assert.equal(f.page.querySelector(".matches-widgets, .matches-animation-card, [data-action='configure-overlay']"), null);
  assert.match(f.page.querySelector(".matches-automation-source-input").value, /^https:\/\//);
});
