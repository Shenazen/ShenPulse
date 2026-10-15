import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { currentPublicGames, serializePublicGames } from './game-catalog.mjs'
import { buildStyles } from './styles.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

await buildStyles()

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

for (const file of ['index.html', 'styles.css', 'content.js', 'app.js']) {
  await cp(path.join(root, file), path.join(dist, file))
}

await writeFile(
  path.join(dist, 'game-catalog.js'),
  serializePublicGames(currentPublicGames())
)

await cp(path.join(root, 'public'), dist, { recursive: true })
await cp(path.join(root, 'app'), path.join(dist, 'app'), { recursive: true })
// Même famille que l’application, servie localement : aucun appel à un CDN de polices.
await mkdir(path.join(dist, 'fonts'), { recursive: true })
for (const file of ['inter-latin-wght-normal.woff2', 'LICENSE-Inter.txt']) {
  await cp(path.join(root, '..', 'resources', 'overlays', 'fonts', file), path.join(dist, 'fonts', file))
}

const index = await readFile(path.join(dist, 'index.html'), 'utf8')
await writeFile(path.join(dist, '404.html'), index)

console.log(`Site ShenPulse généré dans ${dist}`)
