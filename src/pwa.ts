// Client side of the offline/update setup. See public/sw.js for the design:
// the app never checks for updates on its own, only via checkForUpdate().

const BASE = import.meta.env.BASE_URL

/** Offline support runs only in production builds; in dev it would fight HMR. */
export const offlineSupported =
  import.meta.env.PROD &&
  typeof navigator !== 'undefined' &&
  'serviceWorker' in navigator

export interface VersionInfo {
  version: string
  built: string
}

interface WorkerReply {
  ok: boolean
  updated: boolean
  current: VersionInfo | null
  error?: string
}

export function registerServiceWorker() {
  if (!offlineSupported) return
  window.addEventListener('load', () => {
    // Re-registering the same script URL is a no-op; it doesn't trigger an
    // update check.
    navigator.serviceWorker
      .register(`${BASE}sw.js`, { scope: BASE })
      .catch((err) => console.warn('Offline support unavailable:', err))
    // Ask the browser not to evict our storage under pressure.
    navigator.storage?.persist?.().catch(() => {})
  })
}

async function ask(type: 'status' | 'check-update'): Promise<WorkerReply> {
  const registration = await navigator.serviceWorker.getRegistration(BASE)
  const worker = registration?.active
  if (!worker) {
    throw new Error(
      'Offline support is still being set up. Keep the app open while online and try again.',
    )
  }
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timer = setTimeout(
      () => reject(new Error('Timed out waiting for the offline cache.')),
      120_000,
    )
    channel.port1.onmessage = (e: MessageEvent<WorkerReply>) => {
      clearTimeout(timer)
      if (e.data.ok) resolve(e.data)
      else reject(new Error(e.data.error ?? 'Unknown error'))
    }
    worker.postMessage({ type }, [channel.port2])
  })
}

/** The version saved for offline use, or null if it isn't saved yet. */
export async function getInstalledVersion(): Promise<VersionInfo | null> {
  if (!offlineSupported) return null
  try {
    return (await ask('status')).current
  } catch {
    return null
  }
}

/**
 * Downloads a new version if one is published. On success with
 * `updated: true` the caller should reload to start using it.
 */
export async function checkForUpdate(): Promise<{
  updated: boolean
  current: VersionInfo | null
}> {
  if (!navigator.onLine) {
    throw new Error(
      "You're offline. Connect to the internet to check for updates.",
    )
  }
  const { updated, current } = await ask('check-update')
  return { updated, current }
}

export function isStandalone() {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's non-standard flag for home-screen apps.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function isIOS() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}
