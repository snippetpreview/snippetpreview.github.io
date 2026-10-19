import './style.css'
import { githubProvider } from './providers/github-provider'
import { deleteResource, listResources, requestPersistence, storageStatus } from './cache/resource-store'
import type { CachedResource } from './cache/resource-store'

const root = document.querySelector<HTMLDivElement>('#cache-app')!

type Props = {id?: string; class?: string; text?: string; href?: string; type?: string}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (props.id) {
    node.id = props.id
  }
  if (props.class) {
    node.className = props.class
  }
  if (props.text !== undefined) {
    node.textContent = props.text
  }
  if (props.href && node instanceof HTMLAnchorElement) {
    node.href = props.href
  }
  if (props.type && node instanceof HTMLButtonElement) {
    node.type = props.type as 'button' | 'submit' | 'reset'
  }
  for (const child of children) {
    node.append(child)
  }
  return node
}

function button(label: string, onClick: () => void, extraClass?: string): HTMLButtonElement {
  const node = h('button', { type: 'button', class: extraClass, text: label })
  node.addEventListener('click', onClick)
  return node
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / 1024 ** index
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

function formatTime(timestamp: number): string {
  return timestamp ? new Date(timestamp).toLocaleString() : 'unknown'
}

function resourceBytes(resource: CachedResource): number {
  return Object.values(resource.files).reduce((total, file) => total + file.size, 0)
}

function safeName(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]+/g, '_')
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function previewPathFor(resource: CachedResource, filePath: string): string {
  const result = githubProvider.buildPreviewPath({ resourceId: resource.resourceId, filePath })
  return result.ok ? result.value : '/'
}

function canonicalUrlFor(resource: CachedResource): string {
  const result = githubProvider.buildCanonicalUrl({
    resourceId: resource.resourceId,
    username: resource.username
  })
  return result.ok ? result.value : ''
}

async function downloadRenderedPreview(resource: CachedResource): Promise<void> {
  const response = githubProvider.render({ resource, filePath: '' })
  const blob = await response.blob()
  downloadBlob(blob, `${safeName(resource.resourceId)}.html`)
}

function downloadSource(resource: CachedResource, key: string): void {
  const file = resource.files[key]
  if (!file) {
    return
  }
  downloadBlob(new Blob([file.content], { type: file.mime }), safeName(file.filename || key))
}

function fileRow(resource: CachedResource, key: string): HTMLTableRowElement {
  const file = resource.files[key]
  const row = h('tr')
  row.append(
    h('td', {}, h('code', { text: file.filename || key })),
    h('td', { text: formatBytes(file.size) }),
    h('td', { class: 'cache-row-actions' },
      button('Download', () => downloadSource(resource, key)),
      button('Open', () => {
        window.location.href = previewPathFor(resource, key)
      })
    )
  )
  return row
}

function resourceCard(resource: CachedResource): HTMLElement {
  const keys = Object.keys(resource.files)
  const canonical = canonicalUrlFor(resource)
  const card = h('article', { class: 'cache-card' })

  const heading = h('h2', { text: `${resource.providerId} / ${resource.resourceId}` })
  const meta = h('p', { class: 'cache-meta' })
  meta.append(
    h('span', { text: `revision ${resource.revision || 'unknown'}` }),
    h('span', { text: `${keys.length} file${keys.length === 1 ? '' : 's'}` }),
    h('span', { text: formatBytes(resourceBytes(resource)) }),
    h('span', { text: `fetched ${formatTime(resource.fetchedAt)}` })
  )

  const actions = h('div', { class: 'cache-actions' },
    button('Download HTML', () => void downloadRenderedPreview(resource)),
    button('Remove', () => void removeResource(resource), 'danger')
  )
  if (canonical) {
    actions.append(h('a', { href: canonical, text: 'Open on GitHub' }))
  }

  const table = h('table', { class: 'cache-files' })
  const head = h('thead')
  head.append(h('tr', {}, h('th', { text: 'File' }), h('th', { text: 'Size' }), h('th', { text: 'Actions' })))
  const body = h('tbody')
  for (const key of keys) {
    body.append(fileRow(resource, key))
  }
  table.append(head, body)

  card.append(heading, meta)
  if (resource.description) {
    card.append(h('p', { class: 'cache-desc', text: resource.description }))
  }
  card.append(actions, table)
  return card
}

async function removeResource(resource: CachedResource): Promise<void> {
  await deleteResource(resource.providerId, resource.resourceId)
  await refresh()
}

function renderUsage(usage: { usage: number; quota: number; persisted: boolean }, count: number): void {
  const section = document.getElementById('cache-usage')
  if (!section) {
    return
  }
  section.replaceChildren()

  const summary = h('p', { class: 'cache-usage-line' })
  summary.append(
    h('strong', { text: `${count} cached preview${count === 1 ? '' : 's'}` }),
    h('span', { text: ` · ${formatBytes(usage.usage)} of ${formatBytes(usage.quota)} used` }),
    h('span', { text: ` · persistent storage: ${usage.persisted ? 'granted' : 'not granted'}` })
  )
  section.append(summary)

  if (!usage.persisted) {
    section.append(
      button('Request persistent storage', async () => {
        await requestPersistence()
        await refresh()
      })
    )
  }
}

function renderList(resources: CachedResource[]): void {
  const list = document.getElementById('cache-list')
  if (!list) {
    return
  }
  list.replaceChildren()

  if (resources.length === 0) {
    const empty = h('div', { class: 'cache-empty' },
      h('p', { text: 'No previews are cached on this device yet.' }),
      h('p', {}, h('a', { href: '/', text: 'Open a gist preview' }), ' and it will be cached automatically.')
    )
    list.append(empty)
    return
  }

  for (const resource of resources) {
    list.append(resourceCard(resource))
  }
}

async function refresh(): Promise<void> {
  const [resources, usage] = await Promise.all([listResources(), storageStatus()])
  renderUsage(usage, resources.length)
  renderList(resources)
}

function renderShell(): void {
  root.replaceChildren(
    h('main', { class: 'cache-root' },
      h('header', { class: 'cache-header' },
        h('h1', { text: 'Cached previews' }),
        h('p', {
          text: 'Previews fetched on this device. Open them without a connection, download the rendered HTML or the source, or remove them.'
        }),
        h('p', { class: 'cache-nav' },
          h('a', { href: '/', text: '← Back to the composer' })
        )
      ),
      h('section', { id: 'cache-usage', class: 'cache-usage' }),
      h('section', { id: 'cache-list', class: 'cache-list' })
    )
  )
}

async function main(): Promise<void> {
  renderShell()
  await refresh()
}

void main()
