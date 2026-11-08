// Local leaderboards for timed solo games, persisted in localStorage.
// Each board is identified by a key such as "math:addition:easy:up"; keys
// start with the game's id so one game's boards can be reset on their own.

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

function loadAll(): Leaderboards {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Leaderboards) : {}
  } catch {
    return {}
  }
}

function saveAll(boards: Leaderboards) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(boards))
  } catch {
    // Storage full or disabled — nothing more we can do.
  }
}

// More matches wins; ties go to fewer moves (better accuracy), then to
// whoever set the score first.
function compareEntries(a: LeaderboardEntry, b: LeaderboardEntry) {
  return b.matches - a.matches || a.moves - b.moves || a.date.localeCompare(b.date)
}

export function getLeaderboard(board: string): LeaderboardEntry[] {
  return loadAll()[board] ?? []
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
  const boards = loadAll()
  boards[board] = [...(boards[board] ?? []), full]
    .sort(compareEntries)
    .slice(0, LEADERBOARD_SIZE)
  saveAll(boards)
  return full
}

const inGame = (key: string, gameId: string) => key.startsWith(`${gameId}:`)

export function hasAnyLeaderboardEntries(gameId: string): boolean {
  return Object.entries(loadAll()).some(
    ([key, list]) => inGame(key, gameId) && list.length > 0,
  )
}

/** Deletes every leaderboard belonging to one game. */
export function resetLeaderboards(gameId: string) {
  const boards = loadAll()
  for (const key of Object.keys(boards)) {
    if (inGame(key, gameId)) delete boards[key]
  }
  saveAll(boards)
}

export function getLastPlayerName(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(NAME_KEY) ?? ''
}

export function setLastPlayerName(name: string) {
  try {
    window.localStorage.setItem(NAME_KEY, name)
  } catch {
    // ignore
  }
}
