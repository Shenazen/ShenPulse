import { CLIENT_RELEASE } from '/content.js?v=20261022-web1'
import { PRODUCT_TOUR } from '/app/product-tour.js?v=20261022-web1'
import { SCREENSHOTS } from '/app/screenshots.js?v=20261022-web1'
import { escapeHtml } from '/app/html.js?v=20261022-web1'

const SCREENSHOT_VERSION = '20261015-2.0.2'

/** Réserve le vrai ratio avant chargement ; aucune hauteur de présentation arbitraire. */
export function screenshot(src, alt, priority = false) {
  const metadata = SCREENSHOTS[src]
  if (!metadata) throw new Error(`Dimensions de capture absentes : ${src}`)
  const loading = priority ? 'eager' : 'lazy'
  const fetchPriority = priority ? ' fetchpriority="high"' : ''
  return `<figure class="app-shot"><button type="button" class="shot-zoom" data-screenshot-open aria-label="Agrandir : ${escapeHtml(alt)}"><img src="${src}?v=${SCREENSHOT_VERSION}" alt="${escapeHtml(alt)}" width="${metadata.width}" height="${metadata.height}" loading="${loading}" decoding="async"${fetchPriority}></button><figcaption>${escapeHtml(alt)} · ShenPulse ${CLIENT_RELEASE.version} · données de démonstration.</figcaption></figure>`
}

export function productTour() {
  return `<section class="section product-tour" id="decouvrir" aria-labelledby="product-tour-title">
    <div class="section-heading"><div><span class="eyebrow">ShenPulse, aujourd’hui</span><h2 id="product-tour-title">Découvre ton prochain espace de création.</h2></div><p>Des captures de la version ${CLIENT_RELEASE.version}, sans données personnelles. Choisis un espace pour voir comment il fonctionne.</p></div>
    <div class="tour-tabs" role="tablist" aria-label="Espaces de ShenPulse">${PRODUCT_TOUR.map((item, index) => `<button type="button" role="tab" id="tour-${item.id}" data-tour-tab="${item.id}" aria-controls="product-tour-panel" aria-selected="${index === 0}" tabindex="${index === 0 ? 0 : -1}">${escapeHtml(item.title)}${item.premium ? '<span class="badge-pro">PREMIUM</span>' : item.pro ? '<span class="badge-pro">PRO</span>' : ''}</button>`).join('')}</div>
    <div class="tour-panel" id="product-tour-panel" role="tabpanel" tabindex="0" aria-labelledby="tour-${PRODUCT_TOUR[0].id}">${tourPanel(PRODUCT_TOUR[0])}</div>
    <p class="tour-footnote">PRO : accès Pro ou Premium actif requis. PREMIUM : accès Premium actif requis. Certains jeux nécessitent aussi un achat. Prix et droits disponibles dans l’application.</p>
  </section>`
}

function tourPanel(item) {
  return `<div class="tour-copy"><span class="eyebrow">${escapeHtml(item.title)}${item.premium ? ' · Accès Premium' : item.pro ? ' · Accès Pro' : ''}</span><h3>${escapeHtml(item.heading)}</h3><p>${escapeHtml(item.description)}</p><ul class="check-list">${item.points.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul><a class="text-link" href="/docs#${item.guide}">Lire le guide ${escapeHtml(item.title)} →</a></div>${screenshot(`/screenshots/${item.image}`, item.title)}`
}

export function screenshotDialog() {
  return `<dialog class="screenshot-dialog" aria-labelledby="screenshot-dialog-title"><div class="screenshot-dialog__header"><p id="screenshot-dialog-title">Aperçu ShenPulse</p><button type="button" data-screenshot-close aria-label="Fermer l’aperçu">Fermer ×</button></div><img alt=""><p class="screenshot-dialog__caption">Capture du rendu de ShenPulse ${CLIENT_RELEASE.version} avec données de démonstration.</p></dialog>`
}

/** L'AbortSignal du routeur nettoie les événements lors d'un changement de page. */
export function bindVisuals(root, signal) {
  const dialog = root.querySelector('.screenshot-dialog')
  const preview = dialog.querySelector('img')
  let opener = null
  root.addEventListener('click', (event) => {
    const button = event.target.closest('[data-screenshot-open]')
    if (!button) return
    const original = button.querySelector('img')
    opener = button
    preview.src = original.currentSrc || original.src
    preview.alt = original.alt
    preview.setAttribute('width', original.getAttribute('width'))
    preview.setAttribute('height', original.getAttribute('height'))
    dialog.querySelector('#screenshot-dialog-title').textContent = original.alt
    dialog.showModal()
    dialog.querySelector('[data-screenshot-close]').focus()
  }, { signal })
  dialog.querySelector('[data-screenshot-close]').addEventListener('click', () => dialog.close(), { signal })
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close() }, { signal })
  dialog.addEventListener('close', () => {
    preview.removeAttribute('src')
    if (opener?.isConnected) opener.focus()
    opener = null
  }, { signal })
  bindProductTour(root, signal)
}

function bindProductTour(root, signal) {
  const tabs = [...root.querySelectorAll('[data-tour-tab]')]
  const panel = root.querySelector('#product-tour-panel')
  if (!panel) return
  const select = (tab) => {
    const item = PRODUCT_TOUR.find((entry) => entry.id === tab.dataset.tourTab)
    if (!item) return
    tabs.forEach((button) => {
      const selected = button === tab
      button.setAttribute('aria-selected', String(selected))
      button.tabIndex = selected ? 0 : -1
    })
    panel.setAttribute('aria-labelledby', tab.id)
    panel.innerHTML = tourPanel(item)
  }
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab), { signal })
    tab.addEventListener('keydown', (event) => {
      const moves = { ArrowRight: (index + 1) % tabs.length, ArrowLeft: (index + tabs.length - 1) % tabs.length, Home: 0, End: tabs.length - 1 }
      if (!(event.key in moves)) return
      event.preventDefault()
      const next = tabs[moves[event.key]]
      select(next)
      next.focus()
    }, { signal })
  })
}
