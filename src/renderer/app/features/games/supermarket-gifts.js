"use strict";

let marketGiftContext = null;
const MARKET_GIFT_RANGES = [['all', 'Tous'], ['one', '1 pièce'], ['small', '2 à 99'], ['medium', '100 à 999'], ['large', '1 000 et +']];
const MARKET_COMMON_GIFTS = ['5655', '5269', '7934', '5487', '5658', '5879', '6104', '6427', '6267', '6007', '10604', '14115', '14488'];

function supermarketNewRow(type, column, effectId = '') {
  const pack = supermarketPack(), row = supermarketDraft(pack, { column, triggerType: type });
  const code = type !== 'gift' ? 'GiveMoney' : column === 'trap' ? 'FlipCamera' : column === 'neutral' ? 'ChangeFOV' : 'SpawnCustomers';
  const effect = pack.effects.find(item => item.id === effectId && item.available !== false) || pack.effects.find(item => item.code === code) || pack.effects.find(item => item.available !== false);
  row.action.config = { ...row.action.config, effectId: effect.id, duration: effect.duration || 0, parameters: Object.fromEntries((effect.parameters || []).map(parameter => [parameter.id, parameter.defaultValue ?? 0])) };
  row.rule.gameInteraction.title = type === 'follow' ? 'Follow' : type === 'like' ? 'Likes' : effect.name;
  row.rule.name = pack.name + ' · ' + row.rule.gameInteraction.title;
  return row;
}

function saveSupermarketNewRow(row, profileId) {
  const operation = marketWriteQueue.catch(() => {}).then(async () => {
    if (snapshot.state.session.profileId !== profileId) throw new Error('Le profil a changé. Recommencez l’ajout.');
    const pack = supermarketPack();
    if (!requireGameAccess(pack)) throw new Error('Accès au jeu requis.');
    const next = await api.saveGameInteraction(pack.id, structuredClone(row.rule));
    if (snapshot.state.session.profileId === profileId) acceptSnapshot(next || await api.getSnapshot());
    return row.rule;
  });
  marketWriteQueue = operation;
  return operation;
}

function showSupermarketSavedRow(ruleId) {
  const scroll = content.scrollTop;
  render(); content.scrollTop = scroll;
  const card = [...content.querySelectorAll('[data-market-card]')].find(item => item.dataset.rule === ruleId);
  card?.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
}

async function addSupermarketInteraction(type, column = 'neutral', effectId = '') {
  if (!['gift', 'follow', 'like'].includes(type)) return;
  const row = supermarketNewRow(type, column, effectId), profileId = snapshot.state.session.profileId;
  if (type === 'gift') return openSupermarketGifts(null, row);
  await saveSupermarketNewRow(row, profileId);
  showSupermarketSavedRow(row.rule.id);
}

function supermarketGiftPriceMatches(cost, range) {
  return range === 'one' ? cost === 1 : range === 'small' ? cost >= 2 && cost <= 99 : range === 'medium' ? cost >= 100 && cost <= 999 : range === 'large' ? cost >= 1000 : true;
}

function supermarketGiftView(context) {
 return {...context,ranges:MARKET_GIFT_RANGES,commonIds:MARKET_COMMON_GIFTS,selectedId:String(ruleGiftCondition(context.row.rule)?.giftId || ''),usedIds:supermarketRows(supermarketPack()).map(row=>String(ruleGiftCondition(row.rule)?.giftId || ''))};
}
function supermarketGiftContextCurrent(context) {
  return context && marketGiftContext === context && dialog.open && dialog.dataset.variant === 'market-gifts' && dialogSessionId === context.dialogSessionId && snapshot.state.session.profileId === context.profileId && (snapshot.state.settings.account?.uid || '') === context.accountUid && JSON.stringify(giftPickerCatalogContext()) === context.scope;
}

