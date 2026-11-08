import { Link } from '@tanstack/react-router'
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AppPanel } from './AppPanel'
import {
  addLeaderboardEntry,
  getLastPlayerName,
  getLeaderboard,
  hasAnyLeaderboardEntries,
  LEADERBOARD_SIZE,
  type LeaderboardEntry,
  MAX_NAME_LENGTH,
  qualifyingRank,
  resetLeaderboards,
  setLastPlayerName,
} from './leaderboard'
import {
  type CardData,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  type Difficulty,
  type GameDefinition,
} from './types'

// ---------------------------------------------------------------------------
// Config

// 'timed' is solo-only by construction: it's a distinct mode, not a modifier.
type Mode = 'solo' | 'timed' | 'versus'

const MODE_LABELS: Record<Mode, string> = {
  solo: 'Classic',
  timed: 'Timed',
  versus: '2 Players',
}

const PLAYERS = [
  {
    name: 'Player 1',
    ring: 'ring-cyan-300',
    text: 'text-cyan-300',
    panel: 'border-cyan-300 bg-cyan-400/20',
  },
  {
    name: 'Player 2',
    ring: 'ring-pink-400',
    text: 'text-pink-300',
    panel: 'border-pink-400 bg-pink-400/20',
  },
] as const

const MISMATCH_DELAY_MS = 1100
const TIMED_MINUTES = 2
const TIMED_SECONDS = TIMED_MINUTES * 60
// Pause after clearing a timed board so the last match registers visually.
const NEXT_BOARD_DELAY_MS = 500

interface Settings {
  mode: Mode
  difficulty: Difficulty
  variant: string
  faceUp: boolean
}

interface Card<C> {
  key: string
  data: C
  matched: boolean
  // Which player found this pair (always 0 outside versus mode).
  matchedBy: number | null
}

interface Feedback {
  tone: 'good' | 'bad'
  text: string
}

interface TimedResult {
  matches: number
  moves: number
  boards: number
  rank: number | null
  status: 'qualified' | 'saved' | 'declined' | 'unqualified'
  savedId?: string
}

type SettingsTab = 'game' | 'leaderboards' | 'app'

// ---------------------------------------------------------------------------
// Helpers

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

