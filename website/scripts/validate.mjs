import { access, readFile, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { currentPublicGames } from './game-catalog.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const errors = []

const requiredFiles = [
  'index.html',
  '404.html',
  'styles.css',
  'app.js',
  'app/legal-pages.js',
  'app/html.js',
  'app/product-tour.js',
  'app/screenshots.js',
  'app/visual-tour.js',
  'content.js',
  'game-catalog.js',
  'og.png',
  'brand/shenpulse-logo.png',
  'screenshots/app-overview-public.png',
  'screenshots/actions-public.png',
  'screenshots/overlays-public.png',
  'screenshots/games-public.png',
  'screenshots/sounds-public.png',
  'screenshots/subscription-public.png',
  'screenshots/home-public.png',
  'screenshots/commands-public.png',
  'screenshots/matches-public.png',
  'screenshots/music-public.png',
  'screenshots/irl-public.png',
  'screenshots/users-public.png',
  'fonts/inter-latin-wght-normal.woff2',
  'fonts/LICENSE-Inter.txt',
  'site.webmanifest',
  'robots.txt',
  'sitemap.xml'
]

for (const file of requiredFiles) {
  try {
    await access(path.join(dist, file))
  } catch {
    errors.push(`Fichier manquant : ${file}`)
  }
}

const index = await readFile(path.join(dist, 'index.html'), 'utf8')
const allDistFiles = await walk(dist)
const appModules = allDistFiles.filter((file) => file === path.join(dist, 'app.js') || (file.startsWith(path.join(dist, 'app') + path.sep) && /\.(?:js|mjs)$/i.test(file)))
const app = (await Promise.all(appModules.map((file) => readFile(file, 'utf8')))).join('\n')
const content = await readFile(path.join(dist, 'content.js'), 'utf8')
const { GAMES } = await import(pathToFileURL(path.join(dist, 'game-catalog.js')).href)
const expectedGames = currentPublicGames()
const projectPackage = JSON.parse(await readFile(path.join(root, '..', 'package.json'), 'utf8'))
const sitePackage = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const { APP_TABS, CLIENT_RELEASE } = await import(pathToFileURL(path.join(dist, 'content.js')).href)
const { SCREENSHOTS } = await import(pathToFileURL(path.join(dist, 'app/screenshots.js')).href)
const { PRODUCT_TOUR } = await import(pathToFileURL(path.join(dist, 'app/product-tour.js')).href)
const expectedDownload = `/downloads/ShenPulseSetup-${projectPackage.version}.exe`
const hiddenProviderPattern = new RegExp(['crowd', 'control'].join('\\s*'), 'i')

for (const file of allDistFiles.filter((file) => /\.(?:js|mjs)$/i.test(file))) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' })
  } catch (error) {
    errors.push(`JavaScript invalide dans ${path.relative(dist, file)} : ${String(error.stderr || error.message).trim()}`)
  }
}

