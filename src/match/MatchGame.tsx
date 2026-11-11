// The game screen. Rules live in engine.ts; this file wires them to React:
// it turns taps and timers into reducer actions and renders the state.

import { Link } from '@tanstack/react-router'
import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react'
import { recordBestScore, useBestScore } from './bestScores'
import { Block } from './blocks'
import { CardView } from './CardView'
import { IconButton, matButton, primaryColors, Stat } from './controls'
import {
  describeBoard,
  describeSettings,
  formatTime,
  PLAYERS,
  SOLO_BLOCK,
} from './display'
import {
  boardKey,
  buildDeck,
  createGameReducer,
  defaultSettings,
  initialState,
  isClockRunning,
  isMissPending,
  MISMATCH_DELAY_MS,
  NEXT_BOARD_DELAY_MS,
  type Settings,
  TIMED_MINUTES,
  TIMED_SECONDS,
} from './engine'
import { useLeaderboard } from './leaderboard'
import { NewGameSheet } from './NewGameSheet'
import { TimedResultsModal, WinModal } from './ResultModals'
import { type CardData, DIFFICULTIES, type GameDefinition } from './types'
import { useBoardLayout } from './useBoardLayout'

function vibrate(pattern: number | number[]) {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(pattern)
  }
}

export function MatchGame<C extends CardData>({
  game,
}: {
  game: GameDefinition<C>
}) {
  const reducer = useMemo(() => createGameReducer(game), [game])
  const [state, dispatch] = useReducer(reducer, game, (g) => {
    const s = defaultSettings(g)
    return initialState(s, buildDeck(g, s.difficulty, s.variant))
  })
  const { settings, cards, flipped, currentPlayer, scores, moves, seconds } =
    state
  const { mode, difficulty, variant, faceUp } = settings
  const [choosingGame, setChoosingGame] = useState(false)
  // Set when the finished game beat (not just tied) the stored best.
  const [newBest, setNewBest] = useState(false)

  const totalPairs = DIFFICULTIES[difficulty].pairs
  const [boardRef, layout] = useBoardLayout(totalPairs * 2)

  const timed = mode === 'timed'
  const versus = mode === 'versus'
  const { phase } = state
  const board = boardKey(game.id, settings)
  const missPending = isMissPending(state)
  const clockRunning = isClockRunning(state)
  const hasFeedback = Boolean(game.describeMatch || game.describeMiss)
  const best = useBestScore(board)
  const timedBest = useLeaderboard(board)[0]?.matches ?? null

  const newGame = useCallback(
    (s: Settings) => {
      setNewBest(false)
      dispatch({
        type: 'newGame',
        settings: s,
        cards: buildDeck(game, s.difficulty, s.variant),
      })
    },
    [game],
  )

  // --- Timers: each one is just a delayed action. -------------------------

  // A miss stays on screen briefly, then flips back (and passes the turn).
  useEffect(() => {
    if (!missPending) return
    const id = setTimeout(
      () => dispatch({ type: 'resolveMiss' }),
      MISMATCH_DELAY_MS,
    )
    return () => clearTimeout(id)
  }, [missPending])

  // The clock runs from the first tap until the game ends.
  useEffect(() => {
    if (!clockRunning) return
    const id = setInterval(() => dispatch({ type: 'tick' }), 1000)
    return () => clearInterval(id)
  }, [clockRunning])

  // Timed mode: cleared board → deal the next one.
  useEffect(() => {
    if (phase !== 'clearing') return
    const id = setTimeout(
      () =>
        dispatch({
          type: 'nextBoard',
          cards: buildDeck(game, difficulty, variant),
        }),
      NEXT_BOARD_DELAY_MS,
    )
    return () => clearTimeout(id)
  }, [phase, game, difficulty, variant])

  // --- Side effects of state changes. -------------------------------------

  const totalMatches = scores[0] + scores[1]
  const lastTotalMatches = useRef(totalMatches)
  useEffect(() => {
    if (totalMatches > lastTotalMatches.current) vibrate(30)
    lastTotalMatches.current = totalMatches
  }, [totalMatches])

  useEffect(() => {
    if (phase === 'won') vibrate([40, 60, 40, 60, 80])
    if (phase === 'timeUp') vibrate([80, 60, 80])
  }, [phase])

  // Record best score (fewest moves) on a classic solo win.
  useEffect(() => {
    if (phase === 'won' && mode === 'solo') {
      setNewBest(recordBestScore(board, moves))
    }
  }, [phase, mode, board, moves])

  const restart = () => newGame(settings)
  const chooseNewGame = () => setChoosingGame(true)
  const matchedPairs = cards.filter((c) => c.matched).length / 2
  const remaining = Math.max(0, TIMED_SECONDS - seconds)

  return (
    <div className="mat flex h-dvh select-none flex-col overflow-hidden p-[calc(env(safe-area-inset-top)+1.5rem)_max(env(safe-area-inset-right),1.25rem)_max(env(safe-area-inset-bottom),1.5rem)_max(env(safe-area-inset-left),1.25rem)] text-paper">
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col">
        <header className="flex items-center justify-between gap-1.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              to="/"
              aria-label="All games"
              title="All games"
              className={`${matButton} shrink-0 text-xl`}
            >
              ←
            </Link>
            <h1 className="min-w-0 truncate text-xl font-bold min-[400px]:text-2xl sm:text-3xl">
              {game.title}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <IconButton label="Start over" onClick={restart}>
              ↻
            </IconButton>
            <button
              type="button"
              onClick={chooseNewGame}
              className={`${primaryColors} min-h-11 rounded-full px-3.5`}
            >
              New game
            </button>
          </div>
        </header>

        {/* Lines up under the title. Fixed heights keep the board still. */}
        <div className="sm:pl-13">
          <p className="mt-1 truncate text-mat-text">
            {describeSettings(game, settings)}
          </p>

          {versus && (
            <div className="mt-3 grid grid-cols-2 gap-2" aria-live="polite">
              {PLAYERS.map((player, i) => {
                const active = i === currentPlayer && phase !== 'won'
                return (
                  <div
                    key={player.name}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-1.5 transition ${
                      active
                        ? 'block-edge bg-paper text-ink'
                        : 'bg-black/15 text-paper/75'
                    }`}
                  >
                    <Block shape={player.block} className="w-6" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{player.name}</div>
                      <div className="h-5 text-sm">
                        {active ? 'Your turn' : ''}
                      </div>
                    </div>
                    <div className="text-3xl font-bold tabular-nums">
                      {scores[i]}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1">
            {timed ? (
              <>
                <Stat
                  label="Time left"
                  value={formatTime(remaining)}
                  // Padding is always there so the badge never shifts the board.
                  valueClass={`rounded-md px-1.5 ${
                    remaining <= 10
                      ? 'bg-trapezoid motion-safe:animate-pulse'
                      : remaining <= 30
                        ? 'text-hex'
                        : ''
                  }`}
                />
                <Stat label="Matches" value={scores[0]} />
                <Stat label="Board" value={state.boardsCleared + 1} />
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

          {timed && (
            <p className="mt-1 h-6 text-mat-text">
              {!state.started
                ? `Tap a card to start the ${TIMED_MINUTES}-minute clock.`
                : ''}
            </p>
          )}
          {hasFeedback && (
            <p aria-live="polite" className="mt-2 flex h-8 items-center">
              {state.feedback && (
                <span className="inline-flex max-w-full items-center gap-2 rounded-full bg-paper py-1 pr-3.5 pl-2.5 font-bold text-ink">
                  <Block
                    shape={
                      state.feedback.tone === 'bad'
                        ? 'trapezoid'
                        : versus
                          ? PLAYERS[currentPlayer].block
                          : SOLO_BLOCK
                    }
                    className="w-4"
                  />
                  <span className="truncate">{state.feedback.text}</span>
                </span>
              )}
            </p>
          )}
        </div>

        {/* Board: always mounted so it can be measured. */}
        <div
          ref={boardRef}
          className="mt-3 flex min-h-0 flex-1 items-center justify-center"
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
                    wrong={selected && missPending}
                    matchBlock={
                      versus && card.matchedBy !== null
                        ? PLAYERS[card.matchedBy].block
                        : SOLO_BLOCK
                    }
                    onClick={() => dispatch({ type: 'tap', index: i })}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>

      {choosingGame && (
        <NewGameSheet
          game={game}
          initial={settings}
          onClose={() => setChoosingGame(false)}
          onStart={(s) => {
            setChoosingGame(false)
            newGame(s)
          }}
        />
      )}

      {phase === 'timeUp' && (
        <TimedResultsModal
          board={board}
          boardLabel={describeBoard(game, settings)}
          matches={scores[0]}
          moves={moves}
          boards={state.boardsCleared}
          onPlayAgain={restart}
          onNewGame={chooseNewGame}
        />
      )}

      {phase === 'won' && (
        <WinModal
          versus={versus}
          scores={scores}
          moves={moves}
          seconds={seconds}
          newBest={newBest}
          onPlayAgain={restart}
          onNewGame={chooseNewGame}
        />
      )}
    </div>
  )
}
