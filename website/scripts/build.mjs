import { cp, mkdir, readFile, rm, writeFile, access } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'
import sharp from 'sharp'
import { currentPublicGames, serializePublicGames } from './game-catalog.mjs'
import { buildStyles } from './styles.mjs'
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const project = path.dirname(root),
  dist = path.join(root, 'dist')
const require = createRequire(import.meta.url)
await buildStyles()
await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })
for (const file of ['index.html', 'styles.css', 'content.js', 'app.js'])
  await cp(path.join(root, file), path.join(dist, file))
const games = currentPublicGames()
await writeFile(path.join(dist, 'game-catalog.js'), serializePublicGames(games))
await cp(path.join(root, 'public'), dist, { recursive: true })
await cp(path.join(root, 'app'), path.join(dist, 'app'), { recursive: true })
await mkdir(path.join(dist, 'fonts'), { recursive: true })
for (const file of ['inter-latin-wght-normal.woff2', 'LICENSE-Inter.txt'])
  await cp(
    path.join(project, 'resources', 'overlays', 'fonts', file),
    path.join(dist, 'fonts', file),
  )
const { CLIENT_RELEASE } = await import(
  pathToFileURL(path.join(dist, 'content.js')).href + '?v=20261104-seo1'
)
const images = {},
  imageReport = []
