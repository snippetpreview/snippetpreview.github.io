import MarkdownIt from 'markdown-it'
import taskLists from 'markdown-it-task-lists'
import { mathjax } from 'mathjax-full/js/mathjax.js'
import { TeX } from 'mathjax-full/js/input/tex.js'
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js'
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js'
import { SerializedMmlVisitor } from 'mathjax-full/js/core/MmlTree/SerializedMmlVisitor.js'
import { STATE } from 'mathjax-full/js/core/MathItem.js'
import 'mathjax-full/js/input/tex/ams/AmsConfiguration.js'
import 'mathjax-full/js/input/tex/newcommand/NewcommandConfiguration.js'
import xss from 'xss'
import { escapeHtml } from './html-meta'

export interface MarkdownViewInput {
  filename: string
  sourceUrl: string
  source: string
}

interface MathPlaceholder {
  marker: string
  html: string
}

interface FenceState {
  character: '`' | '~'
  length: number
}

const MERMAID_RUNTIME_PATH = '/_runtime/mermaid-11.12.0.min.js'
const HIGHLIGHT_RUNTIME_PATH = '/_runtime/highlight-11.12.0.min.js'

const MERMAID_RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/mermaid@11.12.0/dist/mermaid.min.js'
const HIGHLIGHT_RUNTIME_URL = 'https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.12.0/highlight.min.js'

const adaptor = liteAdaptor()
RegisterHTMLHandler(adaptor)
const tex = new TeX({ packages: ['base', 'ams', 'newcommand'] })
const mathDocument = mathjax.document('', { InputJax: tex })
const mathVisitor = new SerializedMmlVisitor()

const markdownAllowList = {
  a: ['href', 'title', 'target', 'rel', 'class'],
  abbr: ['title'],
  blockquote: ['class'],
  br: [],
  code: ['class'],
  col: ['span', 'class'],
  colgroup: ['span', 'class'],
  dd: ['class'],
  del: ['class'],
  details: ['open', 'class'],
  div: ['class'],
  em: ['class'],
  figcaption: ['class'],
  figure: ['class'],
  h1: ['class'],
  h2: ['class'],
  h3: ['class'],
  h4: ['class'],
  h5: ['class'],
  h6: ['class'],
  hr: ['class'],
  img: ['src', 'alt', 'title', 'width', 'height', 'loading', 'class'],
  input: ['type', 'checked', 'disabled', 'class'],
  kbd: ['class'],
  li: ['class'],
  mark: ['class'],
  ol: ['start', 'reversed', 'class'],
  p: ['class'],
  pre: ['class'],
  s: ['class'],
  section: ['class'],
  small: ['class'],
  span: ['class'],
  strong: ['class'],
  sub: ['class'],
  summary: ['class'],
  sup: ['class'],
  table: ['class'],
  tbody: ['class'],
  td: ['colspan', 'rowspan', 'align', 'class'],
  tfoot: ['class'],
  th: ['colspan', 'rowspan', 'scope', 'align', 'class'],
  thead: ['class'],
  tr: ['align', 'class'],
  ul: ['class']
}

const COPY_SCRIPT = `(function () {
  var button = document.querySelector('.markdown-copy-button')
  var source = document.querySelector('.markdown-source')
  if (!button || !source) return
  var resetTimer
  function flash(label) {
    button.textContent = label
    window.clearTimeout(resetTimer)
    resetTimer = window.setTimeout(function () { button.textContent = 'Copy source' }, 1600)
  }
  function copyWithSelection() {
    try {
      source.hidden = false
      source.select()
      var copied = document.execCommand('copy')
      source.hidden = true
      flash(copied ? 'Copied' : 'Press Ctrl+C')
    } catch (error) {
      source.hidden = true
      flash('Press Ctrl+C')
    }
  }
  button.addEventListener('click', function () {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(source.value).then(function () { flash('Copied') }, copyWithSelection)
      return
    }
    copyWithSelection()
  })
})()`

const ENHANCEMENT_SCRIPT = `(function () {
  var root = document.querySelector('.markdown-page')
  if (!root) return

  function loadScript(src, done) {
    var script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = function () { done(null) }
    script.onerror = function () { done(new Error('Unable to load preview enhancement')) }
    document.head.appendChild(script)
  }

  var diagrams = Array.prototype.slice.call(root.querySelectorAll('pre.mermaid'))
  if (diagrams.length) {
    loadScript('${MERMAID_RUNTIME_PATH}', function (error) {
      if (error || !window.mermaid) return
      try {
        window.mermaid.initialize({ startOnLoad: false, securityLevel: 'strict', theme: 'default' })
        var result = window.mermaid.run({ nodes: diagrams })
        if (result && typeof result.catch === 'function') result.catch(function () {})
      } catch (renderError) {}
    })
  }

  var blocks = Array.prototype.slice.call(root.querySelectorAll('pre code[class*="language-"]'))
  if (blocks.length) {
    loadScript('${HIGHLIGHT_RUNTIME_PATH}', function (error) {
      if (error || !window.hljs) return
      blocks.forEach(function (block) {
        try {
          window.hljs.highlightElement(block)
        } catch (highlightError) {}
      })
    })
  }
})()`

