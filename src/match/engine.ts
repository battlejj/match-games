// The game rules, as a pure reducer: (state, action) → next state.
//
// Everything that happens in a game is one of these actions:
//   newGame     start over with new settings and a freshly dealt deck
//   tap         the player taps a card
//   resolveMiss the pause after a wrong pair is over
//   tick        one second of play time has passed
//   nextBoard   timed mode: deal the next board after one is cleared
//
// Timers and randomness live in the React layer (MatchGame.tsx), which turns
// them into actions; this file has no side effects, so every rule can be
// unit-tested directly.

import {
  type CardData,
  DIFFICULTIES,
  type Difficulty,
  type GameDefinition,
} from './types'

export type Mode = 'solo' | 'timed' | 'versus'

export interface Settings {
  mode: Mode
  difficulty: Difficulty
  variant: string
  faceUp: boolean
}

export interface Card<C> {
  key: string
  data: C
  matched: boolean
  /** Which player found this pair (always 0 outside versus mode). */
  matchedBy: number | null
}

export interface Feedback {
  tone: 'good' | 'bad'
  text: string
}

/**
 * playing   cards can be tapped
 * clearing  timed mode: board cleared, next one about to be dealt
 * won       classic / versus: every pair found
 * timeUp    timed mode: the clock ran out
 */
export type Phase = 'playing' | 'clearing' | 'won' | 'timeUp'

export interface GameState<C> {
  settings: Settings
  cards: Card<C>[]
  /** Indices of face-up (or, in face-up mode, selected) unmatched cards. */
  flipped: number[]
  currentPlayer: number
  scores: [number, number]
  moves: number
  seconds: number
  /** The clock starts on the first tap. */
  started: boolean
  feedback: Feedback | null
  boardsCleared: number
  phase: Phase
}

export type GameAction<C> =
  | { type: 'newGame'; settings: Settings; cards: Card<C>[] }
  | { type: 'tap'; index: number }
  | { type: 'resolveMiss' }
  | { type: 'tick' }
  | { type: 'nextBoard'; cards: Card<C>[] }

export const TIMED_MINUTES = 2
export const TIMED_SECONDS = TIMED_MINUTES * 60
export const MISMATCH_DELAY_MS = 1100
/** Pause after clearing a timed board so the last match registers visually. */
export const NEXT_BOARD_DELAY_MS = 500

/** Two unmatched cards up means a miss is on screen, waiting to resolve. */
export const isMissPending = (state: GameState<unknown>) =>
  state.flipped.length === 2

/** Whether the game clock is running. */
export const isClockRunning = (state: GameState<unknown>) =>
  state.started && (state.phase === 'playing' || state.phase === 'clearing')

/** The parts of a game definition that settings depend on. */
export type GameOptions = Pick<
  GameDefinition<CardData>,
  | 'id'
  | 'title'
  | 'variants'
  | 'variantHeading'
  | 'defaultVariant'
  | 'allowFaceUp'
  | 'defaultFaceUp'
>

/** What a game starts with: practice, medium, the game's default variant. */
export function defaultSettings(game: GameOptions): Settings {
  return {
    mode: 'solo',
    difficulty: 'medium',
    variant: game.defaultVariant,
    faceUp: game.allowFaceUp && game.defaultFaceUp,
  }
}

export function initialState<C>(
  settings: Settings,
  cards: Card<C>[],
): GameState<C> {
  return {
    settings,
    cards,
    flipped: [],
    currentPlayer: 0,
    scores: [0, 0],
    moves: 0,
    seconds: 0,
    started: false,
    feedback: null,
    boardsCleared: 0,
    phase: 'playing',
  }
}

type Describers<C extends CardData> = Pick<
  GameDefinition<C>,
  'describeMatch' | 'describeMiss'
>

function tap<C extends CardData>(
  state: GameState<C>,
  index: number,
  game: Describers<C>,
): GameState<C> {
  if (state.phase !== 'playing' || isMissPending(state)) return state
  const card = state.cards[index]
  if (!card || card.matched) return state
  if (state.flipped.includes(index)) {
    // Face-up mode: tapping the selected card again deselects it.
    return state.settings.faceUp ? { ...state, flipped: [] } : state
  }

  const flipped = [...state.flipped, index]
  if (flipped.length < 2) return { ...state, flipped, started: true }

  const moves = state.moves + 1
  const [a, b] = flipped.map((i) => state.cards[i].data)
  if (a.pairId !== b.pairId) {
    // Miss: stays on screen until resolveMiss.
    const text = game.describeMiss?.(a, b)
    return {
      ...state,
      flipped,
      moves,
      started: true,
      feedback: text ? { tone: 'bad', text } : null,
    }
  }

  // Match: the current player scores and keeps their turn.
  const cards = state.cards.map((c, i) =>
    flipped.includes(i)
      ? { ...c, matched: true, matchedBy: state.currentPlayer }
      : c,
  )
  const scores: [number, number] = [...state.scores]
  scores[state.currentPlayer] += 1
  const cleared = cards.every((c) => c.matched)
  const timed = state.settings.mode === 'timed'
  const text = game.describeMatch?.(a, b)
  return {
    ...state,
    cards,
    flipped: [],
    moves,
    scores,
    started: true,
    feedback: text ? { tone: 'good', text } : null,
    boardsCleared: state.boardsCleared + (cleared && timed ? 1 : 0),
    phase: cleared ? (timed ? 'clearing' : 'won') : 'playing',
  }
}

export function createGameReducer<C extends CardData>(game: Describers<C>) {
  return function gameReducer(
    state: GameState<C>,
    action: GameAction<C>,
  ): GameState<C> {
    switch (action.type) {
      case 'newGame':
        return initialState(action.settings, action.cards)

      case 'tap':
        return tap(state, action.index, game)

      case 'resolveMiss':
        if (!isMissPending(state)) return state
        return {
          ...state,
          flipped: [],
          // In versus mode a miss hands the turn to the other player.
          currentPlayer:
            state.settings.mode === 'versus'
              ? 1 - state.currentPlayer
              : state.currentPlayer,
        }

      case 'tick': {
        if (!isClockRunning(state)) return state
        const seconds = state.seconds + 1
        if (state.settings.mode === 'timed' && seconds >= TIMED_SECONDS) {
          // Out of time: lock the board, dropping any miss on screen.
          return { ...state, seconds, flipped: [], phase: 'timeUp' }
        }
        return { ...state, seconds }
      }

      case 'nextBoard':
        if (state.phase !== 'clearing') return state
        return { ...state, cards: action.cards, flipped: [], phase: 'playing' }
    }
  }
}

// ---------------------------------------------------------------------------
// Dealing (uses randomness, so it stays outside the reducer)

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

export function buildDeck<C extends CardData>(
  game: GameDefinition<C>,
  difficulty: Difficulty,
  variant: string,
): Card<C>[] {
  const deal = ++dealCounter
  const pairs = game.buildPairs(difficulty, variant)
  if (pairs.length !== DIFFICULTIES[difficulty].pairs) {
    throw new Error(
      `${game.id} dealt ${pairs.length} pairs for ${difficulty}; expected ${DIFFICULTIES[difficulty].pairs}`,
    )
  }
  return shuffle(pairs.flat()).map((data, i) => ({
    key: `${deal}-${i}`,
    data,
    matched: false,
    matchedBy: null,
  }))
}

/** Identifies one leaderboard / best-score slot. */
export function boardKey(gameId: string, s: Omit<Settings, 'mode'>) {
  return `${gameId}:${s.variant}:${s.difficulty}:${s.faceUp ? 'up' : 'down'}`
}
