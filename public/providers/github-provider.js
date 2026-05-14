import { fail, ok } from './provider-adapter.js'

const PREVIEW_REGEX = /^\/gist\.github\/([^/]+)(?:\/(.+))?\/?$/i
const CANONICAL_HOST = 'gist.github.com'

function fetchJson(url) {
  return fetch(url, { credentials: 'omit' }).then(async (res) => {
    const text = await res.text()
    try {
      return { ok: res.ok, status: res.status, headers: res.headers, json: JSON.parse(text), text }
    } catch {
      return { ok: res.ok, status: res.status, headers: res.headers, json: null, text }
    }
  })
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function makeHtmlResponse(title, bodyHtml, status = 200) {
  const html = `<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>${escapeHtml(title)}</title></head><body>${bodyHtml}</body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function normalizeFilePath(filePath) {
  if (!filePath) {
    return ''
  }
  if (filePath.startsWith('/')) {
    return filePath.slice(1)
  }
  return filePath
}

export const githubProvider = {
  id: 'gist.github',

  parsePreviewPath(pathname) {
    const match = pathname.match(PREVIEW_REGEX)
    if (!match) {
      return fail('no-match', 'Path does not match gist.github preview namespace')
    }

    const resourceId = decodeURIComponent(match[1] || '').trim()
    const encodedPath = match[2] || ''
    const decodedPath = encodedPath ? decodeURIComponent(encodedPath).trim() : ''

    if (!resourceId) {
      return fail('missing-id', 'Missing gist id')
    }

    return ok({
      resourceId,
      filePath: decodedPath || ''
    })
  },

  parseCanonicalUrl(urlText) {
    let url
    try {
      url = new URL(urlText)
    } catch {
      return fail('invalid-url', 'Malformed URL')
    }

    if (url.host !== CANONICAL_HOST) {
      return fail('invalid-host', 'Not a gist.github.com URL')
    }

    const parts = url.pathname.split('/').filter(Boolean)
    if (parts.length === 0) {
      return fail('missing-id', 'Missing gist id in URL path')
    }

    let username = ''
    let resourceId = ''

    if (parts.length >= 2) {
      username = parts[0]
      resourceId = parts[1]
    } else {
      resourceId = parts[0]
    }

    if (!resourceId) {
      return fail('missing-id', 'Missing gist id in URL path')
    }

    const filePath = (url.hash || '').replace(/^#/, '').trim()

    return ok({
      resourceId,
      filePath,
      username
    })
  },

  buildPreviewPath({ resourceId, filePath }) {
    const id = String(resourceId || '').trim()
    if (!id) {
      return fail('missing-id', 'Missing gist id')
    }

    const normalized = normalizeFilePath(String(filePath || '').trim())
    const encodedPath = normalized ? `/${encodeURIComponent(normalized)}` : ''
    return ok(`/gist.github/${encodeURIComponent(id)}${encodedPath}`)
  },

  buildCanonicalUrl({ resourceId, filePath, username }) {
    const id = String(resourceId || '').trim()
    if (!id) {
      return fail('missing-id', 'Missing gist id')
    }

    const name = String(username || '').trim()
    const normalized = normalizeFilePath(String(filePath || '').trim())
    const hash = normalized ? `#${normalized}` : ''
    const path = name ? `/${name}/${id}` : `/${id}`
    return ok(`https://gist.github.com${path}${hash}`)
  },

  async handlePreview({ resourceId, filePath }) {
    const apiUrl = `https://api.github.com/gists/${resourceId}`
    const meta = await fetchJson(apiUrl)

    if (!meta.ok) {
      const detail = `<h1>Gist Error</h1><p>GitHub API returned status ${meta.status}</p><pre>${escapeHtml(JSON.stringify(meta.json || meta.text || {}, null, 2))}</pre><p><a href=\"/\">← Back to home</a></p>`
      return makeHtmlResponse('Gist Error', detail, meta.status || 502)
    }

    const data = meta.json
    if (!data || !data.files) {
      return makeHtmlResponse('Gist Not Found', '<h1>404 - Gist Not Found</h1><p>Invalid gist response.</p><p><a href=\"/\">← Back to home</a></p>', 404)
    }

    let fileEntry = null
    const requested = normalizeFilePath(String(filePath || '').trim())
    if (requested) {
      fileEntry = data.files[requested] || null
    }

    if (!fileEntry) {
      const keys = Object.keys(data.files)
      if (keys.length === 0) {
        return makeHtmlResponse('Gist Empty', '<h1>Gist is empty</h1><p>No files available.</p><p><a href=\"/\">← Back to home</a></p>', 404)
      }
      fileEntry = data.files[keys[0]]
    }

    let content = fileEntry.content
    if (fileEntry.truncated && fileEntry.raw_url) {
      try {
        const r = await fetch(fileEntry.raw_url)
        if (!r.ok) {
          return makeHtmlResponse('Gist Fetch Error', `<h1>Unable to fetch gist file</h1><p>HTTP ${r.status}</p><p><a href=\"/\">← Back to home</a></p>`, r.status)
        }
        content = await r.text()
      } catch (e) {
        return makeHtmlResponse('Gist Fetch Error', `<h1>Network error fetching gist file</h1><pre>${escapeHtml(String(e))}</pre><p><a href=\"/\">← Back to home</a></p>`, 502)
      }
    }

    const filename = fileEntry.filename || ''
    const isHtml = /\.(html?|xhtml)$/i.test(filename) || /<\s*html[\s>]/i.test(content)
    if (isHtml) {
      return new Response(content, { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    }

    const wrapped = `<h1>${escapeHtml(filename)}</h1><pre>${escapeHtml(content)}</pre><p><a href=\"/\">← Back to home</a></p>`
    return makeHtmlResponse(filename || 'Gist Preview', wrapped, 200)
  }
}
