"use strict";
(function (C) {
    const escapeHtml = C.escape;
    function renderFreeEventsSection(ctx, rows) {
        const pack = ctx.pack, unlocked = ctx.unlocked && ctx.interactionsReady !== false;
        const groups = ctx.freeTypes.map(type => {
            const matches = rows.filter(row => type === 'follow' ? row.rule.trigger?.type === type : ['like', 'likes'].includes(row.rule.trigger?.type));
            return (matches.length ? matches : [null]).map(row => C.renderFreeRow(ctx, row, type)).join('');
        }).join('');
        return '<section class="game-pack-config-section" id="' + escapeHtml(ctx.id('follow')) + '"><header class="game-pack-section-heading game-pack-free-heading"><div><h3>' + escapeHtml(ctx.text.freeTitle) + '</h3><p>' + escapeHtml(ctx.text.freeDescription) + '</p></div></header><div class="game-pack-follow-grid">' + groups + '</div></section>';
    }
    function renderFreeRow(ctx, savedRow, type) {
        const pack = ctx.pack, unlocked = ctx.unlocked && ctx.interactionsReady !== false;
        const fallback = pack.effects.find(effect => (effect.id === ctx.freeDefaults[type] || effect.code === ctx.freeDefaults[type]) && effect.available !== false) || pack.effects.find(effect => effect.available !== false);
        if (!fallback)
            return '';
        const action = savedRow?.action || { id: '', config: { effectId: fallback.id, parameters: Object.fromEntries((fallback.parameters || []).map(parameter => [parameter.id, parameter.defaultValue ?? 0])) } };
        const rule = savedRow?.rule || { id: '', enabled: false, trigger: { type, enabled: true, threshold: 100 }, actions: [action] };
        const row = savedRow || { rule, action, actionIndex: 0, effect: fallback };
        const effect = row.effect || ctx.effectsById.get(action.config.effectId) || fallback;
        const label = type === 'follow' ? 'Follow' : 'Likes';
        const enabled = rule.enabled !== false && ctx.isAutomatic(rule), disabled = unlocked ? '' : 'disabled';
        const savedDisabled = unlocked && savedRow ? '' : 'disabled';
        const attributes = C.rowAttributes(ctx, row);
        const sound = rule.actions.find(item => item.type === 'audio.play' && item.config?.url);
        const soundName = sound?.config?.soundName || (sound ? 'Son associé' : 'Aucun son');
        const parameter = effect.parameters?.[0];
        const amount = parameter ? action.config?.parameters?.[parameter.id] ?? parameter.defaultValue : action.config?.duration ?? effect.duration;
        const extras = rule.actions.filter(item => item.type === 'game.effect' && item.id !== action.id);
        const select = (effectId, attributes, name) => C.renderEffectSelect(ctx, effectId, attributes, name, false);
        return '<article class="game-pack-free-row ' + (enabled ? '' : 'is-disabled') + '" data-' + ctx.bindings.freeType + '="' + escapeHtml(type) + '" ' + (savedRow ? 'data-' + ctx.bindings.card + ' ' + attributes : 'data-' + ctx.bindings.freePlaceholder + '="' + escapeHtml(type) + '"') + '>' +
            '<label class="game-pack-switch"><input type="checkbox" data-' + ctx.bindings.inline + '="enabled" aria-label="Activer ' + label + '" ' + (enabled ? 'checked' : '') + ' ' + disabled + '><span></span></label>' +
            '<span class="game-pack-free-icon ' + escapeHtml(type) + '" aria-hidden="true">' + ctx.eventIcon(type) + '</span>' +
            '<div class="game-pack-free-main"><header><strong>' + label + '</strong>' + (savedRow ? C.renderEditorButton(ctx, row, '⚙', 'game-pack-row-settings') : '') + '</header>' +
            '<div class="game-pack-free-actions"><span class="game-pack-free-trigger">' + (type === 'follow' ? 'Chaque follow →' : 'Tous les <input class="game-pack-like-threshold" type="number" data-' + ctx.bindings.inline + '="threshold" min="1" max="1000000" value="' + Math.max(1, Number(rule.trigger.threshold) || 100) + '" aria-label="Nombre de likes par viewer" ' + disabled + '> likes →') + '</span>' +
            '<label class="game-pack-effect-field"><span>Action dans le jeu</span>' + select(effect.id, 'data-' + ctx.bindings.inline + '="effect" ' + disabled, 'Action pour ' + label) + '</label>' +
            (parameter || effect.duration ? '<input class="game-pack-amount" type="number" data-' + ctx.bindings.inline + '="parameter" data-parameter="' + escapeHtml(parameter?.id || '') + '" aria-label="' + escapeHtml(parameter?.label || 'Durée (s)') + '" title="' + escapeHtml(parameter?.label || 'Durée (s)') + '" min="' + Number(parameter?.min ?? 1) + '" max="' + Number(parameter?.max ?? 120) + '" step="' + Number(parameter?.step ?? 1) + '" value="' + Number(amount || 0) + '" ' + disabled + '>' : '') +
            '<button type="button" class="game-pack-extra-button" data-action="' + escapeHtml(ctx.actions.extraAdd) + '" ' + attributes + ' ' + savedDisabled + '>+ action' + (extras.length ? ' (' + extras.length + ')' : '') + '</button></div>' +
            extras.map(extra => '<div class="game-pack-extra-effect">' + select(extra.config.effectId, 'data-' + ctx.bindings.inline + '="extra-effect" data-extra-id="' + escapeHtml(extra.id) + '" ' + disabled, 'Action supplémentaire') + '<button type="button" data-action="' + escapeHtml(ctx.actions.removeExtra) + '" data-extra-id="' + escapeHtml(extra.id) + '" ' + attributes + ' aria-label="Retirer cette action supplémentaire" ' + disabled + '>×</button></div>').join('') +
            (savedRow && ctx.ui.pendingExtraRuleId === rule.id ? '<div class="game-pack-extra-effect">' + select('', 'data-' + ctx.bindings.inline + '="new-extra-effect" ' + disabled, 'Nouvelle action supplémentaire') + '<button type="button" data-action="' + escapeHtml(ctx.actions.cancelExtra) + '" aria-label="Annuler l’ajout">×</button></div>' : '') + '</div>' +
            '<aside class="game-pack-free-aside"><strong>gratuit</strong><div class="game-pack-sound-control"><button type="button" class="game-pack-sound-play" data-action="' + escapeHtml(ctx.actions.previewSound) + '" ' + attributes + ' aria-label="Écouter le son associé" ' + (unlocked && sound ? '' : 'disabled') + '>▶</button><button type="button" class="game-pack-sound-name" data-action="' + escapeHtml(ctx.actions.sound) + '" ' + attributes + ' title="' + escapeHtml(soundName) + '" ' + savedDisabled + '>' + escapeHtml(soundName) + '</button><button type="button" class="game-pack-sound-edit" data-action="' + escapeHtml(ctx.actions.sound) + '" ' + attributes + ' aria-label="Changer le son" ' + savedDisabled + '>✎</button></div>' +
            '<button type="button" class="game-pack-delete-button" data-action="' + escapeHtml(ctx.actions.delete) + '" ' + attributes + ' aria-label="Supprimer ' + label + '" ' + savedDisabled + '><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"/></svg>Supprimer</button></aside></article>';
    }
    Object.assign(C, { renderFreeEventsSection, renderFreeRow });
})(globalThis.ShenPulseGameWorkspace);
