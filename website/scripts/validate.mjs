import { access, readFile, readdir, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const errors = []

const requiredFiles = [
  'index.html',
  '404.html',
  'styles.css',
  'app.js',
  'content.js',
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
const { GAMES } = await import(pathToFileURL(path.join(dist, 'content.js')).href)
const expectedDownload = '/downloads/ShenPulseSetup-1.0.6.exe'

if (!app.includes(`const DOWNLOAD_URL = '${expectedDownload}'`)) {
  errors.push(`Lien de téléchargement principal incorrect : ${expectedDownload}`)
}

if (!index.includes(`href="${expectedDownload}"`)) {
  errors.push(`Lien de téléchargement sans JavaScript incorrect : ${expectedDownload}`)
}

if (`${index}\n${app}`.includes('/downloads/ShenPulseSetup.exe')) {
  errors.push('L’ancien lien de téléchargement non versionné est encore référencé')
}

if (GAMES.length !== 8) {
  errors.push(`La documentation doit contenir exactement 8 jeux publics, trouvé : ${GAMES.length}`)
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

const unpublishedGames = [
  'ARK: Survival Ascended',
  'Balatro',
  'Blue Prince',
  'Celeste',
  'Cities Skylines',
  'Dead by Daylight',
  'Deep Rock Galactic',
  'Diamond Drop Live',
  'DREDGE',
  'Egging On',
  'Fallout 4',
  'Hades II',
  'Hollow Knight',
  'Inscryption',
  'Kingdom Come: Deliverance II',
  'Le Pont des Diamants',
  'No Man’s Sky',
  'Palworld',
  'Pokémon Rouge/Bleu',
  'Resident Evil 7 Biohazard',
  'Supermarket Simulator',
  'Vampire Survivors',
  'Wobbly Life'
]
for (const game of unpublishedGames) {
  if (`${app}\n${content}`.includes(game)) {
    errors.push(`Jeu non publié encore mentionné : ${game}`)
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
