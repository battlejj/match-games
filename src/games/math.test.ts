import { describe, expect, it } from 'vitest'
import { DIFFICULTIES, type Difficulty } from '../match/types'
import { mathGame } from './math'

const DIFFICULTY_LIST: Difficulty[] = ['easy', 'medium', 'hard']
const VARIANTS = ['addition', 'subtraction', 'multiplication', 'mixed']
const ADD_SUB_MAX = { easy: 10, medium: 20, hard: 100 }
const TIMES = { easy: [5, 10], medium: [10, 10], hard: [12, 12] }
const BOARDS_PER_SETTING = 500

type Pair = ReturnType<typeof mathGame.buildPairs>[number]

function solve(op: string, a: number, b: number) {
  if (op === 'addition') return a + b
  if (op === 'subtraction') return a - b
  return a * b
}

describe.each(VARIANTS)('math boards: %s', (variant) => {
  it.each(DIFFICULTY_LIST)('%s boards are valid', (difficulty) => {
    for (let run = 0; run < BOARDS_PER_SETTING; run++) {
      const pairs = mathGame.buildPairs(difficulty, variant)
      expect(pairs).toHaveLength(DIFFICULTIES[difficulty].pairs)

      const answers = new Set<number>()
      for (const [num, eq] of pairs as Pair[]) {
        if (num.kind !== 'number' || eq.kind !== 'equation') {
          throw new Error(
            `pair must be [number, equation]: ${JSON.stringify([num, eq])}`,
          )
        }
        expect(num.pairId).toBe(eq.pairId)
        expect(num.value).toBe(eq.value)
        expect(solve(eq.op, eq.a, eq.b)).toBe(eq.value)
        expect(eq.value).toBeGreaterThanOrEqual(1)
        expect(Math.min(eq.a, eq.b)).toBeGreaterThanOrEqual(1)
        if (variant !== 'mixed') expect(eq.op).toBe(variant)

        if (eq.op === 'addition') {
          expect(eq.value).toBeLessThanOrEqual(ADD_SUB_MAX[difficulty])
        } else if (eq.op === 'subtraction') {
          expect(eq.a).toBeLessThanOrEqual(ADD_SUB_MAX[difficulty])
        } else {
          const [small, large] = [Math.min(eq.a, eq.b), Math.max(eq.a, eq.b)]
          const [tableMax, factorMax] = TIMES[difficulty]
          expect(small).toBeLessThanOrEqual(tableMax)
          expect(large).toBeLessThanOrEqual(Math.max(tableMax, factorMax))
        }
        answers.add(eq.value)
      }
      // Unique answers: each equation matches exactly one number card.
      expect(answers.size).toBe(pairs.length)
    }
  })
})

describe('math generation', () => {
  it('rarely uses 1 as an operand', () => {
    let ones = 0
    let total = 0
    for (let run = 0; run < 2000; run++) {
      for (const [, eq] of mathGame.buildPairs('medium', 'mixed') as Pair[]) {
        if (eq.kind !== 'equation') continue
        total++
        if (eq.a === 1 || eq.b === 1) ones++
      }
    }
    expect(ones / total).toBeLessThan(0.1)
  })

  it('balances operations on mixed boards', () => {
    const counts: Record<string, number> = {}
    for (let run = 0; run < 2000; run++) {
      for (const [, eq] of mathGame.buildPairs('medium', 'mixed') as Pair[]) {
        if (eq.kind === 'equation') counts[eq.op] = (counts[eq.op] ?? 0) + 1
      }
    }
    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    for (const op of ['addition', 'subtraction', 'multiplication']) {
      expect(counts[op] / total).toBeGreaterThan(0.2)
    }
  })
})

describe('math feedback', () => {
  const num = (value: number) =>
    ({
      kind: 'number',
      value,
      pairId: String(value),
      label: String(value),
    }) as const
  const eq = (
    op: 'addition' | 'subtraction' | 'multiplication',
    a: number,
    b: number,
    value: number,
  ) =>
    ({
      kind: 'equation',
      op,
      a,
      b,
      value,
      pairId: String(value),
      label: '',
    }) as const

  it('explains a match', () => {
    expect(mathGame.describeMatch?.(num(15), eq('addition', 7, 8, 15))).toBe(
      '7 + 8 = 15 ✓',
    )
    expect(
      mathGame.describeMatch?.(eq('multiplication', 3, 4, 12), num(12)),
    ).toBe('3 × 4 = 12 ✓')
  })

  it('explains a wrong number', () => {
    expect(mathGame.describeMiss?.(num(14), eq('addition', 7, 8, 15))).toBe(
      '7 + 8 = 15, not 14',
    )
    expect(mathGame.describeMiss?.(eq('subtraction', 9, 4, 5), num(6))).toBe(
      '9 − 4 = 5, not 6',
    )
  })

  it('explains two numbers or two equations', () => {
    expect(mathGame.describeMiss?.(num(3), num(4))).toBe(
      'Two numbers: match a number with an equation',
    )
    expect(
      mathGame.describeMiss?.(
        eq('addition', 7, 8, 15),
        eq('multiplication', 3, 4, 12),
      ),
    ).toBe('7 + 8 = 15, 3 × 4 = 12')
  })
})
