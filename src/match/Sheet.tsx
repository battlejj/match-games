import { type ReactNode, useEffect, useId } from 'react'

/**
 * A titled panel that slides over the screen: a bottom sheet on phones, a
 * centered dialog on wider screens. Closes with ✕, Escape, or a tap outside.
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      {/* Tap-outside target; keyboard users have ✕ and Escape. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/55"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-paper p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-ink sm:rounded-3xl sm:pb-5"
      >
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 id={titleId} className="text-2xl font-bold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            title="Close"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-track text-lg transition active:bg-black/10 hover:bg-black/5 focus:outline-none focus-visible:ring-4 focus-visible:ring-rhombus"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
