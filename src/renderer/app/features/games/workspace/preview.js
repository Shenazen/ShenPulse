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
        // Shared pages use a separate gift panel; its cards must not occupy a
        // portrait canvas that a studio can shrink and then enlarge again.
        if (compact || globalThis.ShenPulseGameWorkspacePolicy.compactInteractionOverlay(packId))
            url.searchParams.set('layout', 'compact');
        return url.href;
    };
    C.presentation = function (ctx) {
        const value = ctx.preview.presentation || {}, models = ctx.preview.models;
        const definition = models.find(model => String(model.id) === String(value.model)) || models[0] || {};
        return { ...(globalThis.ShenPulseGamePackLayout?.normalize(value,ctx.pack.id)||{}), model: definition.id, definition, motion: value.motion === 'fixed' ? 'fixed' : 'animated', backgroundColor: /^#[0-9a-f]{6}$/i.test(value.backgroundColor || '') ? value.backgroundColor : '#082b63' };
    };
    C.renderPreviewControls = function (ctx) {
        const selected = C.presentation(ctx), animated = selected.motion === 'animated';
        const models = ctx.preview.models.map(model => '<button type="button" data-action="' + e(ctx.actions.chooseModel) + '" data-value="' + e(model.id) + '" aria-pressed="' + (model.id === selected.model) + '" class="' + (model.id === selected.model ? 'active' : '') + '">' + e(model.label) + '</button>').join('');
        const motion = selected.definition.supportsMotion ? '<div class="game-pack-preview-mode" role="group" aria-label="Mode de l’aperçu"><button type="button" data-action="' + e(ctx.actions.previewMode) + '" data-value="animated" aria-pressed="' + animated + '" class="' + (animated ? 'active' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 21 12-12 4 4L7 25M13 2v4m-2-2h4M4 7v4m-2-2h4M20 17v4m-2-2h4"/></svg><span>Animé</span>' + (ctx.preview.planLabel ? '<small class="game-pack-motion-plan">' + e(ctx.preview.planLabel) + '</small>' : '') + '</button><button type="button" data-action="' + e(ctx.actions.previewMode) + '" data-value="' + e(ctx.preview.fixedValue || 'fixed') + '" aria-pressed="' + !animated + '" class="' + (!animated ? 'active' : '') + '"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><path d="m4 18 6-6 4 4 3-3 4 4"/></svg><span>Fixe</span></button></div>' : '';
        const colors = selected.definition.supportsBackground ? '<div class="game-pack-model-colors"><span>' + e(selected.definition.backgroundLabel || 'Couleur de fond') + '</span>' + ctx.preview.backgrounds.map(([color, label]) => '<button type="button" data-action="' + e(ctx.actions.chooseColor) + '" data-value="' + e(color) + '" style="--swatch:' + e(/^#[0-9a-f]{6}$/i.test(color) ? color : '#082b63') + '" aria-label="' + e(label) + '" aria-pressed="' + (color.toLowerCase() === selected.backgroundColor.toLowerCase()) + '"></button>').join('') + '<input type="color" data-' + ctx.bindings.overlayColor + ' aria-label="' + e(selected.definition.backgroundAriaLabel || 'Couleur personnalisée') + '" value="' + e(selected.backgroundColor) + '"></div>' : '';
        return '<div class="game-pack-preview-controls">'  + (models ? '<div class="game-pack-preview-models" role="group" aria-label="Modèle de l’overlay">' + models + '</div>' : '') + motion + colors + '</div>';
    };
    C.renderLayoutControls = function (value, editing = false) {
        const choices = (key, label, entries) => '<fieldset class="game-pack-layout-field"><legend>' + e(label) + '</legend><div class="game-pack-layout-choices">' + entries.map(([id, title]) => '<button type="button" data-action="market-overlay-layout" data-layout-key="' + key + '" data-value="' + id + '" aria-pressed="' + (value[key] === id) + '">' + e(title) + '</button>').join('') + '</div></fieldset>';
        return '<div class="game-pack-layout-controls">' +
            choices('cardPlacement', 'Disposition des cartes', [['sides', 'Sur les côtés'], ['bottom', 'En bandeau']]) +
            choices('cameraPlacement', 'Position de la caméra', [['top', 'Caméra en haut'], ['bottom', 'Caméra en bas']]) +
            choices('rowOrder', 'Ordre des cartes', [['help-first', 'Aides d’abord'], ['trap-first', 'Pièges d’abord']]) +
            '<label class="game-pack-card-size"><span>Taille des cartes</span><output>' + value.cardSize + ' %</output><input type="range" min="80" max="160" step="5" value="' + value.cardSize + '" aria-valuetext="' + value.cardSize + ' pour cent" data-market-card-size></label>' +
            '<p class="game-pack-layout-note">' + (editing ? 'Enregistrez pour appliquer cette disposition sur votre URL. ' : 'Les cartes et l’aperçu se mettent à jour sur la même URL. ') + 'Pour déplacer aussi la caméra et la capture du jeu dans votre scène, utilisez « Installer sur le studio ».</p></div>';
    };
    C.renderPreviewSettings = function (ctx) {
        const selected = C.presentation(ctx);
        return '<section class="game-pack-preview-settings" aria-label="Personnaliser l’affichage"><header><span class="game-pack-settings-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg></span><div><h3>Personnaliser l’affichage</h3><p>Votre mise en page, sur votre LIVE.</p></div><span class="game-pack-settings-live">Aperçu direct</span></header>' +
            C.renderPreviewControls(ctx) + (Number(selected.model) === 1 ? C.renderLayoutControls(selected, ctx.preview.editor) : '') + '</section>';
    };
    C.renderPhoneScreen = function (ctx) {
        const p=ctx.preview,camera=p.camera||{},game=p.game||{},url=p.sourceUrl;
        const cameraHtml=camera.enabled===false?'':'<div class="game-pack-camera-preview"><img src="'+e(camera.src||'')+'" alt="'+e(camera.alt||'Exemple de caméra en LIVE')+'" width="960" height="540"><div class="game-pack-phone-top"><span class="game-pack-demo-user"><i aria-hidden="true"></i><b>'+e(camera.username||'ton_pseudo')+'</b></span><span class="game-pack-demo-live">LIVE</span></div></div>';
        const gameHtml=game.enabled===false?'':'<div class="game-pack-phone-game"><img src="'+e(game.src||ctx.hero?.artwork||'')+'" alt="'+e(game.alt||ctx.pack.name)+'"><span>'+e(game.label||'VOTRE PARTIE')+'</span></div>';
        const selected=C.presentation(ctx),custom=ctx.pack.id==='minecraft-box-cyber'&&Number(selected.model)===1;
        if(custom){
            const area=ShenPulseGamePackLayout.geometry(selected),box=(kind)=>Object.entries(area[kind]).map(([key,value])=>({x:'left',y:'top',width:'width',height:'height'}[key])+':'+(value/(key==='x'||key==='width'?1080:1920)*100)+'%').join(';');
            const place=(html,kind)=>html.replace('class="','style="'+box(kind)+'" class="');
            return '<div class="game-pack-phone has-win-system box-cyber-layout" aria-label="Aperçu de la disposition du LIVE"><div class="game-pack-phone-screen">'+place(cameraHtml,'camera')+place(gameHtml,'game')+'<iframe class="game-pack-phone-wins-source" src="'+e(p.winsSourceUrl)+'" title="Wins et multiplicateur" tabindex="-1"></iframe><div class="game-pack-phone-source"><iframe src="'+e(url)+'" title="Overlay cadeaux du profil actif" tabindex="-1"></iframe></div></div></div>';
        }
        let gameplay=cameraHtml+gameHtml;
        if(p.winsSourceUrl)gameplay='<div class="game-pack-phone-gameplay">'+gameplay+'<iframe class="game-pack-phone-wins-source" src="'+e(p.winsSourceUrl)+'" title="Wins, multiplicateur et cadeaux de wins" tabindex="-1"></iframe></div>';
        return '<div class="game-pack-phone '+(p.winsSourceUrl?'has-win-system':'')+'" aria-label="Aperçu de la disposition du LIVE"><div class="game-pack-phone-screen">'+gameplay+'<div class="game-pack-phone-source">'+(url?'<iframe src="'+e(url)+'" title="Overlay cadeaux du profil actif" tabindex="-1"></iframe>':'<span>Source cadeaux indisponible</span>')+'</div></div></div>';
    };
    C.renderLivePreview = function (ctx) {
        const p = ctx.preview, selected = C.presentation(ctx), animated = selected.definition.supportsMotion && selected.motion === 'animated';
        const boxCyber = ctx.pack.id === 'minecraft-box-cyber', editing = p.editor === true;
        const area = boxCyber && Number(selected.model) === 1 ? ShenPulseGamePackLayout.geometry(selected) : null;
        const guides = (p.guides || []).map(guide => {
            const rect = area?.[{ camera: 'camera', game: 'game', gifts: 'gifts' }[guide.kind]];
            const center = rect ? area.side && guide.kind === 'gifts' ? area.game.y + area.game.height * .76 : rect.y + rect.height / 2 : 0;
            const style = rect ? ' style="top:' + (center / 1920 * 100) + '%"' : '';
            let description = (animated ? guide.animated : guide.fixed) || guide.description || '';
            if (area && guide.kind === 'camera') description = area.flipped ? 'En bas de votre LIVE.' : 'En haut de votre LIVE.';
            if (area && guide.kind === 'game') description = 'Le jeu garde sa place dans votre LIVE.';
            if (area && guide.kind === 'gifts') description = area.side ? 'Sur les côtés du jeu.' : area.flipped ? 'Les cartes en haut du LIVE.' : 'Les cartes en bas du LIVE.';
            return '<span class="game-pack-guide-' + e(guide.kind) + '"' + style + '><strong>' + e(guide.title) + '</strong><small>' + e(description) + '</small></span>';
        }).join('');
        return '<div class="game-pack-preview-area" data-game-workspace-scope="' + e(JSON.stringify([ctx.accountUid || '', ctx.profileId || '', ctx.pack.id])) + '">' + (boxCyber ? (editing ? '' : C.renderCustomizationButton(ctx)) : C.renderPreviewControls(ctx)) +
            '<div class="game-pack-preview-scene"><div class="game-pack-preview-guides" aria-label="Disposition du LIVE">' + guides + '</div>' + C.renderPhoneScreen(ctx) + '</div>' +
            (!boxCyber || editing ? '<p class="game-pack-preview-caption"><strong>' + (animated ? 'Animé' : 'Fixe') + '</strong> · ' + e(boxCyber ? 'L’aperçu suit vos réglages. Enregistrez pour les appliquer à votre LIVE, ou annulez pour conserver votre disposition.' : (animated ? p.caption?.animated : p.caption?.fixed) || '') + '</p>' : '') +
            (editing ? '' : '<button class="button small primary game-pack-copy-overlay" data-action="' + e(ctx.actions.copy) + '" data-value="' + e(C.copyOverlayUrl(ctx)) + '" ' + (p.sourceUrl ? '' : 'disabled') + '>' + e(p.copyLabel || 'Copier l’URL des cadeaux') + '</button>') + '</div>';
    };
    // Le lien manuel est une source de cartes ; la scène automatique garde son canevas complet.
    C.copyOverlayUrl = function (ctx) {
        const base = ctx.preview.publicUrl || ctx.preview.sourceUrl || '';
        if (!base || !globalThis.ShenPulseGameWorkspacePolicy.compactInteractionOverlay(ctx.pack.id)) return base;
        try {
            const url = new URL(base);
            if (!['http:', 'https:'].includes(url.protocol)) return '';
            url.searchParams.set('layout', 'compact');
            url.searchParams.set('fit', 'cards');
            url.searchParams.delete('editorPreview');
            return url.href;
        } catch { return ''; }
    };
    C.renderCustomizationButton = function () {
        return '<button type="button" class="button game-pack-customize-button" data-action="market-overlay-customize" aria-haspopup="dialog"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3"/><circle cx="15" cy="17" r="3"/></svg><span>Personnaliser l’affichage</span></button>';
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
        for (const selector of ['.game-pack-customize-button', '.game-pack-preview-controls', '.game-pack-preview-settings', '.game-pack-preview-guides', '.game-pack-preview-caption', '.game-pack-copy-overlay'].filter(selector => previous.content.querySelector(selector) || next.content.querySelector(selector))) {
            const before = previous.content.querySelector(selector), after = next.content.querySelector(selector), live = preview.querySelector(selector);
            if (!before || !after || !live)
                return false;
            if (before.outerHTML !== after.outerHTML)
                updates.push([live, after.cloneNode(true)]);
            before.replaceWith(document.createComment(selector));
            after.replaceWith(document.createComment(selector));
        }
        const beforePhone=previous.content.querySelector('.box-cyber-layout'),afterPhone=next.content.querySelector('.box-cyber-layout'),livePhone=preview.querySelector('.box-cyber-layout');
        const phoneUpdates=[];
        if(beforePhone&&afterPhone&&livePhone){
            for(const selector of ['.game-pack-camera-preview','.game-pack-phone-game']){
                const old=beforePhone.querySelector(selector),fresh=afterPhone.querySelector(selector),live=livePhone.querySelector(selector);
                if(!old||!fresh||!live)return false;
                if(old.getAttribute('style')!==fresh.getAttribute('style'))phoneUpdates.push([live,fresh.getAttribute('style')]);
                old.removeAttribute('style');fresh.removeAttribute('style');
            }
            if(beforePhone.outerHTML!==afterPhone.outerHTML)return false;
            beforePhone.replaceWith(document.createComment('phone'));afterPhone.replaceWith(document.createComment('phone'));
        }
        if (previous.innerHTML !== next.innerHTML) return false;
        for(const [node,style] of phoneUpdates){if(style===null)node.removeAttribute('style');else node.setAttribute('style',style);}
        for (const [live, replacement] of updates)
            live.replaceWith(replacement);
        return true;
    };
})(globalThis.ShenPulseGameWorkspace);
