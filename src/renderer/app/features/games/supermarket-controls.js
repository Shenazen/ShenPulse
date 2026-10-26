"use strict";

let marketWriteQueue = Promise.resolve();
let marketPresentationQueue = Promise.resolve();
function saveSupermarketOverlayPresentation(patch) {
 const scope={profileId:snapshot.state.session.profileId,accountUid:snapshot.state.settings.account?.uid||''};
 const operation=marketPresentationQueue.catch(()=>{}).then(async()=>{
  if(snapshot.state.session.profileId!==scope.profileId||(snapshot.state.settings.account?.uid||'')!==scope.accountUid)throw new Error('Le compte ou le profil a changé. Rouvrez les modèles.');
  const next=await api.saveGamePackPresentation({...scope,...patch});
  if(snapshot.state.session.profileId===scope.profileId&&(snapshot.state.settings.account?.uid||'')===scope.accountUid){const scroll=content.scrollTop;acceptSnapshot(next);render();content.scrollTop=scroll;}
 });
 marketPresentationQueue=operation;return operation;
}

function supermarketPack() {
  return snapshot.packs.find(pack => pack.id === 'supermarket-simulator');
}

function supermarketReference(target) {
  const card = target.closest('[data-market-card]') || target;
  return { ruleId: card.dataset.rule, actionId: card.dataset.rowAction, index: card.dataset.index };
}

function mutateSupermarketRule(reference, mutate) {
  const profileId = snapshot.state.session.profileId;
  const operation = marketWriteQueue.catch(() => {}).then(async () => {
    if (snapshot.state.session.profileId !== profileId) throw new Error('Le profil a changé. Rouvrez cette interaction.');
    const pack = supermarketPack();
    if (!requireGameAccess(pack)) throw new Error('Accès au jeu requis.');
    const row = findGameInteractionRow(pack.id, reference.ruleId, reference.actionId, reference.index);
    if (!row) throw new Error('Cette interaction n’est plus disponible.');
    const rule = structuredClone(row.rule);
    const action = rule.actions[row.actionIndex];
    mutate(rule, action, row, pack);
    const next = await api.saveGameInteraction(pack.id, rule);
    if (snapshot.state.session.profileId === profileId) acceptSnapshot(next || await api.getSnapshot());
    return rule;
  });
  marketWriteQueue = operation;
  return operation;
}

function mutateSupermarketFreeRule(type, mutate) {
  if (!['follow', 'like'].includes(type)) throw new Error('Événement gratuit inconnu.');
  const profileId = snapshot.state.session.profileId;
  const operation = marketWriteQueue.catch(() => {}).then(async () => {
    if (snapshot.state.session.profileId !== profileId) throw new Error('Le profil a changé. Recommencez la configuration.');
    const pack = supermarketPack();
    if (!requireGameAccess(pack)) throw new Error('Accès au jeu requis.');
    const existing = supermarketRows(pack).find(row => type === 'follow' ? row.rule.trigger?.type === type : ['like', 'likes'].includes(row.rule.trigger?.type));
    const row = existing ? { ...existing, rule: structuredClone(existing.rule) } : supermarketNewRow(type, 'help');
    if (existing) row.action = row.rule.actions[existing.actionIndex];
    else row.rule.enabled = false;
    row.effect = pack.effects.find(effect => effect.id === row.action.config.effectId);
    mutate(row.rule, row.action, row, pack);
    const next = await api.saveGameInteraction(pack.id, row.rule);
    if (snapshot.state.session.profileId === profileId) acceptSnapshot(next || await api.getSnapshot());
    return row.rule;
  });
  marketWriteQueue = operation;
  return operation;
}

