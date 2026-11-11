// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest'

const load = () => import('./leaderboard')
const BOARD = 'math:addition:easy:up'

beforeEach(() => {
  vi.resetModules()
  localStorage.clear()
})

const score = (matches: number, moves: number) => ({
  name: `${matches}/${moves}`,
  matches,
  moves,
  boards: 0,
})

describe('leaderboards', () => {
  it('starts empty and any positive score qualifies at #1', async () => {
    const { getLeaderboard, qualifyingRank } = await load()
    expect(getLeaderboard(BOARD)).toEqual([])
    expect(qualifyingRank(BOARD, { matches: 1, moves: 9 })).toBe(0)
    expect(qualifyingRank(BOARD, { matches: 0, moves: 0 })).toBeNull()
  })

  it('sorts by matches, then fewer moves, then earliest', async () => {
    const { addLeaderboardEntry, getLeaderboard } = await load()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    addLeaderboardEntry(BOARD, { ...score(10, 20), name: 'first' })
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'))
    addLeaderboardEntry(BOARD, { ...score(10, 20), name: 'second' })
    addLeaderboardEntry(BOARD, score(12, 30))
    addLeaderboardEntry(BOARD, score(10, 15))
    vi.useRealTimers()
    expect(getLeaderboard(BOARD).map((e) => e.name)).toEqual([
      '12/30',
      '10/15',
      'first',
      'second',
    ])
  })

  it('keeps the top 10 and ranks new scores behind exact ties', async () => {
    const {
      addLeaderboardEntry,
      getLeaderboard,
      LEADERBOARD_SIZE,
      qualifyingRank,
    } = await load()
    for (let m = 1; m <= 12; m++) addLeaderboardEntry(BOARD, score(m, 20))
    const board = getLeaderboard(BOARD)
    expect(board).toHaveLength(LEADERBOARD_SIZE)
    expect(board[0].matches).toBe(12)
    expect(board.at(-1)?.matches).toBe(3)

    expect(qualifyingRank(BOARD, { matches: 13, moves: 99 })).toBe(0)
    expect(qualifyingRank(BOARD, { matches: 12, moves: 20 })).toBe(1) // tie: behind
    expect(qualifyingRank(BOARD, { matches: 12, moves: 19 })).toBe(0) // fewer moves: ahead
    expect(qualifyingRank(BOARD, { matches: 3, moves: 20 })).toBeNull() // tie with #10
    expect(qualifyingRank(BOARD, { matches: 3, moves: 19 })).toBe(9)
  })

  it('reset clears only the given game', async () => {
    const { addLeaderboardEntry, getLeaderboard, resetLeaderboards } =
      await load()
    addLeaderboardEntry(BOARD, score(5, 9))
    addLeaderboardEntry('math:mixed:hard:down', score(4, 9))
    addLeaderboardEntry('monsters:all:easy:down', score(3, 9))
    resetLeaderboards('math')
    expect(getLeaderboard(BOARD)).toEqual([])
    expect(getLeaderboard('math:mixed:hard:down')).toEqual([])
    expect(getLeaderboard('monsters:all:easy:down')).toHaveLength(1)
  })

  it('remembers the last player name', async () => {
    const { getLastPlayerName, setLastPlayerName } = await load()
    expect(getLastPlayerName()).toBe('')
    setLastPlayerName('Ada')
    expect(getLastPlayerName()).toBe('Ada')
  })
})
