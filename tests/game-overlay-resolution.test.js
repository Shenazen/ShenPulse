"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const policy = require('../src/shared/game-workspace-policy');
const { loadShenazenGameCatalog } = require('../src/main/game-catalog');
const { prepareTikTok } = require('../src/main/studio-installation/tiktok');
const { settings: obsSettings, prepareCollection } = require('../src/main/studio-installation/obs');
const { OVERLAY_VIEWPORT, OVERLAY_RENDER_SIZE, tiktokOverlayTransform, sourceViewport, customLayout } = require('../src/main/studio-installation/layout');
const catalog = loadShenazenGameCatalog(path.resolve('resources'));
const packs = catalog.filter(pack => policy.eligible(pack));
const preserved = new Set(['cult-of-the-lamb', 'euro-truck-simulator-2']);
const tiktokDocument = () => ({ SourceService: { state: {
  scenes: [], sceneSource: { unrelated: { data: { keep: { type: 'browser', payload: { url: 'https://example.test/unrelated' } } }, order: ['keep'] } }, layerMap: {}
} } });
function planFor(pack) {
  return { packId: pack.id, profileId: 'fixture-profile', identity: 'fixture:' + pack.id,
    gameName: pack.name, sceneName: pack.name, executable: 'fixture.exe', assertScope() {},
    overlayUrl: 'https://example.test/game-pack.html?channel=fixture-channel&jeu=' + pack.id + '&profile=fixture-profile' };
}
function overlayFrom(result) {
  return Object.values(result.document.SourceService.state.sceneSource[result.sceneId].data).find(source => source.type === 'browser');
}

test('le lien manuel cadre les cartes et garde les références et la scène automatique', t => {
  const dom = new JSDOM('', { runScripts: 'outside-only' }); t.after(() => dom.window.close());
  for (const name of ['game-categories', 'game-workspace-policy']) dom.window.eval(fs.readFileSync(path.resolve('src/shared', name + '.js'), 'utf8'));
  dom.window.ShenPulseGameWorkspace = { escape: value => String(value) };
  dom.window.eval(fs.readFileSync(path.resolve('src/renderer/app/features/games/workspace/preview.js'), 'utf8'));
  for (const pack of packs) {
    const plan = planFor(pack), url = new URL(dom.window.ShenPulseGameWorkspace.overlayUrl({ base: plan.overlayUrl, packId: pack.id, profileId: plan.profileId }));
    assert.equal(url.searchParams.get('layout'), preserved.has(pack.id) ? null : 'compact', pack.id);
    assert.equal(url.searchParams.get('channel'), 'fixture-channel');
    assert.equal(url.searchParams.get('jeu'), pack.id);
    assert.equal(url.searchParams.get('profile'), plan.profileId);
    const copied = new URL(dom.window.ShenPulseGameWorkspace.copyOverlayUrl({pack,preview:{publicUrl:url.href}}));
    assert.equal(copied.searchParams.get('fit'), preserved.has(pack.id) ? null : 'cards', pack.id);
    assert.equal(copied.searchParams.get('jeu'),pack.id);
    assert.equal(copied.searchParams.get('profile'),plan.profileId);
    assert.equal(copied.searchParams.get('channel'),'fixture-channel');
    if(preserved.has(pack.id))assert.equal(copied.href,url.href);
    assert.equal(url.searchParams.get('fit'),null,'L’aperçu complet garde son cadrage.');
    const browserSettings = obsSettings(plan, 'overlay');
    assert.equal(new URL(browserSettings.url).searchParams.get('layout'), 'compact');
    assert.equal(new URL(browserSettings.url).searchParams.get('fit'),null,'La scène automatique conserve son cadrage.');
    assert.equal(browserSettings.width, sourceViewport(plan,'overlay').width);
    assert.equal(browserSettings.height, sourceViewport(plan,'overlay').height);
  }
});

