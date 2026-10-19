import type { ProviderResource } from '../providers/provider-adapter'

export interface CachedResource extends ProviderResource {
  fetchedAt: number
  lastCheckedAt: number
  visits: Record<string, number>
}

export type SaveOutcome = 'persisted' | 'volatile'

const DB_NAME = 'snippet-preview'
const DB_VERSION = 1
const STORE = 'resources'
const LAST_CHECKED_INDEX = 'by-lastCheckedAt'

type Key = [string, string]

let memory = new Map<string, CachedResource>()
let databasePromise: Promise<IDBDatabase | null> | null = null
let persistence: 'unknown' | 'granted' | 'denied' = 'unknown'
let persistenceRequested = false

function memoryKey(providerId: string, resourceId: string): string {
  return `${providerId}\u0000${resourceId}`
}

function toKey(providerId: string, resourceId: string): Key {
  return [providerId, resourceId]
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise<IDBDatabase | null>((resolve) => {
    if (typeof indexedDB === 'undefined') {
      resolve(null)
      return
    }

    let request: IDBOpenDBRequest
    try {
      request = indexedDB.open(DB_NAME, DB_VERSION)
    } catch {
      resolve(null)
      return
    }

    let settled = false
    const settle = (db: IDBDatabase | null): void => {
      if (!settled) {
        settled = true
        resolve(db)
      }
    }

    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: ['providerId', 'resourceId'] })
        store.createIndex(LAST_CHECKED_INDEX, 'lastCheckedAt')
      }
    }
    request.onsuccess = () => {
      const db = request.result
      db.onversionchange = () => db.close()
      settle(db)
    }
    request.onerror = () => settle(null)
    request.onblocked = () => settle(null)
  })

  return databasePromise
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'))
  })
}

function isQuotaError(error: unknown): boolean {
  if (typeof DOMException !== 'undefined' && error instanceof DOMException) {
    return error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED'
  }
  return false
}

function readMemory(providerId: string, resourceId: string): CachedResource | null {
  return memory.get(memoryKey(providerId, resourceId)) ?? null
}

function writeMemory(resource: CachedResource): void {
  memory.set(memoryKey(resource.providerId, resource.resourceId), resource)
}

async function writeRecord(db: IDBDatabase, record: CachedResource): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = db.transaction(STORE, 'readwrite')
    } catch (error) {
      reject(error)
      return
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    try {
      transaction.objectStore(STORE).put(record)
    } catch (error) {
      reject(error)
    }
  })
}

async function evictLeastRecentlyChecked(db: IDBDatabase, count: number): Promise<number> {
  const all = await readAll(db)
  const victims = all
    .slice()
    .sort((a, b) => a.lastCheckedAt - b.lastCheckedAt)
    .slice(0, Math.max(0, count))

  for (const victim of victims) {
    await removeRecord(db, victim.providerId, victim.resourceId)
  }
  return victims.length
}

async function readAll(db: IDBDatabase): Promise<CachedResource[]> {
  const transaction = db.transaction(STORE, 'readonly')
  const request = transaction.objectStore(STORE).getAll() as IDBRequest<CachedResource[]>
  return requestResult(request)
}

async function removeRecord(db: IDBDatabase, providerId: string, resourceId: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let transaction: IDBTransaction
    try {
      transaction = db.transaction(STORE, 'readwrite')
    } catch (error) {
      reject(error)
      return
    }
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    try {
      transaction.objectStore(STORE).delete(toKey(providerId, resourceId))
    } catch (error) {
      reject(error)
    }
  })
}

async function ensurePersistence(): Promise<void> {
  if (persistenceRequested) {
    return
  }
  persistenceRequested = true
  try {
    const granted = await requestPersistence()
    persistence = granted ? 'granted' : 'denied'
  } catch {
    persistence = 'denied'
  }
}

export function getPersistence(): 'unknown' | 'granted' | 'denied' {
  return persistence
}

interface PersistCapableStorage {
  // lib.dom.d.ts declares persist() but lib.webworker.d.ts omits it.
  persist?: () => Promise<boolean>
}