function prepareSupermarketGiftCatalog(context, result) {
  const roomMatches = giftPickerRoomMatches(result.room), verified = roomMatches && result.room?.available === true;
  const room = roomMatches && (verified || result.room?.partial === true) ? result.roomGifts || [] : [];
  const combined = new Map((result.gifts || []).map(gift => [String(gift.id), gift]));
  for (const gift of room) combined.set(String(gift.id), gift);
  // Une ancienne association reste modifiable même si son cadeau a quitté le panneau TikTok.
  for (const saved of [...supermarketRows(supermarketPack()).map(row => ruleGiftCondition(row.rule)), ruleGiftCondition(context.row.rule)].filter(Boolean)) {
    if (!saved.giftId || combined.has(String(saved.giftId))) continue;
    const gift = giftForSavedReference(saved.value, saved.giftId, saved);
    if (gift) combined.set(String(gift.id), gift);
  }
  const compare = (a, b) => Number(a.gift.cost) - Number(b.gift.cost) || String(a.gift.name).localeCompare(String(b.gift.name), 'fr');
  const options = { preferredId: ruleGiftCondition(context.row.rule)?.giftId || '' };
  context.groups = giftPickerDisplayGroups([...combined.values()], options).sort(compare);
  context.gifts = context.groups.map(group => group.gift);
  const standard = [...combined.values()].filter(gift => gift.source === 'catalog' || gift.isGlobalGift === true);
  const fallback = [...new Map([...standard, ...room].map(gift => [String(gift.id), gift])).values()];
  const regional = verified ? room : fallback.length ? fallback : [...combined.values()];
  context.scopeKind = verified ? 'live' : fallback.length ? 'standard' : 'unknown';
  context.regionalGroups = giftPickerDisplayGroups(regional, options).sort(compare);
  context.regionalIds = [...new Set(context.regionalGroups.flatMap(group => group.variants.flatMap(gift => [String(gift.id), ...(gift.alternateIds || []).map(String)])))];
  const choices = [...context.groups, ...context.regionalGroups].flatMap(group => group.variants);
  context.choices = new Map(choices.map(gift => [String(gift.id), gift]));
  context.searchTextById = new Map(choices.map(gift => [String(gift.id), giftPickerSearchText(gift)]));
}

function renderSupermarketGiftResults(context) {
  const ctx = supermarketContext();
  return supermarketMarkup(ctx, ShenPulseGameWorkspace.renderGiftResults(ctx, supermarketGiftView(context)));
}

function refreshSupermarketGiftResults({ resetScroll = false } = {}) {
  const context = marketGiftContext;
  if (!supermarketGiftContextCurrent(context)) return;
  const grid = dialogBody.querySelector('[data-market-gift-results]');
  if (grid) { const scroll = resetScroll ? 0 : grid.scrollTop; grid.innerHTML = renderSupermarketGiftResults(context); grid.scrollTop = scroll; }
  dialogBody.querySelectorAll('[data-market-gift-range]').forEach(button => { const active = button.dataset.marketGiftRange === context.range; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active)); });
}

function refreshSupermarketGiftCatalog() {
  const context = marketGiftContext;
  if (!supermarketGiftContextCurrent(context) || typeof cachedGiftPickerCatalog !== 'function' || typeof rendererVisualsActive === 'function' && !rendererVisualsActive()) return;
  const result = cachedGiftPickerCatalog();
  if (!result) return;
  prepareSupermarketGiftCatalog(context, result); refreshSupermarketGiftResults();
}

