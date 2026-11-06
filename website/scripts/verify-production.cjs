// Contrôles en lecture seule du site publié ; aucun accès aux profils clients.
const fs = require('node:fs')
const build = JSON.parse(
  fs.readFileSync('.artifacts/website-seo/build-report.json', 'utf8'),
)
const version = require('../../package.json').version
const installerBytes = fs.statSync(
  'dist/ShenPulseSetup-' + version + '.exe',
).size
const origin = 'https://www.shenpulse.leuridan.fr',
  errors = [],
  results = []
const check = (ok, message) => {
  if (!ok) errors.push(message)
}
async function get(url, options = {}) {
  const started = Date.now()
  const r = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20000),
    ...options,
  })
  const text = options.method === 'HEAD' ? '' : await r.text()
  return {
    url,
    status: r.status,
    headers: Object.fromEntries(r.headers),
    text,
    ms: Date.now() - started,
  }
}
async function run() {
  let index = 0
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      while (index < build.pages.length) {
        const p = build.pages[index++]
        try {
          const r = await get(origin + p.path)
          check(r.status === 200, p.path + ': HTTP ' + r.status)
          check(
            r.text.includes('<title>' + p.title + '</title>'),
            p.path + ': titre publié incorrect',
          )
          check(
            r.text.includes('data-route="' + p.path + '"'),
            p.path + ': contenu absent',
          )
          check(
            r.text.includes('href="' + origin + p.path + '"'),
            p.path + ': canonical absent',
          )
          const schemaMatch = r.text.match(
            /<script id="page-schema" type="application\/ld\+json">([\s\S]*?)<\/script>/,
          )
          const schema = JSON.parse(schemaMatch?.[1] || 'null')
          check(
            Boolean(schema?.['@graph']?.length >= 3),
            p.path + ': données structurées absentes',
          )
          check(
            !schema?.['@graph']?.some(
              (item) =>
                item['@type'] === 'SoftwareApplication' ||
                item.aggregateRating ||
                item.review,
            ),
            p.path + ': balisage enrichi non vérifié',
          )
          check(
            r.headers['content-type']?.startsWith('text/html'),
            p.path + ': type MIME',
          )
          check(
            r.headers['content-encoding'] === 'gzip',
            p.path + ': compression absente',
          )
          results.push({
            path: p.path,
            status: r.status,
            ms: r.ms,
            bytes: Buffer.byteLength(r.text),
            encoding: r.headers['content-encoding'],
          })
        } catch (e) {
          errors.push(p.path + ': ' + e.message)
        }
      }
    }),
  )
  for (const [url, target] of [
    [origin + '/index.html', origin + '/'],
    [origin + '/guides/', origin + '/guides'],
    [origin + '/guides/index.html', origin + '/guides'],
    ['https://shenpulse.leuridan.fr/jeux', origin + '/jeux'],
    ['http://www.shenpulse.leuridan.fr/docs', origin + '/docs'],
  ]) {
    const r = await get(url)
    check(
      r.status === 301 && r.headers.location === target,
      url + ': redirection incorrecte ' + r.status + ' ' + r.headers.location,
    )
  }
  for (const p of [
    '/page-inexistante-seo-verification',
    '/admin',
    '/jeux/jeu-prive-inexistant',
  ]) {
    const r = await get(origin + p)
    check(
      r.status === 404 && r.text.includes('noindex,follow'),
      p + ': vraie 404 absente',
    )
  }
  const sitemap = await get(origin + '/sitemap.xml')
  check(
    sitemap.status === 200 &&
      sitemap.headers['content-type']?.includes('xml') &&
      (sitemap.text.match(/<loc>/g) || []).length === build.pages.length,
    'Sitemap public invalide',
  )
  const robot = await get(origin + '/robots.txt')
  check(
    robot.status === 200 &&
      robot.headers['content-type']?.startsWith('text/plain'),
    'robots MIME invalide',
  )
  const verify = await get(origin + '/google8d73906802c6ec67.html')
  check(
    verify.text.trim() ===
      fs
        .readFileSync('website/public/google8d73906802c6ec67.html', 'utf8')
        .trim(),
    'Validation Google inaccessible',
  )
  const installer = await get(
    origin + '/downloads/ShenPulseSetup-' + version + '.exe',
    { method: 'HEAD' },
  )
  check(
    installer.status === 200 &&
      Number(installer.headers['content-length']) === installerBytes,
    'Installateur ' + version + ' incorrect',
  )
  for (const host of ['https://shenpulse.leuridan.fr', origin]) {
    const health = await get(host + '/api/live/health')
    const data = JSON.parse(health.text)
    check(
      health.status === 200 && data.ok === true,
      'Service LIVE indisponible ou redirigé ' + host,
    )
    const payment = await get(host + '/api/payments/config')
    check(
      payment.status === 200 &&
        payment.headers['content-type']?.includes('json'),
      'Route paiement modifiée ' + host,
    )
  }
  const manifest = await import('../dist/image-assets.js') // import depuis scripts -> dist
  const image = await get(origin + manifest.IMAGES['game-palworld'].small, {
    method: 'HEAD',
  })
  check(
    image.status === 200 &&
      image.headers['content-type'] === 'image/webp' &&
      image.headers['cache-control']?.includes('immutable'),
    'Cache image incorrect',
  )
  const html = await get(origin + '/', { method: 'HEAD' })
  const cached = await get(origin + '/', {
    method: 'HEAD',
    headers: { 'If-None-Match': html.headers.etag },
  })
  check(cached.status === 304, 'Revalidation ETag incorrecte')
  const report = {
    checkedAt: new Date().toISOString(),
    pages: results.length,
    results,
    errors,
    sitemapPages: (sitemap.text.match(/<loc>/g) || []).length,
    apiHealthChecked: true,
    installerBytes: Number(installer.headers['content-length']),
  }
  fs.writeFileSync(
    '.artifacts/website-seo/production-check.json',
    JSON.stringify(report, null, 2),
  )
  console.log(
    JSON.stringify(
      {
        pages: results.length,
        errors,
        sitemapPages: report.sitemapPages,
        installerBytes: report.installerBytes,
      },
      null,
      2,
    ),
  )
  if (errors.length) process.exitCode = 1
}
run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
