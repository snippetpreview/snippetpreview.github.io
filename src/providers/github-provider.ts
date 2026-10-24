import { fail, ok } from './provider-adapter'
import type {
  FetchResourceInput,
  ParsedPreview,
  PreviewRequest,
  ProviderAdapter,
  ProviderResource,
  RenderInput,
  ResourceFile,
  ResourceOutcome,
  Result
} from './provider-adapter'
import { isHtmlPath, mimeForPath } from './mime'
import { escapeHtml, injectSourceMeta, sourceMetaTag } from './html-meta'
import { renderSourceView, sourceViewStyles } from './source-view'
import { isMarkdownPath, markdownViewStyles, renderMarkdownView } from './markdown-view'

const PREVIEW_REGEX = /^\/gist\.github\/([^/]+)(?:\/(.+))?\/?$/i
const CANONICAL_HOST = 'gist.github.com'
const API_BASE = 'https://api.github.com/gists/'
const RAW_HOST = 'https://gist.githubusercontent.com'

interface GistFile {
  filename?: string
  content?: string
  truncated?: boolean
  raw_url?: string
}

interface GistResponse {
  files?: Record<string, GistFile>
  history?: Array<{ version?: string }>
  owner?: { login?: string }
  description?: string
}

function makeHtmlResponse(title: string, bodyHtml: string, status = 200, extraHead = ''): Response {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title>${extraHead}</head><body>${bodyHtml}</body></html>`
  return new Response(html, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

function errorPage(message: string, status = 502): Response {
  const detail = `<h1>Gist Error</h1><p>${escapeHtml(message)}</p><p><a href="/">← Back to home</a></p>`
  return makeHtmlResponse('Gist Error', detail, status)
}

function normalizeFilePath(filePath?: string): string {
  if (!filePath) {
    return ''
  }
  return filePath.startsWith('/') ? filePath.slice(1) : filePath
}

function byteLength(content: string): number {
  return new TextEncoder().encode(content).length
}

function parsePreviewPath(pathname: string): Result<ParsedPreview> {
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

  return ok({ resourceId, filePath: decodedPath || '' })
}

function parseCanonicalUrl(urlText: string) {
  let url: URL
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

  return ok({ resourceId, filePath, username })
}

function buildPreviewPath({ resourceId, filePath }: { resourceId: string; filePath?: string }) {
  const id = String(resourceId || '').trim()
  if (!id) {
    return fail('missing-id', 'Missing gist id')
  }

  const normalized = normalizeFilePath(String(filePath || '').trim())
  const encodedPath = normalized ? `/${encodeURIComponent(normalized)}` : '/'
  return ok(`/gist.github/${encodeURIComponent(id)}${encodedPath}`)
}

function buildCanonicalUrl({
  resourceId,
  filePath,
  username
}: {
  resourceId: string
  filePath?: string
  username?: string
}) {
  const id = String(resourceId || '').trim()
  if (!id) {
    return fail('missing-id', 'Missing gist id')
  }

  const name = String(username || '').trim()
  const normalized = normalizeFilePath(String(filePath || '').trim())
  const hash = normalized ? `#${normalized}` : ''
  const path = name ? `/${name}/${id}` : `/${id}`
  return ok(`https://gist.github.com${path}${hash}`)
}

function toResourceFile(key: string, entry: GistFile, content: string): ResourceFile {
  const filename = entry.filename || key
  return {
    filename,
    content,
    mime: mimeForPath(filename || key),
    size: byteLength(content),
    truncated: Boolean(entry.truncated)
  }
}

async function fetchResource({ resourceId, etag }: FetchResourceInput): Promise<ResourceOutcome> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (etag) {
    headers['If-None-Match'] = etag
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}${encodeURIComponent(resourceId)}`, { headers, credentials: 'omit' })
  } catch (error) {
    return { outcome: 'failed', code: 'network', message: `Network error contacting GitHub: ${String(error)}` }
  }

  if (res.status === 304) {
    return { outcome: 'unchanged' }
  }

  if (!res.ok) {
    return {
      outcome: 'failed',
      code: res.status === 404 ? 'not-found' : 'provider-error',
      message: `GitHub API returned status ${res.status}`,
      httpStatus: res.status
    }
  }

  let data: GistResponse | null = null
  try {
    data = (await res.json()) as GistResponse
  } catch {
    return { outcome: 'failed', code: 'invalid-response', message: 'GitHub API returned malformed JSON', httpStatus: 502 }
  }

  if (!data || !data.files) {
    return { outcome: 'failed', code: 'invalid-response', message: 'GitHub API response contained no files', httpStatus: 404 }
  }

  const files: Record<string, ResourceFile> = {}
  for (const [key, entry] of Object.entries(data.files)) {
    let content = entry.content || ''
    if (entry.truncated && entry.raw_url) {
      try {
        const raw = await fetch(entry.raw_url)
        if (!raw.ok) {
          return {
            outcome: 'failed',
            code: 'raw-fetch',
            message: `Unable to fetch gist file ${key} (HTTP ${raw.status})`,
            httpStatus: raw.status
          }
        }
        content = await raw.text()
      } catch (error) {
        return { outcome: 'failed', code: 'network', message: `Network error fetching gist file ${key}: ${String(error)}` }
      }
    }
    files[key] = toResourceFile(key, entry, content)
  }

  const resource: ProviderResource = {
    providerId: 'gist.github',
    resourceId,
    revision: data.history?.[0]?.version || '',
    etag: res.headers.get('etag') || '',
    username: data.owner?.login || '',
    description: data.description || '',
    files
  }

  return { outcome: 'fetched', resource }
}

function buildSourceUrl(resourceId: string, filePath: string, username: string): string {
  const id = encodeURIComponent(String(resourceId || '').trim())
  const name = String(username || '').trim()
  const segments = normalizeFilePath(String(filePath || '').trim())
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/')

  // The pinned gist page has no path-based file selector, so the raw content
  // host is the address that actually identifies a single file.
  const base = name
    ? `${RAW_HOST}/${encodeURIComponent(name)}/${id}/raw`
    : `https://gist.github.com/${id}/raw`

  return segments ? `${base}/${segments}` : base
}

