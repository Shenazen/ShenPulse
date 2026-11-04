import { header, footer, normalizePath, normalizeSearch } from './app/pages.js?v=20261104-seo1'
import { resolvePage, pageGraph } from './app/seo.js?v=20261104-seo1'
import { screenshotDialog, bindVisuals } from './app/visual-tour.js?v=20261104-seo1'
document.documentElement.classList.replace('no-js', 'js')
const app = document.querySelector('#app')
let pageController = null
let pageObservers = []

renderCurrentRoute()
window.addEventListener('popstate', renderCurrentRoute)
document.addEventListener('click', handleNavigation)

function handleNavigation(event) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
  const link = event.target.closest('a[href]')
  if (!link || link.target || link.hasAttribute('download')) return
  const url = new URL(link.href, window.location.href)
  if (url.origin !== window.location.origin || /^(?:\/downloads\/|\/api\/|\/ws\/|\/games\/|\/agences\/)/.test(url.pathname)) return
  event.preventDefault()
  const samePage = normalizePath(url.pathname) === normalizePath(window.location.pathname) && url.search === window.location.search
  history.pushState({}, '', `${url.pathname}${url.search}${url.hash}`)
  if (samePage && url.hash) scrollToCurrentHash({ focus: true })
  else renderCurrentRoute({ focusHash: Boolean(url.hash) })
  if (!url.hash) window.scrollTo({ top: 0, behavior: 'instant' })
}

function renderCurrentRoute({ focusHash = false } = {}) {
  const page = resolvePage(window.location.pathname)
  renderPage(page)
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

function renderPage(page) {
  document.querySelector('.screenshot-dialog[open]')?.close()
  pageController?.abort()
  pageObservers.forEach(observer => observer.disconnect())
  pageObservers = []
  pageController = new AbortController()
  const canonical = 'https://www.shenpulse.leuridan.fr' + page.path
  document.title = page.title
  for (const [selector, value] of [
    ['link[rel="canonical"]', canonical],
    ['meta[name="description"]', page.description],
    ['meta[property="og:title"]', page.title],
    ['meta[property="og:description"]', page.description],
    ['meta[property="og:url"]', canonical],
    ['meta[name="twitter:title"]', page.title],
    ['meta[name="twitter:description"]', page.description],
    ['meta[name="robots"]', page.status === 200 ? 'index,follow' : 'noindex,follow']
  ]) document.querySelector(selector)?.setAttribute(selector.startsWith('link') ? 'href' : 'content', value)
  document.querySelector('#page-schema').textContent = JSON.stringify(pageGraph(page)).replace(/</g, '\\u003c')
  document.documentElement.dataset.page = page.pageClass
  if (app.dataset.route !== page.path) {
    app.innerHTML = header(page.path) + page.content + footer() + screenshotDialog()
    app.dataset.route = page.path
  }
  app.querySelector('main')?.setAttribute('tabindex', '-1')
  bindPageBehaviors(page.pageClass)
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
  if (pageClass === 'games') {
    const input = document.querySelector('#catalog-search')
    input?.addEventListener('input', () => {
      const query = normalizeSearch(input.value)
      const cards = [...document.querySelectorAll('[data-catalog-game]')]
      cards.forEach(card => { card.hidden = !normalizeSearch(card.textContent).includes(query) })
      document.querySelector('#catalog-count').textContent = String(cards.filter(card => !card.hidden).length)
    }, { signal })
  }
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