async function openSupermarketGifts(reference, draft = null) {
  const pack = supermarketPack(), row = draft || findGameInteractionRow(pack.id, reference.ruleId, reference.actionId, reference.index);
  if (!row) throw new Error('Interaction introuvable.');
  const context = { reference, row, profileId: snapshot.state.session.profileId, accountUid: snapshot.state.settings.account?.uid || '', scope: JSON.stringify(giftPickerCatalogContext()), query: '', range: 'all', showAll: false, visibleLimit: 60, gifts: null, saving: false };
  marketGiftContext = context;
  const title = ShenPulseGameInteractionTitles.title(row.rule, pack.effects.find(effect => effect.id === row.action.config.effectId)) || 'cette interaction';
  const ctx = supermarketContext(pack);
  openEditor({ title: 'Quel cadeau déclenche « ' + title + ' » ?', kicker: pack.name.toUpperCase(), variant: 'market-gifts',
    body: supermarketMarkup(ctx, ShenPulseGameWorkspace.renderGiftBrowser(ctx, supermarketGiftView(context))), onSubmit: null });
  context.dialogSessionId = dialogSessionId;
  try {
    const result = await preloadGiftPickerCatalog();
    if (!supermarketGiftContextCurrent(context)) return;
    if (!result) throw new Error('Catalogue de cadeaux indisponible.');
    prepareSupermarketGiftCatalog(context, result); refreshSupermarketGiftResults();
  } catch (error) {
    if (!supermarketGiftContextCurrent(context)) return;
    const results = dialogBody.querySelector('[data-market-gift-results]');
    if (results) results.innerHTML = supermarketMarkup(ctx, ShenPulseGameWorkspace.renderGiftMessage(error.message || 'Catalogue indisponible. Rouvrez le choix des cadeaux pour réessayer.'));
  }
}

function applySupermarketGift(rule, gift) {
  const previous = ruleGiftCondition(rule) || {};
  const reference = giftReferenceForSave(gift.name, gift.id, previous);
  if (!reference?.giftId) throw new Error('Choisissez un cadeau du catalogue.');
  rule.conditions = (rule.conditions || []).filter(condition => !['data.giftName', 'data.giftId', 'data.giftValue', 'data.diamondCount', 'data.giftCoins', 'data.value'].includes(condition.field));
  rule.conditions.unshift({ ...reference, field: 'data.giftName', operator: 'equals', value: gift.name });
  rule.trigger = { ...rule.trigger, type: 'gift', enabled: true };
}

async function chooseSupermarketGift(giftId) {
  const context = marketGiftContext, gift = context?.choices?.get(String(giftId));
  if (!context || !gift || context.saving) return;
  if (!supermarketGiftContextCurrent(context)) throw new Error('Le profil ou le catalogue a changé. Rouvrez le choix des cadeaux.');
  context.saving = true;
  try {
    if (context.row.isNew) {
      applySupermarketGift(context.row.rule, gift);
      await saveSupermarketNewRow(context.row, context.profileId);
    } else await mutateSupermarketRule(context.reference, rule => applySupermarketGift(rule, gift));
    if (marketGiftContext === context && snapshot.state.session.profileId === context.profileId) {
      marketGiftContext = null; dialog.close(); showSupermarketSavedRow(context.row.rule.id);
    }
  } finally { context.saving = false; }
}

dialogBody.addEventListener('input', event => {
  if (!event.target.matches('[data-market-gift-search]') || !marketGiftContext) return;
  marketGiftContext.query = event.target.value; marketGiftContext.visibleLimit = 60; refreshSupermarketGiftResults({ resetScroll: true });
});
dialogBody.addEventListener('change', event => {
  if (!event.target.matches('[data-market-gift-show-all]') || !marketGiftContext) return;
  marketGiftContext.showAll = event.target.checked; marketGiftContext.visibleLimit = 60; refreshSupermarketGiftResults({ resetScroll: true });
});
dialogBody.addEventListener('click', event => {
  const range = event.target.closest('[data-market-gift-range]');
  if (range && marketGiftContext) { marketGiftContext.range = range.dataset.marketGiftRange; marketGiftContext.visibleLimit = 60; refreshSupermarketGiftResults({ resetScroll: true }); return; }
  if (event.target.closest('[data-market-gift-more]') && marketGiftContext) { marketGiftContext.visibleLimit += 60; refreshSupermarketGiftResults(); return; }
  const choice = event.target.closest('[data-market-gift-choice]');
  if (choice) perform(() => chooseSupermarketGift(choice.dataset.marketGiftChoice)).catch(() => {});
});

dialogBody.ownerDocument.addEventListener('visibilitychange', () => { if (!dialogBody.ownerDocument.hidden) refreshSupermarketGiftCatalog(); });
