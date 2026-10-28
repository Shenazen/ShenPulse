"use strict";

function gameWorkspaceEffectAction(pack, effect, previous = {}) {
 const action={...previous,id:previous.id||'action_'+cryptoId(),type:effect.actionType||'game.effect',config:{...previous.config,packId:pack.id,effectId:effect.id,quantity:previous.config?.quantity||effect.quantity||1,duration:effect.duration||0,parameters:Object.fromEntries((effect.parameters||[]).map(p=>[p.id,p.defaultValue??p.min??0]))}};
 if(effect.winCounter)Object.assign(action.config,{amount:effect.winCounter.amount||0,operation:effect.winCounter.operation||'adjust'});
 return action;
}
let marketWriteQueue = Promise.resolve();
let marketPresentationQueue = Promise.resolve();
function saveSupermarketOverlayPresentation(patch) {
 const scope={packId:supermarketPack().id,profileId:snapshot.state.session.profileId,accountUid:snapshot.state.settings.account?.uid||''};
 const operation=marketPresentationQueue.catch(()=>{}).then(async()=>{
  if(supermarketPack()?.id!==scope.packId||snapshot.state.session.profileId!==scope.profileId||(snapshot.state.settings.account?.uid||'')!==scope.accountUid)throw new Error('Le compte ou le profil a changé. Rouvrez les modèles.');
  const next=await api.saveGamePackPresentation({...scope,...patch});
  if(supermarketPack()?.id===scope.packId&&snapshot.state.session.profileId===scope.profileId&&(snapshot.state.settings.account?.uid||'')===scope.accountUid){const scroll=content.scrollTop;acceptSnapshot(next);render();content.scrollTop=scroll;}
 });
 marketPresentationQueue=operation;return operation;
}

function supermarketPack() {
  const selected = typeof selectedGameId !== 'undefined' && snapshot.packs.find(pack => pack.id === selectedGameId);
  if (selected && typeof usesSharedGameWorkspace === 'function') return usesSharedGameWorkspace(selected) ? selected : null;
  return snapshot.packs.find(pack => pack.id === 'supermarket-simulator');
}

function supermarketReference(target) {
  const card = target.closest('[data-market-card]') || target;
  return { packId: supermarketPack().id, profileId: snapshot.state.session.profileId, accountUid: snapshot.state.settings.account?.uid || '', ruleId: card.dataset.rule, actionId: card.dataset.rowAction, index: card.dataset.index };
}

function mutateSupermarketRule(reference, mutate) {
  if (reference?.packId && (reference.packId !== supermarketPack()?.id || reference.profileId !== snapshot.state.session.profileId || reference.accountUid !== (snapshot.state.settings.account?.uid || ''))) throw new Error('Le jeu, le compte ou le profil a changé. Rouvrez cette interaction.');
  const profileId = snapshot.state.session.profileId, packId = supermarketPack().id, accountUid = snapshot.state.settings.account?.uid || '';
  const operation = marketWriteQueue.catch(() => {}).then(async () => {
    if (snapshot.state.session.profileId !== profileId || supermarketPack()?.id !== packId || (snapshot.state.settings.account?.uid || '') !== accountUid) throw new Error('Le profil a changé. Rouvrez cette interaction.');
    const pack = supermarketPack();
    if (!requireGameAccess(pack)) throw new Error('Accès au jeu requis.');
    const row = findGameInteractionRow(pack.id, reference.ruleId, reference.actionId, reference.index);
    if (!row) throw new Error('Cette interaction n’est plus disponible.');
    const rule = structuredClone(row.rule);
    const action = rule.actions[row.actionIndex];
    mutate(rule, action, row, pack);
    const next = await api.saveGameInteraction(pack.id, rule);
    if (snapshot.state.session.profileId === profileId && supermarketPack()?.id === packId && (snapshot.state.settings.account?.uid || '') === accountUid) acceptSnapshot(next || await api.getSnapshot());
    return rule;
  });
  marketWriteQueue = operation;
  return operation;
}