for (const pack of packs.filter(pack => !preserved.has(pack.id))) test('résolution et réparation studio : ' + pack.name, () => {
  const plan = planFor(pack), first = prepareTikTok(tiktokDocument(), plan), overlay = overlayFrom(first), expectedTransform = structuredClone(overlay.transform);
  assert.deepEqual([overlay.payload.cx, overlay.payload.cy, overlay.payload.zoom], [customLayout(plan)?1080:OVERLAY_VIEWPORT.width, customLayout(plan)?1920:OVERLAY_VIEWPORT.height, 1]);
  assert.equal(new URL(overlay.payload.url).searchParams.get('layout'), 'compact');
  const state = first.document.SourceService.state, scene = state.sceneSource[first.sceneId];
  const camera = structuredClone(Object.values(scene.data).find(source => source.type === 'camera'));
  const unrelated = structuredClone(state.sceneSource.unrelated);
  for (const [width, height] of [[800, 600], [1080, 1920]]) {
    const old = structuredClone(first.document), source = old.SourceService.state.sceneSource[first.sceneId].data[overlay.id];
    source.payload = { ...source.payload, url: plan.overlayUrl, cx: width, cy: height, zoom: 1.25 };
    source.transform = { ...source.transform, size: { cx: width, cy: height }, scaleX: 2, scaleY: 2 };
    source.stateData = { cachedTexture: 'low-resolution' };
    source.clip = source.effectiveClip = { x: 1, y: 2, z: 3, w: 4 };
    const repaired = prepareTikTok(old, plan), result = overlayFrom(repaired);
    assert.deepEqual(result.payload, overlay.payload);
    assert.deepEqual(result.transform, customLayout(plan)?expectedTransform:tiktokOverlayTransform());
    assert.deepEqual(result.clip, { x: 0, y: 0, z: 0, w: 0 });
    assert.deepEqual(result.effectiveClip, result.clip);
    assert.equal(result.stateData, undefined);
    assert.deepEqual(repaired.document.SourceService.state.sceneSource.unrelated, unrelated);
    assert.deepEqual(repaired.document.SourceService.state.sceneSource[first.sceneId].data[camera.id], camera);
    assert.deepEqual(overlayFrom(prepareTikTok(repaired.document, plan)), result, 'Réinstaller une seconde fois ne doit rien déplacer.');
  }
  if(customLayout(plan))return; // Le canevas Box Cyber est recalé sur sa géométrie de scène dédiée.
  // A correctly sized custom panel keeps its position, scale and clipping.
  overlay.transform.translateX = 42; overlay.transform.translateY = 700;
  overlay.transform.scaleX = overlay.transform.scaleY = 0.55;
  overlay.clip = { x: 2, y: 0, z: 0, w: 0 };
  assert.deepEqual(overlayFrom(prepareTikTok(first.document, plan)), overlay);
});

for (const id of preserved) test('référence strictement inchangée : ' + id, () => {
  const plan = planFor(catalog.find(pack => pack.id === id)), first = prepareTikTok(tiktokDocument(), plan), overlay = overlayFrom(first);
  overlay.payload = { ...overlay.payload, url: plan.overlayUrl, cx: 800, cy: 600, zoom: 1.25 };
  overlay.transform.translateX = 95; overlay.clip = { x: 1, y: 2, z: 3, w: 4 }; overlay.stateData = { keep: true };
  assert.equal(policy.compactInteractionOverlay(id), false);
  assert.deepEqual(prepareTikTok(first.document, plan).document, first.document);
});

test('les cadeaux et les wins restent deux sources distinctes après réparation', () => {
  for (const pack of packs.filter(pack => pack.effects.some(effect => effect.winCounter))) {
    const plan = planFor(pack); plan.winsOverlayUrl = plan.overlayUrl.replace('game-pack.html', 'game-wins.html');
    const result = prepareTikTok(tiktokDocument(), plan), sources = Object.values(result.document.SourceService.state.sceneSource[result.sceneId].data);
    assert.equal(sources.filter(source => source.type === 'browser').length, 2, pack.id);
    assert.ok(sources.some(source => source.payload?.url === plan.winsOverlayUrl));
    const collection = prepareCollection(null, plan).document;
    assert.equal(collection.sources.filter(source => source.id === 'browser_source').length, 2, pack.id);
  }
});
