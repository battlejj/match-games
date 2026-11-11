// The words the UI uses for each setting. Every screen uses these, so a
// choice has the same name everywhere: the New game sheet, the subtitle
// under the game title, and the top-scores list.

import type { BlockShape } from './blocks'
import { type Mode, type Settings, TIMED_MINUTES } from './engine'
import type { CardData, GameDefinition } from './types'

export const MODES: readonly Mode[] = ['solo', 'timed', 'versus']

export const MODE_LABELS: Record<Mode, string> = {
  solo: 'Practice',
  timed: 'Beat the clock',
  versus: 'Two players',
}

export const MODE_HINTS: Record<Mode, string> = {
  solo: 'Take your time',
  timed: `Most matches in ${TIMED_MINUTES} minutes`,
  versus: 'Take turns',
}

export const START_LABELS: Record<Mode, string> = {
  solo: 'Start practice',
  timed: `Start ${TIMED_MINUTES}-minute game`,
  versus: 'Start two-player game',
}

export const PLAYERS = [
  { name: 'Player 1', block: 'hexagon' },
  { name: 'Player 2', block: 'rhombus' },
] as const satisfies readonly { name: string; block: BlockShape }[]

/** The block stamped on a match: the finder's shape, or green when solo. */
export const SOLO_BLOCK: BlockShape = 'triangle'

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const faceUpLabel = (faceUp: boolean) =>
  faceUp ? 'Face up' : 'Face down'

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function variantLabel<C extends CardData>(game: GameDefinition<C>, v: string) {
  return game.variants.find((o) => o.value === v)?.label ?? v
}

/** Names a board, e.g. "Add, Medium, Face up". */
export function describeBoard<C extends CardData>(
  game: GameDefinition<C>,
  s: Omit<Settings, 'mode'>,
) {
  const parts: string[] = []
  if (game.variants.length > 1) parts.push(variantLabel(game, s.variant))
  parts.push(capitalize(s.difficulty))
  if (game.allowFaceUp) parts.push(faceUpLabel(s.faceUp))
  return parts.join(', ')
}

/** The full choice, e.g. "Beat the clock: Add, Medium, Face up". */
export function describeSettings<C extends CardData>(
  game: GameDefinition<C>,
  s: Settings,
) {
  return `${MODE_LABELS[s.mode]}: ${describeBoard(game, s)}`
}
