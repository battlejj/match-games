import { useState } from 'react'
import { Segmented } from './controls'
import { capitalize, faceUpLabel, MODE_LABELS } from './display'
import { boardKey, defaultSettings, type GameOptions } from './engine'
import { LeaderboardList } from './LeaderboardList'
import {
  LEADERBOARD_SIZE,
  resetLeaderboards,
  useHasLeaderboardEntries,
  useLeaderboard,
} from './leaderboard'
import { DIFFICULTY_ORDER } from './types'

/**
 * Top Beat the clock scores for one game, with filters for each set of
 * choices and a confirmed reset.
 */
export function LeaderboardsPanel({ game }: { game: GameOptions }) {
  const [view, setView] = useState(() => {
    const { variant, difficulty, faceUp } = defaultSettings(game)
    return { variant, difficulty, faceUp }
  })
  const [confirming, setConfirming] = useState(false)
  const [resetDone, setResetDone] = useState(false)
  const entries = useLeaderboard(boardKey(game.id, view))
  const anyScores = useHasLeaderboardEntries(game.id)

  return (
    <>
      <p className="mb-4 text-ink-soft">
        The top {LEADERBOARD_SIZE} {MODE_LABELS.timed} scores for each set of
        choices, saved on this device.
      </p>
      {game.variants.length > 1 && (
        <Segmented
          label={game.variantHeading ?? 'Variant'}
          value={view.variant}
          options={game.variants}
          onChange={(variant) => setView((v) => ({ ...v, variant }))}
        />
      )}
      <Segmented
        label="Difficulty"
        value={view.difficulty}
        options={DIFFICULTY_ORDER.map((d) => ({
          value: d,
          label: capitalize(d),
        }))}
        onChange={(difficulty) => setView((v) => ({ ...v, difficulty }))}
      />
      {game.allowFaceUp && (
        <Segmented
          label="Cards"
          value={view.faceUp ? 'up' : 'down'}
          options={[
            { value: 'up', label: faceUpLabel(true) },
            { value: 'down', label: faceUpLabel(false) },
          ]}
          onChange={(c) => setView((v) => ({ ...v, faceUp: c === 'up' }))}
        />
      )}

      <LeaderboardList entries={entries} />

      <div className="mt-6 border-t-2 border-track pt-4">
        {confirming ? (
          <div
            role="alertdialog"
            aria-labelledby="reset-title"
            aria-describedby="reset-desc"
            className="rounded-xl bg-trapezoid-pale p-4"
          >
            <p id="reset-title" className="text-lg font-bold">
              Reset all {game.title} leaderboards?
            </p>
            <p id="reset-desc" className="mt-1">
              This permanently deletes every saved {MODE_LABELS.timed} score for
              this game, across all settings. It can't be undone.
            </p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                // biome-ignore lint/a11y/noAutofocus: focus the safe choice in a destructive confirmation
                autoFocus
                onClick={() => setConfirming(false)}
                className="min-h-11 flex-1 rounded-lg bg-paper font-bold active:bg-track"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  resetLeaderboards(game.id)
                  setConfirming(false)
                  setResetDone(true)
                }}
                className="min-h-11 flex-1 rounded-lg bg-trapezoid font-bold text-paper active:brightness-90"
              >
                Yes, reset
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={!anyScores}
              onClick={() => {
                setResetDone(false)
                setConfirming(true)
              }}
              className="min-h-11 w-full rounded-xl border-2 border-trapezoid font-bold text-trapezoid transition active:bg-trapezoid-pale disabled:opacity-40"
            >
              Reset leaderboards
            </button>
            {resetDone && (
              <output className="mt-2 block text-center text-ink-soft">
                Leaderboards reset.
              </output>
            )}
          </>
        )}
      </div>
    </>
  )
}
