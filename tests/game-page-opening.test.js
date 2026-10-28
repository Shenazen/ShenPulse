"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { registerGamesIpc } = require('../src/main/ipc/games');

function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function fixture() {
  const selection = new Map(), calls = [], views = [], statuses = new Map();
  const packs = [{ id: 'supermarket-simulator', interactionCatalogVersion: 42 }, { id: 'dredge' }, { id: 'ark' }];
  const state = { settings: { account: { uid: 'owner-a' } }, session: { profileId: 'profile-a' }, game: { installations: {}, interactionCatalogVersions: { 'supermarket-simulator': 42 }, interactionRulesByPack: { 'supermarket-simulator': [{ id: 'saved-rule', actions: [] }] } } };
  const ctx = vm.createContext({ console, structuredClone, Promise, JSON, Set,
    snapshot: { state, packs }, currentPage: 'games', gamePageMode: 'catalog', selectedGameId: '', gameWorkspaceStep: '', gameEffectSearch: '', gameEffectCategory: '',
    content: { scrollTop: 200 }, AUTOMATED_GAME_INSTALLERS: packs.map(p => p.id), gameInstallBusyId: '', gameInstallProgress: null,
    isAccountAuthenticated: () => true,
    render() { views.push({ game: ctx.selectedGameId, mode: ctx.gamePageMode, ready: ctx.selectedGameId ? ctx.gameWorkspaceInteractionsReady(packs.find(p => p.id === ctx.selectedGameId)) : true }); },
    acceptSnapshot(value) { ctx.snapshot = value; }, api: {
      selectGame(id) { calls.push(['select', id]); const d = deferred(); selection.set(id, d); return d.promise; },
      getSnapshot() { throw Error('Redundant snapshot request'); },
      async initializeGameInteractions(id) { calls.push(['initialize', id]); const next = structuredClone(ctx.snapshot); next.state.game.interactionCatalogVersions[id] = 42; next.state.game.interactionRulesByPack[id] = [{ id: 'prepared', actions: [] }]; return { snapshot: next }; },
      getGameRuntimeStatus(id) { calls.push(['status', id]); return statuses.get(id)?.promise || Promise.resolve(null); }
    }
  });
  const access = fs.readFileSync('src/renderer/app/features/games/access.js', 'utf8');
  vm.runInContext(access.slice(access.indexOf('let gameWorkspaceEntry ='), access.indexOf('function renderGameWorkspace(pack)')), ctx);
  const interactions = fs.readFileSync('src/renderer/app/features/games/interactions.js', 'utf8');
  const ast = ts.createSourceFile('interactions.js', interactions, ts.ScriptTarget.Latest, true);
  const restore = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'restoreActiveGameInstallProgress');
  vm.runInContext(restore.getText(ast), ctx);
  return { ctx, packs, views, calls, selection, statuses, async select(id) { selection.get(id).resolve(structuredClone(ctx.snapshot)); await Promise.resolve(); await Promise.resolve(); } };
}

test('la fiche est rendue avant toute réponse IPC, sans recharger l’état ni scanner les autres jeux', async () => {
  const f = fixture(), pending = f.ctx.enterGameWorkspace(f.packs[0]);
  assert.deepEqual(f.views, [{ game: f.packs[0].id, mode: 'detail', ready: true }]);
  assert.equal(f.ctx.content.scrollTop, 0); assert.deepEqual(f.calls, [['select', f.packs[0].id]]);
  f.ctx.content.scrollTop = 670; await f.select(f.packs[0].id); await pending;
  assert.deepEqual(f.calls, [['select', f.packs[0].id], ['status', f.packs[0].id]]);
  assert.equal(f.ctx.content.scrollTop, 670, 'Une réponse tardive ne remonte pas la fiche.');
  assert.equal(f.views.length, 1, 'Pas de deuxième reconstruction sans changement visible.');
});

