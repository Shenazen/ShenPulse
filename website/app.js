import {
  ACTION_TYPES,
  APP_TABS,
  GAMES,
  OVERLAY_TYPES,
  POPUP_GROUPS
} from '/content.js'

const app = document.querySelector('#app')
const DOWNLOAD_URL = '/downloads/ShenPulseSetup.exe'
const SITE_ORIGIN = 'https://www.shenpulse.leuridan.fr'
const RETIRED_ROUTES = ['/login', '/setup', '/admin', '/app']

const LEGAL_PAGES = {
  '/cgu': {
    eyebrow: 'Conditions',
    title: 'Conditions générales d’utilisation',
    intro: 'Règles applicables au site public et à l’utilisation du logiciel ShenPulse.',
    sections: [
      ['Objet', [
        'Les présentes conditions encadrent l’accès au site public ShenPulse, le téléchargement de l’application Windows et l’utilisation du logiciel.',
        'ShenPulse est un outil local d’automatisation pour livestreams. Il permet notamment de transformer des événements reçus depuis des sources configurées par l’utilisateur en sons, médias, voix, overlays, commandes et effets de jeu.'
      ]],
      ['Compte et accès', [
        'Les fonctions de compte, d’abonnement et de configuration sont utilisées depuis l’application. Les pages de connexion et de configuration ne sont pas proposées sur le site public.',
        'L’utilisateur doit fournir des informations exactes, protéger ses identifiants et signaler sans délai tout accès non autorisé.'
      ]],
      ['Plateformes et services tiers', [
        'TikTok, Twitch, Spotify, OBS, PayPal, les jeux, mods et services de stockage cités appartiennent à leurs titulaires respectifs. ShenPulse n’est pas affilié à ces services sauf mention explicite.',
        'L’utilisateur est responsable du respect des conditions des plateformes, des droits d’auteur, des licences des médias, des jeux et des mods qu’il utilise.'
      ]],
      ['Automatisations et jeux', [
        'Avant un live, l’utilisateur doit tester les règles, raccourcis, requêtes réseau et effets de jeu sur un environnement non critique. Les actions pouvant agir sur Windows ou un jeu doivent être activées volontairement.',
        'Seuls les jeux publiés dans la galerie de l’application doivent être considérés comme disponibles. Une passerelle compatible et autorisée est nécessaire pour déclencher des effets réels.'
      ]],
      ['Disponibilité et mises à jour', [
        'Le logiciel, les connecteurs et le site peuvent être modifiés pour des raisons de sécurité, compatibilité ou maintenance. Une plateforme tierce peut modifier ses interfaces et interrompre temporairement une intégration.',
        'L’utilisateur doit installer les mises à jour recommandées et conserver des sauvegardes de ses profils et données importantes.'
      ]],
      ['Contenus et comportement', [
        'Il est interdit d’utiliser ShenPulse pour contourner des protections, accéder à un service sans autorisation, harceler, tromper, diffuser un contenu illégal ou nuire au fonctionnement d’un système.',
        'L’utilisateur reste responsable des textes, médias, sons, commandes et effets diffusés pendant son live.'
      ]],
      ['Responsabilité', [
        'ShenPulse est fourni dans la limite des garanties impératives prévues par la loi. L’éditeur ne peut garantir la disponibilité continue d’un service tiers ni la compatibilité de toutes les versions d’un jeu ou d’un mod.',
        'Aucune clause des présentes conditions ne limite les droits légaux du consommateur ni une responsabilité qui ne pourrait être exclue par la loi.'
      ]],
      ['Suspension et fin d’utilisation', [
        'Un accès peut être suspendu en cas de fraude, atteinte à la sécurité, non-paiement ou violation grave des présentes conditions, sous réserve des droits légaux de l’utilisateur.',
        'L’utilisateur peut cesser d’utiliser le logiciel, supprimer ses données locales depuis l’application et demander la suppression des données de compte conformément à la politique de confidentialité.'
      ]],
      ['Droit applicable et contact', [
        'Les présentes conditions sont régies par le droit français, sans priver un consommateur des protections impératives applicables dans son pays de résidence.',
        'Pour toute question : alexandre.leuridan@gmail.com.'
      ]]
    ]
  },
  '/cgv': {
    eyebrow: 'Achats et abonnements',
    title: 'Conditions générales de vente',
    intro: 'Informations applicables aux achats et abonnements proposés dans l’application ShenPulse.',
    sections: [
      ['Vendeur et champ d’application', [
        'Les présentes conditions s’appliquent aux abonnements et droits numériques achetés depuis l’application ShenPulse. L’identité et les coordonnées de l’éditeur figurent dans les mentions légales.',
        'Les caractéristiques, compatibilités, prix TTC, fréquence de facturation et éventuelles promotions sont présentés dans l’application avant la validation de la commande.'
      ]],
      ['Offres', [
        'L’offre Free permet d’utiliser les fonctions affichées comme gratuites. Pro et Premium sont des abonnements mensuels ; Premium inclut Pro et peut ajouter les avantages indiqués dans l’application.',
        'Certains jeux intégrés peuvent faire l’objet d’un achat distinct. L’accès à un jeu peut aussi nécessiter un abonnement actif lorsque cela est clairement indiqué avant la commande.'
      ]],
      ['Commande et paiement', [
        'La commande est initiée uniquement depuis l’application. Le paiement est traité par PayPal sur son environnement sécurisé ; ShenPulse ne reçoit pas les données complètes de la carte ou du compte bancaire.',
        'L’accès est activé après confirmation du paiement par le serveur. En cas d’échec ou de délai, l’utilisateur doit conserver la référence PayPal et contacter le support.'
      ]],
      ['Durée, renouvellement et résiliation', [
        'Un abonnement est renouvelé selon la périodicité affichée jusqu’à sa résiliation. La prochaine échéance et l’état de l’accès sont visibles dans l’application ou le compte PayPal.',
        'L’utilisateur peut résilier le renouvellement depuis PayPal et demander de l’aide au support. La résiliation prend effet pour les périodes futures ; l’accès payé reste disponible jusqu’à la fin de la période en cours, sauf disposition légale contraire.'
      ]],
      ['Droit de rétractation', [
        'Le consommateur dispose en principe d’un délai légal de quatorze jours pour se rétracter d’un contrat conclu à distance.',
        'Lorsque l’exécution d’un service numérique commence avant la fin de ce délai à la demande expresse du consommateur, les conséquences sur le droit de rétractation doivent être présentées avant la commande. Toute demande peut être adressée à alexandre.leuridan@gmail.com avec l’adresse du compte, la date, l’offre et la référence de paiement.'
      ]],
      ['Conformité et assistance', [
        'Les garanties légales applicables aux contenus et services numériques restent dues. L’utilisateur doit signaler un défaut en décrivant la version de Windows, la version ShenPulse et les étapes de reproduction.',
        'Une interruption due à une plateforme ou à un jeu tiers est distinguée d’un défaut propre au logiciel ShenPulse.'
      ]],
      ['Remboursements et litiges', [
        'Toute demande est examinée au regard du droit applicable, de la date d’achat, de l’usage de l’accès et des justificatifs disponibles.',
        'En cas de désaccord, le consommateur peut recourir gratuitement au médiateur de la consommation dont les coordonnées seront communiquées par l’éditeur lorsqu’un dispositif de médiation applicable est désigné.'
      ]]
    ]
  },
  '/mentions-legales': {
    eyebrow: 'Informations légales',
    title: 'Mentions légales',
    intro: 'Identification de l’éditeur et de l’hébergeur du site.',
    sections: [
      ['Éditeur', [
        'ShenPulse — éditeur personne physique : Alexandre Leuridan, France.',
        'Contact : alexandre.leuridan@gmail.com.'
      ]],
      ['Directeur de la publication', [
        'Alexandre Leuridan.'
      ]],
      ['Hébergement', [
        'OVH SAS — 2 rue Kellermann, 59100 Roubaix, France.',
        'Le domaine et le serveur public sont administrés pour ShenPulse. Les services tiers utilisés par l’application sont décrits dans la politique de confidentialité.'
      ]],
      ['Propriété intellectuelle', [
        'Le nom, l’identité visuelle, le code, les textes et les éléments graphiques propres à ShenPulse sont protégés. Toute reproduction non autorisée est interdite.',
        'Les marques, visuels de jeux, médias et services tiers restent la propriété de leurs titulaires et sont utilisés à titre d’identification ou conformément à leurs licences.'
      ]],
      ['Signalement', [
        'Pour signaler une erreur, un contenu ou un problème de sécurité : alexandre.leuridan@gmail.com.'
      ]]
    ]
  },
  '/confidentialite': {
    eyebrow: 'Données personnelles',
    title: 'Politique de confidentialité',
    intro: 'Données traitées par le site public, le compte ShenPulse et l’application Windows.',
    sections: [
      ['Responsable et contact', [
        'Le responsable du traitement est Alexandre Leuridan pour ShenPulse. Les demandes relatives aux données peuvent être envoyées à alexandre.leuridan@gmail.com.'
      ]],
      ['Site public', [
        'Le site public ne propose ni compte, ni formulaire de profil, ni paiement. Il ne dépose pas de traceur publicitaire ou de mesure d’audience non nécessaire.',
        'L’hébergeur peut traiter des journaux techniques, notamment l’adresse IP, la date, la ressource demandée et des données de sécurité, pour fournir et protéger le service.'
      ]],
      ['Compte ShenPulse', [
        'Lorsqu’un compte est créé depuis l’application, l’adresse e-mail, l’identifiant du compte, le nom d’affichage et l’état des droits peuvent être traités pour l’authentification, la synchronisation et l’assistance.',
        'Les droits d’abonnement, achats, essais et accès Premium offert sont rattachés à l’identifiant du compte et non au pseudonyme TikTok.'
      ]],
      ['Événements live', [
        'ShenPulse traite les données nécessaires aux fonctions choisies : pseudonymes publics, messages, cadeaux, likes, follows, partages, abonnements, raids et informations techniques de session.',
        'La plupart des automatismes et journaux fonctionnent localement. Un relais public ne reçoit que l’état nécessaire aux overlays activés, avec un identifiant révoquable.'
      ]],
      ['Données locales et secrets', [
        'Profils, règles, historique, paramètres, chemins de jeux et médias restent sur l’appareil sauf action explicite de synchronisation ou d’import.',
        'Les mots de passe, jetons et clés compatibles sont chiffrés avec le coffre-fort Windows et ne doivent jamais être partagés.'
      ]],
      ['Paiement et services tiers', [
        'PayPal traite le paiement et renvoie un identifiant et un état de transaction. ShenPulse ne stocke pas le numéro complet d’un moyen de paiement.',
        'Firebase peut assurer l’authentification et la synchronisation des droits. OVHcloud héberge le site et des API. Backblaze B2, Spotify, TikTok, Twitch ou d’autres services ne sont contactés que pour les fonctions configurées.'
      ]],
      ['Bases, durées et destinataires', [
        'Les traitements reposent selon le cas sur l’exécution du contrat, le respect d’obligations légales, la sécurité du service, l’intérêt légitime ou le consentement.',
        'Les données sont conservées pendant la durée nécessaire au compte, au service, à la sécurité, au support et aux obligations comptables. Elles sont accessibles uniquement aux prestataires nécessaires et personnes autorisées.'
      ]],
      ['Droits', [
        'Vous pouvez demander l’accès, la rectification, l’effacement, la limitation, l’opposition ou la portabilité lorsque ces droits s’appliquent. Une réponse est apportée dans le délai légal.',
        'Vous pouvez aussi déposer une réclamation auprès de la CNIL. Une preuve d’identité peut être demandée uniquement en cas de doute raisonnable.'
      ]],
      ['Mineurs et sécurité', [
        'Les fonctions d’achat doivent être utilisées par une personne ayant la capacité de contracter ou avec l’autorisation de son représentant légal.',
        'Des mesures de minimisation, isolation locale, chiffrement et contrôle d’accès sont appliquées. Aucun système n’offrant une sécurité absolue, tout incident suspect doit être signalé rapidement.'
      ]]
    ]
  },
  '/cookies': {
    eyebrow: 'Traceurs',
    title: 'Politique relative aux cookies',
    intro: 'Le site public ShenPulse a été conçu pour fonctionner sans suivi publicitaire.',
    sections: [
      ['Cookies utilisés', [
        'Le site public ne dépose aucun cookie publicitaire, de profilage ou de mesure d’audience non nécessaire.',
        'Aucun bandeau de consentement n’est affiché tant qu’aucun traceur soumis au consentement n’est utilisé.'
      ]],
      ['Stockage local', [
        'Le site peut mémoriser uniquement une préférence strictement locale demandée par l’utilisateur, par exemple l’état d’un élément d’interface. Cette donnée n’est pas transmise à un tiers.',
        'L’application Windows possède ses propres stockages locaux, décrits dans la politique de confidentialité ; ils ne constituent pas des cookies du site public.'
      ]],
      ['Évolution', [
        'Si un outil de mesure d’audience, un contenu externe ou un autre traceur non nécessaire est ajouté, la présente page et le mécanisme de consentement seront mis à jour avant son activation.'
      ]]
    ]
  }
}

