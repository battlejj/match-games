// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

// storage.ts caches values per module instance; load a fresh copy per test.
const load = () => import('./storage')
const realStorage = window.localStorage

/** Replaces window.localStorage with one whose methods throw. */
function breakStorage(methods: ('getItem' | 'setItem')[]) {
  const fail = () => {
    throw new DOMException('Storage unavailable', 'SecurityError')
  }
  const broken = {
    getItem: methods.includes('getItem') ? fail : () => null,
    setItem: methods.includes('setItem') ? fail : () => {},
    removeItem: () => {},
  }
  Object.defineProperty(window, 'localStorage', {
    value: broken,
    configurable: true,
  })
}

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', {
    value: realStorage,
    configurable: true,
  })
  vi.resetModules()
  localStorage.clear()
})

describe('storage', () => {
  it('returns the fallback for missing or corrupt values', async () => {
    const { readJSON } = await load()
    expect(readJSON('missing', 7)).toBe(7)
    localStorage.setItem('corrupt', '{not json')
    expect(readJSON('corrupt', 'fallback')).toBe('fallback')
  })

  it('round-trips values and keeps object identity until changed', async () => {
    const { readJSON, writeJSON } = await load()
    expect(writeJSON('k', { a: 1 })).toBe(true)
    const first = readJSON('k', null)
    expect(first).toEqual({ a: 1 })
    expect(readJSON('k', null)).toBe(first)
    writeJSON('k', { a: 2 })
    expect(readJSON('k', null)).not.toBe(first)
    expect(JSON.parse(localStorage.getItem('k') ?? '')).toEqual({ a: 2 })
  })

  it('reads values written by earlier versions as plain numbers', async () => {
    localStorage.setItem('old', '12')
    const { readJSON } = await load()
    expect(readJSON('old', null)).toBe(12)
  })

  it('never throws when storage refuses writes, and keeps the value in memory', async () => {
    breakStorage(['setItem'])
    const { readJSON, writeJSON, writeString } = await load()
    expect(writeJSON('k', 5)).toBe(false)
    expect(readJSON('k', 0)).toBe(5)
    expect(writeString('s', 'x')).toBe(false)
  })

  it('never throws when storage refuses reads', async () => {
    breakStorage(['getItem'])
    const { readJSON, readString } = await load()
    expect(readJSON('k', 'fallback')).toBe('fallback')
    expect(readString('k')).toBeNull()
  })

  it('removeKey clears a value', async () => {
    const { readJSON, removeKey, writeJSON } = await load()
    writeJSON('k', 1)
    removeKey('k')
    expect(readJSON('k', 'gone')).toBe('gone')
    expect(localStorage.getItem('k')).toBeNull()
  })

  it('picks up changes made in another tab', async () => {
    const { readJSON, writeJSON } = await load()
    writeJSON('k', 1)
    localStorage.setItem('k', '2') // as if written by another tab
    window.dispatchEvent(new StorageEvent('storage', { key: 'k' }))
    expect(readJSON('k', 0)).toBe(2)
  })
})
