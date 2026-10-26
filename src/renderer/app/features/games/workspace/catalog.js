"use strict";
(function (C) {
    const e = C.escape, categoryOf = effect => effect.category || 'Autres';
    C.renderCatalogCard = function (ctx, effect) {
        const enabled = ctx.unlocked && ctx.interactionsReady !== false && effect.available !== false;
        return '<article>' + (effect.image ? '<img class="game-pack-catalog-art" src="' + e(effect.image) + '" alt="' + e(effect.name) + '" width="320" height="200" loading="lazy">' : '') + '<span>' + e(categoryOf(effect)) + '</span><h4>' + e(effect.name) + '</h4><p>' + e(effect.description) + '</p><footer><button class="button small" data-action="' + e(ctx.actions.triggerEffect) + '" data-id="' + e(effect.id) + '" data-pack="' + e(ctx.pack.id) + '" ' + (enabled ? '' : 'disabled') + '>▶ Tester</button><button class="button small primary" data-action="' + e(ctx.actions.addEffect) + '" data-id="' + e(effect.id) + '" data-pack="' + e(ctx.pack.id) + '" ' + (enabled ? '' : 'disabled') + '>＋ Ajouter</button></footer></article>';
    };
    C.renderCatalogBody = function (ctx) {
        const counts = new Map(), pack = ctx.pack, query = ctx.ui.catalog.search.trim().toLocaleLowerCase('fr');
        for (const effect of pack.effects) { const category = categoryOf(effect); counts.set(category, (counts.get(category) || 0) + 1); }
        const effects = pack.effects.filter(effect => (ctx.ui.catalog.category === 'all' || categoryOf(effect) === ctx.ui.catalog.category) && (!query || (effect.name + ' ' + effect.description).toLocaleLowerCase('fr').includes(query)));
        const category = (value, label, count) => '<button data-action="' + e(ctx.actions.category) + '" data-value="' + e(value) + '" class="' + (ctx.ui.catalog.category === value ? 'active' : '') + '">' + e(label) + ' <b>' + count + '</b></button>';
        return '<label class="game-pack-catalog-search"><span>⌕</span><input type="search" data-' + ctx.bindings.catalogSearch + ' placeholder="Chercher un effet" aria-label="Chercher un effet" value="' + e(ctx.ui.catalog.search) + '"></label><div class="game-pack-categories">' + category('all', 'Tout', pack.effects.length) + [...counts].map(([name, count]) => category(name, name, count)).join('') + '</div><div class="game-pack-catalog-grid">' + effects.map(effect => C.renderCatalogCard(ctx, effect)).join('') + (effects.length ? '' : '<p class="game-pack-empty">Aucun effet ne correspond à cette recherche.</p>') + '</div>';
    };
    C.renderCatalogSummary = function (ctx) {
        return '<summary class="game-pack-section-heading"><div><span>' + e(ctx.text.catalogEyebrow) + '</span><h3>' + e(ctx.text.catalogTitle) + '</h3><p>' + ctx.pack.effects.length + ' effets · ajoutez-les à votre pack ou testez-les en jeu.</p></div><span class="game-pack-catalog-toggle"><span data-' + ctx.bindings.catalogLabel + '>' + (ctx.ui.catalog.open ? 'Replier la liste' : 'Afficher les effets') + '</span><b aria-hidden="true">⌄</b></span></summary>';
    };
    C.renderCatalog = function (ctx) {
        return '<details class="game-pack-config-section game-pack-catalog" id="' + e(ctx.id('catalog')) + '"' + (ctx.ui.catalog.open ? ' open' : '') + '>' + C.renderCatalogSummary(ctx) + '<div class="game-pack-catalog-body"' + (ctx.ui.catalog.open ? ' data-catalog-ready="true"' : '') + '>' + (ctx.ui.catalog.open ? C.renderCatalogBody(ctx) : '') + '</div></details>';
    };
    // Le contenu masqué est libéré ; les filtres sont fournis par le contexte du profil.
    C.populateCatalog = function (ctx, catalog, { refresh = false } = {}) {
        if (catalog.id !== ctx.id('catalog')) return false;
        const body = catalog.querySelector('.game-pack-catalog-body');
        if (body && !catalog.open) { body.replaceChildren(); delete body.dataset.catalogReady; return true; }
        if (!body || body.dataset.catalogReady === 'true' && !refresh) return false;
        const html = C.withClassAliases(ctx, C.renderCatalogBody(ctx));
        if (body.dataset.catalogReady === 'true') {
            const template = body.ownerDocument.createElement('template'); template.innerHTML = html;
            for (const selector of ['.game-pack-categories', '.game-pack-catalog-grid']) {
                const current = body.querySelector(selector), next = template.content.querySelector(selector);
                if (current && next && !current.isEqualNode(next)) current.replaceWith(next);
            }
            const input = body.querySelector('[data-' + ctx.bindings.catalogSearch + ']');
            if (input && input.value !== ctx.ui.catalog.search) input.value = ctx.ui.catalog.search;
        } else body.innerHTML = html;
        body.dataset.catalogReady = 'true'; return true;
    };
})(globalThis.ShenPulseGameWorkspace);
