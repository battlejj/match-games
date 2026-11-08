import type { CardData, GameDefinition } from '../match/types'
import { DIFFICULTIES } from '../match/types'

type Element =
  | 'fire'
  | 'water'
  | 'grass'
  | 'electric'
  | 'ice'
  | 'wind'
  | 'rock'
  | 'dark'
  | 'fairy'
  | 'dragon'

interface Creature extends CardData {
  name: string
  art: string
  element: Element
}

// Original creatures. `art` is an emoji placeholder; swap in original
// drawings (e.g. SVGs in src/assets) later without touching the engine.
const CREATURES: Omit<Creature, 'pairId' | 'label'>[] = [
  { name: 'Emberkit', art: '🦊', element: 'fire' },
  { name: 'Cindertail', art: '🦎', element: 'fire' },
  { name: 'Inkwave', art: '🐙', element: 'water' },
  { name: 'Puddlehop', art: '🐸', element: 'water' },
  { name: 'Tidefin', art: '🦈', element: 'water' },
  { name: 'Shellbloom', art: '🐢', element: 'grass' },
  { name: 'Thornquill', art: '🦔', element: 'grass' },
  { name: 'Hootspark', art: '🦉', element: 'electric' },
  { name: 'Buzzbolt', art: '🐝', element: 'electric' },
  { name: 'Frostfang', art: '🐺', element: 'ice' },
  { name: 'Floeflap', art: '🐧', element: 'ice' },
  { name: 'Gustbeak', art: '🦜', element: 'wind' },
  { name: 'Pebblesnail', art: '🐌', element: 'rock' },
  { name: 'Cragpincer', art: '🦀', element: 'rock' },
  { name: 'Duskwing', art: '🦇', element: 'dark' },
  { name: 'Snoozlepaw', art: '🐨', element: 'dark' },
  { name: 'Glimmerwing', art: '🦋', element: 'fairy' },
  { name: 'Drakelet', art: '🐉', element: 'dragon' },
]

const ELEMENT_STYLES: Record<Element, string> = {
  fire: 'from-orange-400 to-red-500',
  water: 'from-sky-400 to-blue-600',
  grass: 'from-lime-400 to-green-600',
  electric: 'from-yellow-300 to-amber-500',
  ice: 'from-cyan-200 to-sky-400',
  wind: 'from-teal-300 to-emerald-500',
  rock: 'from-stone-400 to-amber-800',
  dark: 'from-slate-600 to-zinc-900',
  fairy: 'from-pink-300 to-fuchsia-500',
  dragon: 'from-violet-500 to-indigo-700',
}

function sample<T>(items: T[], n: number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a.slice(0, n)
}

export const monsterGame: GameDefinition<Creature> = {
  id: 'monsters',
  title: 'Monster Match',
  variants: [{ value: 'all', label: 'All creatures' }],
  defaultVariant: 'all',
  // Face-up would just be spotting identical pictures, so memory mode only.
  allowFaceUp: false,
  defaultFaceUp: false,
  backClass: 'from-red-500 to-rose-700',
  buildPairs: (difficulty) =>
    sample(CREATURES, DIFFICULTIES[difficulty].pairs).map((c) => {
      const card: Creature = { ...c, pairId: c.name, label: c.name }
      return [card, card]
    }),
  faceClass: (c) => ELEMENT_STYLES[c.element],
  renderFace: (c) => (
    <>
      <span className="text-[45cqw] leading-none drop-shadow">{c.art}</span>
      <span className="mt-[4cqw] w-full truncate text-center text-[clamp(0.55rem,12cqw,0.95rem)] font-bold leading-tight drop-shadow">
        {c.name}
      </span>
      <span className="hidden text-[clamp(0.5rem,8cqw,0.65rem)] uppercase tracking-wider opacity-80 @min-[5.5rem]:block">
        {c.element}
      </span>
    </>
  ),
}
