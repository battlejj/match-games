// Best (fewest-moves) scores for classic solo games, one per board
// (game × variant × difficulty × card mode), persisted in localStorage.

import { readJSON, useStoredJSON, writeJSON } from './storage'

const keyFor = (board: string) => `match-best-v1:${board}`

/** The best score for a board, re-rendering when it changes. */
export function useBestScore(board: string): number | null {
  return useStoredJSON<number | null>(keyFor(board), null)
}

/** Records a finished game. Returns true if it set a new best. */
export function recordBestScore(board: string, moves: number): boolean {
  const previous = readJSON<number | null>(keyFor(board), null)
  if (previous !== null && moves >= previous) return false
  writeJSON(keyFor(board), moves)
  return true
}
