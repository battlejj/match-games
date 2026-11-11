// Local leaderboards for timed solo games, persisted in localStorage.
// Each board is identified by a key such as "math:addition:easy:up"; keys
// start with the game's id so one game's boards can be reset on their own.

import { useMemo } from 'react'
import {
  readJSON,
  readString,
  useStoredJSON,
  writeJSON,
  writeString,
} from './storage'

export interface LeaderboardEntry {
  id: string
  name: string
  matches: number
  moves: number
  boards: number
  date: string // ISO timestamp
}

type Leaderboards = Record<string, LeaderboardEntry[]>

// v3: boards are namespaced per game. Earlier versions held Pokémon-era
// scores and aren't read anymore.
const STORAGE_KEY = 'match-leaderboards-v3'
const NAME_KEY = 'match-player-name'

export const LEADERBOARD_SIZE = 10
export const MAX_NAME_LENGTH = 16

// Stable fallbacks: returned as-is from snapshots, so they mustn't change.
const NO_BOARDS: Leaderboards = {}
const NO_ENTRIES: LeaderboardEntry[] = []

const loadAll = () => readJSON(STORAGE_KEY, NO_BOARDS)

// More matches wins; ties go to fewer moves (better accuracy), then to
// whoever set the score first.
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry) {
  return (
    b.matches - a.matches || a.moves - b.moves || a.date.localeCompare(b.date)
  )
}

const inGame = (key: string, gameId: string) => key.startsWith(`${gameId}:`)

export function getLeaderboard(board: string): LeaderboardEntry[] {
  return loadAll()[board] ?? NO_ENTRIES
}

/** A board's entries, re-rendering when any leaderboard changes. */
export function useLeaderboard(board: string): LeaderboardEntry[] {
  return useStoredJSON(STORAGE_KEY, NO_BOARDS)[board] ?? NO_ENTRIES
}

/** Whether a game has any saved scores, re-rendering on changes. */
export function useHasLeaderboardEntries(gameId: string): boolean {
  const all = useStoredJSON(STORAGE_KEY, NO_BOARDS)
  return useMemo(
    () =>
      Object.entries(all).some(
        ([key, list]) => inGame(key, gameId) && list.length > 0,
      ),
    [all, gameId],
  )
}

/** 0-based rank a new score would take, or null if it doesn't qualify. */
export function qualifyingRank(
  board: string,
  score: { matches: number; moves: number },
): number | null {
  if (score.matches <= 0) return null
  // Existing entries keep their place on an exact tie.
  const ahead = getLeaderboard(board).filter(
    (e) =>
      e.matches > score.matches ||
      (e.matches === score.matches && e.moves <= score.moves),
  ).length
  return ahead < LEADERBOARD_SIZE ? ahead : null
}

export function addLeaderboardEntry(
  board: string,
  entry: Omit<LeaderboardEntry, 'id' | 'date'>,
): LeaderboardEntry {
  const full: LeaderboardEntry = {
    ...entry,
    // crypto.randomUUID is unavailable on plain-http LAN dev servers.
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    date: new Date().toISOString(),
  }
  const all = loadAll()
  writeJSON(STORAGE_KEY, {
    ...all,
    [board]: [...(all[board] ?? []), full]
      .sort(compareEntries)
      .slice(0, LEADERBOARD_SIZE),
  })
  return full
}

/** Deletes every leaderboard belonging to one game. */
export function resetLeaderboards(gameId: string) {
  writeJSON(
    STORAGE_KEY,
    Object.fromEntries(
      Object.entries(loadAll()).filter(([key]) => !inGame(key, gameId)),
    ),
  )
}

export function getLastPlayerName(): string {
  return readString(NAME_KEY) ?? ''
}

export function setLastPlayerName(name: string) {
  writeString(NAME_KEY, name)
}
