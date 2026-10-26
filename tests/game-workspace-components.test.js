"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const directory = path.join(__dirname, '../src/renderer/app/features/games/workspace');
const files = ['core', 'interactions', 'free-events', 'catalog', 'preview', 'updates', 'sections', 'dialogs'];

function library(t) {
  const dom = new JSDOM('<main></main>', { runScripts: 'outside-only', url: 'https://fixture.test/' });
  t.after(() => dom.window.close());
  Object.defineProperty(dom.window, 'snapshot', { get() { throw Error('Shared components must not read application state'); } });
  for (const file of files) dom.window.eval(fs.readFileSync(path.join(directory, file + '.js'), 'utf8'));
  return { dom, C: dom.window.ShenPulseGameWorkspace, root: dom.window.document.querySelector('main') };
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.freeze(value); for (const child of Object.values(value)) freeze(child); }
  return value;
}
function options(id = 'orchard-demo') {
  const effect = { id: id + '-rain', code: 'Rain', name: 'Arroser les arbres', category: 'Verger', description: 'Une pluie dans le verger.', image: '/orchard/rain.png', parameters: [{ id: 'litres', label: 'Litres', min: 0, max: 500, defaultValue: 12 }] };
  const second = { id: id + '-sun', code: 'Sun', name: 'Faire revenir le soleil', image: '/orchard/sun.png' };
  const action = { id: 'effect-action', type: 'game.effect', config: { packId: id, effectId: effect.id, parameters: { litres: 37 } } };
  const rule = { id: 'viewer-rule', enabled: true, trigger: { type: 'gift', enabled: true }, gameInteraction: { title: 'Pluie du viewer' }, conditions: [{ field: 'data.giftName', value: 'Rose', giftId: 'rose' }], actions: [action], cooldown: { globalMs: 2300 } };
  return {
    pack: { id, name: 'Le verger céleste', effects: [effect, second] }, rows: [{ rule, action, actionIndex: 0, effect, column: 'help' }],
    unlocked: true, profileId: 'profile-orchard', accountUid: 'owner-orchard',
    hero: { artwork: '/orchard/cover.jpg', titleLines: ['LE VERGER', 'CÉLESTE'], description: 'Cultivez votre jardin.', status: 'Édition installée', installed: true, stats: [{ value: 2, label: 'effets' }], actions: [{ action: 'orchard-install', label: 'Installer le verger', id }], links: [{ action: 'orchard-section', value: 'cards', label: 'Les cadeaux' }] },
    guide: { title: 'Préparer le verger', steps: [{ title: 'Installer', description: 'Préparez le module.' }, { title: 'Jouer', description: 'Ouvrez une partie.' }] },
    actions: { add: 'orchard-add', chooseModel: 'orchard-model', chooseColor: 'orchard-color', studioInstall: 'orchard-studio', extraAdd: 'orchard-extra' },
    preview: {
      models: [{ id: 'portrait', label: 'Portrait', supportsMotion: true }, { id: 'panel', label: 'Panneau', supportsBackground: true }, { id: 'minimal', label: 'Minimal' }],
      presentation: { model: 'portrait', motion: 'animated', backgroundColor: '#123456' }, backgrounds: [['#123456', 'Nuit']],
      camera: { src: '/orchard/camera.jpg', username: 'jardinier' }, game: { src: '/orchard/game.jpg' }, sourceUrl: 'https://fixture.test/game-pack?jeu=' + id, publicUrl: 'https://public.test/?game=' + id,
      guides: [{ kind: 'game', title: 'Le verger', description: 'Une partie lisible' }], caption: { animated: 'La pluie réagit aux cadeaux.', fixed: 'Les cartes restent affichées.' }
    },
    fragments: { conditionsButton: ctx => '<button data-game-condition="' + ctx.pack.id + '">Conditions du verger</button>', conditionsPanel: '<aside>Une partie chargée est requise.</aside>' },
    freeDefaults: { follow: second.id, like: effect.id }
  };
}