export async function requestPersistence(): Promise<boolean> {
  if (typeof navigator === 'undefined') {
    return false
  }
  const storage = navigator.storage as unknown as PersistCapableStorage | undefined
  if (!storage?.persist) {
    return false
  }
  try {
    return await storage.persist()
  } catch {
    return false
  }
}

export async function storageStatus(): Promise<{ usage: number; quota: number; persisted: boolean }> {
  let usage = 0
  let quota = 0
  let persisted = persistence === 'granted'

  if (typeof navigator !== 'undefined' && navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate()
      usage = estimate.usage ?? 0
      quota = estimate.quota ?? 0
    } catch {
      // leave defaults when the estimate is unavailable
    }
    if (navigator.storage.persisted) {
      try {
        persisted = await navigator.storage.persisted()
      } catch {
        // keep the previous value
      }
    }
  }

  return { usage, quota, persisted }
}

export async function getResource(providerId: string, resourceId: string): Promise<CachedResource | null> {
  const db = await openDatabase()
  if (!db) {
    return readMemory(providerId, resourceId)
  }

  try {
    const transaction = db.transaction(STORE, 'readonly')
    const request = transaction.objectStore(STORE).get(toKey(providerId, resourceId)) as IDBRequest<
      CachedResource | undefined
    >
    return (await requestResult(request)) ?? null
  } catch {
    return readMemory(providerId, resourceId)
  }
}

export async function listResources(): Promise<CachedResource[]> {
  const db = await openDatabase()
  if (!db) {
    return Array.from(memory.values()).sort((a, b) => b.lastCheckedAt - a.lastCheckedAt)
  }

  const records = await readAll(db).catch(() => [])
  return records.sort((a, b) => b.lastCheckedAt - a.lastCheckedAt)
}

export async function saveResource(
  resource: ProviderResource,
  options: { fetchedAt?: number; lastCheckedAt?: number } = {}
): Promise<SaveOutcome> {
  const now = Date.now()
  const existing = await getResource(resource.providerId, resource.resourceId)
  const record: CachedResource = {
    ...resource,
    fetchedAt: options.fetchedAt ?? now,
    lastCheckedAt: options.lastCheckedAt ?? now,
    visits: existing?.visits ?? {}
  }

  const db = await openDatabase()
  if (!db) {
    writeMemory(record)
    return 'volatile'
  }

  void ensurePersistence()

  try {
    await writeRecord(db, record)
    return 'persisted'
  } catch (error) {
    if (!isQuotaError(error)) {
      return 'volatile'
    }
    try {
      const total = (await readAll(db)).length
      const evicted = await evictLeastRecentlyChecked(db, Math.ceil(total / 4))
      if (evicted === 0) {
        throw error
      }
      await writeRecord(db, record)
      return 'persisted'
    } catch {
      return 'volatile'
    }
  }
}

export async function touchResource(
  providerId: string,
  resourceId: string,
  lastCheckedAt = Date.now()
): Promise<void> {
  const existing = await getResource(providerId, resourceId)
  if (!existing) {
    return
  }

  const updated: CachedResource = { ...existing, lastCheckedAt }
  const db = await openDatabase()
  if (!db) {
    writeMemory(updated)
    return
  }

  try {
    await writeRecord(db, updated)
  } catch {
    writeMemory(updated)
  }
}

export async function recordVisit(providerId: string, resourceId: string, filePath: string): Promise<void> {
  const existing = await getResource(providerId, resourceId)
  if (!existing) {
    return
  }

  const updated: CachedResource = {
    ...existing,
    visits: { ...existing.visits, [filePath || '']: Date.now() }
  }
  const db = await openDatabase()
  if (!db) {
    writeMemory(updated)
    return
  }

  try {
    await writeRecord(db, updated)
  } catch {
    writeMemory(updated)
  }
}

export async function deleteResource(providerId: string, resourceId: string): Promise<void> {
  memory.delete(memoryKey(providerId, resourceId))
  const db = await openDatabase()
  if (!db) {
    return
  }

  try {
    await removeRecord(db, providerId, resourceId)
  } catch {
    // the record is already unreachable through the in-memory view
  }
}