function isEscaped(source: string, index: number): boolean {
  let backslashes = 0
  for (let cursor = index - 1; cursor >= 0 && source[cursor] === '\\'; cursor -= 1) {
    backslashes += 1
  }
  return backslashes % 2 === 1
}

function findClosing(source: string, delimiter: string, start: number): number {
  let cursor = start
  while (cursor < source.length) {
    const found = source.indexOf(delimiter, cursor)
    if (found < 0) {
      return -1
    }
    if (!isEscaped(source, found)) {
      return found
    }
    cursor = found + delimiter.length
  }
  return -1
}

function mathHtml(expression: string, display: boolean, fallback: string): string {
  try {
    const node = mathDocument.convert(expression, { display, end: STATE.CONVERT })
    const serialized = mathVisitor.visitTree(node)
    if (serialized.includes('<merror') || serialized.includes('data-mjx-error=')) {
      return `<code class="math-error">${escapeHtml(fallback)}</code>`
    }
    return normalizeMathMl(serialized, display)
  } catch {
    return `<code class="math-error">${escapeHtml(fallback)}</code>`
  }
}

function mathematicalAlphabet(character: string, variant: string): string {
  const code = character.codePointAt(0)
  if (code === undefined) {
    return character
  }

  const ranges: Record<string, number> = {
    bold: 0x1d400,
    'double-struck': 0x1d538,
    fraktur: 0x1d504,
    'sans-serif': 0x1d5a0,
    monospace: 0x1d670
  }
  const base = ranges[variant]
  if (!base) {
    return character
  }

  if (code >= 65 && code <= 90) {
    return String.fromCodePoint(base + code - 65)
  }
  if (code >= 97 && code <= 122) {
    return String.fromCodePoint(base + 26 + code - 97)
  }
  if (code >= 48 && code <= 57 && variant !== 'fraktur') {
    return String.fromCodePoint(base + 52 + code - 48)
  }
  return character
}

function normalizeMathMl(serialized: string, display: boolean): string {
  let result = serialized.replace(/\sdata-mjx-texclass="[^"]*"/g, '')
  result = result.replace(/<([a-z]+) mathvariant="([^"]+)">([^<>])<\/\1>/g, (_match, tag: string, variant: string, character: string) => {
    const converted = mathematicalAlphabet(character, variant)
    return converted === character
      ? `<${tag}>${character}</${tag}>`
      : `<${tag}>${converted}</${tag}>`
  })
  result = result.replace(/\s+mathvariant="[^"]*"/g, '')
  if (display) {
    return `<span class="math-display">${result}</span>`
  }
  return `<span class="math-inline">${result}</span>`
}

function nextLineEnd(source: string, start: number): number {
  const newline = source.indexOf('\n', start)
  return newline < 0 ? source.length : newline
}

