"use strict";
(function (C) {
    const escapeHtml = C.escape;
    function renderParameterInput(parameter, value, attributes, disabled, fallbackLabel) {
        const label=parameter?.label||fallbackLabel||'Valeur';
        if(parameter?.type==='select')return '<select class="game-pack-amount game-pack-choice" '+attributes+' aria-label="'+escapeHtml(label)+'" title="'+escapeHtml(label)+'" '+disabled+'>'+parameter.options.map(option=>'<option value="'+escapeHtml(option.value)+'" '+(String(option.value)===String(value)?'selected':'')+'>'+escapeHtml(option.label||option.value)+'</option>').join('')+'</select>';
        return '<input class="game-pack-amount" type="'+(parameter?.type==='text'?'text':'number')+'" '+attributes+' min="'+Number(parameter?.min??1)+'" max="'+Number(parameter?.max??120)+'" step="'+Number(parameter?.step??1)+'" aria-label="'+escapeHtml(label)+'" title="'+escapeHtml(label)+'" value="'+escapeHtml(parameter?.type==='text'?value??'':Number(value||0))+'" '+disabled+'>';
    }
    function renderEffectSelect(ctx, effectId, attributes, label, withImage = true) {
        const pack = ctx.pack;
        const effect = ctx.effectsById.get(effectId);
        if (ctx.availableEffects.length > 60 && !ctx.effectOptions.has(effectId)) ctx.effectOptions.set(effectId, '<option value="' + escapeHtml(effectId || '') + '">' + escapeHtml(effect?.name || 'Choisir une action…') + '</option>');
        if (!ctx.effectOptions.has(effectId)) ctx.effectOptions.set(effectId, (effectId ? '' : '<option value="">Choisir une action…</option>') + ctx.availableEffects.map(item => '<option value="' + escapeHtml(item.id) + '" ' + (item.id === effectId ? 'selected' : '') + '>' + escapeHtml(item.name) + '</option>').join(''));
        return '<div class="game-pack-effect-choice">' + (withImage && effect?.image ? '<img src="' + escapeHtml(effect.image) + '" alt="" width="48" height="48" loading="lazy">' : '') + '<select ' + (ctx.availableEffects.length > 60 ? 'data-game-effect-options="' + escapeHtml(pack.id) + '" ' : '') + attributes + ' aria-label="' + escapeHtml(label) + '">' + ctx.effectOptions.get(effectId) + '</select></div>';
    }
    function renderAddButton(ctx, column, disabled, main = false) {
        const menu = main ? 'all' : column, open = ctx.ui.addMenu === menu;
        return '<div class="game-pack-add-wrap"><button type="button" class="' + (main ? 'button' : 'game-pack-text-button') + '" data-action="' + escapeHtml(ctx.actions.add) + '" data-value="' + escapeHtml(column) + '" data-menu="' + escapeHtml(menu) + '" aria-expanded="' + open + '" aria-haspopup="menu" ' + disabled + '>＋ Ajouter' + (main ? ' une interaction' : '') + '</button>' +
            (open ? '<div class="game-pack-add-menu" role="menu">' + (ctx.addTypes || [['gift', '🎁', 'Quand un cadeau est envoyé'], ['follow', '♧', 'À chaque follow'], ['like', '♥', 'Tous les X likes d’un viewer']]).map(([type, icon, label]) => '<button type="button" role="menuitem" ' + disabled + ' data-action="' + escapeHtml(ctx.actions.addKind) + '" data-type="' + escapeHtml(type) + '" data-value="' + escapeHtml(column) + '"><span aria-hidden="true">' + escapeHtml(icon) + '</span>' + escapeHtml(label) + '</button>').join('') + '</div>' : '') + '</div>';
    }
    function renderInteractionCard(ctx, row) {
        const unlocked = ctx.unlocked && ctx.interactionsReady !== false;
        const { rule, action, effect } = row;
        const title = ctx.titleForRule(rule, effect);
        const enabled = rule.enabled !== false;
        const attributes = C.rowAttributes(ctx, row);
        const sound = (rule.actions || []).find(item => item.type === 'audio.play' && item.config?.url);
        const extras = (rule.actions || []).filter(item => item.config?.effectId && (!item.config.packId || item.config.packId === ctx.pack.id) && item.id !== action.id);
        const disabled = unlocked ? '' : 'disabled';
        const trigger = ctx.presentTrigger(rule);
        const pack = ctx.pack;
        const firstParameter = effect.parameters?.[0];
        const parameterValue = firstParameter ? action.config?.parameters?.[firstParameter.id] ?? firstParameter.defaultValue : action.config?.duration ?? effect.duration;
        const soundName = sound?.config?.soundName || (sound ? 'Son associé' : 'Aucun son');
        const parameterLabel = firstParameter?.label || 'Durée (s)';
        return '<article class="game-pack-action-card ' + (!enabled ? 'is-disabled' : '') + '" data-game-reorder-item data-' + ctx.bindings.card + ' ' + attributes + '>' +
            '<div class="game-pack-card-rail"><button type="button" class="game-pack-row-grip" data-game-drag-handle aria-pressed="false" aria-label="Déplacer ' + escapeHtml(title) + '" title="Glissez pour déplacer ; flèches haut et bas au clavier" ' + disabled + '>⠿</button><label class="game-pack-switch"><input type="checkbox" data-' + ctx.bindings.inline + '="enabled" aria-label="Activer ' + escapeHtml(title) + '" ' + (enabled ? 'checked' : '') + ' ' + disabled + '><span></span></label>' +
            '<button type="button" class="game-pack-gift-tile" data-action="' + escapeHtml(rule.trigger?.type === 'gift' ? ctx.actions.gift : ctx.actions.edit) + '" data-effect="' + escapeHtml(effect.id) + '" ' + attributes + ' title="' + escapeHtml(trigger.caption + ' · modifier le déclencheur') + '" aria-label="' + escapeHtml('Configurer le déclencheur de ' + title) + '" ' + disabled + '>' + trigger.image + '</button></div>' +
            '<div class="game-pack-card-controls"><header class="game-pack-card-heading"><input class="game-pack-card-title" data-' + ctx.bindings.inline + '="title" aria-label="Titre de la carte" title="' + escapeHtml(title) + '" value="' + escapeHtml(title) + '" maxlength="120" ' + disabled + '>' +
            C.renderEditorButton(ctx, row, '⚙', 'game-pack-row-settings') +
            '<button type="button" class="game-pack-row-test" data-action="' + escapeHtml(ctx.actions.test) + '" ' + attributes + ' title="Tester dans le jeu" aria-label="Tester ' + escapeHtml(title) + '" ' + disabled + '>▷</button>' +
            (trigger.cost ? '<span class="game-pack-gift-cost" title="' + trigger.cost + ' pièces"><i aria-hidden="true"></i>' + trigger.cost.toLocaleString('fr') + '</span>' : trigger.free ? '<span class="game-pack-gift-cost free">gratuit</span>' : '') + '</header>' +
            '<div class="game-pack-card-meta"><span class="game-pack-trigger-caption" title="' + escapeHtml(trigger.caption) + '">' + (rule.trigger?.type === 'like' ? 'Tous les <input type="number" class="game-pack-like-threshold" data-' + ctx.bindings.inline + '="threshold" min="1" max="1000000" value="' + Number(rule.trigger.threshold || 100) + '" aria-label="Nombre de likes par viewer" ' + disabled + '> likes' : escapeHtml(rule.trigger?.type === 'follow' ? 'Chaque follow' : trigger.caption)) + ' →</span><div class="game-pack-sound-control">' +
            '<button type="button" class="game-pack-sound-play" data-action="' + escapeHtml(ctx.actions.previewSound) + '" ' + attributes + ' aria-label="Écouter le son associé" title="Écouter" ' + (unlocked && sound ? '' : 'disabled') + '>▶</button>' +
            '<button type="button" class="game-pack-sound-name" data-action="' + escapeHtml(ctx.actions.sound) + '" ' + attributes + ' title="' + escapeHtml(soundName + ' · choisir un son') + '" ' + disabled + '>' + escapeHtml(soundName) + '</button>' +
            '<button type="button" class="game-pack-sound-edit" data-action="' + escapeHtml(ctx.actions.sound) + '" ' + attributes + ' aria-label="Changer le son" title="Changer le son" ' + disabled + '>✎</button></div></div>' +
            '<label class="game-pack-effect-field"><span>Action dans le jeu</span>' + C.renderEffectSelect(ctx, effect.id, 'data-' + ctx.bindings.inline + '="effect" ' + disabled, 'Action dans le jeu') + '</label>' +
            extras.map(extra => '<div class="game-pack-extra-effect">' + C.renderEffectSelect(ctx, extra.config.effectId, 'data-' + ctx.bindings.inline + '="extra-effect" data-extra-id="' + escapeHtml(extra.id) + '" ' + disabled, 'Action supplémentaire') + '<button type="button" data-action="' + escapeHtml(ctx.actions.removeExtra) + '" data-extra-id="' + escapeHtml(extra.id) + '" ' + attributes + ' aria-label="Retirer cette action supplémentaire" ' + disabled + '>×</button></div>').join('') +
            (ctx.ui.pendingExtraRuleId === rule.id ? '<div class="game-pack-extra-effect">' + C.renderEffectSelect(ctx, '', 'data-' + ctx.bindings.inline + '="new-extra-effect" ' + disabled, 'Nouvelle action supplémentaire') + '<button type="button" data-action="' + escapeHtml(ctx.actions.cancelExtra) + '" aria-label="Annuler l’ajout">×</button></div>' : '') +
            '<div class="game-pack-card-bottom"><div class="game-pack-effect-extra">' +
            (firstParameter || effect.duration ? renderParameterInput(firstParameter,parameterValue,'data-'+ctx.bindings.inline+'="parameter" data-parameter="'+escapeHtml(firstParameter?.id||'')+'"',disabled,parameterLabel) : '') +
            '<button type="button" class="game-pack-extra-button" data-action="' + escapeHtml(ctx.actions.extraAdd) + '" ' + attributes + ' ' + disabled + '>+ action' + (extras.length ? ' (' + extras.length + ')' : '') + '</button></div>' +
            '<div class="game-pack-card-management"><select data-' + ctx.bindings.inline + '="column" aria-label="Colonne de cette interaction" ' + disabled + '>' + ctx.columns.map(column => '<option value="' + escapeHtml(column.id) + '" ' + (ctx.classify(row) === column.id ? 'selected' : '') + '>' + escapeHtml(column.shortLabel || column.label) + '</option>').join('') + '</select>' +
            '<button type="button" class="game-pack-delete-button" data-action="' + escapeHtml(ctx.actions.delete) + '" ' + attributes + ' aria-label="Supprimer ' + escapeHtml(title) + '" title="Supprimer" ' + disabled + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>Supprimer</button></div></div></div></article>';
    }
    Object.assign(C, { renderParameterInput, renderEffectSelect, renderAddButton, renderInteractionCard });
})(globalThis.ShenPulseGameWorkspace);
