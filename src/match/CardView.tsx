import { Block, type BlockShape } from './blocks'
import type { Card } from './engine'
import type { CardData, GameDefinition } from './types'

export function CardView<C extends CardData>({
  game,
  card,
  faceUpMode,
  revealed,
  selected,
  wrong,
  matchBlock,
  onClick,
}: {
  game: GameDefinition<C>
  card: Card<C>
  faceUpMode: boolean
  revealed: boolean
  selected: boolean
  wrong: boolean
  /** The shape stamped on the card once it's matched. */
  matchBlock: BlockShape
  onClick: () => void
}) {
  const { data, matched } = card
  const ring = wrong
    ? 'ring-4 ring-trapezoid'
    : selected && faceUpMode
      ? 'ring-4 ring-rhombus'
      : ''
  return (
    <button
      type="button"
      onClick={onClick}
      // Face-down: a revealed card can't be tapped. Face-up: selected cards
      // stay tappable so they can be deselected.
      disabled={matched || (!faceUpMode && revealed)}
      aria-pressed={faceUpMode ? selected : undefined}
      aria-label={
        revealed ? `${data.label}${matched ? ', matched' : ''}` : 'Hidden card'
      }
      className={`card-scene @container aspect-[3/4] w-full rounded-[8cqw] transition focus:outline-none focus-visible:ring-4 focus-visible:ring-hex ${
        wrong ? 'card-shake' : ''
      } ${selected && faceUpMode && !wrong ? '-translate-y-[4%]' : ''}`}
    >
      <div
        className={`card-inner ${revealed ? 'is-flipped' : ''} ${
          faceUpMode ? 'no-flip-anim' : ''
        }`}
      >
        {/* Back: a pattern-block tiling inside a paper border. */}
        <div
          className={`card-face block-edge rounded-[8cqw] border-[4cqw] border-paper transition active:brightness-95 hover:brightness-105 ${game.backClass}`}
        />
        {/* Front */}
        <div
          className={`card-face card-front block-edge flex flex-col items-center justify-center overflow-hidden rounded-[8cqw] p-[6cqw] text-ink ${game.faceClass(
            data,
          )} ${ring}`}
        >
          {/* Face-up boards fade found pairs so the rest stand out. */}
          <div
            className={`flex h-full w-full flex-col items-center justify-center ${
              matched && faceUpMode ? 'opacity-35' : ''
            }`}
          >
            {game.renderFace(data)}
          </div>
          {matched && (
            <Block
              shape={matchBlock}
              className="stamp absolute top-[5cqw] right-[5cqw] w-[22cqw]"
            />
          )}
        </div>
      </div>
    </button>
  )
}
