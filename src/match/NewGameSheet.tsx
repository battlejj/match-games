import { useState } from 'react'
import { primaryButton, Segmented } from './controls'
import {
  capitalize,
  faceUpLabel,
  MODE_HINTS,
  MODE_LABELS,
  MODES,
  START_LABELS,
} from './display'
import { boardKey, type Mode, type Settings } from './engine'
import { useLeaderboard } from './leaderboard'
import { Sheet } from './Sheet'
import {
  type CardData,
  DIFFICULTIES,
  DIFFICULTY_ORDER,
  type GameDefinition,
} from './types'

/**
 * Chooses how to play first, then shows only the options that apply.
 * Every mode works with every board, so changing the mode never hides or
 * resets another choice.
 */
export function NewGameSheet<C extends CardData>({
  game,
  initial,
  onClose,
  onStart,
}: {
  game: GameDefinition<C>
  initial: Settings
  onClose: () => void
  onStart: (s: Settings) => void
}) {
  const [draft, setDraft] = useState(initial)
  const update = (patch: Partial<Settings>) =>
    setDraft((d) => ({ ...d, ...patch }))
  const topScore = useLeaderboard(boardKey(game.id, draft))[0]?.matches
  const cardCount = DIFFICULTIES[draft.difficulty].pairs * 2
  const hint = game.difficultyHint?.(draft.difficulty, draft.variant)

  return (
    <Sheet title="New game" onClose={onClose}>
      <ModePicker value={draft.mode} onChange={(mode) => update({ mode })} />

      {game.variants.length > 1 && (
        <Segmented
          label={game.variantHeading ?? 'Variant'}
          value={draft.variant}
          options={game.variants}
          onChange={(variant) => update({ variant })}
        />
      )}

      {game.allowFaceUp && (
        <>
          <Segmented
            label="Cards"
            value={draft.faceUp ? 'up' : 'down'}
            options={[
              { value: 'up', label: faceUpLabel(true) },
              { value: 'down', label: faceUpLabel(false) },
            ]}
            onChange={(v) => update({ faceUp: v === 'up' })}
          />
          <p className="-mt-2 mb-4 text-ink-soft">
            {draft.faceUp
              ? 'All cards are showing. Tap two that go together.'
              : 'Flip two cards at a time and remember where each one is.'}
          </p>
        </>
      )}

      <Segmented
        label="Difficulty"
        value={draft.difficulty}
        options={DIFFICULTY_ORDER.map((d) => ({
          value: d,
          label: capitalize(d),
        }))}
        onChange={(difficulty) => update({ difficulty })}
      />
      <p className="-mt-2 mb-4 text-ink-soft">
        {cardCount} cards.{hint ? ` ${hint}` : ''}
      </p>

      {draft.mode === 'timed' && (
        <p className="mb-4 rounded-xl bg-square-pale px-3 py-2">
          {topScore === undefined
            ? 'No top score yet for these choices.'
            : `Top score for these choices: ${topScore} ${topScore === 1 ? 'match' : 'matches'}.`}
        </p>
      )}

      <button
        type="button"
        onClick={() => onStart(draft)}
        className={`${primaryButton} mt-2 w-full`}
      >
        {START_LABELS[draft.mode]}
      </button>
    </Sheet>
  )
}

function ModePicker({
  value,
  onChange,
}: {
  value: Mode
  onChange: (mode: Mode) => void
}) {
  return (
    <fieldset className="mb-5">
      <legend className="mb-1.5 font-bold text-ink">
        How do you want to play?
      </legend>
      <div className="grid grid-cols-3 gap-2">
        {MODES.map((mode) => {
          const selected = mode === value
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(mode)}
              className={`flex min-h-20 flex-col items-center justify-center rounded-xl border-2 px-1.5 py-2 text-center transition focus:outline-none focus-visible:ring-4 focus-visible:ring-hex ${
                selected
                  ? 'border-rhombus bg-rhombus text-paper'
                  : 'border-track bg-paper text-ink active:bg-track'
              }`}
            >
              <span className="font-bold leading-tight">
                {MODE_LABELS[mode]}
              </span>
              <span
                className={`mt-1 text-sm leading-tight ${selected ? 'text-paper/85' : 'text-ink-soft'}`}
              >
                {MODE_HINTS[mode]}
              </span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
