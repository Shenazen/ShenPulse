import { LEGAL_PAGES } from '/app/legal-pages.js?v=20261016-web1'
import {
  ACTION_TYPES,
  APP_TABS,
  CLIENT_RELEASE,
  OVERLAY_TYPES,
  POPUP_GROUPS
} from '/content.js?v=20261016-web1'
import { GAMES } from '/game-catalog.js?v=20261016-web1'
import { productTour, screenshot, screenshotDialog, bindVisuals } from '/app/visual-tour.js?v=20261016-web1'
import { escapeHtml } from '/app/html.js?v=20261016-web1'

const app = document.querySelector('#app')
const DOWNLOAD_URL = '/downloads/ShenPulseSetup-2.0.3.exe'
const SITE_ORIGIN = 'https://www.shenpulse.leuridan.fr'
const RETIRED_ROUTES = ['/login', '/setup', '/admin', '/app']
let pageController = null
let pageObservers = []

const HOME_FAQ = [
  ['Est-ce un site ou une application ?', 'ShenPulse est une application Windows. Le site sert uniquement à présenter le logiciel, télécharger l’installateur et consulter la documentation.'],
  ['Faut-il ouvrir une page de configuration ?', 'Non. La connexion, la configuration, les abonnements et les jeux se gèrent exclusivement depuis l’application.'],
  ['Puis-je tester sans être en live ?', 'Oui. Le simulateur du tableau de bord et les boutons de test permettent de vérifier tes règles. Attention : les actions associées peuvent réellement lancer un média, un effet ou une machine IRL. Prépare une configuration de test sans risque.'],
  ['Comment ajouter un overlay ?', 'Configure-le dans ShenPulse, copie la source proposée, puis ajoute une source navigateur dans OBS ou une source Lien dans TikTok LIVE Studio. Respecte les dimensions indiquées et garde ShenPulse ouvert.'],
  ['Quelles fonctions nécessitent Pro ?', 'Jeux vidéo, Machines IRL, Commandes et Matchs nécessitent un accès Pro ou Premium actif. Certains modules de jeux demandent aussi un achat supplémentaire. Les prix et droits de ton compte sont présentés dans l’application.'],
  ['Mes profils sont-ils conservés ?', 'Oui, les profils et leurs réglages sont rattachés à ton compte sur ce PC, avec sauvegarde et restauration à la reconnexion. Cela ne constitue pas une synchronisation entre ordinateurs : conserve aussi tes exports.'],
  ['Dois-je configurer Backblaze pour importer un son ?', 'Non. Le stockage média est géré par ShenPulse pour tous les comptes connectés, sans clé Backblaze personnelle. Tu peux importer les formats autorisés depuis l’application, dans la limite indiquée au moment de l’import.'],
  ['Les commandes répondent-elles dans le chat ?', 'L’onglet Commandes reçoit des messages commençant par ! et exécute l’effet configuré : musique, action ou overlay. Il n’envoie pas de réponse textuelle automatique au chat.'],
  ['Quels jeux sont présentés ?', `Les ${GAMES.length} fiches du catalogue public de l’application. Les fiches de référence sont distinguées des intégrations exécutables ; une fiche seule ne garantit pas qu’un mod tiers est installé ou compatible.`]
]

renderCurrentRoute()
window.addEventListener('popstate', renderCurrentRoute)
document.addEventListener('click', handleNavigation)

function handleNavigation(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.target.closest('a[href]')
  if (!link || link.target || link.hasAttribute('download')) return
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return
  event.preventDefault()
  const samePage = normalizePath(url.pathname) === normalizePath(window.location.pathname) && url.search === window.location.search
  history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
  if (samePage && url.hash) scrollToCurrentHash({ focus: true })
  else renderCurrentRoute({ focusHash: Boolean(url.hash) })
  if (!url.hash) window.scrollTo({ top: 0, behavior: 'instant' })
}

function renderCurrentRoute({ focusHash = false } = {}) {
  const path = normalizePath(window.location.pathname)
  const route = RETIRED_ROUTES.some((retired) => path === retired || path.startsWith(`${retired}/`))
    ? 'retired'
    : path

  if (route === '/') renderPage(homePage(), 'ShenPulse — Interactions live, overlays et jeux', 'home')
  else if (route === '/docs') renderPage(docsPage(), 'Documentation complète — ShenPulse', 'docs')
  else if (LEGAL_PAGES[route]) renderPage(legalPage(LEGAL_PAGES[route]), `${LEGAL_PAGES[route].title} — ShenPulse`, 'legal')
  else if (route === 'retired') renderPage(retiredPage(), 'Fonction disponible dans l’application — ShenPulse', 'not-found')
  else renderPage(notFoundPage(), 'Page introuvable — ShenPulse', 'not-found')

  scrollToCurrentHash({ focus: focusHash })
}

