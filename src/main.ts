import './style.css'
import { githubProvider } from './providers/github-provider'
import { resumePendingPreview } from './resume'
import type { ResumeResult } from './resume'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
<main id="preview-root">
  <h1>HTML Snippet Preview</h1>
  <p>Compose and preview GitHub Gist routes with provider namespace support.</p>

  <section id="resume-status" class="resume-status" hidden aria-live="polite"></section>

  <form id="preview-form" aria-label="GitHub gist preview form">
    <div class="row-fields">
      <div>
        <label for="gist-id">Gist ID</label>
        <input id="gist-id" name="gist-id" inputmode="text" />
      </div>
      <div>
        <label for="file-path">File Path (optional)</label>
        <input id="file-path" name="file-path" />
      </div>
    </div>

    <div class="field-group">
      <div class="field-header">
        <label for="github-gist-url">GitHub Gist URL</label>
        <div class="field-buttons">
          <button id="go-to-github-gist" type="button">Go to GitHub</button>
          <button id="copy-gist-url" type="button">Copy</button>
        </div>
      </div>
      <input id="github-gist-url" name="github-gist-url" inputmode="url" placeholder="https://gist.github.com/<user>/<gist-id>#<filename>" />
    </div>

    <div class="field-group">
      <div class="field-header">
        <label for="preview-url">Preview URL</label>
        <div class="field-buttons">
          <button id="go-to-preview" type="button">Go to Preview</button>
          <button id="copy-preview-url" type="button">Copy</button>
        </div>
      </div>
      <output id="preview-url" aria-live="polite"></output>
    </div>

    <div class="actions">
      <button id="reset-form" type="button">Reset</button>
    </div>

    <label for="event-log">Log</label>
    <output id="event-log" role="status" aria-live="polite"></output>
  </form>

    <section id="examples">
    <h2>Examples</h2>
    <ul>

      <li><a href="/gist.github/95e2c10538e95f565120c5ed6adf947d">/gist.github/95e2c10538e95f565120c5ed6adf947d</a></li>
      <li><a href="/gist.github/95e2c10538e95f565120c5ed6adf947d/index.html">/gist.github/95e2c10538e95f565120c5ed6adf947d/index.html</a></li>
    </ul>
  </section>

  <p class="site-nav"><a href="/cache.html">Cached previews</a></p>
