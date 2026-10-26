"use strict";
/** Visite explicative, sans appel métier : une seule instance par document. */
(function (C) {
    const instances = new WeakMap();
    const clamp = (n, min, max) => Math.max(min, Math.min(Math.max(min, max), n));
    C.tourPlacement = function (viewport, target, bubble) {
        const m = 12, gap = 18, w = Math.min(bubble.width, viewport.width - m * 2), h = Math.min(bubble.height, viewport.height - m * 2);
        const midX = target.left + target.width / 2, midY = target.top + target.height / 2;
        const candidates = [
            { side: 'right', left: target.right + gap, top: clamp(midY - h / 2, m, viewport.height - h - m), fits: target.right + gap + w <= viewport.width - m },
            { side: 'left', left: target.left - gap - w, top: clamp(midY - h / 2, m, viewport.height - h - m), fits: target.left - gap - w >= m },
            { side: 'bottom', left: clamp(midX - w / 2, m, viewport.width - w - m), top: target.bottom + gap, fits: target.bottom + gap + h <= viewport.height - m },
            { side: 'top', left: clamp(midX - w / 2, m, viewport.width - w - m), top: target.top - gap - h, fits: target.top - gap - h >= m }
        ];
        const position = candidates.find(p => p.fits) || { side: 'docked', left: clamp(midX - w / 2, m, viewport.width - w - m), top: viewport.height - h - m };
        return { ...position, width: w, height: h, arrowX: clamp(midX - position.left, 22, w - 22), arrowY: clamp(midY - position.top, 22, h - 22) };
    };
    C.createGuidedTour = function (document) {
        if (instances.has(document)) return instances.get(document);
        const win = document.defaultView;
        let state = null, frame = 0;
        const visible = element => element && !element.closest('[hidden]') && element.getClientRects().length && win.getComputedStyle(element).visibility !== 'hidden';
        const currentRoot = () => state && [...document.querySelectorAll('.game-pack-workspace')].find(root => root.dataset.gamePack === state.pack && root.dataset.gameTourScope === state.scope);
        function resolve(step, root) {
            const area = step.global ? document : root;
            for (const selector of step.targets || [step.target]) {
                if (typeof selector !== 'string') continue;
                try { const node = [...area.querySelectorAll(selector)].find(visible); if (node) return node; } catch (_) { /* Une cible retirée n’empêche pas les autres étapes. */ }
            }
            return null;
        }
        function rememberScroll(target) {
            for (let node = target.parentElement; node; node = node.parentElement) {
                if (!state.scroll.has(node) && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) state.scroll.set(node, [node.scrollLeft, node.scrollTop]);
            }
        }
        function reveal(target) {
            rememberScroll(target);
            target.scrollIntoView?.({ block: 'center', inline: 'nearest', behavior: 'instant' });
            // Réserve de la place pour la bulle sous les cibles sur une fenêtre étroite.
            for (let node = target.parentElement; node; node = node.parentElement) {
                const style = win.getComputedStyle(node);
                if (node.scrollHeight > node.clientHeight && /(auto|scroll)/.test(style.overflowY)) {
                    const rect = node.getBoundingClientRect();
                    node.scrollTop += target.getBoundingClientRect().top - Math.max(rect.top + 20, win.innerHeight * .23);
                    break;
                }
            }
        }
        function close() {
            if (!state) return;
            const previous = state, root = currentRoot(); state = null;
            if (frame) win.cancelAnimationFrame(frame); frame = 0;
            previous.mutations.disconnect(); previous.resize?.disconnect();
            win.removeEventListener('resize', schedule); document.removeEventListener('scroll', schedule, true);
            previous.layer.close(); previous.layer.remove();
            for (const [node, [left, top]] of previous.scroll) if (node.isConnected) { node.scrollLeft = left; node.scrollTop = top; }
            const focus = previous.trigger.isConnected ? previous.trigger : root?.querySelector('[data-game-tour-start]');
            if (focus && !focus.disabled) focus.focus({ preventScroll: true });
        }
        function layout() {
            if (!state) return;
            const root = currentRoot();
            if (!root) return close();
            const target = resolve(state.steps[state.index], root);
            if (!target) return show(state.index + 1, 1);
            if (target !== state.target) { state.resize?.unobserve(state.target); state.target = target; state.resize?.observe(target); reveal(target); }
            const width = win.innerWidth, height = win.innerHeight, raw = target.getBoundingClientRect();
            // Le trou suit uniquement la portion réellement visible dans ses conteneurs.
            let left = Math.max(8, raw.left - 7), top = Math.max(8, raw.top - 7), right = Math.min(width - 8, raw.right + 7), bottom = Math.min(height - 8, raw.bottom + 7);
            for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
                const style = win.getComputedStyle(parent), rect = parent.getBoundingClientRect();
                if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) { top = Math.max(top, rect.top); bottom = Math.min(bottom, rect.bottom); }
                if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) { left = Math.max(left, rect.left); right = Math.min(right, rect.right); }
            }
            if (right <= left || bottom <= top) { reveal(target); return schedule(); }
            const rect = { left, top, right, bottom, width: right - left, height: bottom - top };
            const bubble = state.bubble.getBoundingClientRect(), position = C.tourPlacement({ width, height }, rect, bubble);
            state.bubble.style.left = position.left + 'px'; state.bubble.style.top = position.top + 'px';
            state.bubble.dataset.side = position.side; state.bubble.style.setProperty('--tour-arrow-x', position.arrowX + 'px'); state.bubble.style.setProperty('--tour-arrow-y', position.arrowY + 'px');
            // Une grande section ne doit pas éclairer derrière la bulle sur les petits écrans.
            if (position.side === 'docked' && top < position.top - 16) bottom = Math.min(bottom, position.top - 16);
            Object.assign(state.ring.style, { left: left + 'px', top: top + 'px', width: (right - left) + 'px', height: (bottom - top) + 'px' });
            const r = Math.min(12, (right - left) / 2, (bottom - top) / 2);
            state.mask.setAttribute('d', 'M0 0H' + width + 'V' + height + 'H0Z M' + (left + r) + ' ' + top + 'H' + (right - r) + 'Q' + right + ' ' + top + ' ' + right + ' ' + (top + r) + 'V' + (bottom - r) + 'Q' + right + ' ' + bottom + ' ' + (right - r) + ' ' + bottom + 'H' + (left + r) + 'Q' + left + ' ' + bottom + ' ' + left + ' ' + (bottom - r) + 'V' + (top + r) + 'Q' + left + ' ' + top + ' ' + (left + r) + ' ' + top + 'Z');
            state.layer.dataset.ready = 'true';
        }
        function schedule() { if (state && !frame) frame = win.requestAnimationFrame(() => { frame = 0; layout(); }); }
        function show(index, direction = 1) {
            if (!state) return;
            const root = currentRoot(); if (!root) return close();
            let target;
            while (index >= 0 && index < state.steps.length && !(target = resolve(state.steps[index], root))) index += direction;
            if (!target) return close();
            state.index = index;
            const step = state.steps[index];
            state.title.textContent = step.title; state.description.textContent = step.text;
            state.counter.textContent = 'Étape ' + (index + 1) + ' sur ' + state.steps.length;
            state.progress.max = state.steps.length; state.progress.value = index + 1;
            state.previous.disabled = index === 0;
            state.next.textContent = index === state.steps.length - 1 ? 'Terminer' : 'Suivant →';
            state.next.setAttribute('aria-label', index === state.steps.length - 1 ? 'Terminer la visite guidée' : 'Étape suivante');
            state.layer.dataset.step = String(index + 1); state.description.scrollTop = 0;
            if (state.target) state.resize?.unobserve(state.target);
            state.target = target; state.resize?.observe(target); reveal(target); layout();
            // Le focus ne se déplace jamais sur un bouton métier pendant la visite.
            (state.previous.disabled ? state.next : state.layer.contains(document.activeElement) ? document.activeElement : state.next).focus({ preventScroll: true });
        }
        function start(trigger) {
            close();
            const root = trigger.closest('.game-pack-workspace'); if (!root) return false;
            let steps; try { steps = JSON.parse(trigger.dataset.gameTourSteps); } catch (_) { return false; }
            if (!Array.isArray(steps)) return false;
            steps = steps.filter(step => step && typeof step.title === 'string' && typeof step.text === 'string' && resolve(step, root));
            if (!steps.length) return false;
            const layer = document.createElement('dialog'); layer.className = 'game-tour-layer';
            layer.setAttribute('aria-labelledby', 'game-tour-title'); layer.setAttribute('aria-describedby', 'game-tour-description');
            layer.setAttribute('aria-modal', 'true');
            layer.innerHTML = '<svg class="game-tour-shade" aria-hidden="true"><path fill-rule="evenodd"></path></svg><div class="game-tour-ring" aria-hidden="true"></div><section class="game-tour-bubble"><header><span class="game-tour-counter" role="status" aria-live="polite"></span><button type="button" class="game-tour-close" aria-label="Fermer la visite guidée">×</button></header><progress aria-label="Avancement de la visite"></progress><h2 id="game-tour-title"></h2><p id="game-tour-description" aria-live="polite" aria-atomic="true"></p><small class="game-tour-hint">Visite explicative · vos réglages restent inchangés</small><footer><button type="button" class="game-tour-previous">← Précédent</button><button type="button" class="game-tour-next">Suivant →</button></footer><button type="button" class="game-tour-exit">Quitter la visite</button></section>';
            const q = selector => layer.querySelector(selector);
            const mutations = new win.MutationObserver(records => { if (records.some(record => !layer.contains(record.target))) schedule(); });
            state = { trigger, pack: root.dataset.gamePack, scope: root.dataset.gameTourScope, steps, index: 0, layer, bubble: q('.game-tour-bubble'), mask: q('path'), ring: q('.game-tour-ring'), title: q('h2'), description: q('#game-tour-description'), counter: q('.game-tour-counter'), progress: q('progress'), previous: q('.game-tour-previous'), next: q('.game-tour-next'), scroll: new Map(), mutations, resize: win.ResizeObserver ? new win.ResizeObserver(schedule) : null };
            q('.game-tour-close').addEventListener('click', close); q('.game-tour-exit').addEventListener('click', close);
            state.previous.addEventListener('click', () => show(state.index - 1, -1));
            state.next.addEventListener('click', () => state.index === state.steps.length - 1 ? close() : show(state.index + 1));
            layer.addEventListener('close', () => { if (state?.layer === layer) close(); });
            layer.addEventListener('cancel', event => { event.preventDefault(); close(); });
            layer.addEventListener('wheel', event => { if (!state?.description.contains(event.target)) event.preventDefault(); }, { passive: false });
            layer.addEventListener('keydown', event => {
                event.stopPropagation();
                if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault();
                if (event.key === 'Escape') { event.preventDefault(); close(); }
                if (event.key === 'Tab') {
                    const buttons = [...layer.querySelectorAll('button')].filter(button => !button.disabled), first = buttons[0], last = buttons.at(-1);
                    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
                    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
                }
            });
            document.body.append(layer); layer.showModal();
            mutations.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'open', 'data-game-tour-scope'] });
            state.resize?.observe(state.bubble); win.addEventListener('resize', schedule); document.addEventListener('scroll', schedule, true);
            show(0); return true;
        }
        const click = event => {
            if (state && !state.layer.contains(event.target)) { event.preventDefault(); event.stopImmediatePropagation(); return; }
            const trigger = event.target.closest?.('[data-game-tour-start]');
            if (!trigger || trigger.disabled) return;
            event.preventDefault(); event.stopImmediatePropagation(); start(trigger);
        };
        document.addEventListener('click', click, true);
        const controller = { start, close, destroy() { close(); document.removeEventListener('click', click, true); instances.delete(document); } };
        instances.set(document, controller); return controller;
    };
})(globalThis.ShenPulseGameWorkspace);
