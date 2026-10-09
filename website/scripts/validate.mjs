import { access, readFile, readdir, stat } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
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
const app = await readFile(path.join(dist, 'app.js'), 'utf8')
const content = await readFile(path.join(dist, 'content.js'), 'utf8')
const { GAMES } = await import(pathToFileURL(path.join(dist, 'game-catalog.js')).href)
const expectedGames = currentPublicGames()
const expectedDownload = '/downloads/ShenPulseSetup-1.0.14.exe'
const hiddenProviderPattern = new RegExp(['crowd', 'control'].join('\\s*'), 'i')

for (const file of ['app.js', 'content.js', 'game-catalog.js']) {
  try {
    execFileSync(process.execPath, ['--check', path.join(dist, file)], { stdio: 'pipe' })
  } catch (error) {
    errors.push(`JavaScript invalide dans ${file} : ${String(error.stderr || error.message).trim()}`)
  }
}

if (!app.includes(`const DOWNLOAD_URL = '${expectedDownload}'`)) {
  errors.push(`Lien de téléchargement principal incorrect : ${expectedDownload}`)
}

if (!index.includes(`href="${expectedDownload}"`)) {
  errors.push(`Lien de téléchargement sans JavaScript incorrect : ${expectedDownload}`)
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

const allDistFiles = await walk(dist)
for (const file of allDistFiles.filter((candidate) => /\.(?:html|js|css|xml|txt|webmanifest)$/i.test(candidate))) {
  const publicText = await readFile(file, 'utf8')
  if (hiddenProviderPattern.test(publicText)) {
    errors.push(`Terme fournisseur interdit dans ${path.relative(dist, file)}`)
  }
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