function fenceAt(source: string, start: number): { character: '`' | '~'; length: number } | null {
  const end = nextLineEnd(source, start)
  const line = source.slice(start, end)
  const match = /^ {0,3}(`{3,}|~{3,})/.exec(line)
  if (!match) {
    return null
  }
  return { character: match[1][0] as '`' | '~', length: match[1].length }
}

function isFenceClose(source: string, start: number, fence: FenceState): boolean {
  const end = nextLineEnd(source, start)
  const line = source.slice(start, end)
  const expression = new RegExp(`^ {0,3}${fence.character}{${fence.length},} *$`)
  return expression.test(line)
}

function replaceMath(source: string): { source: string; placeholders: MathPlaceholder[] } {
  const placeholders: MathPlaceholder[] = []
  let result = ''
  let cursor = 0
  let lineStart = true
  let fence: FenceState | null = null

  const addPlaceholder = (end: number, expression: string, display: boolean, fallback: string): void => {
    const marker = `SNIPPET_PREVIEW_MATH_${placeholders.length}`
    placeholders.push({
      marker,
      html: mathHtml(expression, display, fallback)
    })
    result += marker
    cursor = end
    lineStart = false
  }

  while (cursor < source.length) {
    if (lineStart) {
      if (fence) {
        const end = nextLineEnd(source, cursor)
        result += source.slice(cursor, end)
        if (isFenceClose(source, cursor, fence)) {
          fence = null
        }
        cursor = end
        lineStart = false
        continue
      }
      const openingFence = fenceAt(source, cursor)
      if (openingFence) {
        const end = nextLineEnd(source, cursor)
        result += source.slice(cursor, end)
        fence = openingFence
        cursor = end
        lineStart = false
        continue
      }
    }

    if (source[cursor] === '\n') {
      result += '\n'
      cursor += 1
      lineStart = true
      continue
    }

    if (source[cursor] === '`') {
      let length = 1
      while (source[cursor + length] === '`') {
        length += 1
      }
      const delimiter = '`'.repeat(length)
      const closing = source.indexOf(delimiter, cursor + length)
      if (closing >= 0) {
        const end = closing + length
        result += source.slice(cursor, end)
        cursor = end
        lineStart = false
        continue
      }
    }

    const displayDelimiter = source.startsWith('$$', cursor) ? '$$' : source.startsWith('\\[', cursor) ? '\\[' : null
    if (displayDelimiter && !isEscaped(source, cursor)) {
      const closingDelimiter = displayDelimiter === '$$' ? '$$' : '\\]'
      const closing = findClosing(source, closingDelimiter, cursor + displayDelimiter.length)
      if (closing >= 0) {
        const expression = source.slice(cursor + displayDelimiter.length, closing)
        addPlaceholder(closing + closingDelimiter.length, expression, true, `${displayDelimiter}${expression}${closingDelimiter}`)
        continue
      }
    }

    const inlineDelimiter = source.startsWith('\\(', cursor) ? '\\(' : source[cursor] === '$' ? '$' : null
    if (inlineDelimiter && !isEscaped(source, cursor)) {
      const expressionStart = cursor + inlineDelimiter.length
      if (inlineDelimiter !== '$' || (source[expressionStart] && !/\s/.test(source[expressionStart]))) {
        const closingDelimiter = inlineDelimiter === '$' ? '$' : '\\)'
        const closing = findClosing(source, closingDelimiter, expressionStart)
        if (closing >= expressionStart && !/\s/.test(source[closing - 1] || '') && (inlineDelimiter !== '$' || !/\d/.test(source[closing + 1] || ''))) {
          const expression = source.slice(expressionStart, closing)
          addPlaceholder(closing + closingDelimiter.length, expression, false, `${inlineDelimiter}${expression}${closingDelimiter}`)
          continue
        }
      }
    }

    result += source[cursor]
    cursor += 1
    lineStart = false
  }

  return { source: result, placeholders }
}

function languageClass(info: string): string {
  const language = info.trim().split(/\s+/)[0] || ''
  return /^[A-Za-z0-9_+-]+$/.test(language) ? `language-${language}` : ''
}

function createMarkdown(): MarkdownIt {
  const markdown = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
    breaks: false
  })
  markdown.use(taskLists, { enabled: false })
  markdown.renderer.rules.fence = (tokens, index) => {
    const token = tokens[index]
    const info = token.info.trim()
    const language = info.split(/\s+/)[0]?.toLowerCase() || ''
    if (language === 'mermaid') {
      return `<pre class="mermaid">${escapeHtml(token.content)}</pre>`
    }
    const className = languageClass(info)
    const classAttribute = className ? ` class="${className}"` : ''
    return `<pre><code${classAttribute}>${escapeHtml(token.content)}</code></pre>\n`
  }
  return markdown
}

function sanitizeRenderedHtml(html: string): string {
  return xss(html, {
    whiteList: markdownAllowList,
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style', 'iframe', 'object', 'embed'],
    css: false
  })
}

function restorePlaceholders(html: string, placeholders: MathPlaceholder[]): string {
  return placeholders.reduce((result, placeholder) => result.split(placeholder.marker).join(placeholder.html), html)
}

export function isMarkdownPath(filePath: string): boolean {
  return /\.(?:md|markdown)$/i.test(filePath)
}

