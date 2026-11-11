import type { CardData, Difficulty, GameDefinition } from '../match/types'
import { DIFFICULTIES } from '../match/types'

type Op = 'addition' | 'subtraction' | 'multiplication'
type Variant = Op | 'mixed'

interface NumberCard extends CardData {
  kind: 'number'
  value: number
}

interface EquationCard extends CardData {
  kind: 'equation'
  op: Op
  a: number
  b: number
  value: number
}

type MathCard = NumberCard | EquationCard

const SYMBOLS: Record<Op, string> = {
  addition: '+',
  subtraction: '−', // U+2212 minus sign, not a hyphen
  multiplication: '×',
}

const SPOKEN: Record<Op, string> = {
  addition: 'plus',
  subtraction: 'minus',
  multiplication: 'times',
}

// Addition: both addends ≥ min, sum ≤ max.
// Subtraction: minuend ≤ max, subtrahend ≥ min, answer ≥ 1 (never negative).
const ADD_SUB_RANGES: Record<Difficulty, { max: number; min: number }> = {
  easy: { max: 10, min: 1 },
  medium: { max: 20, min: 2 },
  hard: { max: 100, min: 5 },
}

// Multiplication: "1–5 times tables" = 1..5 × 1..10, etc.
const TIMES_TABLES: Record<Difficulty, { a: number; b: number }> = {
  easy: { a: 5, b: 10 },
  medium: { a: 10, b: 10 },
  hard: { a: 12, b: 12 },
}

const randInt = (lo: number, hi: number) =>
  lo + Math.floor(Math.random() * (hi - lo + 1))

// Facts with a 1 (7 + 1, 9 × 1) are too easy to be worth many cards; most
// are rerolled so they only turn up occasionally.
const tooEasy = (...operands: number[]) =>
  operands.includes(1) && Math.random() < 0.8

type Fact = { op: Op; a: number; b: number; value: number }

function randomFact(op: Op, difficulty: Difficulty): Fact | null {
  if (op === 'multiplication') {
    const t = TIMES_TABLES[difficulty]
    let a = randInt(1, t.a)
    let b = randInt(1, t.b)
    if (tooEasy(a, b)) return null
    // Show both orders: 3 × 7 and 7 × 3.
    if (Math.random() < 0.5) [a, b] = [b, a]
    return { op, a, b, value: a * b }
  }
  const { max, min } = ADD_SUB_RANGES[difficulty]
  if (op === 'addition') {
    const a = randInt(min, max - min)
    const b = randInt(min, max - a)
    if (tooEasy(a, b)) return null
    return { op, a, b, value: a + b }
  }
  const a = randInt(min + 1, max)
  const b = randInt(min, a - 1)
  if (tooEasy(b)) return null
  return { op, a, b, value: a - b }
}

const OPS: Op[] = ['addition', 'subtraction', 'multiplication']

function buildPairs(
  difficulty: Difficulty,
  variant: string,
): [MathCard, MathCard][] {
  const count = DIFFICULTIES[difficulty].pairs
  const used = new Set<number>()
  const pairs: [MathCard, MathCard][] = []
  // Answers must be unique on a board: each equation then matches exactly one
  // number card, and two cards of the same kind can never share a pairId.
  for (let tries = 0; pairs.length < count && tries < 5000; tries++) {
    const op =
      variant === 'mixed' ? OPS[randInt(0, OPS.length - 1)] : (variant as Op)
    const fact = randomFact(op, difficulty)
    if (!fact || used.has(fact.value)) continue
    used.add(fact.value)
    const pairId = String(fact.value)
    pairs.push([
      { kind: 'number', value: fact.value, pairId, label: String(fact.value) },
      {
        kind: 'equation',
        ...fact,
        pairId,
        label: `${fact.a} ${SPOKEN[fact.op]} ${fact.b}`,
      },
    ])
  }
  return pairs
}

const expr = (c: EquationCard) => `${c.a} ${SYMBOLS[c.op]} ${c.b}`

function split(a: MathCard, b: MathCard) {
  const nums = [a, b].filter((c): c is NumberCard => c.kind === 'number')
  const eqs = [a, b].filter((c): c is EquationCard => c.kind === 'equation')
  return { nums, eqs }
}

// Numbers are plain paper; equations are tinted by operation so the two
// kinds of card are easy to tell apart.
const EQUATION_STYLES: Record<Op, string> = {
  addition: 'bg-rhombus-pale',
  subtraction: 'bg-trapezoid-pale',
  multiplication: 'bg-square-pale',
}

function hint(difficulty: Difficulty, variant: string): string {
  const { max } = ADD_SUB_RANGES[difficulty]
  const tables = `1–${TIMES_TABLES[difficulty].a} times tables`
  switch (variant) {
    case 'addition':
      return `Sums up to ${max}.`
    case 'subtraction':
      return `Subtract from numbers up to ${max}. Answers are never negative.`
    case 'multiplication':
      return `The ${tables}.`
    default:
      return `Add and subtract up to ${max}, multiply with the ${tables}.`
  }
}

const VARIANTS: { value: Variant; label: string }[] = [
  { value: 'addition', label: 'Add' },
  { value: 'subtraction', label: 'Subtract' },
  { value: 'multiplication', label: 'Multiply' },
  { value: 'mixed', label: 'Mixed' },
]

export const mathGame: GameDefinition<MathCard> = {
  id: 'math',
  title: 'Math Match',
  variants: VARIANTS,
  variantHeading: 'What to practice',
  defaultVariant: 'addition',
  difficultyHint: hint,
  allowFaceUp: true,
  defaultFaceUp: true,
  backClass: 'back-hexagon',
  buildPairs,
  faceClass: (c) => (c.kind === 'number' ? 'bg-paper' : EQUATION_STYLES[c.op]),
  renderFace: (c) =>
    c.kind === 'number' ? (
      <span
        className="font-bold leading-none tabular-nums"
        style={{ fontSize: c.value >= 100 ? '32cqw' : '44cqw' }}
      >
        {c.value}
      </span>
    ) : (
      // Column form, like a worksheet: a over "op b", with a rule beneath.
      <span
        className="flex flex-col items-end border-b-[1.5cqw] border-current pb-[2cqw] font-bold leading-[1.05] tabular-nums"
        style={{ fontSize: Math.max(c.a, c.b) >= 100 ? '24cqw' : '28cqw' }}
      >
        <span>{c.a}</span>
        <span>
          {SYMBOLS[c.op]}&nbsp;{c.b}
        </span>
      </span>
    ),
  describeMatch: (a, b) => {
    const { eqs } = split(a, b)
    return eqs[0] ? `${expr(eqs[0])} = ${eqs[0].value} ✓` : null
  },
  describeMiss: (a, b) => {
    const { nums, eqs } = split(a, b)
    if (nums.length === 2) return 'Two numbers: match a number with an equation'
    if (eqs.length === 2)
      return `${expr(eqs[0])} = ${eqs[0].value}, ${expr(eqs[1])} = ${eqs[1].value}`
    return `${expr(eqs[0])} = ${eqs[0].value}, not ${nums[0].value}`
  },
}
