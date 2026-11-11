import { describe, expect, it } from 'vitest'
import { mathGame } from '../games/math'
import {
  buildDeck,
  type Card,
  createGameReducer,
  type GameAction,
  type GameState,
  initialState,
  isClockRunning,
  isMissPending,
  type Settings,
  TIMED_SECONDS,
} from './engine'
import type { CardData, GameDefinition } from './types'

interface TestCard extends CardData {
  label: string
}

// A tiny deterministic board: pairs A, B laid out as A B A B.
function deck(pairIds = ['A', 'B', 'A', 'B']): Card<TestCard>[] {
  return pairIds.map((pairId, i) => ({
    key: `k${i}`,
    data: { pairId, label: pairId },
    matched: false,
    matchedBy: null,
  }))
}

const reducer = createGameReducer<TestCard>({
  describeMatch: (a) => `matched ${a.label}`,
  describeMiss: (a, b) => `${a.label} ≠ ${b.label}`,
})

const settings = (over: Partial<Settings> = {}): Settings => ({
  mode: 'solo',
  difficulty: 'easy',
  variant: 'x',
  faceUp: false,
  ...over,
})

function run(
  state: GameState<TestCard>,
  ...actions: GameAction<TestCard>[]
): GameState<TestCard> {
  return actions.reduce(reducer, state)
}

const tap = (index: number): GameAction<TestCard> => ({ type: 'tap', index })
const start = (over: Partial<Settings> = {}, cards = deck()) =>
  initialState(settings(over), cards)

describe('tapping', () => {
  it('a first tap flips one card and starts the clock', () => {
    const s = run(start(), tap(0))
    expect(s.flipped).toEqual([0])
    expect(s.started).toBe(true)
    expect(s.moves).toBe(0)
    expect(isClockRunning(s)).toBe(true)
  })

  it('a matching pair scores, keeps the turn, and counts a move', () => {
    const s = run(start(), tap(0), tap(2))
    expect(s.cards.map((c) => c.matched)).toEqual([true, false, true, false])
    expect(s.cards[0].matchedBy).toBe(0)
    expect(s.flipped).toEqual([])
    expect(s.scores).toEqual([1, 0])
    expect(s.moves).toBe(1)
    expect(s.feedback).toEqual({ tone: 'good', text: 'matched A' })
  })

  it('a miss stays up until resolveMiss, and blocks further taps', () => {
    let s = run(start(), tap(0), tap(1))
    expect(isMissPending(s)).toBe(true)
    expect(s.moves).toBe(1)
    expect(s.feedback).toEqual({ tone: 'bad', text: 'A ≠ B' })
    expect(run(s, tap(2))).toBe(s)
    s = run(s, { type: 'resolveMiss' })
    expect(s.flipped).toEqual([])
    expect(s.currentPlayer).toBe(0)
  })

  it('ignores matched cards and out-of-range indices', () => {
    const s = run(start(), tap(0), tap(2))
    expect(run(s, tap(0))).toBe(s)
    expect(run(s, tap(99))).toBe(s)
  })

  it('face-down: tapping the flipped card again does nothing', () => {
    const s = run(start(), tap(0))
    expect(run(s, tap(0))).toBe(s)
  })

  it('face-up: tapping the selected card again deselects it', () => {
    const s = run(start({ faceUp: true }), tap(0), tap(0))
    expect(s.flipped).toEqual([])
    expect(s.moves).toBe(0)
  })

  it('works without describers', () => {
    const plain = createGameReducer<TestCard>({})
    const s = [tap(0), tap(1)].reduce(plain, start())
    expect(s.feedback).toBeNull()
  })
})

describe('winning', () => {
  it('classic: clearing the board wins and stops the clock', () => {
    const s = run(start(), tap(0), tap(2), tap(1), tap(3))
    expect(s.phase).toBe('won')
    expect(s.moves).toBe(2)
    expect(isClockRunning(s)).toBe(false)
    expect(run(s, { type: 'tick' })).toBe(s)
    expect(run(s, tap(0))).toBe(s)
  })
})