test('un autre jeu compose les mêmes composants avec ses contenus, actions, images et sections', t => {
  const { C, root } = library(t), data = freeze(options()), before = JSON.stringify(data), ctx = C.createContext(data);
  root.innerHTML = C.renderPage(ctx);
  assert.equal(root.querySelector('h2').textContent, 'LE VERGERCÉLESTE');
  assert.equal(root.querySelector('.game-pack-phone-game img').getAttribute('src'), '/orchard/game.jpg');
  assert.equal(root.querySelector('.game-pack-effect-choice img').getAttribute('src'), '/orchard/rain.png');
  assert.equal(root.querySelector('[data-action="orchard-install"]').dataset.id, data.pack.id);
  assert.equal(root.querySelector('[data-game-card]').dataset.pack, data.pack.id);
  assert.equal(root.querySelector('[data-game-inline="parameter"]').value, '37');
  assert.equal(root.querySelector('.game-pack-free-row[data-game-free-type="follow"] select').value, data.pack.effects[1].id);
  assert.equal(root.querySelectorAll('.game-pack-quick-guide article').length, 2);
  assert.equal(root.querySelector('.game-pack-catalog').open, false);
  assert.equal(root.querySelector('.game-pack-workspace').dataset.gamePack, data.pack.id);
  assert.doesNotMatch(root.innerHTML, /supermarket|market-inline|GiveMoney|XboxGames/i);
  assert.equal(JSON.stringify(data), before, 'rendering leaves every saved rule and presentation untouched');
});

test('les wins et overlays désactivés ne rendent rien et ne consultent aucun fournisseur', t => {
  const { C, root } = library(t), data = options();
  const forbidden = () => { throw Error('Optional data provider must not be called'); };
  data.wins = { renderBody: forbidden }; data.overlays = { renderBody: forbidden };
  data.features = { wins: false, overlays: false, preview: false, conditions: false, guide: false };
  data.fragments = { conditionsPanel: forbidden, conditionsButton: forbidden };
  root.innerHTML = C.renderPage(C.createContext(data));
  for (const selector of ['.game-pack-wins', '.game-pack-overlays', '.game-pack-preview-area', '.game-pack-quick-guide']) assert.equal(root.querySelector(selector), null);
});

test('les sections wins et overlays réutilisent les cartes existantes et se placent librement', t => {
  const { C, root } = library(t), data = options(), calls = [];
  data.features = { wins: true, overlays: true };
  data.sectionOrder = ['hero', 'wins', 'guide', 'overlays', 'interactions', 'freeEvents', 'catalog'];
  data.renderOverlayCard = (card, ctx) => { calls.push([card.key, ctx.pack.id, ctx.profileId]); return '<article data-overlay="' + card.key + '">' + C.renderButton({ action: 'configure-overlay', id: card.key, label: 'Configurer' }) + '</article>'; };
  data.wins = { title: 'Victoires du verger', cards: [{ key: 'winCounter' }] };
  data.overlays = { title: 'Sources du verger', cards: [{ key: 'timer' }, { key: 'leaderboard' }], collapsible: true, actions: [{ action: 'orchard-overlays', label: 'Toutes les sources' }] };
  const ctx = C.createContext(data); root.innerHTML = C.renderPage(ctx);
  assert.deepEqual(calls.map(call => call[0]), ['winCounter', 'timer', 'leaderboard']);
  assert.ok(calls.every(call => call[1] === data.pack.id && call[2] === data.profileId));
  const ids = [...root.querySelector('.game-pack-workspace').children].map(node => node.id).filter(Boolean);
  assert.deepEqual(ids, ['installation', 'wins', 'guide', 'overlays', 'interactions', 'follow', 'catalog'].map(ctx.id));
  const overlays = root.querySelector('#' + ctx.id('overlays'));
  assert.equal(overlays.tagName, 'DETAILS'); assert.equal(overlays.open, false);
  assert.equal(overlays.firstElementChild.tagName, 'SUMMARY');
  assert.equal(overlays.querySelectorAll('[data-overlay]').length, 2);
  assert.ok(overlays.querySelector('[data-action="orchard-overlays"]'));
});

