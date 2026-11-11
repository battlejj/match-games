// Serves the production build like GitHub Pages does, under /match-games/,
// with switches the offline tests use to simulate the site's lifecycle.
//
//   GET /__control?mode=up|v2|down|v2-no-version-json   switch behavior
//   GET /__requests                                     requests since last call
//
// "v2" is the same build with a new version id and a marker in index.html
// (<meta name="e2e-build" content="v2">), standing in for a new release.
import { existsSync, readFileSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PORT = 4173
const PREFIX = '/match-games/'
const DIST = fileURLToPath(new URL('./.dist', import.meta.url))
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
}

let mode = 'up'
let requests = []

function v2Override(rel) {
  if (rel === 'index.html') {
    return readFileSync(join(DIST, rel), 'utf8').replace(
      '<head>',
      '<head><meta name="e2e-build" content="v2">',
    )
  }
  if (rel === 'version.json') {
    const manifest = JSON.parse(readFileSync(join(DIST, rel), 'utf8'))
    return JSON.stringify({ ...manifest, version: `${manifest.version}-v2` })
  }
  return null
}

createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost')
  if (url.pathname === '/__control') {
    mode = url.searchParams.get('mode') ?? mode
    res.writeHead(200).end(mode)
    return
  }
  if (url.pathname === '/__requests') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(requests))
    requests = []
    return
  }
  requests.push(url.pathname)

  if (mode === 'down') return res.writeHead(503).end('Site is down')
  if (!url.pathname.startsWith(PREFIX)) return res.writeHead(404).end()

  const rel =
    decodeURIComponent(url.pathname.slice(PREFIX.length)) || 'index.html'
  if (mode === 'v2-no-version-json' && rel === 'version.json') {
    return res.writeHead(404).end()
  }
  let file = join(DIST, rel)
  let status = 200
  if (!existsSync(file) || statSync(file).isDirectory()) {
    // GitHub Pages answers unknown paths with 404.html and a 404 status.
    file = join(DIST, '404.html')
    status = 404
  }
  const relFile = file.slice(DIST.length + 1)
  const body = mode.startsWith('v2')
    ? (v2Override(relFile) ?? readFileSync(file))
    : readFileSync(file)
  res.writeHead(status, {
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
    'cache-control': 'max-age=600',
  })
  res.end(body)
}).listen(PORT, () =>
  console.log(`e2e server on http://localhost:${PORT}${PREFIX}`),
)