test('une première migration affiche la fiche immédiatement et prépare les interactions une seule fois', async () => {
  const f = fixture(); f.ctx.snapshot.state.game.interactionCatalogVersions = {};
  const pending = f.ctx.enterGameWorkspace(f.packs[0]); assert.equal(f.views[0].ready, false);
  await f.select(f.packs[0].id); await pending;
  assert.equal(f.calls.filter(([name]) => name === 'initialize').length, 1);
  assert.equal(f.views.at(-1).ready, true); assert.equal(f.ctx.snapshot.state.game.interactionRulesByPack[f.packs[0].id][0].id, 'prepared');
  const second = f.ctx.enterGameWorkspace(f.packs[0]); await f.select(f.packs[0].id); await second;
  assert.equal(f.calls.filter(([name]) => name === 'initialize').length, 1);
});

test('le retour à la galerie pendant la sélection ne rouvre pas la fiche et ne lance aucune préparation', async () => {
  const f = fixture(); f.ctx.snapshot.state.game.interactionCatalogVersions = {};
  const pending = f.ctx.enterGameWorkspace(f.packs[0]); f.ctx.gamePageMode = 'catalog'; f.ctx.content.scrollTop = 300;
  await f.select(f.packs[0].id); await pending;
  assert.equal(f.ctx.gamePageMode, 'catalog'); assert.equal(f.ctx.content.scrollTop, 300);
  assert.deepEqual(f.calls, [['select', f.packs[0].id]]); assert.equal(f.views.length, 1);
});

test('une ancienne réponse ne remplace ni un autre jeu, ni les réglages plus récents', async () => {
  const f = fixture(), old = f.ctx.enterGameWorkspace(f.packs[0]);
  const next = f.ctx.enterGameWorkspace(f.packs[1]); await f.select(f.packs[1].id); await next;
  const latest = structuredClone(f.ctx.snapshot); latest.state.game.interactionRulesByPack.dredge = [{ id: 'recent-edit' }]; f.ctx.snapshot = latest;
  f.selection.get(f.packs[0].id).resolve({ state: { ...latest.state, game: {} } }); await old;
  assert.equal(f.ctx.snapshot, latest); assert.equal(f.ctx.selectedGameId, 'dredge');
  assert.deepEqual(f.calls.filter(([name]) => name === 'status'), [['status', 'dredge']]);
});

test('les réponses d’un autre compte ou profil sont ignorées, y compris les erreurs obsolètes', async () => {
  for (const kind of ['profile', 'account', 'page']) {
    const f = fixture(), pending = f.ctx.enterGameWorkspace(f.packs[0]);
    if (kind === 'profile') f.ctx.snapshot.state.session.profileId = 'profile-b';
    if (kind === 'account') f.ctx.snapshot.state.settings.account.uid = 'owner-b';
    if (kind === 'page') f.ctx.currentPage = 'home';
    f.selection.get(f.packs[0].id).reject(Error('Old request')); await pending;
    assert.equal(f.views.length, 1); assert.deepEqual(f.calls, [['select', f.packs[0].id]]);
  }
});

test('une réponse de sélection tardive laisse une modification récente intacte', async () => {
  const f = fixture(), pending = f.ctx.enterGameWorkspace(f.packs[0]), stale = structuredClone(f.ctx.snapshot);
  const latest = structuredClone(f.ctx.snapshot); latest.state.game.interactionRulesByPack[f.packs[0].id][0].id = 'new-rule'; f.ctx.snapshot = latest;
  f.selection.get(f.packs[0].id).resolve(stale); await pending;
  assert.equal(f.ctx.snapshot, latest);
});

test('un échec actuel conserve le retour à la galerie et remonte une erreur exploitable', async () => {
  const f = fixture(), pending = f.ctx.enterGameWorkspace(f.packs[1]);
  f.selection.get(f.packs[1].id).reject(Error('Access revoked'));
  await assert.rejects(pending, /Access revoked/); assert.equal(f.ctx.gamePageMode, 'catalog');
});

test('la reprise ciblée ne bloque pas la fiche et les progrès d’un ancien contexte sont ignorés', async () => {
  const f = fixture(), id = f.packs[1].id, d = deferred(); f.statuses.set(id, d);
  const pending = f.ctx.enterGameWorkspace(f.packs[1]); await f.select(id);
  assert.equal(f.views[0].mode, 'detail'); assert.deepEqual(f.calls, [['select', id], ['status', id]]);
  f.ctx.gamePageMode = 'catalog'; d.resolve({ gameId: id, installing: true, installProgress: { phase: 'download' } }); await pending;
  assert.equal(f.ctx.gameInstallProgress, null);
});

