"use strict";
/**
 * Shared game page components, loaded as classic scripts before each game adapter.
 *
 * createContext({ pack, rows, hero, preview, guide, features, actions, bindings,
 *   profileId, accountUid, ui, columns, classify, freeDefaults, wins, overlays }).
 * The adapter supplies the current profile's data and owns IPC, persistence,
 * permissions and asynchronous lifecycle guards. Rendering never writes state.
 *
 * pack: { id, name, effects }; rows: [{ rule, action, actionIndex, effect }].
 * effects keep their native IDs/parameters. actions map UI events to the adapter's
 * handlers; bindings are validated data-attribute names, not event listeners.
 * preview.models declares each model's supportsMotion/supportsBackground rather
 * than relying on an ordinal. URLs remain stable when presentation changes.
 *
 * features controls section presence. wins/overlays default to false; enable
 * either with { title, cards, renderCard(card, ctx), collapsible?, open? }.
 * Pass the existing overlay-card renderer there to retain its own configuration,
 * counters and action links. sectionOrder can change the order of whole sections.
 *
 * Plain labels/IDs are escaped. fragments, presentTrigger().image, eventIcon(),
 * optional-section renderBody/renderCard/actionsHtml and select attributes are
 * trusted renderer callbacks/markup, never raw user or remote HTML.
 * Each instance gets unique DOM IDs via idPrefix and account/profile/game scope.
 * classAliases exists only for legacy controller migration; new games need none.
 */
