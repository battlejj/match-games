import type { ReactNode } from 'react'

/** The look of primaryButton without its size, for smaller placements. */
export const primaryColors =
  'bg-hex font-bold text-ink shadow-[0_3px_0_var(--color-hex-deep)] transition active:translate-y-[3px] active:shadow-none disabled:translate-y-0 disabled:opacity-40 disabled:shadow-none focus:outline-none focus-visible:ring-4 focus-visible:ring-rhombus'

/**
 * The one main action on a screen: a yellow block with a hard edge
 * underneath that presses flat when tapped. Add a size, e.g. `w-full`.
 */
export const primaryButton = `min-h-12 rounded-xl px-5 text-lg ${primaryColors}`

/** Round and pill buttons that sit directly on the mat. */
export const matButton =
  'flex min-h-11 min-w-11 items-center justify-center rounded-full bg-black/15 text-paper transition active:bg-black/30 hover:bg-black/25 focus:outline-none focus-visible:ring-4 focus-visible:ring-hex'

/** Pick one of a few options. The selected one is blue, like a picked card. */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className="mb-4">
      <legend className="mb-1.5 font-bold text-ink">{label}</legend>
      <div className="flex gap-1 rounded-xl bg-track p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-lg px-1.5 font-bold transition focus:outline-none focus-visible:ring-4 focus-visible:ring-hex ${
              o.value === value
                ? 'bg-rhombus text-paper'
                : 'text-ink active:bg-black/5'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`${matButton} text-xl`}
    >
      {children}
    </button>
  )
}

/** A label and its value, read as plain text on the mat. */
export function Stat({
  label,
  value,
  valueClass = '',
}: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5 whitespace-nowrap">
      <div className="text-mat-text">{label}</div>
      <div
        className={`text-lg font-bold tabular-nums text-paper ${valueClass}`}
      >
        {value}
      </div>
    </div>
  )
}
