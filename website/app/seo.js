import { LEGAL_PAGES } from './legal-pages.js?v=20261104-seo1'
import { APP_TABS, CLIENT_RELEASE } from '../content.js?v=20261104-seo1'
import { GAMES } from '../game-catalog.js?v=20261104-seo1'
import { IMAGES } from '../image-assets.js?v=20261104-seo1'
import { PUBLIC_RELEASE } from '../public-release.js?v=20261104-seo1'
import {
  homePage,
  docsPage,
  legalPage,
  retiredPage,
  notFoundPage,
  normalizePath,
  DOWNLOAD_URL,
  SITE_ORIGIN,
} from './pages.js?v=20261104-seo1'
import { screenshot } from './visual-tour.js?v=20261104-seo1'
import { PRODUCT_TOUR } from './product-tour.js?v=20261104-seo1'
import { escapeHtml as e } from './html.js?v=20261104-seo1'

const GUIDE_PATHS = {
  accueil: 'accueil',
  'vue-ensemble': 'tableau-de-bord',
  utilisateurs: 'utilisateurs',
  actions: 'actions-cadeaux-tiktok',
  sons: 'synthese-vocale',
  musique: 'musique-spotify',
  overlays: 'overlays-obs-tiktok',
  jeux: 'jeux-interactifs',
  'machines-irl': 'machines-irl',
  commandes: 'commandes-du-chat',
  matchs: 'matchs-tiktok',
  abonnement: 'abonnements',
  connexions: 'connexion-live',
  journal: 'diagnostic',
  agences: 'agences',
  'compte-profils': 'compte-et-profils',
}
const GUIDE_TITLES = {
  actions: 'Actions et cadeaux TikTok LIVE',
  sons: 'Synthèse vocale TikTok LIVE : voix TTS et sons',
  overlays: 'Overlays OBS et TikTok LIVE Studio',
  commandes: 'Commandes du chat TikTok LIVE',
  matchs: 'Matchs TikTok LIVE et animations',
  musique: 'Musique Spotify et demandes de titres',
  jeux: 'Installer les interactions de jeux',
  'machines-irl': 'Machines IRL et interactions du LIVE',
}
export const GUIDES = APP_TABS.map((tab) => ({
  ...tab,
  slug: GUIDE_PATHS[tab.id] || tab.id,
  seoTitle: GUIDE_TITLES[tab.id] || tab.title,
}))
export const gamePath = (game) => '/jeux/' + game.id
export const guidePath = (guide) => '/guides/' + guide.slug
export const releasePath = '/mises-a-jour/' + CLIENT_RELEASE.version
const desc = (text) => {
  const plain = String(text).replace(/\s+/g, ' ').trim()
  if (plain.length <= 165) return plain
  return plain.slice(0, 162).replace(/\s+\S*$/, '') + '…'
}
const page = (
  path,
  title,
  description,
  pageClass,
  content,
  breadcrumbs = [],
) => ({
  path,
  title,
  description: desc(description),
  pageClass,
  content,
  status: 200,
  breadcrumbs,
})
const crumb = (name, path) => ({ name, path })
function breadcrumbs(items) {
  return (
    '<nav class="breadcrumbs" aria-label="Fil d’Ariane"><a href="/">Accueil</a>' +
    items
      .map(
        (item) =>
          ' <span aria-hidden="true">›</span> <a href="' +
          e(item.path) +
          '">' +
          e(item.name) +
          '</a>',
      )
      .join('') +
    '</nav>'
  )
}
function layout(title, intro, body, items = []) {
  return (
    '<main id="main" class="seo-page">' +
    breadcrumbs(items) +
    '<header class="seo-hero"><span class="eyebrow">ShenPulse · Guides et interactions LIVE</span><h1>' +
    e(title) +
    '</h1><p>' +
    e(intro) +
    '</p></header>' +
    body +
    '</main>'
  )
}
function cta() {
  return '<section class="seo-cta"><h2>Prépare ton prochain LIVE avec ShenPulse</h2><p>Application Windows à télécharger gratuitement. Des fonctions gratuites et des offres Pro ou Premium sont proposées ; certains modules nécessitent un achat séparé. Vérifie les droits et conditions dans l’application.</p><a class="button button--primary" href="https://apps.microsoft.com/detail/9NDR71Z41ZJG" target="_blank" rel="noopener">Ouvrir le Microsoft Store</a> <a class="text-link" href="/docs#demarrage">Guide de démarrage →</a></section>'
}
function relatedGuides(ids) {
  return (
    '<section class="section"><h2>Guides utiles</h2><div class="seo-link-grid">' +
    GUIDES.filter((g) => ids.includes(g.id))
      .map(
        (g) =>
          '<a class="seo-link-card" href="' +
          guidePath(g) +
          '"><h3>' +
          e(g.seoTitle) +
          '</h3><p>' +
          e(g.summary) +
          '</p></a>',
      )
      .join('') +
    '</div></section>'
  )
}
function gameImage(game, priority = false) {
  const item = IMAGES['game-' + game.id]
  if (!item) return ''
  return (
    '<picture class="seo-game-art"><source type="image/webp" srcset="' +
    item.small +
    ' ' +
    item.smallWidth +
    'w, ' +
    item.large +
    ' ' +
    item.width +
    'w" sizes="(max-width:640px) 90vw, 360px"><img src="' +
    item.large +
    '" width="' +
    item.width +
    '" height="' +
    item.height +
    '" alt="Affiche de ' +
    e(game.name) +
    '" loading="' +
    (priority ? 'eager' : 'lazy') +
    '" decoding="async"' +
    (priority ? ' fetchpriority="high"' : '') +
    '></picture>'
  )
}
function gameCard(game) {
  return (
    '<article class="seo-game-card" data-catalog-game>' +
    gameImage(game) +
    '<div><span class="eyebrow">' +
    e(game.type) +
    '</span><h2><a href="' +
    gamePath(game) +
    '">' +
    e(game.name) +
    '</a></h2><p>' +
    e(game.description) +
    '</p><p class="game-status">' +
    e(game.status) +
    ' · ' +
    game.interactions +
    ' interactions référencées</p><a class="text-link" href="' +
    gamePath(game) +
    '">Installation et conditions →</a></div></article>'
  )
}
function gamesPage() {
  return layout(
    'Jeux compatibles et interactions TikTok LIVE',
    'Choisis un jeu pour connaître ses conditions, son installation et les effets proposés dans ShenPulse. La fiche précise les limites de chaque intégration.',
    '<p class="js-only"><label for="catalog-search">Rechercher un jeu</label> <input id="catalog-search" type="search" placeholder="Minecraft, GTA, Palworld…"><span id="catalog-count">' +
      GAMES.length +
      '</span> fiches</p><div class="seo-catalog">' +
      GAMES.map(gameCard).join('') +
      '</div>' +
      relatedGuides(['jeux', 'overlays']) +
      cta(),
    [crumb('Jeux', '/jeux')],
  )
}
function gamePage(game) {
  const items = [crumb('Jeux', '/jeux'), crumb(game.name, gamePath(game))]
  const similar = GAMES.filter(
    (g) => g.id !== game.id && g.type === game.type,
  ).slice(0, 3)
  return layout(
    game.name + ' : interactions et installation',
    game.description,
    '<div class="seo-detail-grid"><aside>' +
      gameImage(game, true) +
      '<p class="game-status">' +
      e(game.status) +
      ' · ' +
      game.interactions +
      ' interactions référencées</p><p>Version ShenPulse : ' +
      e(CLIENT_RELEASE.version) +
      '. Les conditions et droits affichés dans l’application déterminent la disponibilité.</p></aside><article class="seo-prose"><h2>Ce que les viewers peuvent déclencher</h2><p>' +
      e(game.interactionGuide) +
      '</p><h2>Prérequis et compatibilité</h2><p>' +
      e(game.requirements) +
      '</p><p>Le téléchargement de ShenPulse ne fournit pas automatiquement un jeu commercial ni son abonnement d’accès. Installe l’édition compatible indiquée dans sa fiche.</p><h2>Installer et lancer les interactions</h2><ol>' +
      game.steps.map((step) => '<li>' + e(step) + '</li>').join('') +
      '</ol>' +
      (game.note
        ? '<h2>Conditions et limites à connaître</h2><p>' +
          e(game.note) +
          '</p>'
        : '') +
      '<h2>Vérifier avant le LIVE</h2><p>' +
      e(
        game.status === 'Exécutable'
          ? 'Teste un effet simple sur une partie d’essai, puis vérifie un effet avec durée. La connexion du LIVE, la session ShenPulse activée et le module connecté au jeu sont des états distincts.'
          : 'Cette fiche documente une compatibilité recensée. Une passerelle compatible et disponible doit être installée avant de considérer les interactions comme opérationnelles.',
      ) +
      '</p><p>Conserve les sauvegardes de tes parties. Ferme le jeu avant une mise à jour de son pack et consulte CONDITION DE JEU dans ShenPulse pour les prérequis propres à chaque effet.</p><a href="/docs#jeu-' +
      e(game.id) +
      '">Retrouver cette fiche dans la documentation complète</a></article></div>' +
      relatedGuides(['actions', 'jeux', 'overlays']) +
      (similar.length
        ? '<section class="section"><h2>À découvrir aussi</h2><div class="seo-link-grid">' +
          similar
            .map(
              (g) =>
                '<a class="seo-link-card" href="' +
                gamePath(g) +
                '">' +
                e(g.name) +
                '</a>',
            )
            .join('') +
          '</div></section>'
        : '') +
      cta(),
    items,
  )
}
function guidesPage() {
  return layout(
    'Guides ShenPulse : préparer ses interactions LIVE',
    'Retrouve les réglages, prérequis et conseils de chaque espace de l’application. La documentation complète reste disponible pour une recherche transversale.',
    '<div class="seo-link-grid">' +
      GUIDES.map(
        (g) =>
          '<a class="seo-link-card" href="' +
          guidePath(g) +
          '"><span class="eyebrow">' +
          e(g.group) +
          '</span><h2>' +
          e(g.seoTitle) +
          '</h2><p>' +
          e(g.summary) +
          '</p></a>',
      ).join('') +
      '</div><p><a class="button button--ghost" href="/docs">Ouvrir la documentation complète</a></p>' +
      cta(),
    [crumb('Guides', '/guides')],
  )
}
function guidePage(guide) {
  const tour = PRODUCT_TOUR.find((t) => t.guide === guide.id)
  return layout(
    guide.seoTitle,
    guide.summary,
    '<article class="seo-prose"><p>Ce guide décrit les réglages de ShenPulse ' +
      e(CLIENT_RELEASE.version) +
      '. Choisis ton profil actif avant de préparer ou tester tes interactions.</p>' +
      guide.parts
        .map(
          ([name, text]) =>
            '<section><h2>' + e(name) + '</h2><p>' + e(text) + '</p></section>',
        )
        .join('') +
      '<section><h2>Conseils et conditions</h2><ul>' +
      guide.tips.map((t) => '<li>' + e(t) + '</li>').join('') +
      '</ul></section><p><a href="/docs#' +
      e(guide.id) +
      '">Consulter ce chapitre dans la documentation complète</a></p></article>' +
      (tour
        ? screenshot('/screenshots/' + tour.image, 'Aperçu ' + guide.title)
        : '') +
      relatedGuides(
        ['actions', 'sons', 'overlays', 'jeux'].filter((id) => id !== guide.id),
      ) +
      cta(),
    [crumb('Guides', '/guides'), crumb(guide.seoTitle, guidePath(guide))],
  )
}
function releasePage() {
  return layout(
    'ShenPulse ' + CLIENT_RELEASE.version + ' : nouveautés et corrections',
    CLIENT_RELEASE.summary,
    '<article class="seo-prose"><p>Publié le <time datetime="' +
      e(PUBLIC_RELEASE.date) +
      '">' +
      e(PUBLIC_RELEASE.displayDate) +
      '</time> · Version Windows ' +
      e(CLIENT_RELEASE.version) +
      '.</p>' +
      PUBLIC_RELEASE.html +
      '</article>' +
      relatedGuides(['actions', 'sons', 'jeux']) +
      cta(),
    [crumb('Mise à jour ' + CLIENT_RELEASE.version, releasePath)],
  )
}

