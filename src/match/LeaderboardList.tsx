import type { LeaderboardEntry } from './leaderboard'

export function LeaderboardList({
  entries,
  highlightId,
}: {
  entries: LeaderboardEntry[]
  /** The entry just saved, shown in yellow. */
  highlightId?: string
}) {
  if (entries.length === 0) {
    return (
      <p className="rounded-xl bg-track p-4 text-center text-ink-soft">
        No scores yet. Play Beat the clock to set one!
      </p>
    )
  }
  return (
    <ol className="overflow-hidden rounded-xl bg-track">
      {entries.map((e, i) => {
        const highlighted = e.id === highlightId
        return (
          <li
            key={e.id}
            className={`flex items-center gap-3 px-3 py-2 ${
              highlighted ? 'bg-hex' : i % 2 === 1 ? 'bg-black/[0.04]' : ''
            }`}
          >
            <span className="w-6 text-right font-bold tabular-nums">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="font-bold tabular-nums">{e.matches}</span>
            <span
              className={`w-14 text-right text-sm ${highlighted ? '' : 'text-ink-soft'}`}
            >
              {new Date(e.date).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
