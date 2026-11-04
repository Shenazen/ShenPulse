import { readFile, access, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'parse5'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
  dist = path.join(root, 'dist')
const { publicPaths } = await import(
  pathToFileURL(path.join(dist, 'app/seo.js')).href
)
const origin = 'https://www.shenpulse.leuridan.fr',
  errors = [],
  pages = new Map(),
  titles = new Set(),
  descriptions = new Set()
const attr = (node, key) => node.attrs?.find((a) => a.name === key)?.value
const text = (node) =>
  (node.value || '') + (node.childNodes || []).map(text).join('')
const walk = (node) => [node, ...(node.childNodes || []).flatMap(walk)]
const check = (condition, message) => {
  if (!condition) errors.push(message)
}
for (const route of publicPaths()) {
  const html = await readFile(
    path.join(
      dist,
      route === '/' ? 'index.html' : route.slice(1) + '/index.html',
    ),
    'utf8',
  )
  const parseErrors = [],
    document = parse(html, {
      onParseError: (error) => parseErrors.push(error.code),
    }),
    nodes = walk(document)
  const tagged = (tag) => nodes.filter((n) => n.tagName === tag),
    meta = (key) =>
      tagged('meta').filter(
        (n) => attr(n, 'name') === key || attr(n, 'property') === key,
      )
  const title = text(tagged('title')[0]),
    description = attr(meta('description')[0], 'content')
  check(
    !parseErrors.length,
    route + ': HTML invalide ' + parseErrors.join(', '),
  )
  check(
    tagged('main').length === 1 && tagged('h1').length === 1,
    route + ': un seul main et h1 requis',
  )
  check(
    text(tagged('main')[0]).trim().length > 200,
    route + ': contenu principal absent sans JavaScript',
  )
  check(
    !html.includes('Chargement de ShenPulse'),
    route + ': ancienne coquille de chargement',
  )
  check(
    title?.includes('ShenPulse') && !titles.has(title),
    route + ': titre absent ou dupliqué',
  )
  check(
    meta('description').length === 1 &&
      description?.length >= 60 &&
      description.length <= 165 &&
      !descriptions.has(description),
    route + ': description absente ou dupliquée',
  )
  titles.add(title)
  descriptions.add(description)
  const canonical = tagged('link').filter((n) => attr(n, 'rel') === 'canonical')
  check(
    canonical.length === 1 && attr(canonical[0], 'href') === origin + route,
    route + ': canonical incorrect',
  )
  check(
    attr(meta('og:url')[0], 'content') === origin + route &&
      attr(meta('og:title')[0], 'content') === title &&
      attr(meta('og:description')[0], 'content') === description,
    route + ': métadonnées de partage incohérentes',
  )
  check(
    attr(meta('robots')[0], 'content') === 'index,follow',
    route + ': indexation bloquée',
  )
  const schemas = tagged('script').filter(
    (n) => attr(n, 'type') === 'application/ld+json',
  )
  try {
    const schema = JSON.parse(text(schemas[0]))
    check(
      schema['@context'] === 'https://schema.org' &&
        schema['@graph'].length >= 3,
      route + ': données structurées manquantes',
    )
    check(
      !schema['@graph'].some((item) => item.aggregateRating || item.review),
      route + ': avis non justifiés',
    )
  } catch {
    errors.push(route + ': JSON-LD illisible')
  }
  check(
    tagged('html')[0] && attr(tagged('html')[0], 'lang') === 'fr',
    route + ': langue manquante',
  )
  for (const img of tagged('img').filter((n) => attr(n, 'src'))) {
    check(Boolean(attr(img, 'alt')), route + ': image sans alternative')
    check(
      Number(attr(img, 'width')) > 0 && Number(attr(img, 'height')) > 0,
      route + ': dimensions image manquantes',
    )
  }
  pages.set(route, {
    nodes,
    ids: new Set(nodes.map((n) => attr(n, 'id')).filter(Boolean)),
    html,
  })
}
let links = 0
for (const [route, { nodes }] of pages) {
  for (const node of nodes.filter(
    (n) =>
      n.tagName === 'a' ||
      n.tagName === 'script' ||
      n.tagName === 'link' ||
      n.tagName === 'img',
  )) {
    const value = attr(
      node,
      node.tagName === 'script' || node.tagName === 'img' ? 'src' : 'href',
    )
    if (!value || value.startsWith('mailto:') || value.startsWith('tel:'))
      continue
    const url = new URL(value, origin + route)
    check(
      ['https:', 'http:'].includes(url.protocol),
      route + ': protocole de lien non sûr',
    )
    if (url.origin !== origin) continue
    links++
    if (url.pathname.startsWith('/downloads/')) continue
    if (pages.has(url.pathname)) {
      if (url.hash)
        check(
          pages
            .get(url.pathname)
            .ids.has(decodeURIComponent(url.hash.slice(1))),
          route + ': ancre absente ' + value,
        )
    } else {
      try {
        await access(path.join(dist, url.pathname))
      } catch {
        errors.push(route + ': lien ou ressource absent ' + value)
      }
    }
  }
}
const sitemap = await readFile(path.join(dist, 'sitemap.xml'), 'utf8')
const locations = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
check(
  locations.length === pages.size &&
    new Set(locations).size === pages.size &&
    [...pages.keys()].every((p) => locations.includes(origin + p)),
  'Sitemap différent des pages indexables',
)
const notFound = await readFile(path.join(dist, '404.html'), 'utf8')
check(
  notFound.includes('noindex,follow') &&
    notFound.includes('Cette page n’existe pas.'),
  '404 incorrecte',
)
const robot = await readFile(path.join(dist, 'robots.txt'), 'utf8')
check(
  robot.includes('Sitemap: ' + origin + '/sitemap.xml') &&
    !/Disallow:\s*\/\s*$/m.test(robot),
  'robots.txt bloque le site',
)
const build = JSON.parse(
  await readFile(
    path.join(root, '../.artifacts/website-seo/build-report.json'),
    'utf8',
  ),
)
const imageBytes = build.images.reduce((s, i) => s + i.originalBytes, 0),
  optimizedBytes = build.images.reduce((s, i) => s + i.largeBytes, 0)
await mkdir(path.join(root, '../.artifacts/website-seo'), { recursive: true })
await writeFile(
  path.join(root, '../.artifacts/website-seo/validation.json'),
  JSON.stringify(
    {
      checkedAt: new Date().toISOString(),
      pages: pages.size,
      links,
      imageBytes,
      optimizedBytes,
      errors,
    },
    null,
    2,
  ),
)
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else
  console.log(
    pages.size +
      ' pages HTML valides, ' +
      links +
      ' liens et ressources vérifiés ; images ' +
      Math.round(100 * (1 - optimizedBytes / imageBytes)) +
      ' % plus légères.',
  )
