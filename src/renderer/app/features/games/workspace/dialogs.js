"use strict";
(function (C) {
    const e = C.escape;
    C.renderStudioShell = function (ctx, body, { busy = false, titleId = 'studio-install-title' } = {}) {
        return '<header><div><span>'+e(ctx.pack.name.toUpperCase())+'</span><h2 id="'+e(titleId)+'">'+e(ctx.studioOverlayOnly?'Installer le compteur':'Installer sur le studio')+'</h2></div><button type="button" class="studio-dialog-close" data-action="'+e(ctx.actions.studioClose)+'" aria-label="Fermer" '+(busy?'disabled':'')+'>×</button></header><p>'+e(ctx.studioOverlayOnly?'Ajoutez la source des wins et le compteur de mute à votre scène ShenPulse.':'Ajoutez une scène avec votre caméra, la capture du jeu et vos interactions. La disposition s’adapte au canevas du studio.')+'</p>'+body;
    };
    C.renderStudioStatus = (message, kind = '') => '<div class="studio-dialog-status ' + e(kind) + '" role="' + (kind === 'error' ? 'alert' : 'status') + '">' + e(message) + '</div>';
    C.renderStudioChoices = function (ctx, studios) { return '<div class="studio-install-choices">' + studios.map(studio => '<button type="button" class="studio-install-choice" data-action="' + e(ctx.actions.studioInstall) + '" data-id="' + e(studio.id) + '" ' + (studio.installed ? '' : 'disabled') + '><span class="studio-app-symbol ' + e(studio.id) + '" aria-hidden="true">' + ({ tiktok: '♪', obs: '◉', streamlabs: '▣' }[studio.id] || '▣') + '</span><span><strong>' + e(studio.name) + '</strong><small>' + (studio.installed ? studio.running ? 'Installé · ouvert' : 'Installé' : 'Non installé sur ce PC') + '</small></span><b aria-hidden="true">→</b></button>').join('') + '</div><p class="studio-install-note">Une nouvelle installation réutilise la scène ShenPulse de ce profil. Les scènes existantes sont conservées.</p>'; };
    C.renderStudioResult = function (ctx, result) {
        const only=ctx.studioOverlayOnly;
        return '<div class="studio-dialog-status success" role="status"><strong>'+e(only?'Compteur installé dans ':'Scène installée dans ')+e(result.studioName)+'</strong><p>'+e(result.sceneName)+'</p><ul>'+(only?'<li>Wins et compteur de mute de ce profil</li>':'<li>Caméra</li><li>Capture de '+e(ctx.pack.name)+'</li><li>Overlay des interactions de ce profil</li>'+(ctx.pack.effects?.some(effect=>effect.winCounter)?'<li>Wins et compteur de mute</li>':''))+'</ul></div>'+(result.openingMessage?'<p class="studio-opening-message" role="status">'+e(result.openingMessage)+'</p>':'')+'<p>'+e(only?'Le chrono apparaît pendant un mute actif. Vos autres sources conservent leur disposition.':'La capture du jeu s’affichera lorsque votre partie sera ouverte. Si aucune caméra n’était configurée, sélectionnez votre appareil dans sa source.')+'</p>'+C.renderButton({className:'button primary',action:ctx.actions.studioClose,label:'Terminé'});
    };
    C.renderStudioBlocked = function (ctx, result, studioId) { return '<div class="studio-dialog-status" role="status"><strong>' + e(result.studioName) + '</strong><p>' + e(result.message) + '</p></div><div class="button-row">' + C.renderButton({ className: 'button primary', action: ctx.actions.studioInstall, id: studioId, label: 'Réessayer l’installation' }) + C.renderButton({ action: ctx.actions.studioOpen, label: 'Changer de studio' }) + '</div>'; };
    C.renderStudioError = function (ctx, message, studioId) { return C.renderStudioStatus(message, 'error') + C.renderButton({ action: studioId ? ctx.actions.studioInstall : ctx.actions.studioOpen, id: studioId, label: 'Réessayer' }); };
    C.renderGiftMessage = message => '<p class="game-pack-gift-empty">' + e(message) + '</p>';
    C.renderGiftResults = function (ctx, data) {
        if (!data.gifts) return C.renderGiftMessage('Chargement des cadeaux…');
        const normalize = ctx.normalizeGiftSearch || (value => String(value || '').toLocaleLowerCase('fr'));
        const search = ctx.giftSearchText || (gift => [gift.name, gift.id, gift.cost].join(' ').toLocaleLowerCase('fr'));
        const scopeKind = data.scopeKind || 'unknown';
        const query = normalize(data.query), exact = String(data.query || '').trim();
        const price = (cost, range) => range === 'one' ? cost === 1 : range === 'small' ? cost >= 2 && cost <= 99 : range === 'medium' ? cost >= 100 && cost <= 999 : range === 'large' ? cost >= 1000 : true;
        const ids = gift => [String(gift.id), ...(gift.alternateIds || []).map(String)];
        const groups = data.groups || data.gifts.map(gift => ({ gift, variants: [gift] }));
        function filtered(source) {
            return source.flatMap(group => {
                const allVariants = group.variants?.length ? group.variants : [group.gift];
                const variants = allVariants.filter(gift => price(Number(gift.cost) || 0, data.range) && (!query || (data.searchTextById?.get(String(gift.id)) || search(gift)).includes(query)));
                if (!variants.length) return [];
                const gift = variants.find(gift => ids(gift).includes(exact)) || variants.find(gift => ids(gift).includes(String(data.selectedId))) || variants.find(gift => gift.id === group.gift.id) || variants[0];
                return [{ gift, variants, allVariants }];
            });
        }
        const all = filtered(groups), usedIds = new Set((data.usedIds || []).map(String)), commonIds = new Set((data.commonIds || []).map(String));
        const matches = (group, set) => group.allVariants.some(gift => ids(gift).some(id => set.has(id)));
        const used = all.filter(group => matches(group, usedIds)), common = all.filter(group => !matches(group, usedIds) && matches(group, commonIds));
        const shown = new Set([...used, ...common].flatMap(group => group.allVariants.flatMap(ids)));
        const scoped = data.showAll ? all : filtered(data.regionalGroups || groups);
        const rest = scoped.filter(group => !matches(group, shown)), availableIds = new Set((data.regionalIds || []).map(String));
        const badge = gift => scopeKind !== 'unknown' && !ids(gift).some(id => availableIds.has(id)) ? '<em class="game-pack-gift-scope-badge">' + (scopeKind === 'live' ? 'Autre région / spécial' : 'Autre catalogue') + '</em>' : '';
        const tile = gift => '<button type="button" class="game-pack-gift-choice ' + (ids(gift).includes(String(data.selectedId)) ? 'selected' : '') + '" data-' + ctx.bindings.giftChoice + '="' + e(gift.id) + '" aria-label="' + e(gift.name + ', ' + gift.cost + (gift.cost > 1 ? ' pièces' : ' pièce')) + '" aria-pressed="' + ids(gift).includes(String(data.selectedId)) + '">' + (gift.imageUrl ? '<img src="' + e(gift.imageUrl) + '" alt="" width="42" height="42" loading="lazy">' : '<span class="game-pack-gift-fallback" aria-hidden="true">🎁</span>') + '<strong>' + e(gift.name) + '</strong><small>' + Number(gift.cost || 0).toLocaleString('fr') + ' pièce' + (gift.cost > 1 ? 's' : '') + '</small>' + badge(gift) + '</button>';
        const family = group => '<div class="game-pack-gift-entry">' + tile(group.gift) + (group.variants.length > 1 ? '<details class="game-pack-gift-variants"><summary>Autres variantes (' + (group.variants.length - 1) + ')</summary><div>' + group.variants.filter(gift => gift !== group.gift).map(tile).join('') + '</div></details>' : '') + '</div>';
        const section = (label, items, suffix = '') => '<section class="game-pack-gift-group"><h4>' + e(label) + '</h4><div>' + items.map(family).join('') + '</div>' + suffix + '</section>';
        const limit = Math.max(1, Number(data.visibleLimit) || 60), remaining = Math.max(0, rest.length - limit);
        const more = remaining ? '<button type="button" class="button game-pack-gift-more" data-' + ctx.bindings.giftMore + '>Voir les ' + remaining.toLocaleString('fr') + ' autres cadeaux</button>' : '';
        const label = data.showAll ? 'TOUS LES CADEAUX' : scopeKind === 'live' ? 'CADEAUX DE VOTRE RÉGION / LIVE' : scopeKind === 'standard' ? 'CADEAUX STANDARDS' : 'CATALOGUE DISPONIBLE';
        const notice = !data.showAll && scopeKind !== 'live' ? '<p class="game-pack-gift-scope-note">' + e(scopeKind === 'standard' ? 'Le catalogue standard reste disponible hors LIVE. Connectez votre LIVE pour actualiser les cadeaux disponibles pour votre région et votre compte.' : 'La disponibilité régionale n’est pas encore connue. Le catalogue disponible est affiché en attendant la réponse de TikTok.') + '</p>' : '';
        return (used.length ? section('DÉJÀ UTILISÉS', used) : '') + (common.length ? section('CADEAUX COURANTS', common) : '') + notice + section(label + ' · ' + scoped.length.toLocaleString('fr'), rest.slice(0, limit), more) + (!rest.length && !used.length && !common.length ? C.renderGiftMessage('Aucun cadeau correspondant dans cette liste. Modifiez la recherche ou affichez tous les cadeaux.') : '');
    };
    C.renderGiftBrowser = function (ctx, data) { return '<div class="game-pack-gift-browser"><label class="game-pack-gift-search"><span class="sr-only">Rechercher un cadeau</span><input type="search" data-' + ctx.bindings.giftSearch + ' autofocus placeholder="Chercher un cadeau, un prix (ex. 99) ou un numéro…"></label><div class="game-pack-gift-toolbar"><div role="group" aria-label="Prix des cadeaux">' + (data.ranges || []).map(([value, label]) => '<button type="button" data-' + ctx.bindings.giftRange + '="' + e(value) + '" aria-pressed="' + (value === data.range) + '" class="' + (value === data.range ? 'active' : '') + '">' + e(label) + '</button>').join('') + '</div><label><input type="checkbox" data-' + ctx.bindings.giftShowAll + ' ' + (data.showAll ? 'checked' : '') + '>Afficher tous les cadeaux</label></div><div class="game-pack-gift-results" data-' + ctx.bindings.giftResults + '>' + C.renderGiftResults(ctx, data) + '</div></div>'; };
    C.renderExtraOptions = function (ctx, { mainEffectId, selectedIds = [], fieldName = 'gameExtraEffects' }) { const selected = new Set(selectedIds); return '<p>Le cadeau et les conditions de cette carte restent les mêmes. Choisissez les effets supplémentaires.</p><div class="game-pack-extra-options">' + ctx.pack.effects.filter(effect => effect.id !== mainEffectId && effect.available !== false).map(effect => '<label><input type="checkbox" name="' + e(fieldName) + '" value="' + e(effect.id) + '" ' + (selected.has(effect.id) ? 'checked' : '') + '><span>' + e(effect.name) + '</span></label>').join('') + '</div>'; };
})(globalThis.ShenPulseGameWorkspace);