// Le manifeste partage les vraies dimensions avec le HTML. Ne jamais déduire
// un ratio de présentation d'un ancien fichier de capture.
const expectedScreenshots = requiredFiles.filter((file) => file.startsWith('screenshots/'))
if (Object.keys(SCREENSHOTS || {}).length !== expectedScreenshots.length) errors.push('Le manifeste doit décrire exactement les 12 captures publiques')
for (const file of expectedScreenshots) {
  const metadata = SCREENSHOTS?.[`/${file}`]
  if (!metadata || metadata.width !== 1440 || metadata.height !== 900) {
    errors.push(`Dimensions absentes ou inattendues dans le manifeste : ${file}`)
    continue
  }
  try {
    const image = await readFile(path.join(dist, file))
    const validPng = image.length >= 24 && image.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) && image.toString('ascii', 12, 16) === 'IHDR'
    if (!validPng || image.readUInt32BE(16) !== metadata.width || image.readUInt32BE(20) !== metadata.height) errors.push(`Le PNG ne correspond pas au manifeste : ${file}`)
    if (!/^[a-f0-9]{64}$/.test(metadata.sha256 || '') || createHash('sha256').update(image).digest('hex') !== metadata.sha256) errors.push(`L’empreinte SHA-256 de la capture ne correspond pas au manifeste : ${file}`)
  } catch { errors.push(`Capture PNG illisible : ${file}`) }
}
for (const [src] of Object.entries(SCREENSHOTS || {})) {
  if (!expectedScreenshots.includes(src.slice(1))) errors.push(`Capture inattendue dans le manifeste : ${src}`)
}
try {
  const font = await readFile(path.join(dist, 'fonts/inter-latin-wght-normal.woff2'))
  if (font.length < 100 || font.toString('ascii', 0, 4) !== 'wOF2') errors.push('La police locale Inter WOFF2 est invalide')
  const license = await readFile(path.join(dist, 'fonts/LICENSE-Inter.txt'), 'utf8')
  if (!license.includes('SIL OPEN FONT LICENSE')) errors.push('La licence de la police locale Inter est absente ou incorrecte')
} catch { errors.push('La police Inter ou sa licence est illisible') }
const guideIds = new Set([...APP_TABS.map((tab) => tab.id), 'jeux'])
if (PRODUCT_TOUR.length !== 11 || new Set(PRODUCT_TOUR.map((item) => item.id)).size !== PRODUCT_TOUR.length) errors.push('Le parcours doit contenir 11 onglets distincts')
for (const item of PRODUCT_TOUR) {
  if (!guideIds.has(item.guide)) errors.push(`Guide du parcours introuvable : ${item.id} → ${item.guide}`)
  if (!SCREENSHOTS[`/screenshots/${item.image}`]) errors.push(`Capture du parcours introuvable : ${item.id} → ${item.image}`)
}
for (const match of `${app}\n${content}\n${index}`.matchAll(/(?:['"`])((?:\/screenshots\/)[a-zA-Z0-9._-]+\.png)/g)) {
  if (!SCREENSHOTS[match[1]]) errors.push(`Référence à une capture absente du manifeste : ${match[1]}`)
}

if (!app.includes(`const DOWNLOAD_URL = '${expectedDownload}'`)) {
  errors.push(`Lien de téléchargement principal incorrect : ${expectedDownload}`)
}

if (!index.includes(`href="${expectedDownload}"`)) {
  errors.push(`Lien de téléchargement sans JavaScript incorrect : ${expectedDownload}`)
}

if (sitePackage.version !== projectPackage.version || CLIENT_RELEASE.version !== projectPackage.version) {
  errors.push('La version du site et de ses notes ne correspond pas à celle de l’application')
}

for (const tab of ['Commandes', 'Matchs', 'Machines IRL', 'Musique', 'Utilisateurs']) {
  if (!APP_TABS.some((item) => item.title === tab)) errors.push(`Espace actuel non documenté : ${tab}`)
}

if (APP_TABS.some((item) => item.title === 'Chatbot') || content.includes('Sous-onglet Simulateur')) {
  errors.push('Une ancienne présentation du Chatbot ou du simulateur des Actions subsiste')
}
for (const id of ['session-direct', 'objectifs', 'controleurs', 'parametres', 'admin', 'studio-live']) {
  if (APP_TABS.some((item) => item.id === id)) errors.push(`Ancien espace ou page privée documenté comme onglet public : ${id}`)
}

if (`${index}\n${app}`.includes('/downloads/ShenPulseSetup.exe')) {
  errors.push('L’ancien lien de téléchargement non versionné est encore référencé')
}

if (JSON.stringify(GAMES) !== JSON.stringify(expectedGames)) {
  errors.push('Le catalogue du site ne correspond pas au catalogue public actuel de l’application')
}

for (const game of GAMES) {
  if (!game.description || game.description.length < 100) {
    errors.push(`Description publique manquante ou trop courte : ${game.name}`)
  }
  if (!game.interactionGuide || game.interactionGuide.length < 80) {
    errors.push(`Présentation des interactions manquante ou trop courte : ${game.name}`)
  }
  if (!game.requirements || game.requirements.length < 60) {
    errors.push(`Prérequis publics manquants ou trop courts : ${game.name}`)
  }
}

for (const route of [
  '/',
  '/docs',
  '/cgu',
  '/cgv',
  '/mentions-legales',
  '/confidentialite',
  '/cookies'
]) {
  if (!app.includes(`'${route}'`) && !app.includes(`"${route}"`)) {
    errors.push(`Route non référencée : ${route}`)
  }
}

for (const retiredRoute of ['/login', '/setup', '/admin']) {
  if (!app.includes(retiredRoute)) {
    errors.push(`Route retirée non couverte : ${retiredRoute}`)
  }
}

for (const text of [
  'ShenPulse',
  'Télécharger',
  'Documentation',
  'Conditions générales d’utilisation',
  'Mentions légales',
  'Politique de confidentialité'
]) {
  if (!`${index}\n${app}\n${content}`.includes(text)) {
    errors.push(`Contenu attendu absent : ${text}`)
  }
}

if (/paypal\.com|paypal\.me/i.test(`${index}\n${app}\n${content}`)) {
  errors.push('Un lien PayPal public subsiste dans le site')
}

for (const file of allDistFiles.filter((candidate) => /\.(?:html|js|css|xml|txt|webmanifest)$/i.test(candidate))) {
  const publicText = await readFile(file, 'utf8')
  if (hiddenProviderPattern.test(publicText)) {
    errors.push(`Terme fournisseur interdit dans ${path.relative(dist, file)}`)
  }
  const privatePatterns = [
    /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/,
    /\bAIza[0-9A-Za-z_-]{30,}\b/,
    /\beyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}\b/,
    /(?:https?:\/\/[^\s'"<>]+[?&](?:access_token|refresh_token|id_token|signature|token)=)[^\s'"<>&]{8,}/i,
    /(?:[A-Z]:\\Users\\|file:\/\/\/|\/Users\/|\/home\/)[^\s'"<>]+/i,
    /https?:\/\/[^\s'"<>]*shenpulse-overlays\.web\.app\/[^\s'"<>]+/i
  ]
  if (privatePatterns.some((pattern) => pattern.test(publicText))) errors.push(`Identifiant privé, lien protégé ou chemin personnel dans ${path.relative(dist, file)}`)
}
const forbiddenScreenshots = [
  'screenshots/vue-ensemble.png',
  'screenshots/actions.png',
  'screenshots/overlays.png',
  'screenshots/jeux.png',
  'screenshots/sons.png',
  'screenshots/abonnements.png'
]
for (const file of forbiddenScreenshots) {
  if (allDistFiles.includes(path.join(dist, file))) {
    errors.push(`Ancienne capture non recadrée encore publiée : ${file}`)
  }
}

const executable = allDistFiles.find((file) => file.toLowerCase().endsWith('.exe'))
if (executable) {
  errors.push(`L’installateur ne doit pas être recopié : ${path.relative(dist, executable)}`)
}

if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
} else {
  console.log(`${allDistFiles.length} fichiers contrôlés, routes publiques conformes.`)
}

async function walk(directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...(await walk(full)))
    else if ((await stat(full)).isFile()) files.push(full)
  }
  return files
}