function mutateSupermarketFreeRule(type, mutate) {
  if (!['follow', 'like'].includes(type)) throw new Error('Événement gratuit inconnu.');
  const profileId = snapshot.state.session.profileId, packId = supermarketPack().id, accountUid = snapshot.state.settings.account?.uid || '';
  const operation = marketWriteQueue.catch(() => {}).then(async () => {
    if (snapshot.state.session.profileId !== profileId || supermarketPack()?.id !== packId || (snapshot.state.settings.account?.uid || '') !== accountUid) throw new Error('Le profil a changé. Recommencez la configuration.');
    const pack = supermarketPack();
    if (!requireGameAccess(pack)) throw new Error('Accès au jeu requis.');
    const existing = supermarketRows(pack).find(row => type === 'follow' ? row.rule.trigger?.type === type : ['like', 'likes'].includes(row.rule.trigger?.type));
    const row = existing ? { ...existing, rule: structuredClone(existing.rule) } : supermarketNewRow(type, 'help');
    if (existing) row.action = row.rule.actions[existing.actionIndex];
    else row.rule.enabled = false;
    row.effect = pack.effects.find(effect => effect.id === row.action.config.effectId);
    mutate(row.rule, row.action, row, pack);
    const next = await api.saveGameInteraction(pack.id, row.rule);
    if (snapshot.state.session.profileId === profileId && supermarketPack()?.id === packId && (snapshot.state.settings.account?.uid || '') === accountUid) acceptSnapshot(next || await api.getSnapshot());
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
    if (kind === 'win-mute-seconds') action.config.duration = Math.max(1,Math.min(3600,Math.round(Number(value)||60)));
    if (kind === 'win-factor') action.config.amount = Math.max(1,Math.min(100,Number(value)||2));
    if (kind === 'win-stack') action.config.stackMode = value === 'increment' ? 'increment' : 'replace';
    if (kind === 'win-cap') action.config.maxMultiplier = Math.max(2,Math.min(100,Number(value)||10));
    if (kind === 'win-add-time') action.config.addDuration = checked;
    if (kind === 'win-duration') action.config.duration = Math.max(60,Math.min(3600,(Number(value)||1)*60));
    if (kind === 'threshold') rule.trigger.threshold = Math.max(1, Math.min(1000000, Number(value) || 1));
    if (['extra-effect', 'new-extra-effect'].includes(kind)) {
      const effect = pack.effects.find(item => item.id === value && item.available !== false);
      if (!effect) throw new Error('Choisissez une action disponible.');
      const extra = kind === 'extra-effect' ? rule.actions.find(item => item.id === target.dataset.extraId && item.config?.effectId) : null;
      if (kind === 'extra-effect' && !extra) throw new Error('Cette action n’est plus disponible.');
      if (extra) Object.assign(extra, gameWorkspaceEffectAction(pack, effect, extra));
      else rule.actions.push(gameWorkspaceEffectAction(pack, effect));
    }
    if (kind === 'enabled') { rule.enabled = checked; if (checked && rule.trigger) rule.trigger.enabled = true; }
    if (kind === 'title') {
      const title = String(value).trim().slice(0, 120) || row.effect?.name || pack.effects.find(effect => effect.id === action.config.effectId)?.name;
      rule.gameInteraction = { ...rule.gameInteraction, title };
      rule.name = pack.name + ' · ' + title;
    }
    if (kind === 'column' && MARKET_COLUMNS.some(column => column.id === value)) rule.gameInteraction = { ...rule.gameInteraction, marketColumn: value };
    if (kind === 'effect') {
      const effect = pack.effects.find(item => item.id === value && item.available !== false);
      if (!effect) throw new Error('Effet indisponible.');
      Object.assign(action, gameWorkspaceEffectAction(pack, effect, action));
    }
    if (kind === 'parameter') {
      const effect = pack.effects.find(item => item.id === action.config.effectId);
      const parameter = effect.parameters?.find(item => item.id === parameterId);
      if (parameter?.type === 'text') { action.config.parameters = { ...action.config.parameters, [parameter.id]: String(value).slice(0, parameter.maxLength || 500) }; return; }
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
  const soundPackId = supermarketPack().id;
  const row = findGameInteractionRow(supermarketPack().id, reference.ruleId, reference.actionId, reference.index);
  if (!row) throw new Error('Interaction introuvable.');
  const sound = row.rule.actions.find(action => action.type === 'audio.play' && !action.config?.effectId);
  openEditor({ title: 'Son de l’interaction', kicker: supermarketPack().name.toUpperCase(),
    body: soundPickerField('marketSound', sound?.config?.url || '', { label: 'Son joué avec cet effet', selectedName: sound?.config?.soundName || '', optional: true }),
    onSubmit: async data => {
      if (supermarketPack()?.id !== soundPackId) throw new Error('Le jeu a changé. Rouvrez cette interaction.');
      const url = String(data.get('marketSound') || '').trim();
      await mutateSupermarketRule(reference, rule => {
        const index = rule.actions.findIndex(action => action.type === 'audio.play' && !action.config?.effectId);
        if (!url) { if (index >= 0) rule.actions.splice(index, 1); return; }
        const previous = index >= 0 ? rule.actions[index] : {};
        const action = { ...previous, id: previous.id || 'action_' + cryptoId(), type: 'audio.play', config: { ...previous.config, url, soundName: String(data.get('marketSoundName') || ''), packId: soundPackId, volume: previous.config?.volume ?? 1, outputMode: previous.config?.outputMode || 'local' } };
        if (index >= 0) rule.actions[index] = action;
        else rule.actions.push(action);
      });
    }
  });
}

function openSupermarketExtraActions(reference) {
  const pack = supermarketPack(), row = findGameInteractionRow(pack.id, reference.ruleId, reference.actionId, reference.index);
  if (!row) throw new Error('Interaction introuvable.');
  const selected = new Set(row.rule.actions.filter(action => action.config?.effectId && action.id !== row.action.id).map(action => action.config.effectId));
  const ctx = supermarketContext(pack);
  openEditor({ title: 'Actions jouées avec le même événement', kicker: pack.name.toUpperCase(),
    body: supermarketMarkup(ctx,ShenPulseGameWorkspace.renderExtraOptions(ctx,{mainEffectId:row.action.config.effectId,selectedIds:[...selected],fieldName:'marketExtraEffects'})),
    onSubmit: async data => {
      if (supermarketPack()?.id !== pack.id) throw new Error('Le jeu a changé. Rouvrez cette interaction.');
      const requested = new Set(data.getAll('marketExtraEffects'));
      await mutateSupermarketRule(reference, (rule, action) => {
        rule.actions = rule.actions.filter(item => item.id === action.id || !item.config?.effectId || item.config.packId && item.config.packId !== pack.id || requested.has(item.config.effectId));
        for (const effect of pack.effects.filter(item => requested.has(item.id))) {
          if (rule.actions.some(item => item.config?.effectId && item.config.effectId === effect.id)) continue;
          rule.actions.push(gameWorkspaceEffectAction(pack, effect));
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
    await mutateSupermarketRule(supermarketReference(target), (rule, main) => { rule.actions = rule.actions.filter(item => item.id === main.id || item.id !== target.dataset.extraId || !item.config?.effectId); });
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

// Large catalogs populate a native select only when it is used, instead of N² options at page opening.
function populateGameWorkspaceEffectOptions(event) {
 const select=event.target.closest?.('select[data-game-effect-options]');if(!select)return;
 const pack=snapshot.packs.find(pack=>pack.id===select.dataset.gameEffectOptions);if(!pack||pack.id!==supermarketPack()?.id)return;
 const value=select.value,options=pack.effects.filter(effect=>effect.available!==false&&!effect.winCounter&&effect.actionType!=='overlay.win-counter');
 select.innerHTML=(value?'':'<option value="">Choisir une action…</option>')+options.map(effect=>'<option value="'+escapeHtml(effect.id)+'"'+(effect.id===value?' selected':'')+'>'+escapeHtml(effect.name)+'</option>').join('');
 delete select.dataset.gameEffectOptions;
}
content.addEventListener('focusin',populateGameWorkspaceEffectOptions);
content.addEventListener('pointerdown',populateGameWorkspaceEffectOptions);

function moveGameWorkspaceInteraction({packId,scope,...move}) {
 const [accountUid,profileId,scopePackId]=JSON.parse(scope);
 const current=()=>snapshot.state.session.profileId===profileId&&(snapshot.state.settings.account?.uid||'')===accountUid&&supermarketPack()?.id===packId&&scopePackId===packId;
 const operation=marketWriteQueue.catch(()=>{}).then(async()=>{
  if(!current())throw new Error('Le jeu, le compte ou le profil a changé. Rouvrez cette fiche.');
  if(!requireGameAccess(supermarketPack()))throw new Error('Accès au jeu requis.');
  const next=await api.moveGameInteraction(packId,{profileId,accountUid,...move});
  if(current()){const scroll=content.scrollTop;acceptSnapshot(next);render();content.scrollTop=scroll;}
 });marketWriteQueue=operation;return operation;
}
