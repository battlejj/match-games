import { useSyncExternalStore } from 'react'

// localStorage wrapper that never throws and lets components subscribe to
// changes.
//
// - Reads and writes are wrapped: storage can be full, disabled, or blocked
//   (e.g. some private-browsing modes). Failed writes are reported via the
//   return value instead of crashing whatever triggered them.
// - Parsed values are cached per key, so a key's snapshot keeps the same
//   object identity until it changes. That makes them safe to use with
//   useSyncExternalStore and as hook dependencies.
// - Writes in another tab invalidate the cache and notify subscribers too.

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<() => void>>()

function notify(key: string) {
  for (const listener of listeners.get(key) ?? []) listener()
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === null) {
      // Another tab cleared everything.
      const keys = [...cache.keys()]
      cache.clear()
      for (const key of keys) notify(key)
    } else {
      cache.delete(e.key)
      notify(e.key)
    }
  })
}

function readRaw(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

/** Parsed JSON stored at `key`, or `fallback` if missing or unreadable. */
export function readJSON<T>(key: string, fallback: T): T {
  if (!cache.has(key)) {
    const raw = readRaw(key)
    let value: unknown = null
    if (raw !== null) {
      try {
        value = JSON.parse(raw)
      } catch {
        value = null
      }
    }
    cache.set(key, value)
  }
  return (cache.get(key) as T | null) ?? fallback
}

/** Stores `value` as JSON. Returns false if storage refused the write. */
export function writeJSON(key: string, value: unknown): boolean {
  let saved = true
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    saved = false
  }
  // Keep the in-memory value either way, so the current session still works.
  cache.set(key, value)
  notify(key)
  return saved
}

export function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key)
  } catch {
    // ignore
  }
  cache.set(key, null)
  notify(key)
}

/** Plain-string helpers for values that were never stored as JSON. */
export function readString(key: string): string | null {
  return readRaw(key)
}

export function writeString(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

function subscribe(key: string, listener: () => void) {
  let set = listeners.get(key)
  if (!set) {
    set = new Set()
    listeners.set(key, set)
  }
  set.add(listener)
  return () => {
    set.delete(listener)
  }
}

/**
 * The parsed JSON at `key`, re-rendering when it changes. `fallback` should
 * be a stable value (a module-level constant), since it's returned as-is.
 */
export function useStoredJSON<T>(key: string, fallback: T): T {
  return useSyncExternalStore(
    (listener) => subscribe(key, listener),
    () => readJSON(key, fallback),
    () => fallback,
  )
}