function scrollToCurrentHash({ focus = false } = {}) {
  if (!window.location.hash) return
  let id = window.location.hash.slice(1)
  try { id = decodeURIComponent(id) } catch {}
  requestAnimationFrame(() => {
    const target = document.getElementById(id)
    if (target?.closest('[hidden]')) {
      // Un lien du sommaire reste utilisable après une recherche qui masquait sa cible.
      for (const input of document.querySelectorAll('#docs-search, #game-search')) input.value = ''
      document.querySelector('#docs-search')?.dispatchEvent(new Event('input', { bubbles: true }))
    }
    if (target instanceof HTMLDetailsElement) target.open = true
    target?.scrollIntoView()
    if (target && focus) {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1')
      target.focus({ preventScroll: true })
    }
    const sectionId = target?.closest('.doc-section')?.id || id
    requestAnimationFrame(() => {
      document.querySelectorAll('.docs-sidebar a[href^="#"]').forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${sectionId}`)
      })
    })
  })
}

function renderPage(content, title, pageClass) {
  document.querySelector('.screenshot-dialog[open]')?.close()
  pageController?.abort()
  pageObservers.forEach((observer) => observer.disconnect())
  pageObservers = []
  pageController = new AbortController()
  document.title = title
  document.documentElement.dataset.page = pageClass
  const canonical = `${SITE_ORIGIN}${normalizePath(window.location.pathname)}`
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', canonical)
  document.querySelector('meta[property="og:url"]')?.setAttribute('content', canonical)
  document.querySelector('meta[name="robots"]')?.setAttribute('content', pageClass === 'not-found' ? 'noindex,follow' : 'index,follow')
  app.innerHTML = `${header()}${content}${footer()}${screenshotDialog()}`
  app.querySelector('main')?.setAttribute('tabindex', '-1')
  bindPageBehaviors(pageClass)
}

function header() {
  return `
    <header class="site-header">
      <a class="brand" href="/" aria-label="ShenPulse — accueil">
        <img src="/brand/shenpulse-logo.png" alt="ShenPulse" width="315" height="64">
      </a>
      <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
      <nav id="site-nav" class="site-nav" aria-label="Navigation principale">
        <a href="/" ${active('/')}>Accueil</a>
        <a href="/docs" ${active('/docs')}>Documentation</a>
        <a class="button button--download" href="${DOWNLOAD_URL}" download>Télécharger <span>↓</span></a>
      </nav>
    </header>`
}

function footer() {
  return `
    <footer class="site-footer">
      <div class="footer-main">
        <a class="brand brand--footer" href="/"><img src="/brand/shenpulse-logo.png" alt="ShenPulse" width="315" height="64"></a>
        <p>STREAM · INTERACTIONS · ENSEMBLE<br>L’application Windows pour créer un live avec ta communauté.</p>
        <a class="button button--small" href="${DOWNLOAD_URL}" download>Télécharger pour Windows</a>
      </div>
      <nav aria-label="Liens utiles">
        <strong>Produit</strong>
        <a href="/docs">Documentation</a>
        <a href="/#decouvrir">Découvrir l’application</a>
        <a href="${DOWNLOAD_URL}" download>Téléchargement</a>
      </nav>
      <nav aria-label="Liens légaux">
        <strong>Légal</strong>
        <a href="/cgu">CGU</a>
        <a href="/cgv">CGV</a>
        <a href="/mentions-legales">Mentions légales</a>
        <a href="/confidentialite">Confidentialité</a>
        <a href="/cookies">Cookies</a>
      </nav>
      <div class="footer-bottom">
        <span>© 2026 ShenPulse</span>
        <span>Site public sans connexion ni configuration</span>
      </div>
    </footer>`
}

function homePage() {
  return `
    <main id="main">
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow"><span></span> ShenPulse ${CLIENT_RELEASE.version} · Pour les créateurs LIVE</div>
          <h1>Ton live.<em>Ta communauté aux commandes.</em></h1>
          <p class="hero-lead">Cadeaux, likes, messages : transforme les réactions reçues en sons, animations, jeux et interactions. Prépare ton show et pilote-le depuis une seule application Windows.</p>
          <div class="hero-actions">
            <a class="button button--primary" href="${DOWNLOAD_URL}" download>Télécharger ShenPulse <span>↓</span></a>
            <a class="button button--ghost" href="#decouvrir">Voir l’application <span>↓</span></a>
          </div>
          <dl class="hero-facts">
            <div><dt>Windows 10+</dt><dd>Application locale</dd></div>
            <div><dt>${GAMES.length} fiches</dt><dd>Jeux & modules publics</dd></div>
            <div><dt>Tes profils</dt><dd>Sauvegardés sur ce PC</dd></div>
          </dl>
        </div>
        <div class="hero-visual">
          <span class="visual-label">Aperçu de l’application</span>
          ${screenshot('/screenshots/home-public.png', 'L’accueil de ShenPulse 2.0.2', true)}
        </div>
      </section>

      <section class="trust-strip" aria-label="Fonctions principales">
        ${['TikTok LIVE', 'Actions & commandes', 'OBS & LIVE Studio', 'Musique & voix', 'Machines IRL'].map((item) => `<span>${item}</span>`).join('')}
      </section>

      ${productTour()}

      <section class="section intro-section" id="nouveautes">
        <div class="section-heading">
          <div><span class="eyebrow">Version ${CLIENT_RELEASE.version}</span><h2>${CLIENT_RELEASE.title}</h2></div>
          <p>${CLIENT_RELEASE.summary}</p>
        </div>
        <div class="workflow-grid">
          ${CLIENT_RELEASE.highlights.map(([title, copy], index) => `<article><span>${String(index + 1).padStart(2, '0')}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}
        </div>
      </section>

      <section class="section intro-section">
        <div class="section-heading">
          <div><span class="eyebrow">De l’idée au direct</span><h2>Prépare. Teste. Fais vivre ton show.</h2></div>
          <p>Un profil pour chaque univers, des réactions à ton image et des sources prêtes à rejoindre ton logiciel de diffusion.</p>
        </div>
        <div class="workflow-grid">
          ${[
            ['01', 'Choisis ton profil', 'Connecte ton compte ShenPulse, sélectionne ton profil et renseigne le @ TikTok à suivre.'],
            ['02', 'Compose tes interactions', 'Associe un cadeau ou un événement à un son, une animation, une commande ou un effet compatible.'],
            ['03', 'Vérifie tes sources', 'Ajoute les liens à OBS ou LIVE Studio, puis teste les réactions dans une configuration sans risque.']
          ].map(([number, title, copy]) => `<article><span>${number}</span><h3>${title}</h3><p>${copy}</p></article>`).join('')}
        </div>
      </section>

      <section class="section feature-section">
        <div class="section-heading">
          <div><span class="eyebrow">Conçu pour le direct</span><h2>Des fonctions qui travaillent ensemble.</h2></div>
          <a class="text-link" href="/docs#onglets">Explorer chaque onglet <span>→</span></a>
        </div>
        <div class="feature-grid">
          ${[
            ['bolt', 'Actions & commandes', 'Cadeaux, likes ou commandes ! : choisis l’événement et compose les effets, avec permissions et cooldowns.'],
            ['layers', 'Overlays & matchs', 'Objectifs, classements, roue, timers et réactions de match trouvent leur place dans ton habillage.'],
            ['music', 'Sons, voix & musique', 'Importe tes sons, prépare la synthèse vocale et configure les demandes musicales Spotify.'],
            ['game', 'Jeux & machines IRL', 'Relie les interactions compatibles à ta partie ou à tes prises PlugPlus, avec des tests sous ton contrôle.'],
            ['broadcast', 'OBS & LIVE Studio', 'Retrouve les liens de sources, les dimensions et les réglages utiles dans l’application.'],
            ['shield', 'Profils & communauté', 'Sépare tes configurations par profil et retrouve participants, contributions, rangs et blocages.']
          ].map(([icon, title, copy]) => `<article><span class="feature-icon" data-icon="${icon}"></span><h3>${title}</h3><p>${copy}</p></article>`).join('')}
        </div>
      </section>

      <section class="section showcase">
        <div class="showcase-copy">
          <span class="eyebrow">Jeux interactifs</span>
          <h2>Change de jeu, garde ton univers.</h2>
          <p>Explore les ${GAMES.length} fiches du catalogue public. Prérequis, installation et état des interactions sont indiqués pour chaque intégration.</p>
          <ul class="check-list">
            <li>Accès Pro ou Premium requis</li>
            <li>Interactions configurables et testables</li>
            <li>Une seule session de jeu active à la fois</li>
          </ul>
          <a class="button button--ghost" href="/docs#jeux">Explorer le catalogue public <span>→</span></a>
        </div>
        ${screenshot('/screenshots/games-public.png', 'Galerie publique des jeux ShenPulse')}
      </section>

      <section class="section split-showcase">
        <article>
          <div><span class="eyebrow">Matchs · Pro</span><h3>Le bon effet, au bon moment.</h3><p>Prépare tes widgets et automatisations de match, puis retrouve les sources prévues pour la diffusion.</p><a class="text-link" href="/docs#matchs">Comprendre les Matchs →</a></div>
          ${screenshot('/screenshots/matches-public.png', 'Matchs : tableau de bord et automatisations')}
        </article>
        <article>
          <div><span class="eyebrow">Ta communauté</span><h3>Plus que des chiffres.</h3><p>Participants, contributions et rangs : garde une vue claire de ton public et retrouve facilement les utilisateurs bloqués.</p><a class="text-link" href="/docs#utilisateurs">Découvrir les Utilisateurs →</a></div>
          ${screenshot('/screenshots/users-public.png', 'Utilisateurs : participants, contributions et rangs')}
        </article>
      </section>

      <section class="section split-showcase">
        <article>
          <div><span class="eyebrow">Sources navigateur</span><h3>Un habillage qui te ressemble.</h3><p>Configure couleurs, placement et visibilité, puis copie ta source dans OBS ou LIVE Studio.</p></div>
          ${screenshot('/screenshots/overlays-public.png', 'Galerie des overlays ShenPulse')}
        </article>
        <article>
          <div><span class="eyebrow">Actions</span><h3>Une logique lisible de bout en bout.</h3><p>Crée l’action, teste-la, puis ajoute son déclencheur. Les timers et roues peuvent réutiliser les mêmes actions.</p></div>
          ${screenshot('/screenshots/actions-public.png', 'Actions et déclencheurs ShenPulse')}
        </article>
      </section>

      <section class="section privacy-callout">
        <div>
          <span class="eyebrow">Site volontairement simple</span>
          <h2>Le show se prépare dans l’application.</h2>
          <p>Le site te guide, sans te demander de compte ni de paiement. Dans ShenPulse, chaque compte conserve ses profils sur son PC. Les imports de sons, images, GIF et vidéos utilisent le stockage géré, sans clé personnelle à configurer.</p>
        </div>
        <div class="privacy-list">
          <span><b>01</b> Connexion et offres dans l’application</span>
          <span><b>02</b> Médias importés pour tous les comptes connectés</span>
          <span><b>03</b> Site sans cookie publicitaire</span>
        </div>
      </section>

      <section class="section faq-section">
        <div class="section-heading"><div><span class="eyebrow">Questions fréquentes</span><h2>Les réponses avant l’installation.</h2></div></div>
        <div class="faq-list">${HOME_FAQ.map(([q, a], index) => `<details ${index === 0 ? 'open' : ''}><summary>${q}<span>+</span></summary><p>${a}</p></details>`).join('')}</div>
      </section>

      <section class="final-cta">
        <span class="eyebrow">Prêt pour le prochain live ?</span>
        <h2>Télécharge ShenPulse et construis ta première interaction.</h2>
        <div><a class="button button--primary" href="${DOWNLOAD_URL}" download>Télécharger pour Windows <span>↓</span></a><a class="text-link" href="/docs">Lire le guide de démarrage</a></div>
      </section>
    </main>`
}

function docsPage() {
  return `
    <main id="main" class="docs-page">
      <header class="docs-hero">
        <span class="eyebrow">Centre d’aide ShenPulse</span>
        <h1>Tout comprendre, du premier lancement au jeu en direct.</h1>
        <p>Retrouve les espaces créateur, les réglages et les parcours de ShenPulse ${CLIENT_RELEASE.version}. Les captures utilisent le vrai rendu de l’application avec des données de démonstration, sans compte personnel ni écran d’administration. Clique sur une image pour l’agrandir.</p>
        <label class="docs-search">
          <span aria-hidden="true">⌕</span>
          <input id="docs-search" type="search" aria-label="Rechercher dans la documentation" placeholder="Rechercher un onglet, un champ, un jeu ou un problème…" autocomplete="off">
          <kbd>Ctrl K</kbd>
        </label>
        <div class="docs-meta"><span><b>${APP_TABS.length}</b> espaces documentés</span><span><b>${POPUP_GROUPS.length}</b> fenêtres expliquées</span><span><b>${GAMES.length}</b> fiches jeux & modules</span></div>
      </header>

      <div class="docs-shell">
        <aside class="docs-sidebar">
          <strong>Dans ce guide</strong>
          <nav aria-label="Sommaire de la documentation">
            ${[
              ['demarrage', 'Démarrage rapide'],
              ['interface', 'Repères de l’interface'],
              ['profils-donnees', 'Comptes & profils'],
              ['medias-imports', 'Importer ses médias'],
              ['onglets', 'Tous les onglets'],
              ['actions-types', 'Types d’actions'],
              ['fenetres', 'Fenêtres et champs'],
              ['overlays-doc', 'Overlays & OBS'],
              ['jeux', 'Jeux interactifs'],
              ['diagnostic', 'Diagnostic'],
              ['securite', 'Sécurité & données']
            ].map(([id, label]) => `<a href="#${id}">${label}</a>`).join('')}
          </nav>
          <a class="button button--small" href="${DOWNLOAD_URL}" download>Télécharger ShenPulse</a>
        </aside>

        <div class="docs-content" id="docs-content">
          ${docSection('demarrage', 'Démarrage rapide', 'Le parcours conseillé pour préparer ton premier test, à ton rythme.', `
            <ol class="numbered-steps">
              ${[
                ['Télécharger et installer', `Utilise uniquement <a href="${DOWNLOAD_URL}" download>l’installateur officiel</a>. Ferme l’ancienne version avant de lancer la mise à jour.`],
                ['Ouvrir ou créer le compte', 'La fenêtre de connexion s’ouvre dans l’application. Confirme l’adresse e-mail si ShenPulse le demande.'],
                ['Choisir un profil', 'Le profil “Démarrage” est vierge. Crée un profil par jeu ou type d’émission si tu veux séparer tes réglages.'],
                ['Connecter TikTok', 'Dans la barre du haut, renseigne le @ public et lance la détection. Pour tester hors live, utilise le simulateur du tableau de bord.'],
                ['Créer une action', 'Dans Actions, choisis un type, complète les champs puis utilise Tester.'],
                ['Ajouter le déclencheur', 'Associe un cadeau, un like, un message ou un autre événement. Commence avec un cooldown simple.'],
                ['Ajouter l’overlay dans OBS', 'Dans Overlays, configure le rendu, copie l’URL et crée une source navigateur aux dimensions indiquées.'],
                ['Tester sans risque', 'Le simulateur peut exécuter les actions associées. Désactive les machines et effets sensibles avant le test, puis vérifie le Journal et le rendu de tes sources.']
              ].map(([title, copy], index) => `<li><span>${index + 1}</span><div><h3>${title}</h3><p>${copy}</p></div></li>`).join('')}
            </ol>
            <div class="callout callout--success"><strong>Ordre conseillé</strong><p>Action → test manuel → déclencheur → test cadeau → source OBS → session live. Cet ordre isole immédiatement l’étape qui pose problème.</p></div>
          `)}

          ${docSection('interface', 'Repères de l’interface', 'Les contrôles communs restent disponibles quel que soit l’onglet.', `
            ${screenshot('/screenshots/app-overview-public.png', 'Vue d’ensemble et barre supérieure de ShenPulse')}
            <div class="field-table">
              ${[
                ['Navigation latérale', 'Regroupe Pilotage, Création et Système. Le badge indique le nombre d’éléments lorsque c’est pertinent.'],
                ['Bannière de page', 'Présente l’espace en cours sans ajouter un deuxième en-tête à la barre supérieure.'],
                ['Compte ShenPulse', 'Identité connectée, abonnement actuel et menu du compte. Les droits ne dépendent pas du @ TikTok surveillé.'],
                ['Jeu actif', 'Ramène au jeu en cours ou arrête sa passerelle. Ce contrôle apparaît seulement pendant une session de jeu.'],
                ['Profil', 'Change l’espace de travail actif. Le bouton ••• ouvre la gestion des profils.'],
                ['Compte TikTok', 'Le champ de la barre supérieure reçoit le @ public et affiche l’état de connexion.'],
                ['Bouton de connexion', 'Connecter, En attente du live ou Déconnecter selon l’état du compte surveillé.'],
                ['État LIVE', 'Le badge est placé à côté du @ TikTok. Il ne remplace pas le contrôle des sources dans le logiciel de diffusion.'],
                ['Menu de compte', 'En haut à droite, indique l’abonnement et regroupe notamment le mode léger et la langue.'],
                ['Badges Pro', 'Jeux vidéo, Machines IRL, Commandes et Matchs nécessitent un accès Pro ou Premium actif.']
              ].map(fieldRow).join('')}
            </div>
            <div class="callout"><strong>À ne pas confondre</strong><p>Le compte ShenPulse possède tes réglages, le @ TikTok désigne le LIVE surveillé et la session de jeu ouvre une passerelle. Une connexion à ShenPulse seule ne garantit pas que les événements du LIVE sont reçus.</p></div>
          `)}

          ${docSection('profils-donnees', 'Ton compte, tes profils, tes réglages', 'Une configuration par univers, sans mélanger les comptes du même PC.', `
            <div class="field-table">
              ${[
                ['Compte ShenPulse', 'Possède les profils, les bibliothèques importées, les intégrations et les droits d’accès. Il est distinct du compte TikTok dont tu suis le LIVE.'],
                ['Profil actif', 'Restaure ses actions, déclencheurs, commandes, timers, overlays, réglages Matchs et interactions de jeux. Les préférences TTS et des demandes musicales suivent aussi le profil.'],
                ['Reconnexion sur ce PC', 'La sauvegarde locale retrouve les profils du compte et le profil précédemment sélectionné. Un autre utilisateur ne reçoit pas cette configuration.'],
                ['Changement de PC', 'Cette sauvegarde n’est pas une synchronisation cloud. Conserve un export avant une réinstallation ou un changement d’ordinateur. Les secrets locaux ne sont pas transférés par un export de profil.'],
                ['Sauvegardes', 'Les créations et modifications de profils sont enregistrées. Exporte régulièrement ton travail ; une copie encore présente est nécessaire pour récupérer des données déjà effacées.']
              ].map(fieldRow).join('')}
            </div>
            <div class="callout"><strong>Accès aux réglages d’infrastructure</strong><p>Administration, Contrôleurs et Paramètres sont réservés au propriétaire ShenPulse. Un abonnement Pro ne donne pas ces accès. Les réglages créateur utiles restent dans leurs espaces dédiés.</p></div>
          `)}

          ${docSection('medias-imports', 'Importer tes sons, images et vidéos', 'Le stockage est géré par ShenPulse pour tous les comptes connectés.', `
            <ol class="compact-steps">
              <li>Connecte-toi à ton compte ShenPulse.</li>
              <li>Dans <b>Voix & sons</b>, utilise <b>Importer un son</b>, ou ouvre le sélecteur média de l’effet à configurer.</li>
              <li>Choisis un fichier dont tu possèdes les droits, dans un format accepté.</li>
              <li>Attends la fin du transfert avant de sélectionner le média dans ton action ou ton alerte.</li>
              <li>Teste la bonne sortie : écoute locale ou source audio/média LIVE.</li>
            </ol>
            <div class="callout callout--success"><strong>Aucune clé Backblaze personnelle</strong><p>Les sons, images, GIF et vidéos importés utilisent le stockage géré. Une connexion Internet est nécessaire pour l’import et la lecture d’un média distant. La taille et les formats autorisés sont contrôlés à l’import.</p></div>
            ${screenshot('/screenshots/sounds-public.png', 'Voix & sons : bibliothèque et alertes compactes')}
          `)}

          ${docSection('onglets', 'Tous les onglets utilisateur', 'Chaque zone et chaque contrôle important est détaillé ici.', `
            <div class="docs-card-grid tabs-docs">
              ${APP_TABS.map((tab) => `
                <article class="doc-card doc-searchable" id="${tab.id}" data-search="${escapeHtml(searchText(tab))}">
                  <header><span>${tab.group}</span><h3>${tab.title}</h3><p>${tab.summary}</p></header>
                  <dl>${tab.parts.map(([term, desc]) => `<div><dt>${term}</dt><dd>${desc}</dd></div>`).join('')}</dl>
                  <div class="tips"><strong>Bon à savoir</strong>${tab.tips.map((tip) => `<p>• ${tip}</p>`).join('')}</div>
                </article>`).join('')}
            </div>
            <div class="docs-gallery">
              ${screenshot('/screenshots/actions-public.png', 'Onglet Actions et déclencheurs')}
              ${screenshot('/screenshots/commands-public.png', 'Commandes : effets, permissions et cooldowns')}
              ${screenshot('/screenshots/irl-public.png', 'Machines IRL : prises et interactions en listes')}
              ${screenshot('/screenshots/music-public.png', 'Musique : lecture et demandes de titres')}
              ${screenshot('/screenshots/matches-public.png', 'Matchs : statistiques, widgets et automatisations')}
              ${screenshot('/screenshots/users-public.png', 'Utilisateurs : contributions, rangs et blocages')}
              ${screenshot('/screenshots/subscription-public.png', 'Onglet Abonnement')}
            </div>
          `)}

          ${docSection('actions-types', 'Types d’actions', 'Le type choisi détermine les champs qui apparaissent dans l’éditeur.', `
            <div class="field-table action-types">
              ${ACTION_TYPES.map(fieldRow).join('')}
            </div>
            <div class="callout callout--warning"><strong>Actions avancées</strong><p>Les requêtes HTTP, messages WebSocket, commandes OBS et raccourcis clavier peuvent agir sur d’autres logiciels. Vérifie l’URL, le JSON, la connexion et l’autorisation avant le live.</p></div>
          `)}

          ${docSection('fenetres', 'Fenêtres, popups et champs', 'Les boutons Annuler et Enregistrer ferment le formulaire. Une erreur de validation apparaît dans le pied de la fenêtre sans effacer la saisie.', `
            <div class="accordion-list">
              ${POPUP_GROUPS.map((popup, index) => `
                <details class="doc-searchable" id="${popup.id}" data-search="${escapeHtml(searchText(popup))}" ${index < 2 ? 'open' : ''}>
                  <summary><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${popup.title}</h3><p>${popup.purpose}</p></div><b>+</b></summary>
                  <div class="field-table">${popup.fields.map(fieldRow).join('')}</div>
                </details>`).join('')}
            </div>
            <div class="callout"><strong>Bibliothèques et catalogues</strong><p>Les sélecteurs de cadeaux, sons et médias acceptent une recherche. Écoute ou prévisualise l’élément avant de le valider ; un nom identique ne garantit pas le même fichier.</p></div>
          `)}

          ${docSection('overlays-doc', 'Overlays, OBS et TikTok LIVE Studio', 'Chaque source a son propre usage et ses dimensions recommandées.', `
            ${screenshot('/screenshots/overlays-public.png', 'Overlays et widgets dans ShenPulse')}
            <div class="field-table overlay-types">${OVERLAY_TYPES.map(([name, use, size]) => fieldRow([name, `${use} Taille conseillée : ${size}.`])).join('')}</div>
            <h3 class="subheading">Ajouter une source dans OBS</h3>
            <ol class="compact-steps">
              <li>Dans ShenPulse, ouvre <b>Overlays</b>, choisis la carte et clique sur <b>Configurer</b>.</li>
              <li>Règle le thème, le contenu, le placement et la visibilité. Contrôle l’aperçu.</li>
              <li>Copie l’URL et note la largeur et la hauteur indiquées.</li>
              <li>Dans OBS, ajoute une <b>Source navigateur</b>, colle l’URL et saisis les dimensions.</li>
              <li>Si la source doit repartir à zéro à chaque scène, active le rafraîchissement lorsque la scène devient active.</li>
              <li>Utilise le simulateur ShenPulse pour vérifier l’affichage et le son.</li>
            </ol>
            <div class="callout"><strong>Animations de Matchs dans TikTok LIVE Studio</strong><p>Dans Matchs → Widgets, utilise « Copier pour TikTok Studio » puis colle le lien dans une source Lien. Configure et active tes effets dans Automatisations. Garde ShenPulse ouvert sur le même PC : les vidéos protégées sont lues localement, sans fichier exporté. Les animations contiennent leur son ; les aperçus dans ShenPulse restent muets. Vérifie aussi le volume de la source dans le mélangeur de Studio.</p></div>
            <div class="callout callout--warning"><strong>Un widget peut être vide au repos</strong><p>Active une automatisation et sélectionne un effet avant de le tester. Certaines sources ne s’affichent qu’au déclenchement de l’événement. La détection d’un match dépend des événements que TikTok transmet réellement à ShenPulse.</p></div>
            <h3 class="subheading">Champs communs des overlays</h3>
            <div class="field-table">
              ${[
                ['Échelle', 'Change la taille du rendu à l’intérieur de la source, pas la taille de la source OBS.'],
                ['Décalage X / Y', 'Valeur négative vers la gauche ou le haut ; positive vers la droite ou le bas.'],
                ['Accent / secondaire / texte / fond', 'Couleurs des éléments générés par ShenPulse. Un texte intégré dans une image ne change pas.'],
                ['Opacité du fond', 'De transparent à opaque.'],
                ['Police / taille', 'Affecte les textes générés.'],
                ['Saturation / teinte', 'Modifie le rendu entier, design compris.'],
                ['Visible au repos', 'Garde ou masque l’overlay lorsqu’aucun événement n’est actif.'],
                ['Éléments visibles', 'Titre, objectif, rang, avatars, badges, pourcentage, ombre ou métrique selon le type.']
              ].map(fieldRow).join('')}
            </div>
          `)}

          ${docSection('jeux', 'Jeux et effets interactifs', `Cette section reprend les ${GAMES.length} cartes actuellement visibles dans la galerie publique de ShenPulse.`, `
            ${screenshot('/screenshots/games-public.png', 'Galerie publique des jeux et effets')}
            <div class="game-legend"><span><i class="status-dot status-dot--active"></i> Interactions exécutables</span><span><i class="status-dot"></i> Fiche de référence</span></div>
            <label class="game-search"><span>⌕</span><input id="game-search" type="search" aria-label="Filtrer les fiches de jeux" placeholder="Filtrer les ${GAMES.length} fiches…"><b id="game-count">${GAMES.length}</b></label>
            <div class="game-doc-grid" id="game-doc-grid">
              ${GAMES.map((game, index) => `
                <details class="game-doc doc-searchable" id="jeu-${escapeHtml(game.id)}" data-game="${escapeHtml(searchText(game))}" data-search="${escapeHtml(searchText(game))}">
                  <summary>
                    <span class="game-index">${String(index + 1).padStart(2, '0')}</span>
                    <div><small>${escapeHtml(game.type)}</small><h3>${escapeHtml(game.name)}</h3><p>${game.interactions} interaction${game.interactions > 1 ? 's' : ''}${game.status === 'Référence' ? ' référencées' : ''}</p></div>
                    <span class="game-status ${game.status === 'Exécutable' ? 'is-active' : 'is-reference'}">${escapeHtml(game.status)}</span>
                  </summary>
                  <div class="game-detail">
                    <div class="game-guide-heading">
                      <div><small>Présentation du jeu</small><p class="game-description">${escapeHtml(game.description)}</p></div>
                      <a class="game-guide-link" href="#jeu-${escapeHtml(game.id)}" aria-label="Lien direct vers le guide ${escapeHtml(game.name)}">Lien direct</a>
                    </div>
                    <div class="game-guide-grid">
                      <article><small>Expérience en direct</small><p>${escapeHtml(game.interactionGuide)}</p></article>
                      <article><small>Prérequis</small><p>${escapeHtml(game.requirements)}</p></article>
                    </div>
                    <h4>Mise en route</h4>
                    <ol>${game.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol>
                    ${game.note ? `<p class="game-note"><b>À savoir :</b> ${escapeHtml(game.note)}</p>` : ''}
                    <p><b>${game.status === 'Exécutable' ? 'Test conseillé' : 'Avant utilisation'} :</b> ${game.status === 'Exécutable' ? 'démarre la passerelle, utilise un effet simple, vérifie le Journal, puis teste un effet avec durée ou file d’attente.' : 'suis le guide lié dans l’application et installe une passerelle compatible avant de considérer les effets comme disponibles.'}</p>
                  </div>
                </details>`).join('')}
            </div>
            <div class="callout callout--warning"><strong>Sauvegardes et compatibilité</strong><p>Ferme le jeu avant toute installation. Conserve les sauvegardes créées par ShenPulse et désactive les autres mods lors du premier test. Les mises à jour d’un jeu peuvent rendre un pack temporairement incompatible.</p></div>
          `)}

          ${docSection('diagnostic', 'Diagnostic et problèmes fréquents', 'Lis d’abord le Journal : la première erreur explique souvent toutes les suivantes.', `
            <div class="troubleshooting-grid">
              ${[
                ['Le live n’est pas détecté', ['Vérifie le @ sans faute.', 'Confirme que le compte est publiquement en direct.', 'Arrête puis relance la détection.', 'Teste le mode Démo pour isoler la connexion.']],
                ['Une action ne part pas', ['Vérifie l’interrupteur de la règle.', 'Contrôle le type, les conditions et le seuil.', 'Attends la fin du cooldown.', 'Utilise Tester sur l’action puis sur la règle.']],
                ['L’overlay est vide', ['Garde ShenPulse ouvert et connecté.', 'Recharge la source de diffusion.', 'Vérifie le bon profil, l’activation du widget et le lien copié.', 'Teste un événement compatible sans effet dangereux.']],
                ['Le jeu ne réagit pas', ['Vérifie qu’une seule session de jeu est active.', 'Contrôle le port ou l’URL de la passerelle.', 'Teste un effet marqué exécutable.', 'Compare la version du jeu et du mod.']],
                ['Pas de son ou de voix', ['Teste la piste dans la bibliothèque.', 'Vérifie le volume ShenPulse et Windows.', 'Contrôle la voix système.', 'Vérifie les filtres TTS.']],
                ['OBS ne répond pas', ['Active le serveur OBS WebSocket dans OBS.', 'Vérifie la configuration de la connexion autorisée.', 'Contrôle l’action et son résultat dans le Journal.', 'Pour un réglage d’infrastructure indisponible, contacte le support.']],
                ['Spotify est déconnecté', ['Ouvre les réglages de Musique.', 'Vérifie la configuration et l’autorisation Spotify.', 'Confirme les prérequis du compte Spotify.', 'Garde un appareil de lecture actif.']],
                ['Une commande ! ne part pas', ['Vérifie le bon profil et l’accès Pro.', 'Contrôle le nom, les alias et la plateforme.', 'Vérifie le rôle requis et les cooldowns.', 'Vérifie que l’action liée existe et est active dans ce profil.']],
                ['Un import échoue', ['Vérifie la connexion au compte et à Internet.', 'Contrôle le format et la taille du fichier.', 'Réessaie avec la dernière version de ShenPulse.', 'Note le message exact pour le support, sans partager de jeton.']],
                ['Après une mise à jour', ['Exporte les profils avant si possible.', 'Installe la dernière version.', 'Reconnecte le même compte sur le même PC.', 'Vérifie le profil actif avant de relancer les effets.']]
              ].map(([title, steps]) => `<article class="doc-searchable" data-search="${escapeHtml(searchText([title, steps]))}"><h3>${title}</h3><ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol></article>`).join('')}
            </div>
          `)}

          ${docSection('securite', 'Sécurité, données et bonnes pratiques', 'ShenPulse privilégie les services locaux et limite les secrets exposés à l’interface.', `
            <div class="security-grid">
              ${[
                ['Secrets', 'Ne partage jamais jeton API, mot de passe OBS/RCON, clé de stockage ou jeton de plateforme. Laisse le champ secret vide pour conserver une valeur existante.'],
                ['Profils', 'Exporte régulièrement les profils. L’import remplace ou restaure une configuration : vérifie le fichier avant validation.'],
                ['API locale', 'Elle écoute uniquement sur la machine et exige un jeton. N’ouvre pas les ports locaux sur Internet.'],
                ['Médias', 'Utilise uniquement des sons, images et vidéos dont tu possèdes les droits ou une licence adaptée.'],
                ['Jeux', 'Teste sur une sauvegarde non critique et ferme le jeu avant de modifier son dossier.'],
                ['Vie privée du live', 'Les pseudonymes et messages sont des données personnelles. Ne publie pas un journal complet sans le relire.']
              ].map(([title, copy]) => `<article><span></span><h3>${title}</h3><p>${copy}</p></article>`).join('')}
            </div>
            <div class="callout callout--success"><strong>Avant chaque live</strong><p>Bon profil, bon @, règles utiles activées, cooldowns vérifiés, sources OBS visibles, jeu testé, volume contrôlé et Journal sans erreur.</p></div>
          `)}

          <p class="docs-empty" id="docs-empty" hidden>Aucun résultat dans la documentation. Essaie un nom d’onglet, de champ ou de jeu.</p>
        </div>
      </div>
    </main>`
}

function legalPage(page) {
  return `
    <main id="main" class="legal-page">
      <header class="legal-hero">
        <span class="eyebrow">${page.eyebrow}</span>
        <h1>${page.title}</h1>
        <p>${page.intro}</p>
        <small>Version en vigueur au ${page.updatedAt || '30 juillet 2026'}</small>
      </header>
      <div class="legal-layout">
        <aside>
          <strong>Documents</strong>
          ${Object.entries(LEGAL_PAGES).map(([path, item]) => `<a href="${path}" ${active(path)}>${item.title}</a>`).join('')}
        </aside>
        <article>
          ${page.sections.map(([title, paragraphs], index) => `
            <section id="legal-${index + 1}">
              <span>${String(index + 1).padStart(2, '0')}</span>
              <div><h2>${title}</h2>${paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join('')}</div>
            </section>`).join('')}
          <div class="legal-contact"><strong>Une question sur ce document ?</strong><a href="mailto:alexandre.leuridan@gmail.com">alexandre.leuridan@gmail.com</a></div>
        </article>
      </div>
    </main>`
}

function retiredPage() {
  return `
    <main id="main" class="message-page">
      <span class="message-code">APPLICATION</span>
      <h1>Cette fonction est disponible uniquement dans ShenPulse.</h1>
      <p>La connexion, la configuration, les abonnements et les jeux ne sont plus accessibles depuis le site public. Ouvre l’application Windows pour continuer.</p>
      <div><a class="button button--primary" href="${DOWNLOAD_URL}" download>Télécharger ShenPulse</a><a class="button button--ghost" href="/docs">Consulter la documentation</a></div>
    </main>`
}

function notFoundPage() {
  return `
    <main id="main" class="message-page">
      <span class="message-code">404</span>
      <h1>Cette page n’existe pas.</h1>
      <p>Retourne à l’accueil ou ouvre la documentation complète de ShenPulse.</p>
      <div><a class="button button--primary" href="/">Retour à l’accueil</a><a class="button button--ghost" href="/docs">Documentation</a></div>
    </main>`
}

function docSection(id, title, intro, body) {
  return `<section class="doc-section doc-searchable-section" id="${id}"><header><span class="section-index">#</span><div><h2>${title}</h2><p>${intro}</p></div></header><div class="section-body">${body}</div></section>`
}

function fieldRow([term, description]) {
  return `<div><dt>${term}</dt><dd>${description}</dd></div>`
}

function bindPageBehaviors(pageClass) {
  const signal = pageController.signal
  bindVisuals(app, signal)
  const menuButton = document.querySelector('.menu-toggle')
  const siteNav = document.querySelector('#site-nav')
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') === 'true'
    menuButton.setAttribute('aria-expanded', String(!open))
    siteNav?.classList.toggle('is-open', !open)
  })

  if (pageClass === 'home') bindHomeMotion()
  if (pageClass !== 'docs') return

  const docsSearch = document.querySelector('#docs-search')
  const searchable = [...document.querySelectorAll('.doc-searchable')]
  const sections = [...document.querySelectorAll('.doc-searchable-section')]
  const empty = document.querySelector('#docs-empty')
  const gameSearch = document.querySelector('#game-search')
  const games = [...document.querySelectorAll('.game-doc')]
  const gameCount = document.querySelector('#game-count')

  const applySearch = () => {
    const query = normalizeSearch(docsSearch.value)
    const gameQuery = normalizeSearch(gameSearch?.value)
    let visibleCount = 0
    searchable.forEach((element) => {
      const globalMatches = !query || normalizeSearch(element.dataset.search || element.textContent).includes(query)
      const gameMatches = !element.matches('.game-doc') || !gameQuery || normalizeSearch(element.dataset.game).includes(gameQuery)
      const visible = globalMatches && gameMatches
      element.hidden = !visible
      if (visible) visibleCount += 1
    })
    let visibleSections = 0
    sections.forEach((section) => {
      const ownMatches = !query || normalizeSearch(section.textContent).includes(query)
      const childVisible = [...section.querySelectorAll('.doc-searchable')].some((item) => !item.hidden)
      section.hidden = Boolean(query) && !ownMatches && !childVisible
      if (!section.hidden) visibleSections += 1
    })
    if (gameCount) gameCount.textContent = String(games.filter((game) => !game.hidden).length)
    if (empty) empty.hidden = visibleCount > 0 || visibleSections > 0 || !query
  }
  docsSearch?.addEventListener('input', applySearch, { signal })
  gameSearch?.addEventListener('input', applySearch, { signal })

  document.addEventListener('keydown', focusDocsSearch, { signal })

  const docSections = [...document.querySelectorAll('.doc-section')]
  const highlightCurrentSection = () => {
    const probe = Math.min(window.innerHeight * 0.35, 360)
    let current = docSections[0]
    docSections.forEach((section) => {
      if (section.getBoundingClientRect().top <= probe) current = section
    })
    if (!current) return
    document.querySelectorAll('.docs-sidebar a[href^="#"]').forEach((link) => {
      link.classList.toggle('is-active', link.getAttribute('href') === `#${current.id}`)
    })
  }
  const observer = new IntersectionObserver(
    highlightCurrentSection,
    { rootMargin: '-80px 0px -75%', threshold: [0, 0.05, 0.2] }
  )
  pageObservers.push(observer)
  docSections.forEach((section) => observer.observe(section))
  highlightCurrentSection()
}

function bindHomeMotion() {
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return

  const targets = [...document.querySelectorAll([
    '.trust-strip',
    '.section-heading',
    '.workflow-grid article',
    '.feature-grid article',
    '.showcase-copy',
    '.showcase .app-shot',
    '.split-showcase > article',
    '.privacy-callout > *',
    '.faq-list details',
    '.final-cta > *'
  ].join(','))]

  targets.forEach((element, index) => {
    element.classList.add('reveal')
    element.style.setProperty('--reveal-delay', `${(index % 3) * 70}ms`)
  })

  if (!('IntersectionObserver' in window)) {
    targets.forEach((element) => element.classList.add('is-visible'))
    return
  }

  const revealObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('is-visible')
        revealObserver.unobserve(entry.target)
      })
    },
    { rootMargin: '0px 0px -10%', threshold: 0.1 }
  )
  pageObservers.push(revealObserver)

  targets.forEach((element) => revealObserver.observe(element))
}

function focusDocsSearch(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    document.querySelector('#docs-search')?.focus()
  }
}

function active(path) {
  return normalizePath(window.location.pathname) === path ? 'aria-current="page"' : ''
}

function normalizePath(path) {
  const normalized = String(path || '/').replace(/\/+$/, '')
  return normalized || '/'
}

function normalizeSearch(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function searchText(value) {
  return normalizeSearch(JSON.stringify(value))
}
