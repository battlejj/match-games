// Sheets opened from the home screen: things for grown-ups, kept out of
// the game screens.

import { useState } from 'react'
import { AppPanel } from './AppPanel'
import { Segmented } from './controls'
import type { GameOptions } from './engine'
import { LeaderboardsPanel } from './LeaderboardsPanel'
import { Sheet } from './Sheet'

export function TopScoresSheet({
  games,
  onClose,
}: {
  games: readonly GameOptions[]
  onClose: () => void
}) {
  const [gameId, setGameId] = useState(games[0].id)
  const game = games.find((g) => g.id === gameId) ?? games[0]
  return (
    <Sheet title="Top scores" onClose={onClose}>
      {games.length > 1 && (
        <Segmented
          label="Game"
          value={gameId}
          options={games.map((g) => ({ value: g.id, label: g.title }))}
          onChange={setGameId}
        />
      )}
      {/* Keyed so each game's filters start from its own defaults. */}
      <LeaderboardsPanel key={game.id} game={game} />
    </Sheet>
  )
}

export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="About this app" onClose={onClose}>
      <AppPanel />
    </Sheet>
  )
}
