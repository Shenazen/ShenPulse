"use strict";
/** Mises à jour locales de la page : les composants inchangés et les iframes restent montés. */
(function (C) {
    const key = node => node.nodeType === 1 ? ['id', 'data-rule', 'data-row-action', 'data-pack'].map(name => node.getAttribute(name) || '').join('|') : '';
    const compatible = (a, b) => a && b && a.nodeType === b.nodeType && a.nodeName === b.nodeName && key(a) === key(b);
    const containsFrame = node => node.nodeType === 1 && (node.tagName === 'IFRAME' || node.querySelector('iframe'));
    C.patchPage = function (root, previousMarkup, nextMarkup) {
        const live = root.querySelector('.game-pack-workspace');
        if (!live) return false;
        const document = root.ownerDocument, before = document.createElement('template'), after = document.createElement('template');
        before.innerHTML = previousMarkup; after.innerHTML = nextMarkup;
        const previous = before.content.querySelector('.game-pack-workspace'), next = after.content.querySelector('.game-pack-workspace');
        if (!previous || !next || !live || !previous.dataset.gameTourScope || previous.dataset.gameTourScope !== next.dataset.gameTourScope || live.dataset.gameTourScope !== next.dataset.gameTourScope || previous.dataset.gamePack !== next.dataset.gamePack || live.dataset.gamePack !== next.dataset.gamePack) return false;
        // Un changement hors de ce composant relève du rendu normal de l’application.
        previous.replaceWith(document.createComment('game-workspace')); next.replaceWith(document.createComment('game-workspace'));
        if (before.innerHTML !== after.innerHTML) return false;
        const operations = [];
        function replace(old, replacement) {
            if (containsFrame(old)) return false;
            operations.push(() => old.replaceWith(replacement.cloneNode(true))); return true;
        }
        function plan(old, replacement, current) {
            if (!compatible(old, current)) return false;
            if (old.isEqualNode(replacement)) return true;
            if (!compatible(old, replacement)) return replace(current, replacement);
            if (old.nodeType !== 1) { operations.push(() => { current.nodeValue = replacement.nodeValue; }); return true; }
            if (old.tagName === 'IFRAME' && old.getAttribute('src') !== replacement.getAttribute('src')) return false;
            const oldChildren = [...old.childNodes], newChildren = [...replacement.childNodes], liveChildren = [...current.childNodes];
            if (oldChildren.length !== newChildren.length || oldChildren.length !== liveChildren.length) return replace(current, replacement);
            for (const name of new Set([...old.getAttributeNames(), ...replacement.getAttributeNames()])) {
                const value = replacement.getAttribute(name);
                if (old.getAttribute(name) === value) continue;
                operations.push(() => {
                    const drafting = document.activeElement === current && (current.tagName === 'INPUT' || current.tagName === 'TEXTAREA') && current.value !== (old.getAttribute('value') || '');
                    if (value === null) current.removeAttribute(name); else current.setAttribute(name, value);
                    if (name === 'value' && 'value' in current && !drafting) current.value = value || '';
                    if (name === 'checked' && 'checked' in current) current.checked = value !== null;
                    if (name === 'selected' && 'selected' in current) current.selected = value !== null;
                });
            }
            for (let i = 0; i < oldChildren.length; i++) if (!plan(oldChildren[i], newChildren[i], liveChildren[i])) return false;
            return true;
        }
        if (!plan(previous, next, live)) return false;
        // Validation de tout l’arbre avant la première modification : aucun rendu partiel en cas de repli.
        for (const operation of operations) operation();
        return true;
    };
})(globalThis.ShenPulseGameWorkspace);