test('les modèles sont définis par leurs capacités et gardent la même source', t => {
  const { C, root } = library(t), data = options(); let source;
  for (const model of ['portrait', 'panel', 'minimal']) {
    data.preview.presentation.model = model; const ctx = C.createContext(data); root.innerHTML = C.renderLivePreview(ctx);
    assert.equal(root.querySelector('[data-action="orchard-model"][aria-pressed="true"]').dataset.value, model);
    assert.equal(!!root.querySelector('.game-pack-preview-mode'), model === 'portrait');
    assert.equal(!!root.querySelector('.game-pack-model-colors'), model === 'panel');
    const nextSource = root.querySelector('iframe').getAttribute('src'); source ??= nextSource; assert.equal(nextSource, source);
  }
  assert.equal(C.overlayUrl({ base: 'javascript:alert(1)', packId: 'other' }), '');
  const url = new URL(C.overlayUrl({ base: 'https://fixture.test/game-pack?channel=abc&motion=animated&model=3', packId: 'vol', profileId: 'pilot', compact: true }));
  assert.equal(url.searchParams.get('jeu'), 'vol'); assert.equal(url.searchParams.get('profile'), 'pilot'); assert.equal(url.searchParams.get('layout'), 'compact'); assert.equal(url.searchParams.has('motion'), false);
});

test('la présentation se met à jour sans détruire la frame et refuse un changement de profil ou de page', t => {
  const { C, root } = library(t), data = options();
  const before = C.renderPage(C.createContext(data)); root.innerHTML = before;
  const frame = root.querySelector('iframe'), window = frame.contentWindow;
  data.preview.presentation.model = 'panel'; const next = C.renderPage(C.createContext(data));
  assert.equal(C.patchPreview(root, before, next), true);
  assert.equal(root.querySelector('iframe'), frame); assert.equal(frame.contentWindow, window);
  assert.ok(root.querySelector('.game-pack-model-colors'));
  for (const field of ['profileId', 'accountUid']) {
    const changed = C.renderPage(C.createContext({ ...data, [field]: 'different-owner' }));
    assert.equal(C.patchPreview(root, next, changed), false);
  }
  const titleChanged = C.renderPage(C.createContext({ ...data, hero: { ...data.hero, titleLines: ['Autre titre'] } }));
  assert.equal(C.patchPreview(root, next, titleChanged), false);
  assert.equal(root.querySelector('h2').textContent, 'LE VERGERCÉLESTE');
});

test('deux instances et des colonnes personnalisées restent indépendantes', t => {
  const { C, root } = library(t), first = options('orbital-flight'), second = options('forest-survival');
  second.idPrefix = 'forest-profile-b'; second.columns = [{ id: 'bonus', label: 'Soutien' }, { id: 'danger', label: 'Danger' }]; second.rows[0].column = 'danger';
  const a = C.createContext(first), b = C.createContext(second);
  root.innerHTML = C.renderPage(a) + C.renderPage(b);
  const ids = [...root.querySelectorAll('[id]')].map(node => node.id);
  assert.equal(ids.length, new Set(ids).size);
  assert.equal(root.querySelectorAll('[data-game-pack]').length, 2);
  assert.ok(root.querySelector('#' + b.id('interactions') + ' .danger [data-pack="forest-survival"]'));
  assert.equal(root.querySelector('#' + b.id('interactions') + ' [data-action="orchard-add"]').dataset.value, 'bonus');
  assert.notEqual(root.querySelectorAll('[data-game-workspace-scope]')[0].dataset.gameWorkspaceScope, root.querySelectorAll('[data-game-workspace-scope]')[1].dataset.gameWorkspaceScope);
});

test('les cartes verrouillées, actions multiples et filtres conservent les données natives', t => {
  const { C, root } = library(t), data = options(), row = data.rows[0];
  row.rule.actions.push({ id: 'sun-action', type: 'game.effect', config: { effectId: data.pack.effects[1].id } }, { id: 'audio', type: 'audio.play', config: { url: '/audio/rain.mp3', soundName: 'Pluie douce' } });
  const mapped = [row, { ...row, action: row.rule.actions[1] }];
  assert.equal(C.collectRows(data.pack, mapped).length, 1);
  const before = JSON.stringify(data); data.unlocked = false;
  const ctx = C.createContext(freeze(data)); root.innerHTML = C.renderInteractionCard(ctx, row);
  assert.equal(root.querySelectorAll('.game-pack-extra-effect').length, 1);
  assert.equal(root.querySelector('.game-pack-sound-name').textContent, 'Pluie douce');
  assert.ok([...root.querySelectorAll('button,input,select')].every(control => control.disabled));
  const search = C.createContext({ ...data, ui: { catalog: { category: 'Autres', open: true } } }); root.innerHTML = C.renderCatalog(search);
  assert.equal(root.querySelectorAll('article').length, 1); assert.equal(root.querySelector('article h4').textContent, data.pack.effects[1].name);
  assert.equal(JSON.stringify({ ...data, unlocked: true }), before);
});

