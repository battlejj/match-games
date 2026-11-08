import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

const GAMES = [
  {
    to: '/math',
    icon: '🧮',
    title: 'Math Match',
    blurb: 'Match each number with its equation. Add, subtract, multiply, or mix them all.',
    className: 'from-emerald-400 to-teal-600',
  },
  {
    to: '/monsters',
    icon: '🐉',
    title: 'Monster Match',
    blurb: 'A memory game. Flip cards to find matching pairs of creatures.',
    className: 'from-rose-400 to-red-600',
  },
] as const

function Home() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-gradient-to-b from-indigo-950 via-indigo-900 to-purple-900 p-[max(env(safe-area-inset-top),1.5rem)_max(env(safe-area-inset-right),1.25rem)_max(env(safe-area-inset-bottom),1.5rem)_max(env(safe-area-inset-left),1.25rem)] text-white">
      <h1 className="text-center text-3xl font-extrabold tracking-tight sm:text-5xl">
        Match Games
      </h1>
      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        {GAMES.map((g) => (
          <Link
            key={g.to}
            to={g.to}
            className={`flex items-center gap-4 rounded-3xl bg-gradient-to-br p-5 shadow-xl transition active:scale-[0.98] hover:brightness-110 sm:flex-col sm:p-8 sm:text-center ${g.className}`}
          >
            <span className="text-5xl sm:text-7xl">{g.icon}</span>
            <span>
              <span className="block text-2xl font-extrabold">{g.title}</span>
              <span className="mt-1 block text-sm text-white/90">{g.blurb}</span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