const HOME_FAQ = [
  ['Est-ce un site ou une application ?', 'ShenPulse est une application Windows. Le site sert uniquement à présenter le logiciel, télécharger l’installateur et consulter la documentation.'],
  ['Faut-il ouvrir une page de configuration ?', 'Non. La connexion, la configuration, les abonnements et les jeux se gèrent exclusivement depuis l’application.'],
  ['Puis-je tester sans être en live ?', 'Oui. Le mode Démo et les boutons de test permettent de vérifier règles, médias, sons, voix, overlays et effets.'],
  ['Comment ajouter un overlay ?', 'Configure-le dans ShenPulse, copie son URL, puis ajoute une source navigateur dans OBS avec les dimensions conseillées.'],
  ['Quels jeux sont présentés ?', 'Uniquement les huit jeux actuellement visibles dans la galerie publique de l’application. Les projets non publiés ne sont ni cités ni documentés sur le site.'],
  ['À quoi sert la carte de partage ?', 'Elle s’affiche automatiquement quand tu partages l’adresse du site sur un réseau social ou une messagerie compatible. Tu n’as aucun fichier à joindre manuellement.']
]

renderCurrentRoute()
window.addEventListener('popstate', renderCurrentRoute)
document.addEventListener('click', handleNavigation)

function handleNavigation(event) {
  const link = event.target.closest('a[href]')
  if (!link || link.target || link.hasAttribute('download')) return
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin) return
  event.preventDefault()
  history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
  renderCurrentRoute()
  if (url.hash) document.querySelector(url.hash)?.scrollIntoView()
  else window.scrollTo({ top: 0, behavior: 'instant' })
}

