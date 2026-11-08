import { createFileRoute } from '@tanstack/react-router'
import { monsterGame } from '../games/monsters'
import { MatchGame } from '../match/MatchGame'

export const Route = createFileRoute('/monsters')({
  component: () => <MatchGame game={monsterGame} />,
})