test('la reprise générale au démarrage continue de retrouver une installation d’un autre jeu', async () => {
  const f = fixture(); f.ctx.api.getGameRuntimeStatus = async id => id === 'ark' ? { gameId: id, installing: true, installProgress: { phase: 'download' } } : null;
  await f.ctx.restoreActiveGameInstallProgress(); assert.equal(f.ctx.gameInstallBusyId, 'ark'); assert.equal(f.ctx.gameInstallProgress.open, true);
});

test('la sélection principale construit un seul snapshot, ne réécrit pas une sélection identique et conserve ses gardes', () => {
  const handlers = new Map(), notifications = [], calls = []; let active = 'dredge', snapshots = 0, writes = 0;
  const store = { getStateProjection: () => ({ session: { activeGamePackId: active } }), set(key, id) { assert.equal(key, 'session.activeGamePackId'); writes++; active = id; } };
  const core = { snapshot() { snapshots++; return { state: { session: { activeGamePackId: active } } }; }, notifyRenderer: (event, value) => notifications.push([event, value]) };
  registerGamesIpc({ handle: (name, fn) => handlers.set(name, fn), core, store, requireGameSessionAvailability: id => { calls.push('session'); return id; }, requireGameAccess: () => calls.push('access') });
  const select = handlers.get('game:select'), result = select(null, 'ark');
  assert.equal(snapshots, 1); assert.equal(writes, 1); assert.equal(notifications[0][1], result);
  select(null, 'ark'); assert.equal(writes, 1); assert.equal(snapshots, 2); assert.equal(notifications.length, 1);
  assert.deepEqual(calls, ['session', 'access', 'session', 'access']);
});


