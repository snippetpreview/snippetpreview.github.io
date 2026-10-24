import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'
import type { PrecacheEntry } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { githubProvider } from './providers/github-provider'
import type { ProviderAdapter, ParsedPreview } from './providers/provider-adapter'
import { recordVisit } from './cache/resource-store'
import { errorResponse, notCachedResponse, resolveResource } from './cache/preview-service'
import { markdownRuntimeAssets } from './providers/markdown-view'

declare global {
  interface WorkerGlobalScope {
    __WB_MANIFEST: Array<string | PrecacheEntry>
  }
}

const sw = self as unknown as ServiceWorkerGlobalScope

const providers: ProviderAdapter[] = [githubProvider]
const runtimeCacheName = 'snippet-preview-runtime-v1'

async function handleRuntimeAsset(request: Request, upstream: string): Promise<Response> {
  const cache = await caches.open(runtimeCacheName)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }

  try {
    const response = await fetch(upstream, { credentials: 'omit' })
    if (!response.ok) {
      return new Response(`Runtime asset unavailable: ${response.status}`, {
        status: 502,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      })
    }
    await cache.put(request, response.clone())
    return response
  } catch (error) {
    return new Response(`Runtime asset unavailable: ${String(error)}`, {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    })
  }
}

sw.addEventListener('install', (event) => {
  event.waitUntil(sw.skipWaiting())
})

clientsClaim()

precacheAndRoute(self.__WB_MANIFEST, {
  // Parameters never change which document is served, and `next` is the
  // cold-start resume parameter, so it must not defeat shell precaching.
  ignoreURLParametersMatching: [/.*/]
})
cleanupOutdatedCaches()

// Deliberately no catch-all navigation fallback: unknown paths keep returning
// the site's 404 document instead of silently rendering the composer.

async function handlePreview(
  provider: ProviderAdapter,
  { resourceId, filePath }: ParsedPreview,
  request: Request
): Promise<Response> {
  const isNavigation = request.mode === 'navigate'
  const resolution = await resolveResource(provider, resourceId, { revalidate: isNavigation })

  if (!resolution.ok) {
    if (resolution.code === 'not-found') {
      return errorResponse('Gist not found', resolution.message, 404)
    }
    if (resolution.code === 'network') {
      return notCachedResponse()
    }
    return errorResponse('Preview unavailable', resolution.message, resolution.httpStatus ?? 502)
  }

  const { resource } = resolution

  if (isNavigation) {
    // Cache bookkeeping must never turn a servable preview into an error.
    try {
      await recordVisit(provider.id, resourceId, filePath)
    } catch {
      // ignore visit tracking failures
    }
    return provider.render({ resource, filePath, request })
  }

  return provider.renderAsset({ resource, filePath })
}

sw.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)

  if (url.origin !== sw.location.origin) {
    return
  }

  for (const asset of Object.values(markdownRuntimeAssets)) {
    if (url.pathname === asset.path) {
      event.respondWith(handleRuntimeAsset(request, asset.upstream))
      return
    }
  }

  for (const provider of providers) {
    const parsed = provider.parsePreviewPath(url.pathname)
    if (!parsed.ok) {
      continue
    }
    event.respondWith(handlePreview(provider, parsed.value, request))
    return
  }
})
