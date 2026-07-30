import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')

await rm(dist, { recursive: true, force: true })
await mkdir(dist, { recursive: true })

for (const file of ['index.html', 'styles.css', 'content.js', 'app.js']) {
  await cp(path.join(root, file), path.join(dist, file))
}

await cp(path.join(root, 'public'), dist, { recursive: true })

const index = await readFile(path.join(dist, 'index.html'), 'utf8')
await writeFile(path.join(dist, '404.html'), index)

console.log(`Site ShenPulse généré dans ${dist}`)