test('les clics réels ouvrent immédiatement Supermarket et une autre fiche même si les IPC sont bloqués', async t => {
  const path = require('node:path'), { pathToFileURL } = require('node:url');
  const { JSDOM, VirtualConsole } = require('jsdom');
  const { createDefaultState } = require('../src/main/defaults');
  const { loadShenazenGameCatalog } = require('../src/main/game-catalog');
  const { defaultGameInteractionRule } = require('../src/main/game-hub/interaction-defaults');
  const root = path.resolve(__dirname, '..'), state = createDefaultState();
  const packs = loadShenazenGameCatalog(path.join(root, 'resources')).filter(p => ['supermarket-simulator', 'dredge'].includes(p.id));
  const market = packs.find(p => p.id === 'supermarket-simulator'), dredge = packs.find(p => p.id === 'dredge');
  assert.ok(market && dredge);
  const account = { uid: 'navigation-fixture', email: 'navigation@example.test', authenticated: true, emailVerified: true, displayName: 'Créateur' };
  Object.assign(state.settings.account, account); state.commerce.subscription = { tier: 'pro', status: 'active', source: 'own' };
  state.game.interactionCatalogVersions[market.id] = market.interactionCatalogVersion;
  state.game.interactionRulesByPack[market.id] = market.defaultMappings.map(mapping => defaultGameInteractionRule(market, market.effects.find(e => e.id === mapping.effectId), mapping, market.interactionCatalogVersion));
  const data = { appVersion: require('../package.json').version, state, packs, soundCatalog: [], mediaCatalog: [], catalogCounts: {}, timerRuntime: [], overlayUrls: {}, localOverlayUrls: {}, publicOverlayRelay: { connected: false }, liveDirectory: { available: true, connected: true, rows: [] } };
  const selects = new Map(), status = deferred(), errors = [], calls = []; let checking = false, snapshots = 0;
  const virtualConsole = new VirtualConsole(); virtualConsole.on('jsdomError', error => errors.push(error));
  const html = path.join(root, 'src/renderer/index.html');
  const dom = new JSDOM(fs.readFileSync(html, 'utf8'), { url: pathToFileURL(html).href, runScripts: 'dangerously', resources: 'usable', pretendToBeVisual: true, virtualConsole, beforeParse(window) {
    window.structuredClone = structuredClone;
    Object.defineProperty(window, 'localStorage', { value: { getItem: () => null, setItem() {}, removeItem() {} } });
    window.shenPulse = {
      getSnapshot: async () => { snapshots++; return structuredClone(data); },
      selectGame: id => { calls.push(['select', id]); const d = deferred(); selects.set(id, d); return d.promise; },
      initializeGameInteractions: async () => { throw Error('Current default mappings must not be initialized on every click'); },
      getGameRuntimeStatus: id => { if (!checking) return Promise.resolve(null); calls.push(['status', id]); return id === market.id ? status.promise : Promise.resolve(null); },
      searchGifts: async () => ({ gifts: [], total: 0 }),
      getSpotifyStatus: async () => ({ configured: false, connected: false, devices: [] }), controlSpotify: async () => ({ settings: { enabled: false }, queue: [], history: [] }),
      users: { snapshot: async () => ({ rows: [], total: 0, filteredTotal: 0, stats: {}, streamers: [], blockedUsers: [] }) },
      controllers: { status: async () => ({ devices: [], mappings: [] }) }, updates: { check: async () => ({ available: false }) },
      account: { status: async () => account, gameCheatAccess: async () => ({ allowed: false }), syncEntitlements: async () => null },
      admin: { status: async () => ({ authorized: false }), visibility: async () => state.settings.siteVisibility }, on: () => () => {}
    };
    window.HTMLCanvasElement.prototype.getContext = () => ({ clearRect() {}, drawImage() {}, fillRect() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} });
    window.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
    window.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
    window.HTMLElement.prototype.scrollIntoView = function () {};
    window.addEventListener('error', event => errors.push(event.error || Error(event.message)));
    window.addEventListener('unhandledrejection', event => errors.push(event.reason));
  } });
  t.after(() => dom.window.close());
  const until = async predicate => { const end = Date.now() + 5000; while (!predicate()) { if (Date.now() > end) throw Error('Renderer did not settle'); await new Promise(resolve => setTimeout(resolve, 10)); } };
  await until(() => dom.window.document.querySelector('.creator-home-page') && snapshots >= 2);
  await new Promise(resolve => setTimeout(resolve, 100)); checking = true;
  const initialRequests = snapshots, document = dom.window.document;
  dom.window.eval('currentPage="games";gamePageMode="catalog";render();');
  document.querySelector('[data-action="open-game"][data-id="supermarket-simulator"]').click();
  await until(() => selects.has(market.id));
  assert.ok(document.querySelector('.market-workspace'), 'The full page must exist while selection IPC is unresolved.');
  assert.equal(document.querySelectorAll('[data-market-card]').length, 12);
  selects.get(market.id).resolve(structuredClone(data)); await until(() => calls.some(([name]) => name === 'status'));
  assert.deepEqual(calls, [['select', market.id], ['status', market.id]]);
  document.querySelector('[data-action="close-game"]').click(); await until(() => document.querySelector('.games-gallery-page'));
  document.querySelector('[data-action="open-game"][data-id="dredge"]').click();
  await until(() => selects.has(dredge.id));
  assert.equal(document.querySelector('.game-workspace-hero h2').textContent, dredge.name, 'The second page must also open before its IPC response.');
  status.resolve({ gameId: market.id, installing: true, installProgress: { phase: 'download' } });
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(dom.window.eval('gameInstallProgress'), null, 'An old response must not open an installation modal over another game.');
  selects.get(dredge.id).resolve(structuredClone(data)); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(snapshots, initialRequests, 'Opening pages must not request full snapshots again.');
  // Exercise every real adapter with the actual script order and native fragments, not fixture substitutes.
  const allPacks = loadShenazenGameCatalog(path.join(root, 'resources'));
  dom.window.__allPacksForQa = allPacks;
  const report = dom.window.eval('snapshot.packs=__allPacksForQa; __allPacksForQa.filter(pack=>ShenPulseGameWorkspacePolicy.eligible(pack)).map(pack=>{selectedGameId=pack.id;const template=document.createElement("template");template.innerHTML=renderGameWorkspace(pack);return {id:pack.id,shared:template.content.querySelector("[data-game-pack]")?.dataset.gamePack===pack.id,legacy:!!template.content.querySelector(".game-journey-tabs")};})');
  assert.equal(report.length,51);for(const result of report){assert.equal(result.shared,true,result.id);assert.equal(result.legacy,false,result.id);}
  assert.equal(errors.length, 0, errors.map(error => error.stack || error.message).join('\n'));
});
