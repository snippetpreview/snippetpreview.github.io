import { escapeHtml } from './html-meta'

export interface SourceViewInput {
  filename: string
  mime: string
  sourceUrl: string
  content: string
}

const COPY_SCRIPT = `(function () {
  var button = document.querySelector('.copy-button')
  var code = document.querySelector('.code-block code')
  if (!button || !code) return
  var resetTimer
  function flash(label) {
    button.textContent = label
    window.clearTimeout(resetTimer)
    resetTimer = window.setTimeout(function () { button.textContent = 'Copy' }, 1600)
  }
  function copyWithSelection() {
    try {
      var range = document.createRange()
      range.selectNodeContents(code)
      var selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
      var copied = document.execCommand('copy')
      flash(copied ? 'Copied' : 'Press Ctrl+C')
    } catch (error) {
      flash('Press Ctrl+C')
    }
  }
  button.addEventListener('click', function () {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(code.textContent).then(function () { flash('Copied') }, copyWithSelection)
      return
    }
    copyWithSelection()
  })
})()`

export function sourceViewStyles(): string {
  return `<style>
    :root {
      color-scheme: light dark;
      --bg: #ffffff;
      --panel: #f4f4f7;
      --border: #e2e1e6;
      --text: #1f1d24;
      --muted: #6b6375;
      --accent: #aa3bff;
      --code-bg: #fbfbfd;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #16171d;
        --panel: #1c1d25;
        --border: #2e303a;
        --text: #e8e7ee;
        --muted: #9ca3af;
        --accent: #c084fc;
        --code-bg: #111218;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font: 16px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    .source-page { max-width: 1000px; margin: 0 auto; padding: 32px 20px 48px; }
    .source-header h1 {
      margin: 0 0 6px;
      font: 600 22px/1.3 ui-monospace, Consolas, monospace;
      word-break: break-all;
    }
    .source-link { margin: 0 0 20px; font-size: 14px; word-break: break-all; }
    .source-link a { color: var(--accent); text-decoration: none; }
    .source-link a:hover { text-decoration: underline; }
    .code-block {
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
      background: var(--code-bg);
    }
    .code-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      background: var(--panel);
      border-bottom: 1px solid var(--border);
    }
    .code-language {
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--muted);
    }
    .copy-button {
      font: inherit;
      font-size: 13px;
      padding: 4px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--bg);
      color: var(--text);
      cursor: pointer;
    }
    .copy-button:hover { border-color: var(--accent); color: var(--accent); }
    .copy-button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .code-block pre {
      margin: 0;
      padding: 16px;
      max-height: 72vh;
      overflow: auto;
      font: 14px/1.55 ui-monospace, SFMono-Regular, Consolas, monospace;
    }
    .code-block code { white-space: pre; }
    .source-footer { margin-top: 20px; font-size: 14px; color: var(--muted); }
    .source-footer a { color: var(--accent); text-decoration: none; }
  </style>`
}

export function renderSourceView({ filename, mime, sourceUrl, content }: SourceViewInput): string {
  const language = (mime.split(';')[0] || 'text/plain').trim()
  return `<main class="source-page">
  <header class="source-header">
    <h1>${escapeHtml(filename)}</h1>
    <p class="source-link"><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a></p>
  </header>
  <section class="code-block" aria-label="Source code">
    <div class="code-toolbar">
      <span class="code-language">${escapeHtml(language)}</span>
      <button type="button" class="copy-button" aria-live="polite">Copy</button>
    </div>
    <pre tabindex="0"><code>${escapeHtml(content)}</code></pre>
  </section>
  <p class="source-footer"><a href="/">← Back to home</a> · <a href="/cache.html">Cached previews</a></p>
</main>
<script>${COPY_SCRIPT}</script>`
}