async function saveSupermarketInline(target) {
  const reference = supermarketReference(target);
  const kind = target.dataset.marketInline, value = target.value, checked = target.checked;
  const parameterId = target.dataset.parameter;
  const mutate = (rule, action, row, pack) => {
    if (kind === 'threshold') rule.trigger.threshold = Math.max(1, Math.min(1000000, Number(value) || 1));
    if (['extra-effect', 'new-extra-effect'].includes(kind)) {
      const effect = pack.effects.find(item => item.id === value && item.available !== false);
      if (!effect) throw new Error('Choisissez une action disponible.');
      const extra = kind === 'extra-effect' ? rule.actions.find(item => item.id === target.dataset.extraId && item.type === 'game.effect') : null;
      if (kind === 'extra-effect' && !extra) throw new Error('Cette action n’est plus disponible.');
      const config = { packId: pack.id, effectId: effect.id, quantity: 1, duration: effect.duration || 0, parameters: Object.fromEntries((effect.parameters || []).map(parameter => [parameter.id, parameter.defaultValue ?? 0])) };
      if (extra) extra.config = { ...extra.config, ...config };
      else rule.actions.push({ id: 'action_' + cryptoId(), type: 'game.effect', config });
    }
    if (kind === 'enabled') { rule.enabled = checked; if (checked && ['follow', 'like', 'likes'].includes(rule.trigger?.type)) rule.trigger.enabled = true; }
    if (kind === 'title') {
      const title = String(value).trim().slice(0, 120) || row.effect?.name || pack.effects.find(effect => effect.id === action.config.effectId)?.name;
      rule.gameInteraction = { ...rule.gameInteraction, title };
      rule.name = pack.name + ' · ' + title;
    }
    if (kind === 'column' && MARKET_COLUMNS.some(column => column.id === value)) rule.gameInteraction = { ...rule.gameInteraction, marketColumn: value };
    if (kind === 'effect') {
      const effect = pack.effects.find(item => item.id === value && item.available !== false);
      if (!effect) throw new Error('Effet indisponible.');
      action.config = { ...action.config, effectId: effect.id, duration: effect.duration || 0, parameters: Object.fromEntries((effect.parameters || []).map(parameter => [parameter.id, parameter.defaultValue ?? parameter.min ?? 0])) };
    }
    if (kind === 'parameter') {
      const effect = pack.effects.find(item => item.id === action.config.effectId);
      const parameter = effect.parameters?.find(item => item.id === parameterId);
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error('Entrez une valeur numérique valide.');
      const next = Math.min(parameter?.max ?? 120, Math.max(parameter?.min ?? 1, parsed));
      if (parameter) action.config.parameters = { ...action.config.parameters, [parameter.id]: next };
      else action.config.duration = next;
      if (parameter && effect.duration && (parameter.id === 'count' || /durée/i.test(parameter.label))) action.config.duration = next;
    }
  };
  const placeholder = target.closest('[data-market-free-placeholder]');
  if (placeholder) await mutateSupermarketFreeRule(placeholder.dataset.marketFreePlaceholder, mutate);
  else await mutateSupermarketRule(reference, mutate);
  if (kind === 'new-extra-effect') marketPendingExtraRuleId = '';
}

