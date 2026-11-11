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

// Pale block colors behind each creature; the creature carries the color.
const ELEMENT_STYLES: Record<Element, string> = {
  fire: 'bg-square-pale',
  water: 'bg-rhombus-pale',
  grass: 'bg-triangle-pale',
  electric: 'bg-hex-pale',
  ice: 'bg-[#e3f1f6]',
  wind: 'bg-[#e6f1ea]',
  rock: 'bg-tan-pale',
  dark: 'bg-[#dfe3ea]',
  fairy: 'bg-[#f7e1ee]',
  dragon: 'bg-[#e6e0f4]',
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
  backClass: 'back-blue',
  buildPairs: (difficulty) =>
    sample(CREATURES, DIFFICULTIES[difficulty].pairs).map((c) => {
      const card: Creature = { ...c, pairId: c.name, label: c.name }
      return [card, card]
    }),
  faceClass: (c) => ELEMENT_STYLES[c.element],
  renderFace: (c) => (
    <>
      <span className="text-[45cqw] leading-none">{c.art}</span>
      <span className="mt-[4cqw] w-full truncate text-center text-[clamp(0.55rem,12cqw,0.95rem)] font-bold leading-tight">
        {c.name}
      </span>
      <span className="hidden text-[clamp(0.55rem,9cqw,0.75rem)] text-ink-soft capitalize @min-[5.5rem]:block">
        {c.element}
      </span>
    </>
  ),
}
