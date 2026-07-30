import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const client = path.join(dist, 'client')
const server = path.join(dist, 'server')

await rm(dist, { recursive: true, force: true })
await mkdir(client, { recursive: true })
await mkdir(server, { recursive: true })

for (const file of ['index.html', 'styles.css', 'content.js', 'app.js']) {
  await cp(path.join(root, file), path.join(dist, file))
  await cp(path.join(root, file), path.join(client, file))
}

await cp(path.join(root, 'public'), dist, { recursive: true })
await cp(path.join(root, 'public'), client, { recursive: true })
await cp(path.join(root, 'worker', 'index.js'), path.join(server, 'index.js'))

const index = await readFile(path.join(dist, 'index.html'), 'utf8')
await writeFile(path.join(dist, '404.html'), index)

console.log(`Site ShenPulse généré dans ${dist}`)
