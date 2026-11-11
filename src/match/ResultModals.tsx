import { type ReactNode, useState } from 'react'
import { Block } from './blocks'
import { primaryButton } from './controls'
import { formatTime, PLAYERS, SOLO_BLOCK } from './display'
import { LeaderboardList } from './LeaderboardList'
import {
  addLeaderboardEntry,
  getLastPlayerName,
  MAX_NAME_LENGTH,
  qualifyingRank,
  setLastPlayerName,
  useLeaderboard,
} from './leaderboard'

function ModalShell({
  blocks,
  children,
}: {
  /** The block shapes shown at the top: whoever won, or the mode. */
  blocks: ReactNode
  children: ReactNode
}) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-ink/55 p-4">
      <div className="block-edge max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-3xl bg-paper p-6 text-center text-ink">
        <div className="flex items-end justify-center gap-2">{blocks}</div>
        {children}
      </div>
    </div>
  )
}

interface ModalActionProps {
  onPlayAgain: () => void
  onNewGame: () => void
}

function ModalActions({ onPlayAgain, onNewGame }: ModalActionProps) {
  return (
    <>
      <button
        type="button"
        onClick={onPlayAgain}
        className={`${primaryButton} mt-6 w-full`}
      >
        Play again
      </button>
      <button
        type="button"
        onClick={onNewGame}
        className="mt-2 min-h-11 w-full rounded-xl font-bold text-rhombus active:bg-track"
      >
        New game
      </button>
    </>
  )
}

/** Shown when every pair is found in a practice or two-player game. */
export function WinModal({
  versus,
  scores,
  moves,
  seconds,
  newBest,
  ...actions
}: ModalActionProps & {
  versus: boolean
  scores: [number, number]
  moves: number
  seconds: number
  newBest: boolean
}) {
  const winner = scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1
  const summary = `${moves} moves in ${formatTime(seconds)}`

  if (!versus) {
    return (
      <ModalShell blocks={<Block shape={SOLO_BLOCK} className="w-14" />}>
        <h2 className="mt-3 text-2xl font-bold">You matched them all!</h2>
        <p className="mt-1 text-lg text-ink-soft">{summary}</p>
        {newBest && (
          <p className="mt-3 inline-block rounded-full bg-hex px-3 py-0.5 font-bold">
            New best!
          </p>
        )}
        <ModalActions {...actions} />
      </ModalShell>
    )
  }

  return (
    <ModalShell
      blocks={
        winner === null ? (
          PLAYERS.map((p) => (
            <Block key={p.name} shape={p.block} className="w-12" />
          ))
        ) : (
          <Block shape={PLAYERS[winner].block} className="w-14" />
        )
      }
    >
      <h2 className="mt-3 text-2xl font-bold">
        {winner === null ? "It's a tie!" : `${PLAYERS[winner].name} wins!`}
      </h2>
      <p className="mt-1 text-4xl font-bold tabular-nums">
        {scores[0]} – {scores[1]}
      </p>
      <p className="mt-1 text-lg text-ink-soft">{summary}</p>
      <ModalActions {...actions} />
    </ModalShell>
  )
}

/**
 * Shown when Beat the clock ends. Checks the leaderboard when it opens and
 * offers to save (or decline saving) a qualifying score.
 */
export function TimedResultsModal({
  board,
  boardLabel,
  matches,
  moves,
  boards,
  ...actions
}: ModalActionProps & {
  /** Leaderboard key, e.g. "math:addition:medium:up". */
  board: string
  boardLabel: string
  matches: number
  moves: number
  boards: number
}) {
  // Rank is decided once, when the game ends, before anything is saved.
  const [rank] = useState(() => qualifyingRank(board, { matches, moves }))
  const [status, setStatus] = useState<'deciding' | 'saved' | 'declined'>(
    'deciding',
  )
  const [savedId, setSavedId] = useState<string>()
  const [name, setName] = useState(getLastPlayerName)
  const entries = useLeaderboard(board)
  const trimmed = name.trim()
  const asking = rank !== null && status === 'deciding'
  const accuracy = moves > 0 ? Math.round((matches / moves) * 100) : 0

  const save = () => {
    const entry = addLeaderboardEntry(board, {
      name: trimmed,
      matches,
      moves,
      boards,
    })
    setLastPlayerName(trimmed)
    setSavedId(entry.id)
    setStatus('saved')
  }

  return (
    <ModalShell blocks={<Block shape="square" className="w-12" />}>
      <h2 className="mt-3 text-2xl font-bold">Time's up!</h2>
      <p className="mt-1 text-6xl font-bold tabular-nums">{matches}</p>
      <p className="font-bold">{matches === 1 ? 'match' : 'matches'}</p>
      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-track p-2">
        {[
          ['Boards cleared', boards],
          ['Moves', moves],
          ['Accuracy', `${accuracy}%`],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse justify-end">
            <dt className="text-sm leading-tight text-ink-soft">{label}</dt>
            <dd className="text-xl font-bold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>

      {asking && (
        <form
          className="mt-5 rounded-xl bg-hex-pale p-4 text-left"
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) save()
          }}
        >
          <p className="text-center text-lg font-bold">
            You made the leaderboard: #{rank + 1}!
          </p>
          <label htmlFor="leaderboard-name" className="mt-3 block font-bold">
            Name for the leaderboard
          </label>
          {/* text-base (16px) or larger prevents iOS from zooming on focus. */}
          <input
            id="leaderboard-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint="done"
            placeholder="Your name"
            className="mt-1 min-h-11 w-full select-text rounded-lg border-2 border-ink/20 bg-paper px-3 text-lg text-ink outline-none focus:border-rhombus"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setStatus('declined')}
              className="min-h-11 flex-1 rounded-lg font-bold text-ink active:bg-black/5"
            >
              No thanks
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="min-h-11 flex-1 rounded-lg bg-ink font-bold text-paper transition active:bg-ink-soft disabled:opacity-40"
            >
              Save score
            </button>
          </div>
        </form>
      )}

      {status === 'declined' && (
        <p className="mt-4 text-ink-soft">
          Score not saved to the leaderboard.
        </p>
      )}

      {!asking && (
        <div className="mt-5 text-left">
          <h3 className="mb-2 text-center font-bold">
            Top scores: {boardLabel}
          </h3>
          <LeaderboardList entries={entries} highlightId={savedId} />
        </div>
      )}

      <ModalActions {...actions} />
    </ModalShell>
  )
}
