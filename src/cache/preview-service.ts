import type { ProviderAdapter, ProviderResource } from '../providers/provider-adapter'
import type { CachedResource } from './resource-store'
import { getResource, saveResource, touchResource } from './resource-store'

export type ResourceResolution =
  | { ok: true; resource: CachedResource; source: 'cache' | 'network'; volatile?: boolean }
  | { ok: false; code: string; message: string; httpStatus?: number }

const inflight = new Map<string, Promise<ResourceResolution>>()

function toCached(resource: ProviderResource, visits: Record<string, number> = {}): CachedResource {
  const now = Date.now()
  return { ...resource, fetchedAt: now, lastCheckedAt: now, visits }
}

function isRecoverable(result: Extract<ResourceResolution, { ok: false }>): boolean {
  if (result.code === 'unchanged') {
    return true
  }
  if (result.httpStatus === undefined) {
    return true
  }
  return result.httpStatus === 403 || result.httpStatus === 429 || result.httpStatus >= 500
}

async function fetchIntoCache(
  provider: ProviderAdapter,
  resourceId: string,
  cached: CachedResource | null
): Promise<ResourceResolution> {
  const outcome = await provider.fetchResource({ resourceId, etag: cached?.etag || undefined })

  if (outcome.outcome === 'unchanged') {
    return { ok: false, code: 'unchanged', message: 'Resource has not changed' }
  }

  if (outcome.outcome === 'failed') {
    return {
      ok: false,
      code: outcome.code,
      message: outcome.message,
      httpStatus: outcome.httpStatus
    }
  }

  const saved = await saveResource(outcome.resource)
  const stored = await getResource(outcome.resource.providerId, outcome.resource.resourceId)
  return {
    ok: true,
    resource: stored ?? toCached(outcome.resource, cached?.visits),
    source: 'network',
    volatile: saved === 'volatile'
  }
}

/**
 * Resolves a provider resource, preferring the cache unless revalidation is asked for.
 * A recoverable provider failure still serves a stale cached copy; an unrecoverable one
 * (such as a missing resource) is surfaced so the caller can report it.
 */
export async function resolveResource(
  provider: ProviderAdapter,
  resourceId: string,
  options: { revalidate: boolean }
): Promise<ResourceResolution> {
  const cached = await getResource(provider.id, resourceId)

  if (cached && !options.revalidate) {
    return { ok: true, resource: cached, source: 'cache' }
  }

  const inflightKey = `${provider.id}|${resourceId}`
  let pending = inflight.get(inflightKey)
  if (!pending) {
    pending = fetchIntoCache(provider, resourceId, cached)
      .then(async (result) => {
        if (!result.ok && result.code === 'unchanged' && cached) {
          await touchResource(provider.id, resourceId)
          return { ok: true, resource: cached, source: 'cache' } as ResourceResolution
        }
        return result
      })
      .finally(() => inflight.delete(inflightKey))
    inflight.set(inflightKey, pending)
  }

  const result = await pending
  if (!result.ok && cached && isRecoverable(result)) {
    return { ok: true, resource: cached, source: 'cache' }
  }
  return result
}

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function errorResponse(title: string, message: string, status = 502): Response {
  const body = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head><body><h1>${escapeHtml(title)}</h1><p>${escapeHtml(message)}</p><p><a href="/">← Back to home</a> · <a href="/cache.html">Cached previews</a></p></body></html>`
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  })
}

export function notCachedResponse(): Response {
  return errorResponse(
    'Preview not cached',
    'This preview is unavailable offline and has not been cached on this device yet.',
    504
  )
}
