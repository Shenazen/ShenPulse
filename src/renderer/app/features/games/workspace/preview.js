"use strict";
(function (C) {
    const e = C.escape;
    C.overlayUrl = function ({ base, packId, profileId, language = 'fr', compact = false }) {
        if (!base)
            return '';
        let url;
        try {
            url = new URL(base);
        }
        catch {
            return '';
        }
        if (!['http:', 'https:'].includes(url.protocol))
            return '';
        url.searchParams.set('jeu', packId);
        url.searchParams.set('profile', profileId);
        url.searchParams.set('lang', language);
        url.searchParams.delete('motion');
        url.searchParams.delete('model');
        // Hiking uses a separate wins source; its gifts must not occupy a
        // portrait canvas that a studio can shrink and then enlarge again.
        if (compact || packId === 'gtav-hiking-enhanced')
            url.searchParams.set('layout', 'compact');
        return url.href;
    };
    C.presentation = function (ctx) {
        const value = ctx.preview.presentation || {}, models = ctx.preview.models;
        const definition = models.find(model => String(model.id) === String(value.model)) || models[0] || {};
        return { model: definition.id, definition, motion: value.motion === 'fixed' ? 'fixed' : 'animated', backgroundColor: /^#[0-9a-f]{6}$/i.test(value.backgroundColor || '') ? value.backgroundColor : '#082b63' };
    };
    C.renderPreviewControls = function (ctx) {
        const selected = C.presentation(ctx), animated = selected.motion === 'animated';
        const models = ctx.preview.models.map(model => '<button type="button" data-action="' + e(ctx.actions.chooseModel) + '" data-value="' + e(model.id) + '" aria-pressed="' + (model.id === selected.model) + '" class="' + (model.id === selected.model ? 'active' : '') + '">' + e(model.label) + '</button>').join('');
        const motion = selected.definition.supportsMotion ? '<div class="game-pack-preview-mode" role="group" aria-label="Mode de l’aperçu"><button data-action="' + e(ctx.actions.previewMode) + '" data-value="animated" aria-pressed="' + animated + '" class="' + (animated ? 'active' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 21 12-12 4 4L7 25M13 2v4m-2-2h4M4 7v4m-2-2h4M20 17v4m-2-2h4"/></svg><span>Animé</span>' + (ctx.preview.planLabel ? '<small class="game-pack-motion-plan">' + e(ctx.preview.planLabel) + '</small>' : '') + '</button><button data-action="' + e(ctx.actions.previewMode) + '" data-value="' + e(ctx.preview.fixedValue || 'fixed') + '" aria-pressed="' + !animated + '" class="' + (!animated ? 'active' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 4"/></svg><span>Fixe</span></button></div>' : '';
        const colors = selected.definition.supportsBackground ? '<div class="game-pack-model-colors"><span>' + e(selected.definition.backgroundLabel || 'Couleur de fond') + '</span>' + ctx.preview.backgrounds.map(([color, label]) => '<button type="button" data-action="' + e(ctx.actions.chooseColor) + '" data-value="' + e(color) + '" style="--swatch:' + e(/^#[0-9a-f]{6}$/i.test(color) ? color : '#082b63') + '" aria-label="' + e(label) + '" aria-pressed="' + (color.toLowerCase() === selected.backgroundColor.toLowerCase()) + '"></button>').join('') + '<input type="color" data-' + ctx.bindings.overlayColor + ' aria-label="' + e(selected.definition.backgroundAriaLabel || 'Couleur personnalisée') + '" value="' + e(selected.backgroundColor) + '"></div>' : '';
        return '<div class="game-pack-preview-controls">' + (models ? '<div class="game-pack-preview-models" role="group" aria-label="Modèle de l’overlay">' + models + '</div>' : '') + motion + colors + '</div>';
    };
    C.renderPhoneScreen = function (ctx) {
        const p=ctx.preview,camera=p.camera||{},game=p.game||{},url=p.sourceUrl;
        const cameraHtml=camera.enabled===false?'':'<div class="game-pack-camera-preview"><img src="'+e(camera.src||'')+'" alt="'+e(camera.alt||'Exemple de caméra en LIVE')+'" width="960" height="540"><div class="game-pack-phone-top"><span class="game-pack-demo-user"><i aria-hidden="true"></i><b>'+e(camera.username||'ton_pseudo')+'</b></span><span class="game-pack-demo-live">LIVE</span></div></div>';
        const gameHtml=game.enabled===false?'':'<div class="game-pack-phone-game"><img src="'+e(game.src||ctx.hero?.artwork||'')+'" alt="'+e(game.alt||ctx.pack.name)+'"><span>'+e(game.label||'VOTRE PARTIE')+'</span></div>';
        let gameplay=cameraHtml+gameHtml;
        if(p.winsSourceUrl)gameplay='<div class="game-pack-phone-gameplay">'+gameplay+'<iframe class="game-pack-phone-wins-source" src="'+e(p.winsSourceUrl)+'" title="Wins, multiplicateur et cadeaux de wins" tabindex="-1"></iframe></div>';
        return '<div class="game-pack-phone '+(p.winsSourceUrl?'has-win-system':'')+'" aria-label="Aperçu de la disposition du LIVE"><div class="game-pack-phone-screen">'+gameplay+'<div class="game-pack-phone-source">'+(url?'<iframe src="'+e(url)+'" title="Overlay cadeaux du profil actif" tabindex="-1"></iframe>':'<span>Source cadeaux indisponible</span>')+'</div></div></div>';
    };
    C.renderLivePreview = function (ctx) {
        const p = ctx.preview, selected = C.presentation(ctx), animated = selected.definition.supportsMotion && selected.motion === 'animated';
        const guides = (p.guides || []).map(guide => '<span class="game-pack-guide-' + e(guide.kind) + '"><strong>' + e(guide.title) + '</strong><small>' + e((animated ? guide.animated : guide.fixed) || guide.description || '') + '</small></span>').join('');
        return '<div class="game-pack-preview-area" data-game-workspace-scope="' + e(JSON.stringify([ctx.accountUid || '', ctx.profileId || '', ctx.pack.id])) + '">' + C.renderPreviewControls(ctx) +
            '<div class="game-pack-preview-scene"><div class="game-pack-preview-guides" aria-label="Disposition du LIVE">' + guides + '</div>' + C.renderPhoneScreen(ctx) + '</div>' +
            '<p class="game-pack-preview-caption"><strong>' + (animated ? 'Animé' : 'Fixe') + '</strong> · ' + e((animated ? p.caption?.animated : p.caption?.fixed) || '') + '</p>' +
            '<button class="button small primary game-pack-copy-overlay" data-action="' + e(ctx.actions.copy) + '" data-value="' + e(p.publicUrl || p.sourceUrl || '') + '" ' + (p.sourceUrl ? '' : 'disabled') + '>' + e(p.copyLabel || 'Copier l’URL des cadeaux') + '</button></div>';
    };
    C.patchPreview = function (root, previousMarkup, nextMarkup) {
        const preview = root.querySelector('.game-pack-preview-area'), frame = preview?.querySelector('.game-pack-phone-source iframe');
        if (!frame)
            return false;
        const document = root.ownerDocument, previous = document.createElement('template'), next = document.createElement('template');
        previous.innerHTML = previousMarkup;
        next.innerHTML = nextMarkup;
        const nextFrame = next.content.querySelector('.game-pack-phone-source iframe');
        if (!nextFrame || frame.getAttribute('src') !== nextFrame.getAttribute('src') || preview.getAttribute('data-game-workspace-scope') !== next.content.querySelector('.game-pack-preview-area')?.getAttribute('data-game-workspace-scope'))
            return false;
        const updates = [];
        for (const selector of ['.game-pack-preview-controls', '.game-pack-preview-guides', '.game-pack-preview-caption', '.game-pack-copy-overlay']) {
            const before = previous.content.querySelector(selector), after = next.content.querySelector(selector), live = preview.querySelector(selector);
            if (!before || !after || !live)
                return false;
            if (before.outerHTML !== after.outerHTML)
                updates.push([live, after.cloneNode(true)]);
            before.replaceWith(document.createComment(selector));
            after.replaceWith(document.createComment(selector));
        }
        if (previous.innerHTML !== next.innerHTML)
            return false;
        for (const [live, replacement] of updates)
            live.replaceWith(replacement);
        return true;
    };
})(globalThis.ShenPulseGameWorkspace);
