/*
 * Provider adapter contract for Service Worker routing.
 * Each provider adapter should expose:
 * - id: unique provider namespace key
 * - parsePreviewPath(pathname): ParseResult
 * - parseCanonicalUrl(urlText): ParseResult
 * - buildPreviewPath({ resourceId, filePath }): BuildResult
 * - buildCanonicalUrl({ resourceId, filePath, username }): BuildResult
 * - handlePreview({ resourceId, filePath, request }): Promise<Response>
 */

'use strict'

export function ok(value) {
  return { ok: true, value }
}

export function fail(code, message) {
  return { ok: false, error: { code, message } }
}