test('cadeaux, studios et effets supplémentaires utilisent les données du jeu sans les modifier', t => {
  const { C, root } = library(t), ctx = C.createContext(options());
  root.innerHTML = C.renderStudioShell(ctx, C.renderStudioChoices(ctx, [{ id: 'obs', name: 'OBS', installed: true }, { id: 'tiktok', name: 'TikTok', installed: false }]));
  assert.equal(root.querySelector('[data-id="obs"]').disabled, false); assert.equal(root.querySelector('[data-id="tiktok"]').disabled, true);
  assert.equal(root.querySelector('[data-id="obs"]').dataset.action, 'orchard-studio');
  root.innerHTML = C.renderStudioResult(ctx, { studioName: 'OBS', sceneName: 'Verger · profil A', openingMessage: 'Vous pouvez ouvrir OBS.' });
  assert.ok(root.textContent.includes('Capture de Le verger céleste')); assert.ok(root.textContent.includes('Vous pouvez ouvrir OBS.'));
  const gifts = freeze({ range: 'all', showAll: true, selectedId: 'rose', usedIds: ['rose'], commonIds: ['star'], gifts: [{ id: 'rose', name: 'Rose', cost: 1, imageUrl: '/rose.png' }, { id: 'star', name: 'Étoile', cost: 99 }, { id: 'moon', name: 'Lune', cost: 1000 }] });
  const original = JSON.stringify(gifts); root.innerHTML = C.renderGiftBrowser(ctx, gifts);
  assert.equal(root.querySelectorAll('[data-game-gift-choice]').length, 3);
  assert.equal(root.querySelector('[data-game-gift-choice="rose"]').getAttribute('aria-pressed'), 'true');
  assert.equal(root.querySelectorAll('.game-pack-gift-group').length, 3);
  root.innerHTML = C.renderGiftResults(ctx, { ...gifts, range: 'large' }); assert.equal(root.querySelectorAll('[data-game-gift-choice]').length, 1);
  assert.equal(JSON.stringify(gifts), original);
  root.innerHTML = C.renderExtraOptions(ctx, { mainEffectId: ctx.pack.effects[0].id, selectedIds: [ctx.pack.effects[1].id], fieldName: 'orchardEffects' });
  assert.equal(root.querySelectorAll('input').length, 1); assert.equal(root.querySelector('input').name, 'orchardEffects'); assert.equal(root.querySelector('input').checked, true);
});

test('les données personnalisées sont échappées et les noms de bindings sont validés', t => {
  const { C, root } = library(t), data = options('game" onclick="bad'), attack = '"><img src=x onerror=bad()>';
  data.pack.name = attack; data.hero.titleLines = [attack]; data.rows[0].rule.gameInteraction.title = attack;
  data.columns = [{ id: 'odd" onclick="bad', label: attack }]; data.rows[0].column = data.columns[0].id; data.ui = { addMenu: data.columns[0].id, catalog: { open: true } };
  data.fragments = {};
  data.addTypes = [['gift" onclick="bad', attack, attack]]; data.actions.gift = attack;
  root.innerHTML = C.renderPage(C.createContext(data));
  assert.equal(root.querySelector('h2').textContent, attack);
  assert.equal(root.querySelectorAll('[onclick],[onerror],img[src="x"]').length, 0);
  assert.equal(root.querySelector('[data-game-card]').dataset.pack, data.pack.id);
  assert.equal(root.querySelector('.game-pack-catalog-grid [data-action="game-page-add-effect"]').dataset.pack, data.pack.id);
  assert.throws(() => C.createContext({ ...data, bindings: { inline: 'x" onclick="bad' } }), /Attribut/);
});


