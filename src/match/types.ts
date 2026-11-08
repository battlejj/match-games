import type { ReactNode } from 'react'

export type Difficulty = 'easy' | 'medium' | 'hard'

export const DIFFICULTIES: Record<Difficulty, { pairs: number }> = {
  easy: { pairs: 6 },
  medium: { pairs: 8 },
  hard: { pairs: 12 },
}

export const DIFFICULTY_ORDER: Difficulty[] = ['easy', 'medium', 'hard']

/** Anything that can go on a card. Two cards match when pairIds are equal. */
export interface CardData {
  pairId: string
  /** Read by screen readers when the card is revealed. */
  label: string
}

export interface GameDefinition<C extends CardData> {
  /** Storage namespace for scores; must not contain ':'. */
  id: string
  title: string
  /** Game-specific variants, e.g. the math operation. Use one entry if none. */
  variants: readonly { value: string; label: string }[]
  variantHeading?: string
  defaultVariant: string
  /** Optional per-difficulty description shown in settings, e.g. "sums to 20". */
  difficultyHint?: (difficulty: Difficulty, variant: string) => string
  allowFaceUp: boolean
  defaultFaceUp: boolean
  buildPairs: (difficulty: Difficulty, variant: string) => [C, C][]
  renderFace: (card: C) => ReactNode
  /** Classes for the card front (background gradient etc.). */
  faceClass: (card: C) => string
  backClass: string
  /** Feedback line after a match / miss. Return null for none. */
  describeMatch?: (a: C, b: C) => string | null
  describeMiss?: (a: C, b: C) => string | null
}