</main>
`

type LogLevel = 'info' | 'warning' | 'error'

interface ParsedCanonical {
  gistId: string
  filePath: string
  username: string
}

const form = document.getElementById('preview-form') as HTMLFormElement
const gistIdInput = document.getElementById('gist-id') as HTMLInputElement
const filePathInput = document.getElementById('file-path') as HTMLInputElement
const githubUrlInput = document.getElementById('github-gist-url') as HTMLInputElement
const previewUrlOutput = document.getElementById('preview-url') as HTMLOutputElement
const logOutput = document.getElementById('event-log') as HTMLOutputElement

const goToGithubButton = document.getElementById('go-to-github-gist') as HTMLButtonElement
const goToPreviewButton = document.getElementById('go-to-preview') as HTMLButtonElement
const copyGistButton = document.getElementById('copy-gist-url') as HTMLButtonElement
const copyPreviewButton = document.getElementById('copy-preview-url') as HTMLButtonElement
const resetButton = document.getElementById('reset-form') as HTMLButtonElement

let knownUsername = ''
let decomposeTimer: number | undefined

function log(level: LogLevel, message: string): void {
  const time = new Date().toLocaleTimeString()
  logOutput.value = `[${level.toUpperCase()} ${time}] ${message}`
}

function buildPreviewPath(gistId: string, filePath: string): string {
  const result = githubProvider.buildPreviewPath({ resourceId: gistId, filePath })
  return result.ok ? result.value : ''
}

function buildCanonicalGistUrl(gistId: string, filePath: string, username: string): string {
  const result = githubProvider.buildCanonicalUrl({ resourceId: gistId, filePath, username })
  return result.ok ? result.value : ''
}

function parseCanonicalGistUrl(urlText: string): ParsedCanonical | null {
  const result = githubProvider.parseCanonicalUrl(urlText)
  if (!result.ok) {
    return null
  }
  return {
    gistId: result.value.resourceId,
    filePath: result.value.filePath,
    username: result.value.username
  }
}

function parsePreviewUrl(urlText: string): ParsedCanonical | null {
  let path = urlText.trim()
  try {
    const u = new URL(path)
    path = u.pathname || ''
  } catch {
    // not an absolute URL — allow relative paths
  }

  const result = githubProvider.parsePreviewPath(path)
  if (!result.ok) {
    return null
  }
  return {
    gistId: result.value.resourceId,
    filePath: result.value.filePath,
    username: ''
  }
}

function syncFromIdAndPath(): void {
  const gistId = gistIdInput.value.trim()
  const filePath = filePathInput.value
  const previewPath = buildPreviewPath(gistId, filePath)
  previewUrlOutput.value = previewPath
  githubUrlInput.value = buildCanonicalGistUrl(gistId, filePath, knownUsername)
}

function openNewTab(url: string): void {
  if (!url) {
    log('warning', 'Nothing to open. Fill in gist-id first.')
    return
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}

async function copyText(text: string, label: string): Promise<void> {
  if (!text) {
    log('warning', `No ${label} to copy.`)
    return
  }

  try {
    await navigator.clipboard.writeText(text)
    log('info', `${label} copied.`)
  } catch (error) {
    log('error', `Failed to copy ${label}: ${String(error)}`)
  }
}

function clearDecomposeTimer(): void {
  if (decomposeTimer !== undefined) {
    window.clearTimeout(decomposeTimer)
    decomposeTimer = undefined
  }
}

gistIdInput.addEventListener('input', () => {
  syncFromIdAndPath()
})

filePathInput.addEventListener('input', () => {
  syncFromIdAndPath()
})

githubUrlInput.addEventListener('input', () => {
  clearDecomposeTimer()
  decomposeTimer = window.setTimeout(() => {
    let parsed = parseCanonicalGistUrl(githubUrlInput.value.trim())
    if (!parsed) {
      parsed = parsePreviewUrl(githubUrlInput.value.trim())
    }
    if (!parsed) {
      log('error', 'Malformed GitHub gist URL. Expected gist.github.com or /gist.github/ preview URL.')
      return
    }

    gistIdInput.value = parsed.gistId
    filePathInput.value = parsed.filePath
    knownUsername = parsed.username
    syncFromIdAndPath()
    log('info', 'GitHub URL parsed into gist-id and filePath.')
  }, 1500)
})

goToGithubButton.addEventListener('click', () => {
  const url = buildCanonicalGistUrl(gistIdInput.value, filePathInput.value, knownUsername)
  openNewTab(url)
})

goToPreviewButton.addEventListener('click', () => {
  const previewPath = previewUrlOutput.value
  if (!previewPath) {
    log('warning', 'Preview URL is empty.')
    return
  }
  const absolute = new URL(previewPath, window.location.origin).toString()
  openNewTab(absolute)
})

copyGistButton.addEventListener('click', async () => {
  const url = buildCanonicalGistUrl(gistIdInput.value, filePathInput.value, knownUsername)
  await copyText(url, 'GitHub URL')
})

copyPreviewButton.addEventListener('click', async () => {
  const previewPath = previewUrlOutput.value
  const absolute = previewPath ? new URL(previewPath, window.location.origin).toString() : ''
  await copyText(absolute, 'Preview URL')
})

resetButton.addEventListener('click', () => {
  clearDecomposeTimer()
  form.reset()
  knownUsername = ''
  previewUrlOutput.value = ''
  logOutput.value = ''
})

syncFromIdAndPath()
log('info', 'Ready.')

const RESUME_MESSAGES: Record<Exclude<ResumeResult['outcome'], 'none' | 'resumed'>, string> = {
  invalid: 'This preview address could not be understood, so nothing was restored.',
  'already-attempted': 'This preview was already retried in this tab but could not be restored.',
  'worker-unavailable':
    'Previews are served by a service worker, which this browser or page load did not provide.',
  timeout: 'The preview could not be restored because the service worker did not take control in time.'
}

function textNode(tag: 'p' | 'span', text: string): HTMLElement {
  const node = document.createElement(tag)
  node.textContent = text
  return node
}

function showResumeFallback(result: ResumeResult): void {
  const container = document.getElementById('resume-status')
  if (!container || result.outcome === 'none' || result.outcome === 'resumed') {
    return
  }

  container.hidden = false
  container.replaceChildren(textNode('p', RESUME_MESSAGES[result.outcome]))

  if (result.path) {
    const parsed = githubProvider.parsePreviewPath(new URL(result.path, window.location.origin).pathname)
    if (parsed.ok) {
      const canonical = githubProvider.buildCanonicalUrl({ resourceId: parsed.value.resourceId })
      if (canonical.ok) {
        const link = document.createElement('a')
        link.href = canonical.value
        link.rel = 'noopener noreferrer'
        link.textContent = 'Open this gist on GitHub instead'
        container.append(link)
      }
    }
  }
}

async function boot(): Promise<void> {
  const resume = await resumePendingPreview()
  showResumeFallback(resume)

  // Register the service worker at site root to intercept preview navigations.
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
      log('info', `Service worker active for ${registration.scope}`)
    } catch (error) {
      log('warning', `Service worker registration failed: ${String(error)}`)
    }
  }
}

void boot()