await mkdir(path.join(dist, 'images'), { recursive: true })
async function optimize(key, input, largeWidth, smallWidth) {
  const image = sharp(input, { limitInputPixels: 50000000 }).rotate()
  const original = await readFile(input),
    digest = createHash('sha256').update(original).digest('hex').slice(0, 12)
  const basename = key.replace(/[^a-z0-9-]/gi, '-').replace(/^-+/, '') + '-' + digest
  const large = '/images/' + basename + '-' + largeWidth + '.webp',
    small = '/images/' + basename + '-' + smallWidth + '.webp'
  const largeInfo = await image
    .clone()
    .resize({ width: largeWidth, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toFile(path.join(dist, large))
  const smallInfo = await image
    .clone()
    .resize({ width: smallWidth, withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(path.join(dist, small))
  images[key] = {
    large,
    small,
    width: largeInfo.width,
    height: largeInfo.height,
    smallWidth: smallInfo.width,
  }
  imageReport.push({
    key,
    originalBytes: original.length,
    largeBytes: largeInfo.size,
    smallBytes: smallInfo.size,
  })
}
const { SCREENSHOTS } = await import(
  pathToFileURL(path.join(dist, 'app/screenshots.js')).href + '?v=20261104-seo1'
)
for (const src of Object.keys(SCREENSHOTS))
  await optimize(src, path.join(dist, src), 1440, 720)
const packs = require(
  path.join(project, 'src/main/game-catalog.js'),
).loadShenazenGameCatalog(path.join(project, 'resources'))
const artworkRoot = path.resolve(project, 'src/renderer/assets/games')
for (const game of games) {
  const pack = packs.find(
    (p) =>
      p.id === (game.id === 'minecraft' ? 'minecraft-bedrock-box' : game.id),
  )
  if (!pack?.artwork) continue
  const input = path.resolve(artworkRoot, pack.artwork)
  if (!input.startsWith(artworkRoot + path.sep))
    throw Error('Image hors racine : ' + game.id)
  try {
    await access(input)
  } catch {
    continue
  }
  await optimize('game-' + game.id, input, 720, 360)
}
await optimize(
  'brand-logo',
  path.join(dist, 'brand/shenpulse-logo.png'),
  630,
  315,
)
await sharp(path.join(dist, 'brand/shenpulse-icon.png'))
  .resize(64, 64)
  .png()
  .toFile(path.join(dist, 'brand/favicon-64.png'))
await writeFile(
  path.join(dist, 'image-assets.js'),
  'export const IMAGES = ' + JSON.stringify(images, null, 2) + '\n',
)
const markdown = await readFile(
  path.join(project, 'docs/releases', CLIENT_RELEASE.version + '.fr.md'),
  'utf8',
)
const escape = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
const inline = (text) =>
  escape(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
let releaseHtml = '',
  list = false
for (const line of markdown.split(/\r?\n/)) {
  if (line.startsWith('# ')) continue
  if (line.startsWith('- ')) {
    if (!list) {
      releaseHtml += '<ul>'
      list = true
    }
    releaseHtml += '<li>' + inline(line.slice(2)) + '</li>'
    continue
  }
  if (list) {
    releaseHtml += '</ul>'
    list = false
  }
  if (line.startsWith('## '))
    releaseHtml += '<h2>' + inline(line.slice(3)) + '</h2>'
  else if (line.trim()) releaseHtml += '<p>' + inline(line) + '</p>'
}
if (list) releaseHtml += '</ul>'
await writeFile(
  path.join(dist, 'public-release.js'),
  'export const PUBLIC_RELEASE = ' +
    JSON.stringify({
      date: CLIENT_RELEASE.publishedAt || '2026-11-04',
      displayDate: CLIENT_RELEASE.displayDate || '4 novembre 2026',
      html: releaseHtml,
    }) +
    '\n',
)
const { resolvePage, publicPaths, pageGraph } = await import(
  pathToFileURL(path.join(dist, 'app/seo.js')).href + '?build=' + Date.now()
)
const { header, footer } = await import(
  pathToFileURL(path.join(dist, 'app/pages.js')).href + '?v=20261104-seo1'
)
const { screenshotDialog } = await import(
  pathToFileURL(path.join(dist, 'app/visual-tour.js')).href + '?v=20261104-seo1'
)
const template = await readFile(path.join(root, 'index.html'), 'utf8')
const buildDate = new Date().toISOString().slice(0, 10),
  pages = []
function documentHtml(page) {
  const origin = 'https://www.shenpulse.leuridan.fr',
    canonical = origin + page.path
  let html = template.replace(
    /<title>[\s\S]*?<\/title>/,
    '<title>' + escape(page.title) + '</title>',
  )
  html = html.replace(
    /(<meta\s+name="description"\s+content=")[^"]*("\s*\/>)/,
    '$1' + escape(page.description) + '$2',
  )
  for (const key of ['og:title', 'twitter:title'])
    html = html.replace(
      new RegExp(
        '(<meta\\s+(?:property|name)="' +
          key +
          '"\\s+content=")[^"]*("\\s*\\/>)',
      ),
      '$1' + escape(page.title) + '$2',
    )
  for (const key of ['og:description', 'twitter:description'])
    html = html.replace(
      new RegExp(
        '(<meta\\s+(?:property|name)="' +
          key +
          '"\\s+content=")[^"]*("\\s*\\/>)',
      ),
      '$1' + escape(page.description) + '$2',
    )
  html = html
    .replace(/(<link rel="canonical" href=")[^"]*(")/, '$1' + canonical + '$2')
    .replace(
      /(<meta property="og:url" content=")[^"]*(")/,
      '$1' + canonical + '$2',
    )
  html = html.replace(
    '<html lang="fr">',
    '<html lang="fr" class="no-js" data-page="' + page.pageClass + '">',
  )
  if (page.status !== 200)
    html = html.replace('content="index,follow"', 'content="noindex,follow"')
  const schema =
    '<script id="page-schema" type="application/ld+json">' +
    JSON.stringify(pageGraph(page)).replace(/</g, '\\u003c') +
    '</script>'
  const body =
    '<body><a class="skip-link" href="#main">Aller au contenu</a><div id="app" data-route="' +
    page.path +
    '">' +
    header(page.path) +
    page.content +
    footer() +
    screenshotDialog() +
    '</div><noscript><p class="noscript-note">Le contenu et les liens sont accessibles sans JavaScript. Les aperçus interactifs et filtres nécessitent son activation.</p></noscript><script type="module" src="/app.js?v=20261104-seo1"></script></body>'
  return html
    .replace('</head>', schema + '\n</head>')
    .replace(/<body>[\s\S]*<\/body>/, body)
}
for (const route of publicPaths()) {
  const page = resolvePage(route),
    relative = route === '/' ? 'index.html' : route.slice(1) + '/index.html'
  await mkdir(path.dirname(path.join(dist, relative)), { recursive: true })
  const html = documentHtml(page)
  await writeFile(path.join(dist, relative), html)
  pages.push({
    path: route,
    file: relative,
    title: page.title,
    description: page.description,
    bytes: Buffer.byteLength(html),
  })
}
await writeFile(path.join(dist, '404.html'), documentHtml(resolvePage('/404')))
const locations = pages
  .map(
    (p) =>
      '  <url><loc>https://www.shenpulse.leuridan.fr' +
      escape(p.path) +
      '</loc></url>',
  )
  .join('\n')
await writeFile(
  path.join(dist, 'sitemap.xml'),
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    locations +
    '\n</urlset>\n',
)
const reportDirectory = path.join(project, '.artifacts/website-seo')
await mkdir(reportDirectory, { recursive: true })
await writeFile(
  path.join(reportDirectory, 'build-report.json'),
  JSON.stringify(
    {
      builtAt: new Date().toISOString(),
      buildDate,
      pages,
      images: imageReport,
    },
    null,
    2,
  ),
)
console.log(
  pages.length +
    ' pages HTML complètes, ' +
    imageReport.length +
    ' images optimisées. Site généré dans ' +
    dist,
)
