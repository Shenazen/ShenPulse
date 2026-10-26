"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const directory = path.join(__dirname, '../src/renderer/app/features/games/workspace');
function fixture(t, extra = []) {
    const dom = new JSDOM('<button id="global-connect">Connecter</button><main id="content"><div class="game-pack-workspace" data-game-pack="orchard" data-game-tour-scope="profile-a"><button id="install">Installer</button><button id="gift">Cadeau</button><button id="hidden" hidden>Indisponible</button><div id="help"></div></div></main>', { runScripts: 'outside-only', pretendToBeVisual: true });
    t.after(() => dom.window.close()); const { document } = dom.window;
    Object.defineProperty(dom.window, 'snapshot', { get() { throw Error('La visite ne doit pas lire ni écrire les réglages'); } });
    for (const file of ['core','sections','tour']) dom.window.eval(fs.readFileSync(path.join(directory, file + '.js'), 'utf8'));
    const proto = dom.window.HTMLElement.prototype;
    proto.scrollIntoView = function () { this.dataset.revealed = 'true'; };
    proto.getBoundingClientRect = function () { return { left: 140, top: 200, right: 300, bottom: 245, width: 160, height: 45 }; };
    proto.getClientRects = function () { return this.hidden ? [] : [this.getBoundingClientRect()]; };
    dom.window.HTMLDialogElement.prototype.showModal = function () { this.open = true; this.dataset.modal = 'true'; };
    dom.window.HTMLDialogElement.prototype.close = function () { this.open = false; };
    const C = dom.window.ShenPulseGameWorkspace, root = document.querySelector('.game-pack-workspace');
    const steps = [{ target:'#install',title:'Installer',text:'Fermez le jeu avant l’installation.' }, { target:'#hidden',title:'À ignorer',text:'Invisible' }, { target:'#missing',title:'À ignorer aussi',text:'Absente' }, { targets:['#missing','#gift'],title:'Cadeau',text:'Choisissez votre cadeau.' }, ...extra];
    const ctx = C.createContext({ pack:{id:'orchard',name:'Verger'}, tour:{steps} });
    document.querySelector('#help').innerHTML = C.renderTourEntry(ctx);
    const trigger = document.querySelector('[data-game-tour-start]'), controller = C.createGuidedTour(document);
    t.after(() => controller.destroy());
    return { dom, document, C, root, trigger, controller, dialog:() => document.querySelector('.game-tour-layer'), wait:() => new Promise(resolve => setTimeout(resolve, 45)) };
}
test('la visite est modale, filtre les cibles absentes, navigue sans déclencher les boutons du jeu et rend le focus', t => {
    const f = fixture(t); let calls = 0; f.document.querySelector('#install').addEventListener('click', () => calls++);
    f.trigger.click(); assert.equal(f.dialog().open, true); assert.equal(f.dialog().dataset.modal, 'true');
    assert.equal(f.dialog().querySelector('.game-tour-counter').textContent, 'Étape 1 sur 2');
    assert.equal(f.dialog().querySelector('.game-tour-previous').disabled, true);
    f.document.querySelector('#install').click(); assert.equal(calls, 0, 'les actions métier restent bloquées même si un clic est envoyé par code');
    f.dialog().querySelector('.game-tour-next').click(); assert.equal(f.dialog().querySelector('h2').textContent, 'Cadeau');
    assert.equal(f.dialog().querySelector('.game-tour-next').textContent, 'Terminer');
    f.dialog().querySelector('.game-tour-previous').click(); assert.equal(f.dialog().dataset.step, '1');
    f.dialog().querySelector('.game-tour-next').click(); f.dialog().querySelector('.game-tour-next').click();
    assert.equal(f.dialog(), null); assert.equal(f.document.activeElement, f.trigger);
    f.document.querySelector('#install').click(); assert.equal(calls, 1, 'les boutons redeviennent utilisables après la visite');
});
test('Échap, Annuler natif et Quitter ferment sans conserver de couche bloquante', t => {
    const f = fixture(t);
    for (const quit of [dialog => dialog.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{ key:'Escape',bubbles:true,cancelable:true })), dialog => dialog.dispatchEvent(new f.dom.window.Event('cancel',{ cancelable:true })), dialog => dialog.querySelector('.game-tour-exit').click(), dialog => dialog.querySelector('.game-tour-close').click()]) {
        f.trigger.click(); quit(f.dialog()); assert.equal(f.dialog(), null);
    }
    assert.equal(f.C.createGuidedTour(f.document), f.controller, 'un seul gestionnaire de visite par document');
});
test('la visite retient les cibles globales explicites et échappe les textes', t => {
    const attack='<img src=x onerror=bad()>';
    const f = fixture(t,[{target:'#global-connect',global:true,title:attack,text:attack}]);
    f.trigger.click(); f.dialog().querySelector('.game-tour-next').click(); f.dialog().querySelector('.game-tour-next').click();
    assert.equal(f.dialog().querySelector('h2').textContent,attack); assert.equal(f.dialog().querySelectorAll('img,[onerror]').length,0);
    assert.equal(f.document.querySelector('#global-connect').dataset.revealed,'true');
});
test('un nouveau rendu du même profil recible la visite ; changer de profil la ferme', async t => {
    const f = fixture(t); f.trigger.click();
    const replacement = f.root.cloneNode(true); f.root.replaceWith(replacement); await f.wait();
    assert.ok(f.dialog()); assert.equal(replacement.querySelector('#install').dataset.revealed,'true');
    replacement.dataset.gameTourScope='profile-b'; await f.wait(); assert.equal(f.dialog(),null);
});
test('quitter la page ferme la visite et restaure la position de lecture', async t => {
    const f=fixture(t), main=f.document.querySelector('main');
    Object.defineProperty(main,'scrollHeight',{value:2000}); Object.defineProperty(main,'clientHeight',{value:500}); main.scrollTop=430;
    f.trigger.click(); main.scrollTop=800; f.controller.close(); assert.equal(main.scrollTop,430);
    f.trigger.click(); f.root.remove(); await f.wait(); assert.equal(f.dialog(),null);
});
test('les cibles qui disparaissent sont ignorées sans accès à une autre page', async t => {
    const f=fixture(t); f.trigger.click(); f.document.querySelector('#install').remove(); await f.wait();
    assert.equal(f.dialog().querySelector('h2').textContent,'Cadeau');
    f.document.querySelector('#gift').remove(); await f.wait(); assert.equal(f.dialog(),null);
});
test('Tab reste dans la bulle et une définition invalide ne bloque pas l’application', t => {
    const f=fixture(t); f.trigger.click(); const last=f.dialog().querySelector('.game-tour-exit'); last.focus();
    last.dispatchEvent(new f.dom.window.KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));
    assert.equal(f.document.activeElement,f.dialog().querySelector('.game-tour-close'));
    f.controller.close(); f.trigger.dataset.gameTourSteps='invalid'; assert.equal(f.controller.start(f.trigger),false); assert.equal(f.dialog(),null);
});
test('la bulle reste dans la fenêtre et évite la cible dès que la place le permet', t => {
    const f=fixture(t);
    for(const width of [320,480,768,1280,1920]) for(const height of [360,600,900]) {
        const target={left:18,top:110,right:Math.min(width-18,280),bottom:160,width:Math.min(width-36,262),height:50};
        const p=f.C.tourPlacement({width,height},target,{width:370,height:290});
        assert.ok(p.left>=12); assert.ok(p.top>=12); assert.ok(p.left+p.width<=width-12); assert.ok(p.top+p.height<=height-12);
        if(p.side!=='docked') assert.ok(p.left>=target.right||p.left+p.width<=target.left||p.top>=target.bottom||p.top+p.height<=target.top);
    }
});


test('la visite reste disponible en consultation et ne déverrouille aucune commande métier', t => {
    const f=fixture(t), source=fs.readFileSync(path.join(__dirname,'../src/renderer/app/core/access-navigation.js'),'utf8');
    f.dom.window.isAccountAuthenticated=()=>false;f.dom.window.GUEST_BROWSING_ACTIONS=new Set();
    const begin=source.indexOf('function applyGuestReadOnlyMode('),end=source.indexOf('function requireAccountForAction(',begin);
    f.dom.window.eval(source.slice(begin,end));f.dom.window.applyGuestReadOnlyMode(f.root);
    assert.equal(f.trigger.disabled,false);assert.equal(f.document.querySelector('#install').disabled,true);
    f.trigger.click();assert.ok(f.dialog());
});


test('une fermeture native tardive ne ferme pas une nouvelle visite', t => {
 const f=fixture(t);f.trigger.click();const old=f.dialog();f.controller.close();f.trigger.click();const current=f.dialog();old.dispatchEvent(new f.dom.window.Event('close'));assert.equal(f.dialog(),current);
 current.close();current.dispatchEvent(new f.dom.window.Event('close'));assert.equal(f.dialog(),null);
});
