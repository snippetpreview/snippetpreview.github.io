/*
 * Provider adapter contract for Service Worker routing.
 * Each provider adapter should expose:
 * - id: unique provider namespace key
 * - parsePreviewPath(pathname): Result<ParsedPreview>
 * - parseCanonicalUrl(urlText): Result<ParsedCanonical>
 * - buildPreviewPath({ resourceId, filePath }): Result<string>
 * - buildCanonicalUrl({ resourceId, filePath, username }): Result<string>
 * - handlePreview({ resourceId, filePath, request }): Promise<Response>
 */

export interface Ok<T> {
  ok: true
  value: T
}

export interface Err {
  ok: false
  error: { code: string; message: string }
}

export type Result<T> = Ok<T> | Err

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function fail(code: string, message: string): Err {
  return { ok: false, error: { code, message } }
}

export interface ParsedPreview {
  resourceId: string
  filePath: string
}

export interface ParsedCanonical {
  resourceId: string
  filePath: string
  username: string
}

export interface PreviewTarget {
  resourceId: string
  filePath?: string
}

export interface CanonicalTarget extends PreviewTarget {
  username?: string
}

export interface PreviewRequest extends PreviewTarget {
  request?: Request
}

export interface ResourceFile {
  filename: string
  content: string
  mime: string
  size: number
  truncated: boolean
}

export interface ProviderResource {
  providerId: string
  resourceId: string
  revision: string
  etag: string
  username: string
  description: string
  files: Record<string, ResourceFile>
}

export type ResourceOutcome =
  | { outcome: 'fetched'; resource: ProviderResource }
  | { outcome: 'unchanged' }
  | { outcome: 'failed'; code: string; message: string; httpStatus?: number }

export interface FetchResourceInput {
  resourceId: string
  etag?: string
}

export interface RenderInput {
  resource: ProviderResource
  filePath?: string
  request?: Request
}

export interface AssetRenderInput {
  resource: ProviderResource
  filePath?: string
}

export interface ProviderAdapter {
  id: string
  parsePreviewPath(pathname: string): Result<ParsedPreview>
  parseCanonicalUrl(urlText: string): Result<ParsedCanonical>
  buildPreviewPath(target: PreviewTarget): Result<string>
  buildCanonicalUrl(target: CanonicalTarget): Result<string>
  fetchResource(input: FetchResourceInput): Promise<ResourceOutcome>
  render(input: RenderInput): Response
  renderAsset(input: AssetRenderInput): Response
  handlePreview(input: PreviewRequest): Promise<Response>
}
