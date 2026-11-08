import { useEffect, useState } from 'react'
import {
  checkForUpdate,
  getInstalledVersion,
  isIOS,
  isStandalone,
  offlineSupported,
  type VersionInfo,
} from '../pwa'

type CheckState =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'updated'; version: string }
  | { kind: 'error'; message: string }

function formatBuilt(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

/** Settings → App: offline status, updates, and open-source licenses. */
export function AppPanel() {
  return (
    <div className="space-y-4">
      <OfflineSection />
      <LicensesSection />
    </div>
  )
}

function OfflineSection() {
  const [installed, setInstalled] = useState<VersionInfo | null | undefined>(
    undefined,
  )
  const [check, setCheck] = useState<CheckState>({ kind: 'idle' })

  // Poll until the first offline copy has finished saving.
  useEffect(() => {
    if (!offlineSupported) return
    let cancelled = false
    let timer: ReturnType<typeof setTimeout>
    const poll = async () => {
      const v = await getInstalledVersion()
      if (cancelled) return
      setInstalled(v)
      if (!v) timer = setTimeout(poll, 2000)
    }
    poll()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [])

  const runCheck = async () => {
    setCheck({ kind: 'checking' })
    try {
      const { updated, current } = await checkForUpdate()
      if (current) setInstalled(current)
      if (updated && current) {
        setCheck({ kind: 'updated', version: current.version })
        setTimeout(() => window.location.reload(), 1200)
      } else {
        setCheck({ kind: 'current' })
      }
    } catch (err) {
      setCheck({
        kind: 'error',
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  if (!offlineSupported) {
    return (
      <p className="rounded-xl bg-white/5 p-4 text-sm text-indigo-200">
        Offline mode and updates are only active in the production build (
        <code>npm run build</code>). This is the development server.
      </p>
    )
  }

  const showInstallTip = isIOS() && !isStandalone()

  return (
    <>
      <div className="rounded-xl bg-white/5 p-4">
        {installed === undefined ? (
          <p className="text-sm text-indigo-200">Checking offline status…</p>
        ) : installed ? (
          <>
            <p className="font-semibold text-lime-300">✓ Ready to play offline</p>
            <p className="mt-1 text-sm text-indigo-200">
              Version <code className="text-white">{installed.version}</code>
              {installed.built && <> · built {formatBuilt(installed.built)}</>}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-amber-300">Saving for offline use…</p>
            <p className="mt-1 text-sm text-indigo-200">
              Keep the app open while you're online. This only happens once.
            </p>
          </>
        )}
      </div>

      {showInstallTip && (
        <div className="rounded-xl bg-white/5 p-4 text-sm text-indigo-100">
          <p className="font-semibold text-white">Install on this iPhone or iPad</p>
          <ol className="mt-1 list-decimal space-y-0.5 pl-5">
            <li>
              Tap the <strong>Share</strong> button in Safari.
            </li>
            <li>
              Choose <strong>Add to Home Screen</strong>.
            </li>
            <li>Open the app from your Home Screen once while online.</li>
          </ol>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={runCheck}
          disabled={!installed || check.kind === 'checking' || check.kind === 'updated'}
          className="min-h-12 w-full rounded-xl bg-yellow-400 font-bold text-indigo-950 transition active:bg-yellow-500 disabled:opacity-40"
        >
          {check.kind === 'checking' ? 'Checking…' : 'Check for updates'}
        </button>
        <p className="mt-2 min-h-5 text-center text-sm" role="status">
          {check.kind === 'current' && (
            <span className="text-indigo-200">You have the latest version.</span>
          )}
          {check.kind === 'updated' && (
            <span className="text-lime-300">
              Updated to {check.version}. Restarting…
            </span>
          )}
          {check.kind === 'error' && (
            <span className="text-rose-300">
              {check.message.replace(/[.!]?$/, '.')} Your current version still
              works.
            </span>
          )}
        </p>
      </div>

      <p className="text-xs text-indigo-300">
        The app never checks for updates on its own. It only changes when you
        tap the button above. Your scores are kept when it updates.
      </p>
    </>
  )
}

const LICENSES_URL = `${import.meta.env.BASE_URL}LICENSES.txt`

/** Shows the licenses in-app: a plain link would strand iOS home-screen users. */
function LicensesSection() {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    if (!open || text !== null) return
    fetch(LICENSES_URL)
      .then((res) => {
        // The dev server answers unknown paths with index.html, so check the type.
        const isText = res.headers.get('content-type')?.startsWith('text/plain')
        if (!res.ok || !isText) throw new Error()
        return res.text()
      })
      .then(setText)
      .catch(() => setError(true))
  }, [open, text])

  return (
    <div className="border-t border-white/10 pt-4">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between rounded-xl px-1 text-sm font-semibold text-indigo-100 active:bg-white/10"
      >
        Licenses
        <span aria-hidden="true">{open ? '▾' : '▸'}</span>
      </button>
      {open && (
        <div className="mt-2">
          <p className="mb-2 text-xs text-indigo-300">
            Match Games is open source under the MIT License, and it's built
            with the open-source projects listed below.
          </p>
          {error ? (
            <p className="rounded-xl bg-white/5 p-3 text-sm text-indigo-200">
              The licenses are collected by the production build (
              <code>npm run build</code>).
            </p>
          ) : text === null ? (
            <p className="text-sm text-indigo-200">Loading…</p>
          ) : (
            <pre className="max-h-80 select-text overflow-auto whitespace-pre-wrap rounded-xl bg-black/30 p-3 font-mono text-[11px] leading-snug text-indigo-100">
              {text}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