test('une préparation des interactions garde la page visible et bloque seulement les commandes concernées', t => {
  const { C, root } = library(t), data = options(); data.interactionsReady = false; data.ui = { addMenu: 'help' };
  root.innerHTML = C.renderPage(C.createContext(data));
  assert.ok(root.querySelector('.game-pack-hero')); assert.ok(root.querySelector('[role="status"]').textContent.includes('Préparation'));
  for (const control of root.querySelectorAll('[data-game-card] button,[data-game-card] input,[data-game-card] select,.game-pack-free-row input,.game-pack-free-row select,.game-pack-add-wrap button')) assert.equal(control.disabled, true);
  assert.equal(root.querySelector('[data-action="orchard-install"]').disabled, false);
});


test('le catalogue est composé à la demande, libéré au repli et conserve les filtres du contexte', t => {
 const {C,root}=library(t),data=options(),ctx=C.createContext(data);root.innerHTML=C.renderPage(ctx);const catalog=root.querySelector('.game-pack-catalog');
 assert.equal(catalog.querySelectorAll('article').length,0);assert.equal(catalog.querySelectorAll('img').length,0);
 catalog.open=true;assert.equal(C.populateCatalog(ctx,catalog),true);assert.equal(catalog.querySelectorAll('article').length,2);const input=catalog.querySelector('input');assert.equal(C.populateCatalog(ctx,catalog),false);assert.equal(catalog.querySelector('input'),input);
 catalog.open=false;C.populateCatalog(ctx,catalog);assert.equal(catalog.querySelector('.game-pack-catalog-body').childNodes.length,0);
 const filtered=C.createContext({...data,ui:{catalog:{open:true,search:'soleil'}}});catalog.open=true;C.populateCatalog(filtered,catalog);assert.equal(catalog.querySelectorAll('article').length,1);assert.equal(catalog.querySelector('input').value,'soleil');
});

test('une mise à jour des cartes ou du statut conserve l’aperçu, les autres cartes et le brouillon actif', t => {
 const {C,root,dom}=library(t),data=options();const first=C.renderPage(C.createContext(data));root.innerHTML=first;
 const frame=root.querySelector('iframe'),window=frame.contentWindow,free=root.querySelector('.game-pack-free-row'),field=root.querySelector('.game-pack-card-title');field.focus();field.value='Brouillon local';
 data.hero.status='Jeu connecté';data.hero.stats[0].value=3;data.rows[0].rule.gameInteraction.title='Valeur serveur';
 const next=C.renderPage(C.createContext(data));assert.equal(C.patchPage(root,first,next),true);assert.equal(root.querySelector('iframe'),frame);assert.equal(frame.contentWindow,window);assert.equal(root.querySelector('.game-pack-free-row'),free);assert.equal(root.querySelector('.game-pack-card-title'),field);assert.equal(dom.window.document.activeElement,field);assert.equal(field.value,'Brouillon local');assert.match(root.querySelector('.game-pack-status').textContent,/Jeu connecté/);
});

test('ajouter une carte et modifier les contrôles d’overlay laisse la frame montée', t => {
 const {C,root}=library(t),data=options();const before=C.renderPage(C.createContext(data));root.innerHTML=before;const frame=root.querySelector('iframe');
 const row=structuredClone(data.rows[0]);row.rule.id='second-rule';row.action.id='second-action';data.rows.push(row);data.preview.presentation.model='panel';const next=C.renderPage(C.createContext(data));
 assert.equal(C.patchPage(root,before,next),true);assert.equal(root.querySelector('iframe'),frame);assert.equal(root.querySelectorAll('[data-game-card]').length,2);assert.ok(root.querySelector('.game-pack-model-colors'));
});

test('la mise à jour refuse un changement de compte, profil, jeu ou source sans modification partielle', t => {
 const {C,root}=library(t),data=options(),before=C.renderPage(C.createContext(data));root.innerHTML=before;const frame=root.querySelector('iframe');
 for(const patch of [{accountUid:'other'},{profileId:'other'},{pack:{...data.pack,id:'other'}},{preview:{...data.preview,sourceUrl:'https://other.test/'}}]){
  const next=C.renderPage(C.createContext({...data,hero:{...data.hero,status:'Ne doit pas changer'},...patch}));assert.equal(C.patchPage(root,before,next),false);assert.equal(root.querySelector('iframe'),frame);assert.doesNotMatch(root.querySelector('.game-pack-status').textContent,/Ne doit pas changer/);
 }
 assert.equal(C.patchPage(root,before,before+'<p>Une autre fenêtre</p>'),false);
});