export function resolvePage(rawPath) {
  const path = normalizePath(rawPath)
  if (path === '/')
    return page(
      path,
      'ShenPulse : interactions TikTok LIVE, jeux et overlays',
      'Transforme les cadeaux et réactions du LIVE en actions, voix TTS, sons et interactions de jeux. ShenPulse pour Windows, compatible OBS et TikTok LIVE Studio.',
      'home',
      homePage(),
    )
  if (path === '/docs')
    return page(
      path,
      'Documentation ShenPulse : installation, réglages et jeux',
      'Documentation complète de ShenPulse : connexion TikTok LIVE, actions, TTS, sons, overlays OBS, jeux compatibles, comptes et conseils de dépannage.',
      'docs',
      docsPage(),
      [crumb('Documentation', path)],
    )
  if (path === '/jeux')
    return page(
      path,
      'Jeux compatibles TikTok LIVE et interactions | ShenPulse',
      'Minecraft, GTA Enhanced, Palworld et les autres jeux compatibles : installation des packs, éditions prises en charge et interactions déclenchées par les viewers.',
      'games',
      gamesPage(),
      [crumb('Jeux', path)],
    )
  if (path === '/guides')
    return page(
      path,
      'Guides ShenPulse : actions, TTS, overlays et TikTok LIVE',
      'Prépare tes actions, voix TTS, sons, overlays et jeux TikTok LIVE avec les guides ShenPulse. Réglages détaillés, prérequis et étapes de mise en route.',
      'guides',
      guidesPage(),
      [crumb('Guides', path)],
    )
  const game = GAMES.find((g) => gamePath(g) === path)
  if (game)
    return page(
      path,
      game.name + ' : interactions TikTok LIVE | ShenPulse',
      game.description,
      'game',
      gamePage(game),
      [crumb('Jeux', '/jeux'), crumb(game.name, path)],
    )
  const guide = GUIDES.find((g) => guidePath(g) === path)
  if (guide)
    return page(
      path,
      guide.seoTitle + ' | Guide ShenPulse',
      guide.summary,
      'guide',
      guidePage(guide),
      [crumb('Guides', '/guides'), crumb(guide.seoTitle, path)],
    )
  if (path === releasePath)
    return page(
      path,
      'ShenPulse ' + CLIENT_RELEASE.version + ' : nouveautés et corrections',
      CLIENT_RELEASE.summary,
      'release',
      releasePage(),
      [crumb('Mise à jour ' + CLIENT_RELEASE.version, path)],
    )
  if (LEGAL_PAGES[path])
    return page(
      path,
      LEGAL_PAGES[path].title + ' | ShenPulse',
      LEGAL_PAGES[path].intro +
        ' Consulte les informations légales de ShenPulse.',
      'legal',
      legalPage(LEGAL_PAGES[path], path),
      [crumb(LEGAL_PAGES[path].title, path)],
    )
  return {
    ...page(
      path,
      path === '/login' ||
        path === '/setup' ||
        path === '/admin' ||
        path === '/app'
        ? 'Fonction disponible dans l’application | ShenPulse'
        : 'Page introuvable | ShenPulse',
      'Retrouve les guides et les pages publiques de ShenPulse.',
      'not-found',
      /^\/(login|setup|admin|app)(\/|$)/.test(path)
        ? retiredPage()
        : notFoundPage(),
    ),
    status: 404,
  }
}
export function publicPaths() {
  return [
    '/',
    '/docs',
    '/jeux',
    '/guides',
    ...GUIDES.map(guidePath),
    ...GAMES.map(gamePath),
    releasePath,
    ...Object.keys(LEGAL_PAGES),
  ]
}
export function pageGraph(page) {
  const website = {
    '@type': 'WebSite',
    '@id': SITE_ORIGIN + '/#website',
    url: SITE_ORIGIN + '/',
    name: 'ShenPulse',
    inLanguage: 'fr',
  }
  const organisation = {
    '@type': 'Organization',
    '@id': SITE_ORIGIN + '/#organization',
    name: 'ShenPulse',
    url: SITE_ORIGIN + '/',
    logo: SITE_ORIGIN + '/brand/shenpulse-logo.png',
    sameAs: ['https://apps.microsoft.com/detail/9NDR71Z41ZJG'],
  }
  const webpage = {
    '@type':
      page.pageClass === 'game'
        ? 'WebPage'
        : page.pageClass === 'guide'
          ? 'TechArticle'
          : page.pageClass === 'release'
            ? 'Article'
            : 'WebPage',
    '@id': SITE_ORIGIN + page.path + '#webpage',
    url: SITE_ORIGIN + page.path,
    name: page.title,
    description: page.description,
    inLanguage: 'fr',
    isPartOf: { '@id': website['@id'] },
    publisher: { '@id': organisation['@id'] },
  }
  const graph = [website, organisation, webpage]
  if (page.breadcrumbs.length)
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { name: 'Accueil', path: '/' },
        ...page.breadcrumbs,
      ].map((item, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: item.name,
        item: SITE_ORIGIN + item.path,
      })),
    })
  // Le résultat enrichi SoftwareApplication exige un avis ou une note vérifiée.
  // Ne pas émettre un balisage inéligible ni inventer des évaluations.
  if (['guide', 'release'].includes(page.pageClass)) Object.assign(webpage, {
    headline: page.title, author: { '@id': organisation['@id'] },
    image: SITE_ORIGIN + '/og.png?v=2',
  })
  if (page.path === '/jeux')
    graph.push({
      '@type': 'ItemList',
      name: 'Jeux et interactions ShenPulse',
      itemListElement: GAMES.map((g, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        name: g.name,
        url: SITE_ORIGIN + gamePath(g),
      })),
    })
  if (page.path === releasePath)
    Object.assign(webpage, {
      datePublished: PUBLIC_RELEASE.date,
      headline: page.title,
      author: { '@id': organisation['@id'] },
    })
  return { '@context': 'https://schema.org', '@graph': graph }
}
