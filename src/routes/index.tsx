import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { mathGame } from '../games/math'
import { monsterGame } from '../games/monsters'
import { matButton } from '../match/controls'
import { AboutSheet, TopScoresSheet } from '../match/HomeSheets'

export const Route = createFileRoute('/')({ component: Home })

const GAMES = [
  {
    to: '/math',
    game: mathGame,
    blurb:
      'Match each number with its equation. Add, subtract, multiply, or mix them all.',
  },
  {
    to: '/monsters',
    game: monsterGame,
    blurb: 'A memory game. Flip cards to find matching pairs of creatures.',
  },
] as const

const SCORED_GAMES = GAMES.map((g) => g.game)

function Home() {
  const [sheet, setSheet] = useState<'scores' | 'about' | null>(null)
  const close = () => setSheet(null)
  return (
    <div className="mat flex min-h-dvh flex-col items-center justify-center p-[calc(env(safe-area-inset-top)+1.5rem)_max(env(safe-area-inset-right),1.25rem)_max(env(safe-area-inset-bottom),1.5rem)_max(env(safe-area-inset-left),1.25rem)] text-paper">
      <div className="w-full max-w-xl">
        <h1 className="text-4xl font-bold sm:text-5xl">Match Games</h1>
        <div className="mt-6 grid gap-4">
          {GAMES.map(({ to, game, blurb }) => (
            <Link
              key={to}
              to={to}
              className="block-edge flex items-center gap-4 rounded-2xl bg-paper p-4 text-ink transition active:translate-y-[3px] active:shadow-none focus:outline-none focus-visible:ring-4 focus-visible:ring-hex sm:p-5"
            >
              {/* A small copy of the game's card back. */}
              <span aria-hidden="true" className="@container w-16 shrink-0">
                <span
                  className={`block-edge block aspect-[3/4] rounded-[8cqw] border-[6cqw] border-paper ring-1 ring-ink/15 ${game.backClass}`}
                />
              </span>
              <span>
                <span className="block text-2xl font-bold">{game.title}</span>
                <span className="mt-1 block text-ink-soft">{blurb}</span>
              </span>
            </Link>
          ))}
        </div>
        <nav aria-label="More" className="mt-6 flex flex-wrap gap-2">
          <HomeButton onClick={() => setSheet('scores')}>Top scores</HomeButton>
          <HomeButton onClick={() => setSheet('about')}>
            About this app
          </HomeButton>
        </nav>
      </div>
      {sheet === 'scores' && (
        <TopScoresSheet games={SCORED_GAMES} onClose={close} />
      )}
      {sheet === 'about' && <AboutSheet onClose={close} />}
    </div>
  )
}

function HomeButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${matButton} px-5 font-bold`}
    >
      {children}
    </button>
  )
}