(function (root) {
    const C = root.ShenPulseGameWorkspace = {};
    C.escape = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const defaultActions = { add: 'game-page-add', addKind: 'game-page-add-kind', gift: 'game-page-gift', edit: 'edit-game-interaction', test: 'test-game-interaction', delete: 'delete-game-interaction', sound: 'game-page-sound', previewSound: 'game-page-preview-sound', extraAdd: 'game-page-extra-add', removeExtra: 'game-page-remove-extra', cancelExtra: 'game-page-cancel-extra', category: 'game-page-category', addEffect: 'game-page-add-effect', chooseModel: 'game-page-overlay-model', chooseColor: 'game-page-overlay-color', previewMode: 'game-page-preview-mode', section: 'game-page-section', install: 'install-game', launch: 'launch-game', stop: 'stop-game-session', copy: 'copy', studioOpen: 'game-page-studio-open', studioInstall: 'game-page-studio-install', studioClose: 'game-page-studio-close', triggerEffect: 'trigger-effect', back: 'close-game' };
    const defaultBindings = { inline: 'game-inline', card: 'game-card', freeType: 'game-free-type', freePlaceholder: 'game-free-placeholder', overlayColor: 'game-overlay-color', catalogSearch: 'game-catalog-search', catalogLabel: 'game-catalog-label', giftChoice: 'game-gift-choice', giftRange: 'game-gift-range', giftSearch: 'game-gift-search', giftShowAll: 'game-gift-show-all', giftResults: 'game-gift-results', giftMore: 'game-gift-more' };
    const columns = [{ id: 'help', label: 'Aider le streamer', shortLabel: 'Aide' }, { id: 'neutral', label: 'Neutre', shortLabel: 'Neutre' }, { id: 'trap', label: 'Le piéger', shortLabel: 'Piège' }];
    C.createContext = function (options) {
        if (!options?.pack?.id || !options.pack.name)
            throw new Error('Un jeu identifié est requis pour composer sa page.');
        const pack = { ...options.pack, effects: options.pack.effects || [] };
        const ctx = { ...options, pack, unlocked: options.unlocked === true,
            hero: options.hero || {}, guide: options.guide || {},
            idPrefix: options.idPrefix || 'game-' + String(pack.id).replace(/[^a-z0-9_-]/gi, '-'),
            actions: { ...defaultActions, ...options.actions }, bindings: { ...defaultBindings, ...options.bindings },
            columns: options.columns || columns, rows: options.rows || [],
            features: { hero: true, preview: true, guide: true, interactions: true, freeEvents: true, catalog: true, round: false, wins: false, overlays: false, studio: true, conditions: true, ...options.features },
            ui: { addMenu: '', pendingExtraRuleId: '', ...options.ui, catalog: { search: '', category: 'all', open: false, ...options.ui?.catalog } },
            text: { back: 'Tous les jeux', interactionsEyebrow: 'VOTRE PACK PERSONNALISÉ', interactionsTitle: 'Ce que font vos viewers', interactionsDescription: 'Modifiez vos cartes : les réglages restent propres au profil actif.', catalogEyebrow: 'POUR ALLER PLUS LOIN', catalogTitle: 'Tous les effets du jeu', freeTitle: 'Follow et likes', freeDescription: 'Gratuits pour vos viewers : activez-les pour qu’un follow ou une série de likes déclenche une action.', emptyColumn: 'Ajoutez une interaction ou déplacez une carte dans cette colonne.', emptyNeutral: 'Les actions qui aident autant qu’elles piègent. En jaune sur votre overlay.', ...options.text },
            fragments: options.fragments || {}, freeTypes: options.freeTypes || ['follow', 'like'], freeDefaults: options.freeDefaults || {},
            preview: { models: [], backgrounds: [], ...options.preview }, wins: options.wins || {}, overlays: options.overlays || {}
        };
        for (const name of Object.values(ctx.bindings))
            if (!/^[a-z][a-z0-9-]*$/.test(name))
                throw new Error('Attribut de composant invalide.');
        // Index et caches limités à ce rendu : aucune donnée de profil ne persiste ici.
        ctx.effectsById = new Map(pack.effects.map(effect => [effect.id, effect]));
        ctx.availableEffects = pack.effects.filter(effect => effect.available !== false && (!options.effectFilter || options.effectFilter(effect)));
        ctx.effectOptions = new Map();
        ctx.titleForRule = options.titleForRule || ((rule, effect) => rule.gameInteraction?.title || effect.name);
        ctx.defaultColumn = options.defaultColumn || (ctx.columns.some(column => column.id === 'neutral') ? 'neutral' : ctx.columns[0]?.id || 'neutral');
        ctx.classify = options.classify || (row => ctx.columns.some(column => column.id === row.column) ? row.column : ctx.defaultColumn);
        ctx.isAutomatic = options.isAutomatic || (rule => rule.trigger?.enabled !== false);
        ctx.eventIcon = options.eventIcon || (() => '');
        ctx.presentTrigger = options.presentTrigger || (rule => ({ caption: rule.trigger?.type || 'Lancement manuel', image: ctx.eventIcon(rule.trigger?.type), cost: 0, free: ['follow', 'like', 'likes'].includes(rule.trigger?.type) }));
        ctx.id = name => ctx.idPrefix + '-' + name;
        return ctx;
    };
    C.collectRows = function (pack, mapped) {
        const seen = new Set(), effects = new Map(pack.effects.map(effect => [effect.id, effect]));
        const rows = mapped.flatMap(row => {
            const effect = effects.get(row.action.config?.effectId);
            if (!effect || row.action.config?.packId && row.action.config.packId !== pack.id || !['game.effect', 'overlay.win-counter', 'audio.play'].includes(row.action.type) || seen.has(row.rule.id))
                return [];
            seen.add(row.rule.id);
            return [{ ...row, effect }];
        });
        return globalThis.ShenPulseGameInteractionOrder?.rows(rows) || rows;
    };
    C.classifyRow = function (row, { columns, storedKey = 'column', helpCodes = new Set(), neutralCodes = new Set() }) {
        const stored = row.rule.gameInteraction?.[storedKey];
        if (columns.some(column => column.id === stored))
            return stored;
        if (helpCodes.has(row.effect.code))
            return 'help';
        return neutralCodes.has(row.effect.code) ? 'neutral' : 'trap';
    };
    C.rowAttributes = (ctx, row) => 'data-pack="' + C.escape(ctx.pack.id) + '" data-rule="' + C.escape(row.rule.id) + '" data-row-action="' + C.escape(row.action.id || '') + '" data-index="' + C.escape(row.actionIndex ?? 0) + '"';
    C.renderEditorButton = (ctx, row, label, extraClass = '') => '<button type="button" class="' + C.escape(extraClass) + '" data-action="' + C.escape(ctx.actions.edit) + '" data-effect="' + C.escape(row.effect.id) + '" ' + C.rowAttributes(ctx, row) + (ctx.unlocked && ctx.interactionsReady !== false ? '' : ' disabled') + '>' + label + '</button>';
    C.fragment = (ctx, name) => typeof ctx.fragments[name] === 'function' ? ctx.fragments[name](ctx) : ctx.fragments[name] || '';
    C.withClassAliases = function (ctx, html) {
        const aliases = Object.entries(ctx.classAliases || {});
        if (!aliases.length)
            return html;
        return html.replace(/class="([^"]*)"/g, (_all, value) => {
            const classes = value.split(/\s+/).filter(Boolean);
            for (const value of [...classes])
                for (const [prefix, alias] of aliases)
                    if (value.startsWith(prefix))
                        classes.push(alias + value.slice(prefix.length));
            return 'class="' + [...new Set(classes)].join(' ') + '"';
        });
    };
})(globalThis);