function redirectRootRequest(request: Request | undefined, requested: string): Response | null {
  if (!request || requested) {
    return null
  }

  try {
    const requestUrl = new URL(request.url)
    if (requestUrl.pathname.endsWith('/')) {
      return null
    }

    requestUrl.pathname = `${requestUrl.pathname}/`
    return Response.redirect(requestUrl.href, 302)
  } catch {
    return null
  }
}

function render({ resource, filePath, request }: RenderInput): Response {
  const keys = Object.keys(resource.files)
  if (keys.length === 0) {
    return makeHtmlResponse('Gist Empty', '<h1>Gist is empty</h1><p>No files available.</p><p><a href="/">← Back to home</a></p>', 404)
  }

  const requested = normalizeFilePath(String(filePath || '').trim())
  const entry = requested ? resource.files[requested] : resource.files[keys[0]]

  if (!entry) {
    const detail = `<h1>404 - File Not Found</h1><p>This gist does not contain <code>${escapeHtml(requested)}</code>.</p><p><a href="/">← Back to home</a></p>`
    return makeHtmlResponse('Gist File Not Found', detail, 404)
  }

  const sourceUrl = buildSourceUrl(resource.resourceId, entry.filename || requested, resource.username)

  if (isMarkdownPath(entry.filename)) {
    const redirect = redirectRootRequest(request, requested)
    if (redirect) {
      return redirect
    }

    return makeHtmlResponse(
      entry.filename || 'Gist Markdown Preview',
      renderMarkdownView({
        filename: entry.filename || requested,
        sourceUrl,
        source: entry.content
      }),
      200,
      `${sourceMetaTag(sourceUrl)}${markdownViewStyles()}`
    )
  }

  if (isHtmlPath(entry.filename) || /<\s*html[\s>]/i.test(entry.content)) {
    // If the original navigation URL does not end with a trailing slash,
    // redirect to the same path with a trailing slash so relative URLs
    // inside the served HTML resolve correctly.
    // Only redirect to a trailing slash when the incoming navigation
    // targeted the gist resource root (no specific file requested). If
    // a file path was requested (e.g. `/.../index.html`) do not redirect.
    const redirect = redirectRootRequest(request, requested)
    if (redirect) {
      return redirect
    }
    return new Response(injectSourceMeta(entry.content, sourceUrl), { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  const body = renderSourceView({
    filename: entry.filename || requested,
    mime: entry.mime,
    sourceUrl,
    content: entry.content
  })
  return makeHtmlResponse(entry.filename || 'Gist Preview', body, 200, `${sourceMetaTag(sourceUrl)}${sourceViewStyles()}`)
}

function renderAsset({ resource, filePath }: { resource: ProviderResource; filePath?: string }): Response {
  const requested = normalizeFilePath(String(filePath || '').trim())
  const keys = Object.keys(resource.files)
  const entry = requested ? resource.files[requested] : keys.length > 0 ? resource.files[keys[0]] : undefined

  if (!entry) {
    return new Response(`File not found: ${requested || '(root)'}`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }

  return new Response(entry.content, {
    status: 200,
    headers: { 'Content-Type': entry.mime }
  })
}

async function handlePreview({ resourceId, filePath, request }: PreviewRequest): Promise<Response> {
  const outcome = await fetchResource({ resourceId })
  if (outcome.outcome === 'failed') {
    return errorPage(outcome.message, outcome.httpStatus && outcome.httpStatus >= 400 ? outcome.httpStatus : 502)
  }
  if (outcome.outcome === 'unchanged') {
    return errorPage('Unexpected empty provider response.', 502)
  }
  return render({ resource: outcome.resource, filePath, request })
}

export const githubProvider: ProviderAdapter = {
  id: 'gist.github',
  parsePreviewPath,
  parseCanonicalUrl,
  buildPreviewPath,
  buildCanonicalUrl,
  fetchResource,
  render,
  renderAsset,
  handlePreview
}