function revealSupermarketSection(section) {
  const key = section === 'launch' ? 'installation' : section;
  const node = content.querySelector('#market-' + key);
  if (!node) return;
  if (node.tagName === 'DETAILS') node.open = true;
  node.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function supermarketDraft(pack, { column = 'neutral', triggerType = 'gift' } = {}) {
  const action = { id: 'action_' + cryptoId(), type: 'game.effect', config: { packId: pack.id, effectId: '', quantity: 1, duration: 0, parameters: {} } };
  const rule = { id: 'rule_' + cryptoId(), name: pack.name, enabled: true, priority: 50, trigger: { enabled: true, type: triggerType, source: '*', threshold: triggerType === 'like' ? 100 : 1 }, conditions: [], cooldown: { globalMs: 0, perUserMs: 0 }, chance: 1, gameInteraction: { marketColumn: column }, actions: [action] };
  return { rule, action, actionIndex: 0, isNew: true };
}

function openSupermarketSound(reference) {
  const row = findGameInteractionRow('supermarket-simulator', reference.ruleId, reference.actionId, reference.index);
  if (!row) throw new Error('Interaction introuvable.');
  const sound = row.rule.actions.find(action => action.type === 'audio.play' && !action.config?.effectId);
  openEditor({ title: 'Son de l’interaction', kicker: supermarketPack().name.toUpperCase(),
    body: soundPickerField('marketSound', sound?.config?.url || '', { label: 'Son joué avec cet effet', selectedName: sound?.config?.soundName || '', optional: true }),
    onSubmit: async data => {
      const url = String(data.get('marketSound') || '').trim();
      await mutateSupermarketRule(reference, rule => {
        const index = rule.actions.findIndex(action => action.type === 'audio.play' && !action.config?.effectId);
        if (!url) { if (index >= 0) rule.actions.splice(index, 1); return; }
        const previous = index >= 0 ? rule.actions[index] : {};
        const action = { ...previous, id: previous.id || 'action_' + cryptoId(), type: 'audio.play', config: { ...previous.config, url, soundName: String(data.get('marketSoundName') || ''), packId: 'supermarket-simulator', volume: previous.config?.volume ?? 1, outputMode: previous.config?.outputMode || 'local' } };
        if (index >= 0) rule.actions[index] = action;
        else rule.actions.push(action);
      });
    }
  });
}

function openSupermarketExtraActions(reference) {
  const pack = supermarketPack(), row = findGameInteractionRow(pack.id, reference.ruleId, reference.actionId, reference.index);
  if (!row) throw new Error('Interaction introuvable.');
  const selected = new Set(row.rule.actions.filter(action => action.type === 'game.effect' && action.id !== row.action.id).map(action => action.config.effectId));
  const ctx = supermarketContext(pack);
  openEditor({ title: 'Actions jouées avec le même événement', kicker: pack.name.toUpperCase(),
    body: supermarketMarkup(ctx,ShenPulseGameWorkspace.renderExtraOptions(ctx,{mainEffectId:row.action.config.effectId,selectedIds:[...selected],fieldName:'marketExtraEffects'})),
    onSubmit: async data => {
      const requested = new Set(data.getAll('marketExtraEffects'));
      await mutateSupermarketRule(reference, (rule, action) => {
        rule.actions = rule.actions.filter(item => item.id === action.id || item.type !== 'game.effect' || requested.has(item.config.effectId));
        for (const effect of pack.effects.filter(item => requested.has(item.id))) {
          if (rule.actions.some(item => item.type === 'game.effect' && item.config.effectId === effect.id)) continue;
          rule.actions.push({ id: 'action_' + cryptoId(), type: 'game.effect', config: { packId: pack.id, effectId: effect.id, quantity: 1, duration: effect.duration || 0, parameters: Object.fromEntries((effect.parameters || []).map(parameter => [parameter.id, parameter.defaultValue ?? 0])) } });
        }
      });
    }
  });
}

const SUPERMARKET_PAGE_ACTIONS = new Set(['market-section', 'market-overlay-model', 'market-overlay-color', 'market-preview-mode', 'market-category', 'market-add', 'market-add-kind', 'market-add-effect', 'market-gift', 'market-extra-add', 'market-remove-extra', 'market-cancel-extra', 'market-follow', 'market-sound', 'market-preview-sound', 'market-extra-actions']);
registerActionHandler(SUPERMARKET_PAGE_ACTIONS, async ({ action, target }) => {
  if (!SUPERMARKET_PAGE_ACTIONS.has(action)) return ACTION_NOT_HANDLED;
  const pack = supermarketPack();
  if (!pack || !requireGameAccess(pack)) return;
  if (action === 'market-section') return revealSupermarketSection(target.dataset.value);
  if (action === 'market-overlay-model') return saveSupermarketOverlayPresentation({model:Number(target.dataset.value)});
  if (action === 'market-overlay-color') return saveSupermarketOverlayPresentation({backgroundColor:target.dataset.value});
  if (action === 'market-preview-mode') return saveSupermarketOverlayPresentation({motion:target.dataset.value==='animated'?'animated':'fixed'});
  if (action === 'market-category') {
    marketCatalogCategory = target.dataset.value;
    marketCatalogOpen = true;
    const catalog = content.querySelector('#market-catalog');
    if (catalog) { catalog.open = true; ShenPulseGameWorkspace.populateCatalog(supermarketContext(), catalog, { refresh: true }); }
    else render();
    return;
  }
  if (action === 'market-add') {
    marketAddMenu = marketAddMenu === (target.dataset.menu || target.dataset.value) ? '' : target.dataset.menu || target.dataset.value;
    const scroll = content.scrollTop; render(); content.scrollTop = scroll;
    return;
  }
  if (action === 'market-add-kind') {
    marketAddMenu = '';
    const scroll = content.scrollTop; render(); content.scrollTop = scroll;
    return addSupermarketInteraction(target.dataset.type, target.dataset.value);
  }
  if (action === 'market-add-effect') {
    const effect = pack.effects.find(item => item.id === target.dataset.id && item.available !== false);
    if (effect) return addSupermarketInteraction('gift', supermarketColumn({ rule: {}, effect }), effect.id);
    return;
  }
  if (action === 'market-gift') return openSupermarketGifts(supermarketReference(target));
  if (action === 'market-extra-add' || action === 'market-cancel-extra') {
    marketPendingExtraRuleId = action === 'market-extra-add' ? supermarketReference(target).ruleId : '';
    const scroll = content.scrollTop; render(); content.scrollTop = scroll;
    return;
  }
  if (action === 'market-remove-extra') {
    await mutateSupermarketRule(supermarketReference(target), (rule, main) => { rule.actions = rule.actions.filter(item => item.id === main.id || item.id !== target.dataset.extraId || item.type !== 'game.effect'); });
    const scroll = content.scrollTop; render(); content.scrollTop = scroll;
    return;
  }
  if (action === 'market-follow') return addSupermarketInteraction(target.dataset.value, 'help');
  if (action === 'market-preview-sound') {
    const reference = supermarketReference(target);
    const row = findGameInteractionRow(pack.id, reference.ruleId, reference.actionId, reference.index);
    const sound = row?.rule.actions.find(item => item.type === 'audio.play' && item.config?.url);
    if (sound) return perform(() => api.testAction(structuredClone(sound)), 'Aperçu du son');
    return;
  }
  if (action === 'market-sound') return openSupermarketSound(supermarketReference(target));
  if (action === 'market-extra-actions') return openSupermarketExtraActions(supermarketReference(target));
});

content.addEventListener('toggle', event => {
  const catalog = event.target;
  if (catalog.id !== 'market-catalog' || !catalog.isConnected) return;
  marketCatalogOpen = catalog.open;
  ShenPulseGameWorkspace.populateCatalog(supermarketContext(), catalog);
  catalog.querySelector('[data-market-catalog-label]').textContent = catalog.open ? 'Replier la liste' : 'Afficher les effets';
}, true);

content.addEventListener('change', event => {
  if(event.target.matches('[data-market-overlay-color]')){perform(()=>saveSupermarketOverlayPresentation({backgroundColor:event.target.value})).catch(()=>{});return;}
  const target = event.target.closest('[data-market-inline]');
  if (!target) return;
  perform(async () => {
    const scroll = content.scrollTop;
    try { await saveSupermarketInline(target); }
    finally { render(); content.scrollTop = scroll; }
  }).catch(() => {});
});
content.addEventListener('input', event => {
  if (!event.target.matches('[data-market-catalog-search]')) return;
  marketCatalogSearch = event.target.value;
  const catalog = event.target.closest('.market-catalog');
  if (catalog) ShenPulseGameWorkspace.populateCatalog(supermarketContext(), catalog, { refresh: true });
});

content.addEventListener('click', event => {
  if (!marketAddMenu || event.target.closest('.market-add-wrap')) return;
  marketAddMenu = '';
  content.querySelectorAll('.market-add-menu').forEach(menu => menu.remove());
  content.querySelectorAll('[data-action="market-add"]').forEach(button => button.setAttribute('aria-expanded', 'false'));
});
