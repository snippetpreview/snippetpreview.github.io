const GUARD_KEY = 'snippet-preview:resume-attempt'
const CONTROL_TIMEOUT_MS = 4000

export type ResumeOutcome =
  | 'none'
  | 'resumed'
  | 'invalid'
  | 'already-attempted'
  | 'worker-unavailable'
  | 'timeout'

export interface ResumeResult {
  outcome: ResumeOutcome
  path: string | null
}

/**
 * Accepts only absolute paths on the current origin, so `next` cannot be used
 * to bounce a visitor to another site.
 */
export function sanitizeNext(raw: string | null): string | null {
  if (!raw || !raw.startsWith('/')) {
    return null
  }
  if (raw.startsWith('//') || raw.startsWith('/\\')) {
    return null
  }

  try {
    const url = new URL(raw, window.location.origin)
    if (url.origin !== window.location.origin) {
      return null
    }
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return null
  }
}

function waitForControl(timeoutMs: number): Promise<boolean> {
  if (navigator.serviceWorker.controller) {
    return Promise.resolve(true)
  }

  return new Promise((resolve) => {
    let settled = false
    let timer = 0

    const cleanup = (): void => {
      window.clearTimeout(timer)
      navigator.serviceWorker.removeEventListener('controllerchange', onChange)
    }
    const finish = (controlled: boolean): void => {
      if (settled) {
        return
      }
      settled = true
      cleanup()
      resolve(controlled)
    }
    const onChange = (): void => finish(true)

    navigator.serviceWorker.addEventListener('controllerchange', onChange)
    timer = window.setTimeout(() => finish(Boolean(navigator.serviceWorker.controller)), timeoutMs)
  })
}

function readGuard(): string | null {
  try {
    return sessionStorage.getItem(GUARD_KEY)
  } catch {
    return null
  }
}

function writeGuard(path: string): void {
  try {
    sessionStorage.setItem(GUARD_KEY, path)
  } catch {
    // storage may be unavailable; the timeout still bounds the attempt
  }
}

/**
 * Resumes a preview path forwarded by the not-found page once a service worker
 * controls this page. Each path is attempted at most once per tab so an
 * unusable worker cannot produce a redirect loop.
 */
export async function resumePendingPreview(): Promise<ResumeResult> {
  const raw = new URLSearchParams(window.location.search).get('next')
  if (!raw) {
    return { outcome: 'none', path: null }
  }

  const path = sanitizeNext(raw)
  if (!path) {
    return { outcome: 'invalid', path: null }
  }

  if (readGuard() === path) {
    return { outcome: 'already-attempted', path }
  }
  writeGuard(path)

  if (!('serviceWorker' in navigator)) {
    return { outcome: 'worker-unavailable', path }
  }

  try {
    await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
  } catch {
    return { outcome: 'worker-unavailable', path }
  }

  if (!(await waitForControl(CONTROL_TIMEOUT_MS))) {
    return { outcome: 'timeout', path }
  }

  window.location.replace(path)
  return { outcome: 'resumed', path }
}
