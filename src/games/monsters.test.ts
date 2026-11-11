import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, type Difficulty } from '../match/types'
import { monsterGame } from './monsters'

describe('monster boards', () => {
  it.each([
    'easy',
    'medium',
    'hard',
  ] as Difficulty[])('%s boards have distinct identical pairs', (difficulty) => {
    for (let run = 0; run < 200; run++) {
      const pairs = monsterGame.buildPairs(difficulty, 'all')
      expect(pairs).toHaveLength(DIFFICULTIES[difficulty].pairs)
      for (const [a, b] of pairs) expect(a).toEqual(b)
      expect(new Set(pairs.map(([a]) => a.pairId)).size).toBe(pairs.length)
    }
  })

  it('is memory-only', () => {
    expect(monsterGame.allowFaceUp).toBe(false)
  })
})
