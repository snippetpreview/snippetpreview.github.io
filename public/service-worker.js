/* Service Worker for Snippet Preview
 * Provider-agnostic dispatcher for namespaced preview routes.
 */

'use strict'
import { githubProvider } from './providers/github-provider.js'

const providers = [githubProvider]

self.addEventListener('install', (evt) => {
  // Activate immediately so the worker can control pages on next navigation
  evt.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', (evt) => {
  evt.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (evt) => {
  const req = evt.request

  if (req.mode !== 'navigate') {
    evt.respondWith(fetch(req))
    return
  }

  const url = new URL(req.url)
  if (url.pathname === '/') {
    evt.respondWith(fetch(req))
    return
  }

  for (const provider of providers) {
    const parsed = provider.parsePreviewPath(url.pathname)
    if (parsed.ok) {
      evt.respondWith(provider.handlePreview({
        resourceId: parsed.value.resourceId,
        filePath: parsed.value.filePath,
        request: req
      }))
      return
    }
  }

  evt.respondWith(fetch(req))
})
