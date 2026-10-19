const DC_SOURCE_PATTERN = /<meta\s[^>]*name\s*=\s*["']DC\.source["']/i

export function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function sourceMetaTag(sourceUrl: string): string {
  return `<meta name="DC.source" scheme="URI" content="${escapeHtml(sourceUrl)}">`
}

/**
 * Inserts the DC.source declaration as the first element of the document head.
 * Gist documents that already declare their own source are left untouched.
 */
export function injectSourceMeta(html: string, sourceUrl: string): string {
  if (DC_SOURCE_PATTERN.test(html)) {
    return html
  }

  const tag = sourceMetaTag(sourceUrl)
  const head = /<head[^>]*>/i.exec(html)
  if (head) {
    const at = head.index + head[0].length
    return `${html.slice(0, at)}${tag}${html.slice(at)}`
  }

  const htmlTag = /<html[^>]*>/i.exec(html)
  if (htmlTag) {
    const at = htmlTag.index + htmlTag[0].length
    return `${html.slice(0, at)}<head>${tag}</head>${html.slice(at)}`
  }

  return `${tag}${html}`
}
