import { createFileRoute } from '@tanstack/react-router'
import { mathGame } from '../games/math'
import { MatchGame } from '../match/MatchGame'

export const Route = createFileRoute('/math')({
  component: () => <MatchGame game={mathGame} />,
})