export function markdownViewStyles(): string {
  return `<style>
    :root {
      color-scheme: light dark;
      --markdown-bg: #ffffff;
      --markdown-panel: #f4f4f7;
      --markdown-border: #e2e1e6;
      --markdown-text: #1f1d24;
      --markdown-muted: #6b6375;
      --markdown-accent: #aa3bff;
      --markdown-code-bg: #fbfbfd;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --markdown-bg: #16171d;
        --markdown-panel: #1c1d25;
        --markdown-border: #2e303a;
        --markdown-text: #e8e7ee;
        --markdown-muted: #9ca3af;
        --markdown-accent: #c084fc;
        --markdown-code-bg: #111218;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--markdown-bg);
      color: var(--markdown-text);
      font: 16px/1.65 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }
    .markdown-page { max-width: 1000px; margin: 0 auto; padding: 32px 20px 48px; }
    .markdown-header { border-bottom: 1px solid var(--markdown-border); margin-bottom: 28px; padding-bottom: 18px; }
    .markdown-header h1 { margin: 0 0 8px; font: 600 22px/1.3 ui-monospace, Consolas, monospace; word-break: break-all; }
    .markdown-source-link, .markdown-footer { color: var(--markdown-muted); font-size: 14px; word-break: break-all; }
    .markdown-source-link a, .markdown-footer a { color: var(--markdown-accent); text-decoration: none; }
    .markdown-source-link a:hover, .markdown-footer a:hover { text-decoration: underline; }
    .markdown-content { overflow-wrap: anywhere; }
    .markdown-content h1, .markdown-content h2, .markdown-content h3, .markdown-content h4, .markdown-content h5, .markdown-content h6 { line-height: 1.3; margin: 1.4em 0 .55em; }
    .markdown-content h1 { font-size: 2em; }
    .markdown-content h2 { border-bottom: 1px solid var(--markdown-border); padding-bottom: .25em; }
    .markdown-content img { max-width: 100%; height: auto; }
    .markdown-content a { color: var(--markdown-accent); }
    .markdown-content blockquote { border-left: 4px solid var(--markdown-border); color: var(--markdown-muted); margin: 1em 0; padding: 0 1em; }
    .markdown-content table { border-collapse: collapse; display: block; max-width: 100%; overflow-x: auto; }
    .markdown-content th, .markdown-content td { border: 1px solid var(--markdown-border); padding: 6px 10px; text-align: left; }
    .markdown-content th { background: var(--markdown-panel); }
    .markdown-content pre { background: var(--markdown-code-bg); border: 1px solid var(--markdown-border); border-radius: 8px; overflow: auto; padding: 14px 16px; }
    .markdown-content code { background: var(--markdown-panel); border-radius: 4px; font: .9em ui-monospace, SFMono-Regular, Consolas, monospace; padding: .15em .3em; }
    .markdown-content pre code, .markdown-content pre.mermaid { background: transparent; border: 0; padding: 0; white-space: pre; }
    .markdown-content .task-list-item { list-style: none; }
    .markdown-content .contains-task-list { padding-left: 1.2em; }
    .markdown-content .task-list-item-checkbox { margin: 0 .45em 0 0; }
    .markdown-content .mermaid { overflow-x: auto; }
    .markdown-content .math-display { display: block; margin: 1em 0; overflow-x: auto; padding: .2em 0; }
    .markdown-content .math-inline { display: inline-block; max-width: 100%; overflow-x: auto; vertical-align: middle; }
    .markdown-content .math-error { background: #fff1f1; color: #9b1c1c; }
    .markdown-actions { align-items: center; display: flex; gap: 10px; margin: 0 0 20px; }
    .markdown-copy-button { background: var(--markdown-bg); border: 1px solid var(--markdown-border); border-radius: 6px; color: var(--markdown-text); cursor: pointer; font: inherit; font-size: 13px; padding: 4px 10px; }
    .markdown-copy-button:hover { border-color: var(--markdown-accent); color: var(--markdown-accent); }
    .markdown-source { position: absolute; left: -9999px; width: 1px; }
    .markdown-footer { margin-top: 28px; }
  </style>`
}

export function renderMarkdownView({ filename, sourceUrl, source }: MarkdownViewInput): string {
  const prepared = replaceMath(source)
  const rendered = createMarkdown().render(prepared.source)
  const body = restorePlaceholders(sanitizeRenderedHtml(rendered), prepared.placeholders)
  return `<main class="markdown-page">
  <header class="markdown-header">
    <h1>${escapeHtml(filename)}</h1>
    <p class="markdown-source-link"><a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(sourceUrl)}</a></p>
  </header>
  <div class="markdown-actions">
    <button type="button" class="markdown-copy-button" aria-live="polite">Copy source</button>
    <textarea class="markdown-source" aria-hidden="true" tabindex="-1" hidden>${escapeHtml(source)}</textarea>
  </div>
  <article class="markdown-content">${body}</article>
  <p class="markdown-footer"><a href="/">← Back to home</a> · <a href="/cache.html">Cached previews</a></p>
</main>
<script>${COPY_SCRIPT}</script>
<script>${ENHANCEMENT_SCRIPT}</script>`
}

export const markdownRuntimeAssets = {
  mermaid: { path: MERMAID_RUNTIME_PATH, upstream: MERMAID_RUNTIME_URL },
  highlight: { path: HIGHLIGHT_RUNTIME_PATH, upstream: HIGHLIGHT_RUNTIME_URL }
} as const