function renderCurrentRoute() {
  const path = normalizePath(window.location.pathname)
  const route = RETIRED_ROUTES.some((retired) => path === retired || path.startsWith(`${retired}/`))
    ? 'retired'
    : path

  if (route === '/') renderPage(homePage(), 'ShenPulse — Interactions live, overlays et jeux', 'home')
  else if (route === '/docs') renderPage(docsPage(), 'Documentation complète — ShenPulse', 'docs')
  else if (LEGAL_PAGES[route]) renderPage(legalPage(LEGAL_PAGES[route]), `${LEGAL_PAGES[route].title} — ShenPulse`, 'legal')
  else if (route === 'retired') renderPage(retiredPage(), 'Fonction disponible dans l’application — ShenPulse', 'not-found')
  else renderPage(notFoundPage(), 'Page introuvable — ShenPulse', 'not-found')
}

function renderPage(content, title, pageClass) {
  document.title = title
  document.documentElement.dataset.page = pageClass
  app.innerHTML = `${header()}${content}${footer()}`
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
        <p>L’application Windows qui transforme les réactions d’un live en moments de jeu.</p>
        <a class="button button--small" href="${DOWNLOAD_URL}" download>Télécharger pour Windows</a>
      </div>
      <nav aria-label="Liens utiles">
        <strong>Produit</strong>
        <a href="/docs">Documentation</a>
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
          <div class="eyebrow"><span></span> Application Windows pour créateurs live</div>
          <h1>Chaque réaction devient <em>un moment de jeu.</em></h1>
          <p class="hero-lead">ShenPulse relie les événements de ton live à des alertes, overlays, sons, voix, commandes et effets de jeu — depuis une seule application locale.</p>
          <div class="hero-actions">
            <a class="button button--primary" href="${DOWNLOAD_URL}" download>Télécharger ShenPulse <span>↓</span></a>
            <a class="button button--ghost" href="/docs">Découvrir la documentation <span>→</span></a>
          </div>
          <dl class="hero-facts">
            <div><dt>Windows 10+</dt><dd>Application locale</dd></div>
            <div><dt>8 jeux</dt><dd>Catalogue public</dd></div>
            <div><dt>0 traceur</dt><dd>Sur le site public</dd></div>
          </dl>
        </div>
        <div class="hero-visual">
          <span class="visual-label">Aperçu de l’application</span>
          ${screenshot('/screenshots/app-overview-public.png', 'Vue d’ensemble de l’application ShenPulse', true)}
          <div class="floating-note floating-note--top"><span>●</span> Prêt à interagir</div>
          <div class="floating-note floating-note--bottom"><strong>932</strong> cadeaux recherchables</div>
        </div>
      </section>

      <section class="trust-strip" aria-label="Fonctions principales">
        ${['Événements live', 'Actions multi-étapes', 'Overlays OBS', 'Jeux interactifs', 'Profils locaux'].map((item) => `<span>${item}</span>`).join('')}
      </section>

      <section class="section intro-section">
        <div class="section-heading">
          <div><span class="eyebrow">Un centre de contrôle, pas une usine à gaz</span><h2>Prépare, teste, puis lance ton live.</h2></div>
          <p>Tout ce qui configure ou pilote ShenPulse reste dans l’application. Le site public ne contient ni connexion, ni setup, ni panneau de gestion.</p>
        </div>
        <div class="workflow-grid">
          ${[
            ['01', 'Connecte une source', 'Renseigne ton @ TikTok, utilise le mode Démo ou ajoute un relais autorisé.'],
            ['02', 'Compose tes réactions', 'Associe un événement à un média, un son, une voix, une roue ou un effet de jeu.'],
            ['03', 'Teste tout le parcours', 'Simule les cadeaux et vérifie le rendu dans OBS avant de passer en direct.']
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
            ['bolt', 'Automatisations', 'Filtres, seuils, probabilités, priorités et cooldowns pour maîtriser chaque déclenchement.'],
            ['layers', 'Overlays & widgets', 'Like Goal, classements, timers, roue, Coin Jar, compteur de wins et animations de match.'],
            ['music', 'Sons & voix', 'Bibliothèque audio, médias personnels, TTS filtré et commandes Spotify.'],
            ['game', 'Jeux & effets', 'Jeux intégrés, installateurs gérés, passerelles locales et fiches de compatibilité transparentes.'],
            ['broadcast', 'OBS & sources', 'Sources navigateur stables, dimensions conseillées et aperçu réel dans l’application.'],
            ['shield', 'Contrôle local', 'Secrets chiffrés, API loopback protégée, profils exportables et aucune télémétrie par défaut.']
          ].map(([icon, title, copy]) => `<article><span class="feature-icon" data-icon="${icon}"></span><h3>${title}</h3><p>${copy}</p></article>`).join('')}
        </div>
      </section>

      <section class="section showcase">
        <div class="showcase-copy">
          <span class="eyebrow">Jeux interactifs</span>
          <h2>Les jeux actuellement disponibles, rien de plus.</h2>
          <p>Le site reprend uniquement les huit jeux visibles dans la galerie publique de ShenPulse. Les jeux encore en préparation restent privés jusqu’à leur publication dans l’application.</p>
          <ul class="check-list">
            <li>Installation et sauvegarde guidées</li>
            <li>Interactions configurables et testables</li>
            <li>Une seule session de jeu active à la fois</li>
          </ul>
          <a class="button button--ghost" href="/docs#jeux">Voir les 8 jeux publics <span>→</span></a>
        </div>
        ${screenshot('/screenshots/games-public.png', 'Galerie publique des jeux ShenPulse')}
      </section>

      <section class="section split-showcase">
        <article>
          <div><span class="eyebrow">Sources navigateur</span><h3>Le rendu avant l’URL.</h3><p>Configure thème, placement, couleurs et visibilité avec un aperçu fidèle, puis copie la source dans OBS.</p></div>
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
          <h2>Pas de compte web. Pas de configuration web.</h2>
          <p>La vitrine présente ShenPulse, la documentation explique l’application et le téléchargement fournit l’installateur. Les achats PayPal, la connexion et les réglages restent dans l’application.</p>
        </div>
        <div class="privacy-list">
          <span><b>01</b> Aucun formulaire public</span>
          <span><b>02</b> Aucun lien de paiement public</span>
          <span><b>03</b> Aucun cookie publicitaire</span>
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
        <p>Chaque onglet, bouton important, fenêtre et famille de champs est expliqué ci-dessous. Les fichiers d’illustration sont recadrés avant publication et ne contiennent ni navigation latérale ni écran d’administration.</p>
        <label class="docs-search">
          <span aria-hidden="true">⌕</span>
          <input id="docs-search" type="search" placeholder="Rechercher un onglet, un champ, un jeu ou un problème…" autocomplete="off">
          <kbd>Ctrl K</kbd>
        </label>
        <div class="docs-meta"><span><b>13</b> onglets utilisateur</span><span><b>${POPUP_GROUPS.length}</b> fenêtres expliquées</span><span><b>${GAMES.length}</b> jeux documentés</span></div>
      </header>

      <div class="docs-shell">
        <aside class="docs-sidebar">
          <strong>Dans ce guide</strong>
          <nav aria-label="Sommaire de la documentation">
            ${[
              ['demarrage', 'Démarrage rapide'],
              ['interface', 'Repères de l’interface'],
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
          ${docSection('demarrage', 'Démarrage rapide', 'Passe de l’installation à un test complet en moins de quinze minutes.', `
            <ol class="numbered-steps">
              ${[
                ['Télécharger et installer', `Utilise uniquement <a href="${DOWNLOAD_URL}" download>l’installateur officiel</a>. Ferme l’ancienne version avant de lancer la mise à jour.`],
                ['Ouvrir ou créer le compte', 'La fenêtre de connexion s’ouvre dans l’application. Confirme l’adresse e-mail si ShenPulse le demande.'],
                ['Choisir un profil', 'Le profil “Démarrage” est vierge. Crée un profil par jeu ou type d’émission si tu veux séparer tes réglages.'],
                ['Connecter TikTok', 'Clique sur le bloc @ TikTok dans la barre du haut, renseigne le pseudo public et lance la détection. Le mode Démo reste disponible hors live.'],
                ['Créer une action', 'Dans Actions, choisis un type, complète les champs puis utilise Tester.'],
                ['Ajouter le déclencheur', 'Associe un cadeau, un like, un message ou un autre événement. Commence avec un cooldown simple.'],
                ['Ajouter l’overlay dans OBS', 'Dans Overlays, configure le rendu, copie l’URL et crée une source navigateur aux dimensions indiquées.'],
                ['Tester puis démarrer', 'Simule un cadeau, vérifie le Journal, puis démarre la session live et éventuellement la session du jeu.']
              ].map(([title, copy], index) => `<li><span>${index + 1}</span><div><h3>${title}</h3><p>${copy}</p></div></li>`).join('')}
            </ol>
            <div class="callout callout--success"><strong>Ordre conseillé</strong><p>Action → test manuel → déclencheur → test cadeau → source OBS → session live. Cet ordre isole immédiatement l’étape qui pose problème.</p></div>
          `)}

          ${docSection('interface', 'Repères de l’interface', 'Les contrôles communs restent disponibles quel que soit l’onglet.', `
            ${screenshot('/screenshots/app-overview-public.png', 'Vue d’ensemble et barre supérieure de ShenPulse')}
            <div class="field-table">
              ${[
                ['Navigation latérale', 'Regroupe Pilotage, Création et Système. Le badge indique le nombre d’éléments lorsque c’est pertinent.'],
                ['Titre de page', 'Rappelle l’onglet et son objectif.'],
                ['Compte ShenPulse', 'Connexion, synchronisation des droits et accès aux réglages du compte.'],
                ['Jeu actif', 'Ramène au jeu en cours ou arrête sa passerelle. Ce contrôle apparaît seulement pendant une session de jeu.'],
                ['Profil', 'Change l’espace de travail actif. Le bouton ••• ouvre la gestion des profils.'],
                ['Compte TikTok', 'Ouvre la fenêtre du @ et affiche l’état de détection.'],
                ['Bouton de détection', 'Active ou arrête la surveillance TikTok.'],
                ['Démarrer le live', 'Lance ou arrête la session du profil courant.'],
                ['Services locaux', 'En bas de la barre latérale, indique les ports de l’API et des overlays.'],
                ['Compte en bas de barre', 'Ouvre le menu de compte et le lien vers les Paramètres.']
              ].map(fieldRow).join('')}
            </div>
            <div class="callout"><strong>À ne pas confondre</strong><p>La détection TikTok surveille le compte, la session live active les automatismes et la session de jeu ouvre une passerelle. Les trois états peuvent être différents.</p></div>
          `)}

          ${docSection('onglets', 'Tous les onglets utilisateur', 'Chaque zone et chaque contrôle important est détaillé ici.', `
            <div class="docs-card-grid tabs-docs">
              ${APP_TABS.map((tab) => `
                <article class="doc-card doc-searchable" id="${tab.id}" data-search="${searchText(tab)}">
                  <header><span>${tab.group}</span><h3>${tab.title}</h3><p>${tab.summary}</p></header>
                  <dl>${tab.parts.map(([term, desc]) => `<div><dt>${term}</dt><dd>${desc}</dd></div>`).join('')}</dl>
                  <div class="tips"><strong>Bon à savoir</strong>${tab.tips.map((tip) => `<p>• ${tip}</p>`).join('')}</div>
                </article>`).join('')}
            </div>
            <div class="docs-gallery">
              ${screenshot('/screenshots/actions-public.png', 'Onglet Actions et déclencheurs')}
              ${screenshot('/screenshots/sounds-public.png', 'Onglet Sons et voix')}
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
                <details class="doc-searchable" id="${popup.id}" data-search="${searchText(popup)}" ${index < 2 ? 'open' : ''}>
                  <summary><span>${String(index + 1).padStart(2, '0')}</span><div><h3>${popup.title}</h3><p>${popup.purpose}</p></div><b>+</b></summary>
                  <div class="field-table">${popup.fields.map(fieldRow).join('')}</div>
                </details>`).join('')}
            </div>
            <div class="callout"><strong>Bibliothèques et catalogues</strong><p>Les sélecteurs de cadeaux, sons et médias acceptent une recherche. Écoute ou prévisualise l’élément avant de le valider ; un nom identique ne garantit pas le même fichier.</p></div>
          `)}

          ${docSection('overlays-doc', 'Overlays et configuration OBS', 'Chaque source a son propre usage et ses dimensions recommandées.', `
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

          ${docSection('jeux', 'Jeux et effets interactifs', 'Cette section contient uniquement les huit jeux actuellement visibles dans la galerie publique de ShenPulse.', `
            ${screenshot('/screenshots/games-public.png', 'Galerie publique des jeux et effets')}
            <div class="game-legend"><span><i class="status-dot status-dot--active"></i> Visible dans l’application</span></div>
            <label class="game-search"><span>⌕</span><input id="game-search" type="search" placeholder="Filtrer les ${GAMES.length} jeux…"><b id="game-count">${GAMES.length}</b></label>
            <div class="game-doc-grid" id="game-doc-grid">
              ${GAMES.map((game, index) => `
                <details class="game-doc doc-searchable" data-game="${searchText(game)}" data-search="${searchText(game)}">
                  <summary>
                    <span class="game-index">${String(index + 1).padStart(2, '0')}</span>
                    <div><small>${game.type}</small><h3>${game.name}</h3><p>${game.interactions} interaction${game.interactions > 1 ? 's' : ''}</p></div>
                    <span class="game-status ${game.status === 'Exécutable' ? 'is-active' : 'is-reference'}">${game.status}</span>
                  </summary>
                  <div class="game-detail">
                    <ol>${game.steps.map((step) => `<li>${step}</li>`).join('')}</ol>
                    ${game.note ? `<p class="game-note">${game.note}</p>` : ''}
                    <p><b>Test conseillé :</b> démarre la passerelle, utilise un effet simple, vérifie le Journal, puis teste un effet avec durée ou file d’attente.</p>
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
                ['L’overlay est vide', ['Vérifie que les services locaux sont verts.', 'Recharge la source OBS.', 'Contrôle l’URL et les dimensions.', 'Simule un événement compatible.']],
                ['Le jeu ne réagit pas', ['Vérifie qu’une seule session de jeu est active.', 'Contrôle le port ou l’URL de la passerelle.', 'Teste un effet marqué exécutable.', 'Compare la version du jeu et du mod.']],
                ['Pas de son ou de voix', ['Teste la piste dans la bibliothèque.', 'Vérifie le volume ShenPulse et Windows.', 'Contrôle la voix système.', 'Vérifie les filtres TTS.']],
                ['OBS ne répond pas', ['Active OBS WebSocket.', 'Vérifie l’adresse et le mot de passe.', 'Clique sur Tester OBS.', 'Contrôle le pare-feu local.']],
                ['Spotify est déconnecté', ['Vérifie le Client ID.', 'Déclare l’URI de retour exacte.', 'Relance l’autorisation.', 'Garde un appareil Spotify actif.']],
                ['Après une mise à jour', ['Exporte les profils avant si possible.', 'Installe la dernière version.', 'Rouvre le jeu ou la source OBS.', 'Consulte le Journal pour une migration.']]
              ].map(([title, steps]) => `<article class="doc-searchable" data-search="${searchText([title, steps])}"><h3>${title}</h3><ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol></article>`).join('')}
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
        <small>Version en vigueur au 30 juillet 2026</small>
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

function screenshot(src, alt, priority = false) {
  const loading = priority ? 'eager' : 'lazy'
  const fetchPriority = priority ? ' fetchpriority="high"' : ''
  return `<figure class="app-shot"><div><img src="${src}" alt="${alt}" loading="${loading}"${fetchPriority}></div><figcaption>${alt} — fichier public recadré avant publication.</figcaption></figure>`
}

function fieldRow([term, description]) {
  return `<div><dt>${term}</dt><dd>${description}</dd></div>`
}

function bindPageBehaviors(pageClass) {
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

  docsSearch?.addEventListener('input', () => {
    const query = normalizeSearch(docsSearch.value)
    let visibleCount = 0
    searchable.forEach((element) => {
      const visible = !query || normalizeSearch(element.dataset.search || element.textContent).includes(query)
      element.hidden = !visible
      if (visible) visibleCount += 1
    })
    sections.forEach((section) => {
      const ownMatches = !query || normalizeSearch(section.textContent).includes(query)
      const childVisible = [...section.querySelectorAll('.doc-searchable')].some((item) => !item.hidden)
      section.hidden = Boolean(query) && !ownMatches && !childVisible
    })
    if (empty) empty.hidden = visibleCount > 0 || !query
  })

  document.addEventListener('keydown', focusDocsSearch, { once: true })
  const gameSearch = document.querySelector('#game-search')
  const games = [...document.querySelectorAll('.game-doc')]
  const gameCount = document.querySelector('#game-count')
  gameSearch?.addEventListener('input', () => {
    const query = normalizeSearch(gameSearch.value)
    let count = 0
    games.forEach((item) => {
      const visible = !query || normalizeSearch(item.dataset.game).includes(query)
      item.hidden = !visible
      if (visible) count += 1
    })
    if (gameCount) gameCount.textContent = String(count)
  })

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      document.querySelectorAll('.docs-sidebar a[href^="#"]').forEach((link) => {
        link.classList.toggle('is-active', link.getAttribute('href') === `#${visible.target.id}`)
      })
    },
    { rootMargin: '-20% 0px -65%', threshold: [0.05, 0.2, 0.5] }
  )
  document.querySelectorAll('.doc-section').forEach((section) => observer.observe(section))
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

  targets.forEach((element) => revealObserver.observe(element))
}

function focusDocsSearch(event) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    document.querySelector('#docs-search')?.focus()
  } else {
    document.addEventListener('keydown', focusDocsSearch, { once: true })
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

void SITE_ORIGIN