function shuffle<T>(items: T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Every deal gets fresh React keys. Reusing keys would let a new board's faces
// show mid-way through the old board's flip-back animation.
let dealCounter = 0

function buildDeck<C extends CardData>(
  game: GameDefinition<C>,
  difficulty: Difficulty,
  variant: string,
): Card<C>[] {
  const deal = ++dealCounter
  return shuffle(game.buildPairs(difficulty, variant).flat()).map((data, i) => ({
    key: `${deal}-${i}`,
    data,
    matched: false,
    matchedBy: null,
  }))
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

/** Identifies one leaderboard / best-score slot. */
function boardKey(gameId: string, s: Omit<Settings, 'mode'>) {
  return `${gameId}:${s.variant}:${s.difficulty}:${s.faceUp ? 'up' : 'down'}`
}

const bestStorageKey = (board: string) => `match-best-v1:${board}`

function loadBest(board: string): number | null {
  if (typeof window === 'undefined') return null
  const v = window.localStorage.getItem(bestStorageKey(board))
  return v ? Number(v) : null
}

function variantLabel<C extends CardData>(game: GameDefinition<C>, v: string) {
  return game.variants.find((o) => o.value === v)?.label ?? v
}

function describeSettings<C extends CardData>(
  game: GameDefinition<C>,
  s: Settings,
) {
  const parts = [
    MODE_LABELS[s.mode] + (s.mode === 'timed' ? ` ${TIMED_MINUTES} min` : ''),
  ]
  if (game.variants.length > 1) parts.push(variantLabel(game, s.variant))
  parts.push(capitalize(s.difficulty))
  if (game.allowFaceUp) parts.push(s.faceUp ? 'Face up' : 'Memory')
  return parts.join(' · ')
}

// ---------------------------------------------------------------------------
// Board layout

interface BoardLayout {
  cols: number
  cardWidth: number
  gap: number
}

// Measures the space available for the board and picks the column count that
// yields the largest 3:4 cards with no scrolling — so the same deck lays out
// as 4×6 on a portrait phone and 6×4 on a landscape tablet.
function useBoardLayout(count: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<BoardLayout>({
    cols: 4,
    cardWidth: 0,
    gap: 8,
  })

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const compute = () => {
      const { width, height } = el.getBoundingClientRect()
      const gap = Math.min(width, height) >= 600 ? 12 : 8
      let best: BoardLayout = { cols: 4, cardWidth: 0, gap }
      for (let cols = 2; cols <= count; cols++) {
        if (count % cols !== 0) continue
        const rows = count / cols
        const byWidth = (width - (cols - 1) * gap) / cols
        const byHeight = ((height - (rows - 1) * gap) / rows) * (3 / 4)
        const cardWidth = Math.floor(Math.min(byWidth, byHeight))
        if (cardWidth > best.cardWidth) best = { cols, cardWidth, gap }
      }
      setLayout(best)
    }
    compute()
    const observer = new ResizeObserver(compute)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  return [ref, layout] as const
}

// ---------------------------------------------------------------------------
// Game

export function MatchGame<C extends CardData>({
  game,
}: {
  game: GameDefinition<C>
}) {
  const [settings, setSettings] = useState<Settings>(() => ({
    mode: 'solo',
    difficulty: 'medium',
    variant: game.defaultVariant,
    faceUp: game.allowFaceUp && game.defaultFaceUp,
  }))
  const { mode, difficulty, variant, faceUp } = settings
  const [cards, setCards] = useState<Card<C>[]>(() =>
    buildDeck(game, 'medium', game.defaultVariant),
  )
  const [currentPlayer, setCurrentPlayer] = useState(0)
  const [scores, setScores] = useState<[number, number]>([0, 0])
  // Indices of the face-up (or, in face-up mode, selected) unmatched cards.
  const [flipped, setFlipped] = useState<number[]>([])
  const [moves, setMoves] = useState(0)
  const [seconds, setSeconds] = useState(0)
  const [started, setStarted] = useState(false)
  const [best, setBest] = useState<number | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [settingsTab, setSettingsTab] = useState<SettingsTab | null>(null)
  // Timed mode
  const [boardsCleared, setBoardsCleared] = useState(0)
  const [timeUp, setTimeUp] = useState(false)
  const [timedResult, setTimedResult] = useState<TimedResult | null>(null)
  const [leaderboardVersion, setLeaderboardVersion] = useState(0)

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors boardsCleared synchronously so the time-up effect never reads a
  // stale count when the last board and the clock finish in the same commit.
  const boardsClearedRef = useRef(0)

  const totalPairs = DIFFICULTIES[difficulty].pairs
  const [boardRef, layout] = useBoardLayout(totalPairs * 2)

  const timed = mode === 'timed'
  const versus = mode === 'versus'
  const board = boardKey(game.id, settings)
  const boardCleared = cards.length > 0 && cards.every((c) => c.matched)
  const won = boardCleared && !timed
  // Two unmatched cards up means a miss is on screen.
  const locked = flipped.length === 2
  const hasFeedback = Boolean(game.describeMatch || game.describeMiss)

  const newGame = useCallback(
    (s: Settings) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      boardsClearedRef.current = 0
      setSettings(s)
      setCards(buildDeck(game, s.difficulty, s.variant))
      setCurrentPlayer(0)
      setScores([0, 0])
      setFlipped([])
      setMoves(0)
      setSeconds(0)
      setStarted(false)
      setFeedback(null)
      setBoardsCleared(0)
      setTimeUp(false)
      setTimedResult(null)
    },
    [game],
  )

  useEffect(
    () => () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    },
    [],
  )

  // Clock runs from the first tap.
  useEffect(() => {
    if (!started || won || timeUp) return
    const id = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(id)
  }, [started, won, timeUp])

  // Timed mode: cleared board → next board.
  useEffect(() => {
    if (!timed || !boardCleared || timeUp) return
    boardsClearedRef.current += 1
    setBoardsCleared(boardsClearedRef.current)
    const id = setTimeout(() => {
      setCards(buildDeck(game, difficulty, variant))
      setFlipped([])
    }, NEXT_BOARD_DELAY_MS)
    return () => clearTimeout(id)
  }, [timed, boardCleared, timeUp, game, difficulty, variant])

  // Timed mode: out of time → lock the board and check the leaderboard.
  useEffect(() => {
    if (!timed || timeUp || seconds < TIMED_SECONDS) return
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    setFlipped([])
    setTimeUp(true)
    const matches = scores[0]
    const rank = qualifyingRank(board, { matches, moves })
    setTimedResult({
      matches,
      moves,
      boards: boardsClearedRef.current,
      rank,
      status: rank === null ? 'unqualified' : 'qualified',
    })
    vibrate([80, 60, 80])
  }, [timed, timeUp, seconds, scores, moves, board])

  useEffect(() => {
    setBest(loadBest(board))
  }, [board])

  useEffect(() => {
    if (won) vibrate([40, 60, 40, 60, 80])
  }, [won])

  // Record best score (fewest moves) on a classic solo win.
  useEffect(() => {
    if (!won || mode !== 'solo') return
    const prev = loadBest(board)
    if (prev === null || moves < prev) {
      window.localStorage.setItem(bestStorageKey(board), String(moves))
      setBest(moves)
    }
  }, [won, moves, board, mode])

  // biome-ignore lint/correctness/useExhaustiveDependencies: leaderboardVersion signals a storage change
  const timedBest = useMemo(
    () => getLeaderboard(board)[0]?.matches ?? null,
    [board, leaderboardVersion],
  )

  const handleTap = (index: number) => {
    if (locked || won || timeUp) return
    const card = cards[index]
    if (card.matched) return
    if (flipped.includes(index)) {
      // Face-up mode: tapping the selected card again deselects it.
      if (faceUp) setFlipped([])
      return
    }

    if (!started) setStarted(true)

    const next = [...flipped, index]
    setFlipped(next)
    if (next.length < 2) return

    setMoves((m) => m + 1)
    const [a, b] = next.map((i) => cards[i].data)
    if (a.pairId === b.pairId) {
      // Match: the current player scores and keeps their turn.
      vibrate(30)
      const text = game.describeMatch?.(a, b)
      setFeedback(text ? { tone: 'good', text } : null)
      setCards((prev) =>
        prev.map((c, i) =>
          i === next[0] || i === next[1]
            ? { ...c, matched: true, matchedBy: currentPlayer }
            : c,
        ),
      )
      setScores((prev) => {
        const updated: [number, number] = [...prev]
        updated[currentPlayer] += 1
        return updated
      })
      setFlipped([])
    } else {
      // Miss: show why, then hide/deselect and hand over the turn in versus.
      const text = game.describeMiss?.(a, b)
      setFeedback(text ? { tone: 'bad', text } : null)
      timeoutRef.current = setTimeout(() => {
        setFlipped([])
        if (mode === 'versus') setCurrentPlayer((p) => 1 - p)
      }, MISMATCH_DELAY_MS)
    }
  }

  const saveTimedScore = (name: string) => {
    if (!timedResult) return
    const entry = addLeaderboardEntry(board, {
      name,
      matches: timedResult.matches,
      moves: timedResult.moves,
      boards: timedResult.boards,
    })
    setLastPlayerName(name)
    setTimedResult({ ...timedResult, status: 'saved', savedId: entry.id })
    setLeaderboardVersion((v) => v + 1)
  }

  const restart = () => newGame(settings)
  const matchedPairs = cards.filter((c) => c.matched).length / 2
  const remaining = Math.max(0, TIMED_SECONDS - seconds)
  const winner =
    scores[0] === scores[1] ? null : scores[0] > scores[1] ? 0 : 1

  return (
    <div className="flex h-dvh select-none flex-col overflow-hidden bg-gradient-to-b from-indigo-950 via-indigo-900 to-purple-900 pt-[max(env(safe-area-inset-top),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)] pl-[max(env(safe-area-inset-left),0.75rem)] text-white">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              to="/"
              aria-label="All games"
              title="All games"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-xl transition active:bg-white/25 hover:bg-white/20"
            >
              ←
            </Link>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold tracking-tight sm:text-3xl">
                {game.title}
              </h1>
              <p className="truncate text-xs text-indigo-300 sm:text-sm">
                {describeSettings(game, settings)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <IconButton label="New game" onClick={restart}>
              ↻
            </IconButton>
            <IconButton label="Settings" onClick={() => setSettingsTab('game')}>
              ⚙
            </IconButton>
          </div>
        </header>

        {/* Status */}
        {versus && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3" aria-live="polite">
            {PLAYERS.map((player, i) => {
              const active = i === currentPlayer && !won
              return (
                <div
                  key={player.name}
                  className={`flex items-center justify-between rounded-xl border-2 px-3 py-1.5 transition sm:px-4 sm:py-2 ${
                    active
                      ? `${player.panel} shadow-lg`
                      : 'border-transparent bg-white/5 opacity-60'
                  }`}
                >
                  <div className="min-w-0">
                    <div
                      className={`truncate text-sm font-semibold sm:text-base ${player.text}`}
                    >
                      {player.name}
                    </div>
                    <div className="h-4 text-xs text-indigo-100">
                      {active ? 'Your turn' : ''}
                    </div>
                  </div>
                  <div className="text-2xl font-extrabold tabular-nums sm:text-3xl">
                    {scores[i]}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-2 flex justify-center gap-2 text-center text-xs sm:mt-3 sm:gap-3 sm:text-sm">
          {timed ? (
            <>
              <Stat
                label="Time left"
                value={formatTime(remaining)}
                valueClass={
                  remaining <= 10
                    ? 'text-red-400 animate-pulse'
                    : remaining <= 30
                      ? 'text-amber-300'
                      : ''
                }
              />
              <Stat label="Matches" value={scores[0]} />
              <Stat label="Board" value={boardsCleared + 1} />
              <Stat label="Top" value={timedBest ?? '—'} />
            </>
          ) : (
            <>
              <Stat label="Moves" value={moves} />
              <Stat label="Time" value={formatTime(seconds)} />
              <Stat label="Pairs" value={`${matchedPairs}/${totalPairs}`} />
              {!versus && <Stat label="Best" value={best ?? '—'} />}
            </>
          )}
        </div>

        {/* Fixed heights so the board never resizes as these lines change. */}
        {timed && (
          <p className="mt-2 h-5 text-center text-sm text-indigo-200">
            {!started
              ? `Tap a card to start the ${TIMED_MINUTES}-minute clock.`
              : ''}
          </p>
        )}
        {hasFeedback && (
          <p
            aria-live="polite"
            className={`mt-2 h-6 truncate text-center text-base font-bold sm:text-lg ${
              feedback?.tone === 'good' ? 'text-lime-300' : 'text-rose-300'
            }`}
          >
            {feedback?.text ?? ''}
          </p>
        )}

        {/* Board: always mounted so it can be measured. */}
        <div
          ref={boardRef}
          className="mt-2 flex min-h-0 flex-1 items-center justify-center"
        >
          {layout.cardWidth > 0 && (
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, ${layout.cardWidth}px)`,
                gap: layout.gap,
              }}
            >
              {cards.map((card, i) => {
                const selected = flipped.includes(i)
                return (
                  <CardView
                    key={card.key}
                    game={game}
                    card={card}
                    faceUpMode={faceUp}
                    revealed={faceUp || card.matched || selected}
                    selected={selected}
                    wrong={selected && locked}
                    matchRing={
                      versus && card.matchedBy !== null
                        ? PLAYERS[card.matchedBy].ring
                        : 'ring-lime-300'
                    }
                    onClick={() => handleTap(i)}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {settingsTab && (
        <SettingsSheet
          game={game}
          initial={settings}
          initialTab={settingsTab}
          onClose={() => setSettingsTab(null)}
          onStart={(s) => {
            setSettingsTab(null)
            newGame(s)
          }}
          onLeaderboardsReset={() => setLeaderboardVersion((v) => v + 1)}
        />
      )}

      {timedResult && (
        <TimedResultsModal
          result={timedResult}
          boardLabel={describeSettings(game, settings).replace(/^[^·]+· /, '')}
          entries={getLeaderboard(board)}
          onSave={saveTimedScore}
          onDecline={() => setTimedResult({ ...timedResult, status: 'declined' })}
          onPlayAgain={restart}
          onSettings={() => setSettingsTab('game')}
        />
      )}

      {won && (
        <ModalShell>
          {versus ? (
            <>
              <div className="text-5xl">{winner === null ? '🤝' : '🏆'}</div>
              <h2 className="mt-2 text-2xl font-bold">
                {winner === null
                  ? "It's a tie!"
                  : `${PLAYERS[winner].name} wins!`}
              </h2>
              <p className="mt-2 text-indigo-700">
                {scores[0]} – {scores[1]} · {moves} moves in{' '}
                {formatTime(seconds)}
              </p>
            </>
          ) : (
            <>
              <div className="text-5xl">🎉</div>
              <h2 className="mt-2 text-2xl font-bold">You matched them all!</h2>
              <p className="mt-2 text-indigo-700">
                {moves} moves in {formatTime(seconds)}
                {best === moves && (
                  <span className="block font-semibold">New best!</span>
                )}
              </p>
            </>
          )}
          <ModalActions
            onPlayAgain={restart}
            onSettings={() => setSettingsTab('game')}
          />
        </ModalShell>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cards

function CardView<C extends CardData>({
  game,
  card,
  faceUpMode,
  revealed,
  selected,
  wrong,
  matchRing,
  onClick,
}: {
  game: GameDefinition<C>
  card: Card<C>
  faceUpMode: boolean
  revealed: boolean
  selected: boolean
  wrong: boolean
  matchRing: string
  onClick: () => void
}) {
  const { data, matched } = card
  const ring = wrong
    ? 'ring-4 ring-red-500'
    : matched
      ? `ring-4 ${matchRing}`
      : selected && faceUpMode
        ? 'ring-4 ring-white'
        : ''
  return (
    <button
      type="button"
      onClick={onClick}
      // Face-down: a revealed card can't be tapped. Face-up: selected cards
      // stay tappable so they can be deselected.
      disabled={matched || (!faceUpMode && revealed)}
      aria-pressed={faceUpMode ? selected : undefined}
      aria-label={
        revealed ? `${data.label}${matched ? ', matched' : ''}` : 'Hidden card'
      }
      className={`card-scene @container aspect-[3/4] w-full rounded-[8cqw] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-yellow-300 ${
        wrong ? 'card-shake' : ''
      } ${selected && faceUpMode && !wrong ? '-translate-y-[4%]' : ''} ${
        matched && faceUpMode ? 'opacity-40' : ''
      }`}
    >
      <div
        className={`card-inner ${revealed ? 'is-flipped' : ''} ${
          faceUpMode ? 'no-flip-anim' : ''
        }`}
      >
        {/* Back */}
        <div
          className={`card-face flex items-center justify-center rounded-[8cqw] border-2 border-white/20 bg-gradient-to-br shadow-lg transition active:brightness-90 hover:brightness-110 ${game.backClass}`}
        >
          <div className="flex aspect-square w-2/5 items-center justify-center rounded-full border-[3px] border-white/80 bg-white/20 text-[18cqw] font-black text-white/90">
            ?
          </div>
        </div>
        {/* Front */}
        <div
          className={`card-face card-front flex flex-col items-center justify-center overflow-hidden rounded-[8cqw] bg-gradient-to-br p-[6cqw] shadow-lg ${game.faceClass(
            data,
          )} ${ring}`}
        >
          {game.renderFace(data)}
        </div>
      </div>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Modals

function ModalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-6 text-center text-indigo-950 shadow-2xl">
        {children}
      </div>
    </div>
  )
}

function ModalActions({
  onPlayAgain,
  onSettings,
}: {
  onPlayAgain: () => void
  onSettings: () => void
}) {
  return (
    <>
      <button
        type="button"
        onClick={onPlayAgain}
        className="mt-5 min-h-12 w-full rounded-xl bg-indigo-600 font-semibold text-white transition active:bg-indigo-700 hover:bg-indigo-500"
      >
        Play again
      </button>
      <button
        type="button"
        onClick={onSettings}
        className="mt-2 min-h-11 w-full rounded-xl font-semibold text-indigo-700 active:bg-indigo-50"
      >
        Change settings
      </button>
    </>
  )
}

function TimedResultsModal({
  result,
  boardLabel,
  entries,
  onSave,
  onDecline,
  onPlayAgain,
  onSettings,
}: {
  result: TimedResult
  boardLabel: string
  entries: LeaderboardEntry[]
  onSave: (name: string) => void
  onDecline: () => void
  onPlayAgain: () => void
  onSettings: () => void
}) {
  const [name, setName] = useState(getLastPlayerName)
  const trimmed = name.trim()
  const accuracy =
    result.moves > 0 ? Math.round((result.matches / result.moves) * 100) : 0

  return (
    <ModalShell>
      <div className="text-5xl">⏱️</div>
      <h2 className="mt-2 text-2xl font-bold">Time's up!</h2>
      <p className="mt-1 text-5xl font-extrabold tabular-nums text-indigo-600">
        {result.matches}
      </p>
      <p className="text-sm font-semibold text-indigo-700">
        {result.matches === 1 ? 'match' : 'matches'}
      </p>
      <p className="mt-2 text-sm text-indigo-700">
        {result.boards} {result.boards === 1 ? 'board' : 'boards'} cleared ·{' '}
        {result.moves} moves · {accuracy}% accuracy
      </p>

      {result.status === 'qualified' && result.rank !== null && (
        <form
          className="mt-5 rounded-xl bg-yellow-100 p-4 text-left"
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onSave(trimmed)
          }}
        >
          <p className="text-center font-bold text-indigo-950">
            🏆 You made the leaderboard — #{result.rank + 1}!
          </p>
          <label
            htmlFor="leaderboard-name"
            className="mt-3 block text-xs font-semibold uppercase tracking-wide text-indigo-700"
          >
            Name for the leaderboard
          </label>
          {/* text-base (16px) prevents iOS from zooming on focus. */}
          <input
            id="leaderboard-name"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, MAX_NAME_LENGTH))}
            maxLength={MAX_NAME_LENGTH}
            autoComplete="nickname"
            enterKeyHint="done"
            placeholder="Your name"
            className="mt-1 min-h-11 w-full select-text rounded-lg border border-indigo-200 bg-white px-3 text-base text-indigo-950 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-300"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={onDecline}
              className="min-h-11 flex-1 rounded-lg font-semibold text-indigo-700 active:bg-yellow-200"
            >
              No thanks
            </button>
            <button
              type="submit"
              disabled={!trimmed}
              className="min-h-11 flex-1 rounded-lg bg-indigo-600 font-semibold text-white transition active:bg-indigo-700 disabled:opacity-40"
            >
              Save score
            </button>
          </div>
        </form>
      )}

      {result.status === 'declined' && (
        <p className="mt-4 text-sm text-indigo-700">
          Score not saved to the leaderboard.
        </p>
      )}

      {result.status !== 'qualified' && (
        <div className="mt-5 text-left">
          <h3 className="mb-2 text-center text-sm font-semibold text-indigo-700">
            Leaderboard · {boardLabel}
          </h3>
          <LeaderboardList
            entries={entries}
            highlightId={result.savedId}
            theme="light"
          />
        </div>
      )}

      <ModalActions onPlayAgain={onPlayAgain} onSettings={onSettings} />
    </ModalShell>
  )
}

function LeaderboardList({
  entries,
  highlightId,
  theme,
}: {
  entries: LeaderboardEntry[]
  highlightId?: string
  theme: 'light' | 'dark'
}) {
  const light = theme === 'light'
  if (entries.length === 0) {
    return (
      <p
        className={`rounded-xl p-4 text-center text-sm ${
          light ? 'bg-indigo-50 text-indigo-700' : 'bg-white/5 text-indigo-200'
        }`}
      >
        No scores yet. Play a timed game to set one!
      </p>
    )
  }
  return (
    <ol
      className={`overflow-hidden rounded-xl text-sm ${light ? 'bg-indigo-50' : 'bg-white/5'}`}
    >
      {entries.map((e, i) => {
        const highlighted = e.id === highlightId
        return (
          <li
            key={e.id}
            className={`flex items-center gap-3 px-3 py-2 ${
              highlighted
                ? 'bg-yellow-300 font-semibold text-indigo-950'
                : i % 2 === 1
                  ? light
                    ? 'bg-indigo-100/60'
                    : 'bg-white/5'
                  : ''
            }`}
          >
            <span className="w-6 text-right font-bold tabular-nums">
              {i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate">{e.name}</span>
            <span className="font-bold tabular-nums">{e.matches}</span>
            <span
              className={`w-14 text-right text-xs ${
                highlighted ? '' : light ? 'text-indigo-500' : 'text-indigo-300'
              }`}
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

// ---------------------------------------------------------------------------
// Settings

function SettingsSheet<C extends CardData>({
  game,
  initial,
  initialTab,
  onClose,
  onStart,
  onLeaderboardsReset,
}: {
  game: GameDefinition<C>
  initial: Settings
  initialTab: SettingsTab
  onClose: () => void
  onStart: (s: Settings) => void
  onLeaderboardsReset: () => void
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab)
  const [draft, setDraft] = useState(initial)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const solo = draft.mode !== 'versus'
  const hint = game.difficultyHint?.(draft.difficulty, draft.variant)

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-indigo-950 p-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] text-white shadow-2xl sm:rounded-3xl sm:pb-5"
      >
        <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-white/20 sm:hidden" />

        <div className="mb-5">
          <Segmented
            label="Settings section"
            hideLabel
            value={tab}
            options={[
              { value: 'game', label: 'New game' },
              { value: 'leaderboards', label: 'Leaderboards' },
              { value: 'app', label: 'App' },
            ]}
            onChange={setTab}
          />
        </div>

        {tab === 'game' ? (
          <>
            {game.variants.length > 1 && (
              <Segmented
                label={game.variantHeading ?? 'Variant'}
                value={draft.variant}
                options={game.variants}
                onChange={(v) => setDraft((d) => ({ ...d, variant: v }))}
              />
            )}
            <Segmented
              label="Players"
              value={solo ? 'solo' : 'versus'}
              options={[
                { value: 'solo', label: 'Solo' },
                { value: 'versus', label: '2 Players' },
              ]}
              onChange={(players) =>
                setDraft((d) => ({
                  ...d,
                  // Timed is solo-only; switching to 2 players drops it.
                  mode: players === 'versus' ? 'versus' : 'solo',
                }))
              }
            />
            {solo && (
              <Segmented
                label="Game type"
                value={draft.mode}
                options={[
                  { value: 'solo', label: 'Classic' },
                  { value: 'timed', label: `Timed · ${TIMED_MINUTES} min` },
                ]}
                onChange={(mode) => setDraft((d) => ({ ...d, mode }))}
              />
            )}
            {draft.mode === 'timed' && (
              <p className="-mt-2 mb-4 text-xs text-indigo-300">
                Clear as many boards as you can in {TIMED_MINUTES} minutes.
                Your total matches go on the leaderboard.
              </p>
            )}
            {game.allowFaceUp && (
              <>
                <Segmented
                  label="Cards"
                  value={draft.faceUp ? 'up' : 'down'}
                  options={[
                    { value: 'up', label: 'Face up' },
                    { value: 'down', label: 'Face down' },
                  ]}
                  onChange={(v) => setDraft((d) => ({ ...d, faceUp: v === 'up' }))}
                />
                <p className="-mt-2 mb-4 text-xs text-indigo-300">
                  {draft.faceUp
                    ? 'All cards are showing. Tap two that go together.'
                    : 'Memory mode: flip two cards at a time and remember where things are.'}
                </p>
              </>
            )}
            <Segmented
              label="Difficulty"
              value={draft.difficulty}
              options={DIFFICULTY_ORDER.map((d) => ({
                value: d,
                label: `${capitalize(d)} · ${DIFFICULTIES[d].pairs * 2}`,
              }))}
              onChange={(difficulty) => setDraft((d) => ({ ...d, difficulty }))}
            />
            {hint && <p className="-mt-2 mb-4 text-xs text-indigo-300">{hint}</p>}

            <button
              type="button"
              onClick={() => onStart(draft)}
              className="mt-2 min-h-12 w-full rounded-xl bg-yellow-400 font-bold text-indigo-950 transition active:bg-yellow-500"
            >
              Start new game
            </button>
          </>
        ) : tab === 'leaderboards' ? (
          <LeaderboardsPanel
            game={game}
            initial={initial}
            onReset={onLeaderboardsReset}
          />
        ) : (
          <AppPanel />
        )}
      </div>
    </div>
  )
}

function LeaderboardsPanel<C extends CardData>({
  game,
  initial,
  onReset,
}: {
  game: GameDefinition<C>
  initial: Settings
  onReset: () => void
}) {
  const [view, setView] = useState({
    variant: initial.variant,
    difficulty: initial.difficulty,
    faceUp: initial.faceUp,
  })
  const [confirming, setConfirming] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  // Bumped after a reset so the lists re-read storage.
  const [, setVersion] = useState(0)

  const entries = getLeaderboard(boardKey(game.id, view))
  const anyScores = hasAnyLeaderboardEntries(game.id)

  return (
    <>
      <p className="mb-4 text-xs text-indigo-300">
        Top {LEADERBOARD_SIZE} timed solo scores for {game.title}, saved on this
        device.
      </p>
      {game.variants.length > 1 && (
        <Segmented
          label={game.variantHeading ?? 'Variant'}
          value={view.variant}
          options={game.variants}
          onChange={(variant) => setView((v) => ({ ...v, variant }))}
        />
      )}
      <Segmented
        label="Difficulty"
        value={view.difficulty}
        options={DIFFICULTY_ORDER.map((d) => ({ value: d, label: capitalize(d) }))}
        onChange={(difficulty) => setView((v) => ({ ...v, difficulty }))}
      />
      {game.allowFaceUp && (
        <Segmented
          label="Cards"
          value={view.faceUp ? 'up' : 'down'}
          options={[
            { value: 'up', label: 'Face up' },
            { value: 'down', label: 'Face down' },
          ]}
          onChange={(c) => setView((v) => ({ ...v, faceUp: c === 'up' }))}
        />
      )}

      <LeaderboardList entries={entries} theme="dark" />

      <div className="mt-6 border-t border-white/10 pt-4">
        {confirming ? (
          <div
            role="alertdialog"
            aria-labelledby="reset-title"
            aria-describedby="reset-desc"
            className="rounded-xl border border-red-400/50 bg-red-500/15 p-4"
          >
            <p id="reset-title" className="font-semibold">
              Reset all {game.title} leaderboards?
            </p>
            <p id="reset-desc" className="mt-1 text-sm text-red-100">
              This permanently deletes every saved timed score for this game,
              across all settings. It can't be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                // biome-ignore lint/a11y/noAutofocus: focus the safe choice in a destructive confirmation
                autoFocus
                onClick={() => setConfirming(false)}
                className="min-h-11 flex-1 rounded-lg bg-white/10 font-semibold active:bg-white/20"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetLeaderboards(game.id)
                  setConfirming(false)
                  setResetDone(true)
                  setVersion((v) => v + 1)
                  onReset()
                }}
                className="min-h-11 flex-1 rounded-lg bg-red-600 font-semibold active:bg-red-700"
              >
                Yes, reset
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!anyScores}
              onClick={() => {
                setResetDone(false)
                setConfirming(true)
              }}
              className="min-h-11 w-full rounded-xl border border-red-400/60 font-semibold text-red-300 transition active:bg-red-500/20 disabled:opacity-40"
            >
              Reset leaderboards
            </button>
            {resetDone && (
              <p className="mt-2 text-center text-sm text-indigo-200" role="status">
                Leaderboards reset.
              </p>
            )}
          </>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Small controls

function Segmented<T extends string>({
  label,
  hideLabel = false,
  value,
  options,
  onChange,
}: {
  label: string
  hideLabel?: boolean
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <fieldset className={hideLabel ? '' : 'mb-4'}>
      <legend
        className={
          hideLabel
            ? 'sr-only'
            : 'mb-1.5 text-xs font-semibold uppercase tracking-wide text-indigo-300'
        }
      >
        {label}
      </legend>
      <div className="flex gap-1 rounded-xl bg-white/10 p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
            className={`min-h-11 flex-1 rounded-lg px-1.5 text-sm font-semibold transition ${
              o.value === value
                ? 'bg-yellow-400 text-indigo-950'
                : 'text-white active:bg-white/10'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-xl transition active:bg-white/25 hover:bg-white/20"
    >
      {children}
    </button>
  )
}

function Stat({
  label,
  value,
  valueClass = '',
}: {
  label: string
  value: string | number
  valueClass?: string
}) {
  return (
    <div className="min-w-16 rounded-lg bg-white/10 px-2.5 py-1 sm:min-w-20 sm:px-3 sm:py-1.5">
      <div className="whitespace-nowrap text-[10px] uppercase tracking-wide text-indigo-200 sm:text-xs">
        {label}
      </div>
      <div className={`font-bold tabular-nums sm:text-lg ${valueClass}`}>
        {value}
      </div>
    </div>
  )
}