describe('versus', () => {
  it('a miss passes the turn; a match keeps it', () => {
    let s = run(start({ mode: 'versus' }), tap(0), tap(1))
    s = run(s, { type: 'resolveMiss' })
    expect(s.currentPlayer).toBe(1)
    s = run(s, tap(0), tap(2))
    expect(s.scores).toEqual([0, 1])
    expect(s.cards[0].matchedBy).toBe(1)
    expect(s.currentPlayer).toBe(1)
    s = run(s, tap(1), tap(3))
    expect(s.scores).toEqual([0, 2])
    expect(s.phase).toBe('won')
  })

  it('resolveMiss with no miss pending is a no-op', () => {
    const s = start({ mode: 'versus' })
    expect(run(s, { type: 'resolveMiss' })).toBe(s)
  })
})

describe('timed', () => {
  const timed = () => start({ mode: 'timed' })

  it('the clock only runs after the first tap', () => {
    const s = timed()
    expect(run(s, { type: 'tick' })).toBe(s)
    expect(run(s, tap(0), { type: 'tick' }).seconds).toBe(1)
  })

  it('a cleared board waits in "clearing", then nextBoard deals a new one', () => {
    let s = run(timed(), tap(0), tap(2), tap(1), tap(3))
    expect(s.phase).toBe('clearing')
    expect(s.boardsCleared).toBe(1)
    expect(isClockRunning(s)).toBe(true)
    expect(run(s, tap(0))).toBe(s)

    const fresh = deck(['C', 'C', 'D', 'D'])
    s = run(s, { type: 'nextBoard', cards: fresh })
    expect(s.phase).toBe('playing')
    expect(s.cards).toBe(fresh)
    expect(s.scores).toEqual([2, 0]) // matches carry across boards
    s = run(s, tap(0), tap(1), tap(2), tap(3))
    expect(s.boardsCleared).toBe(2)
    expect(s.scores).toEqual([4, 0])
  })

  it('nextBoard outside "clearing" is ignored', () => {
    const s = timed()
    expect(run(s, { type: 'nextBoard', cards: deck() })).toBe(s)
  })

  it('time running out ends the game and drops a pending miss', () => {
    let s = run(timed(), tap(0), tap(1)) // miss on screen
    s = { ...s, seconds: TIMED_SECONDS - 1 }
    s = run(s, { type: 'tick' })
    expect(s.phase).toBe('timeUp')
    expect(s.seconds).toBe(TIMED_SECONDS)
    expect(s.flipped).toEqual([])
    expect(isClockRunning(s)).toBe(false)
    expect(run(s, { type: 'resolveMiss' })).toBe(s)
    expect(run(s, tap(2))).toBe(s)
  })

  it('time can run out during "clearing"; nextBoard is then ignored', () => {
    let s = run(timed(), tap(0), tap(2), tap(1), tap(3))
    s = run({ ...s, seconds: TIMED_SECONDS - 1 }, { type: 'tick' })
    expect(s.phase).toBe('timeUp')
    expect(s.boardsCleared).toBe(1)
    expect(run(s, { type: 'nextBoard', cards: deck() })).toBe(s)
  })

  it('classic games have no time limit', () => {
    const s = run(
      { ...run(start(), tap(0)), seconds: TIMED_SECONDS },
      { type: 'tick' },
    )
    expect(s.phase).toBe('playing')
    expect(s.seconds).toBe(TIMED_SECONDS + 1)
  })
})

describe('newGame', () => {
  it('resets everything', () => {
    const played = run(start({ mode: 'versus' }), tap(0), tap(2), tap(1))
    const fresh = deck()
    const s = run(played, {
      type: 'newGame',
      settings: settings({ mode: 'timed' }),
      cards: fresh,
    })
    expect(s).toEqual(initialState(settings({ mode: 'timed' }), fresh))
  })
})

describe('buildDeck', () => {
  it('deals every pair twice with unique keys, fresh each deal', () => {
    const a = buildDeck(mathGame, 'easy', 'addition')
    const b = buildDeck(mathGame, 'easy', 'addition')
    expect(a).toHaveLength(12)
    const counts = new Map<string, number>()
    for (const c of a)
      counts.set(c.data.pairId, (counts.get(c.data.pairId) ?? 0) + 1)
    expect([...counts.values()].every((n) => n === 2)).toBe(true)
    const keys = [...a, ...b].map((c) => c.key)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it('throws if a game deals the wrong number of pairs', () => {
    const broken = {
      ...mathGame,
      buildPairs: () => [],
    } as unknown as GameDefinition<CardData>
    expect(() => buildDeck(broken, 'easy', 'addition')).toThrow(/expected 6/)
  })
})
