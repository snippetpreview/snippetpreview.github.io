import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!

app.innerHTML = `
<main id="preview-root">
  <h1>HTML Snippet Preview</h1>
  <p>Compose and preview GitHub Gist routes with provider namespace support.</p>

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

function normalizeFilePath(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    return ''
  }
  return trimmed.startsWith('/') ? trimmed.slice(1) : trimmed
}

function log(level: LogLevel, message: string): void {
  const time = new Date().toLocaleTimeString()
  logOutput.value = `[${level.toUpperCase()} ${time}] ${message}`
}

function buildPreviewPath(gistId: string, filePath: string): string {
  const id = gistId.trim()
  if (!id) {
    return ''
  }
  const normalized = normalizeFilePath(filePath)
  const encodedPath = normalized ? `/${encodeURIComponent(normalized)}` : '/'
  return `/gist.github/${encodeURIComponent(id)}${encodedPath}`
}

function buildCanonicalGistUrl(gistId: string, filePath: string, username: string): string {
  const id = gistId.trim()
  if (!id) {
    return ''
  }
  const normalized = normalizeFilePath(filePath)
  const hash = normalized ? `#${normalized}` : ''
  const user = username.trim()
  const path = user ? `/${user}/${id}` : `/${id}`
  return `https://gist.github.com${path}${hash}`
}

function parseCanonicalGistUrl(urlText: string): ParsedCanonical | null {
  let url: URL
  try {
    url = new URL(urlText)
  } catch {
    return null
  }

  if (url.host !== 'gist.github.com') {
    return null
  }

  const parts = url.pathname.split('/').filter(Boolean)
  if (parts.length === 0) {
    return null
  }

  let username = ''
  let gistId = ''
  if (parts.length >= 2) {
    username = parts[0]
    gistId = parts[1]
  } else {
    gistId = parts[0]
  }

  if (!gistId) {
    return null
  }

  const filePath = (url.hash || '').replace(/^#/, '').trim()
  return { gistId, filePath, username }
}

function parsePreviewUrl(urlText: string): ParsedCanonical | null {
  let path = urlText.trim()
  try {
    const u = new URL(path)
    path = u.pathname || ''
  } catch {
    // not an absolute URL — allow relative paths
  }

  const match = path.match(/^\/gist\.github\/([^/]+)(?:\/(.+))?\/?$/i)
  if (!match) return null

  const gistId = decodeURIComponent(match[1] || '').trim()
  const filePath = match[2] ? decodeURIComponent(match[2]).trim() : ''
  if (!gistId) return null
  return { gistId, filePath, username: '' }
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

// Register the service worker at site root to intercept preview navigations
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/service-worker.js', { scope: '/', type: 'module' })
    .then((registration) => {
      console.log('Service Worker registered:', registration.scope)
    })
    .catch((err) => {
      console.warn('Service Worker registration failed:', err)
    })
}
