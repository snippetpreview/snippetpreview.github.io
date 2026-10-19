import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(fileURLToPath(new URL('../dist', import.meta.url)))
const portArgIndex = process.argv.indexOf('--port')
const port = Number(portArgIndex > -1 ? process.argv[portArgIndex + 1] : 4174)

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm'
}

function notFound(res) {
  const body = fs.readFileSync(path.join(root, '404.html'))
  res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' })
  res.end(body)
}

http
  .createServer((req, res) => {
    const url = new URL(req.url, `http://localhost:${port}`)
    const requested = path.join(root, decodeURIComponent(url.pathname))

    if (!requested.startsWith(root)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' })
      res.end('Forbidden')
      return
    }

    const filePath = url.pathname.endsWith('/') ? path.join(requested, 'index.html') : requested

    fs.stat(filePath, (error, stat) => {
      if (error || !stat.isFile()) {
        notFound(res)
        return
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(filePath)] || 'application/octet-stream',
        'Cache-Control': 'no-cache'
      })
      fs.createReadStream(filePath).pipe(res)
    })
  })
  .listen(port, () => {
    console.log('Serving dist/ with GitHub Pages 404 semantics')
    console.log(`  http://localhost:${port}/`)
    console.log(`  http://localhost:${port}/gist.github/95e2c10538e95f565120c5ed6adf947d/`)
    console.log(`  http://localhost:${port}/cache.html`)
  })
