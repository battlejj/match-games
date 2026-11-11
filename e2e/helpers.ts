import { expect, type Locator, type Page } from '@playwright/test'

export type ServerMode = 'up' | 'v2' | 'down' | 'v2-no-version-json'

/** Switches the e2e server (see e2e/server.mjs). */
export async function setServer(page: Page, mode: ServerMode) {
  await page.request.get(`http://localhost:4173/__control?mode=${mode}`)
}

/** Paths requested since the last call. */
export async function serverRequests(page: Page): Promise<string[]> {
  return (await page.request.get('http://localhost:4173/__requests')).json()
}

export const cards = (page: Page) => page.locator('.card-scene')
export const tapCard = (page: Page, index: number) =>
  cards(page).nth(index).click()

export async function cardLabels(page: Page): Promise<string[]> {
  return cards(page).evaluateAll((els) =>
    els.map((el) => el.getAttribute('aria-label') ?? ''),
  )
}

/** The value shown under a stat label, e.g. stat(page, 'Moves'). */
export const stat = (page: Page, label: string) =>
  page.locator(`div:text-is("${label}") + div`)

/** Advances the app's clock (tests call page.clock.install() first). */
export const advance = (page: Page, ms: number) => page.clock.runFor(ms)

/** Waits out the pause after a wrong pair. */
export const afterMiss = (page: Page) => advance(page, 1200)

/** Opens the New game sheet from the game screen. */
export async function openNewGame(page: Page) {
  await page.getByRole('button', { name: 'New game', exact: true }).click()
  return page.getByRole('dialog', { name: 'New game' })
}

/** Opens one of the home screen's sheets ("Top scores", "About this app"). */
export async function openHomeSheet(
  page: Page,
  name: 'Top scores' | 'About this app',
) {
  await page.goto('./')
  await page.getByRole('button', { name }).click()
  return page.getByRole('dialog', { name })
}

export type Mode = 'Practice' | 'Beat the clock' | 'Two players'

interface GameOptions {
  mode?: Mode
  operation?: 'Add' | 'Subtract' | 'Multiply' | 'Mixed'
  cards?: 'Face up' | 'Face down'
  difficulty?: 'Easy' | 'Medium' | 'Hard'
}

/** Picks an option in a labeled group, e.g. choose(sheet, 'Cards', 'Face up'). */
export const choose = (
  scope: Page | Locator,
  group: string,
  name: string | RegExp,
) =>
  scope
    .getByRole('group', { name: group })
    .getByRole('button', { name })
    .click()

/** Starts a new game through the New game sheet. */
export async function startGame(page: Page, options: GameOptions) {
  const sheet = await openNewGame(page)
  if (options.mode)
    await choose(
      sheet,
      'How do you want to play?',
      new RegExp(`^${options.mode}`),
    )
  if (options.operation)
    await choose(sheet, 'What to practice', options.operation)
  if (options.cards) await choose(sheet, 'Cards', options.cards)
  if (options.difficulty) await choose(sheet, 'Difficulty', options.difficulty)
  await sheet.getByRole('button', { name: /^Start / }).click()
}

// --- Math boards (face up) ----------------------------------------------

type MathCard = { kind: 'number' | 'equation'; value: number }

/** Parses a math card's accessible label: "15" or "7 plus 8". */
export function parseMathLabel(label: string): MathCard {
  const text = label.replace(/, matched$/, '')
  const m = text.match(/^(\d+) (plus|minus|times) (\d+)$/)
  if (!m) return { kind: 'number', value: Number(text) }
  const [a, b] = [Number(m[1]), Number(m[3])]
  const value = m[2] === 'plus' ? a + b : m[2] === 'minus' ? a - b : a * b
  return { kind: 'equation', value }
}

/** Index pairs [number, equation] for every unmatched pair on the board. */
export async function mathPairs(page: Page): Promise<[number, number][]> {
  const labels = await cardLabels(page)
  const parsed = labels.map(parseMathLabel)
  const pairs: [number, number][] = []
  parsed.forEach((card, i) => {
    if (card.kind !== 'number' || labels[i].endsWith(', matched')) return
    const j = parsed.findIndex(
      (c, k) =>
        c.kind === 'equation' &&
        c.value === card.value &&
        !labels[k].endsWith(', matched'),
    )
    pairs.push([i, j])
  })
  return pairs
}

/** A wrong [number, equation] pair on a face-up math board. */
export async function wrongMathPair(page: Page): Promise<[number, number]> {
  const labels = await cardLabels(page)
  const parsed = labels.map(parseMathLabel)
  const n = parsed.findIndex((c) => c.kind === 'number')
  const e = parsed.findIndex(
    (c) => c.kind === 'equation' && c.value !== parsed[n].value,
  )
  return [n, e]
}

/** Solves a face-up math board, after `misses` deliberate wrong pairs. */
export async function solveFaceUpMath(page: Page, { misses = 0 } = {}) {
  for (let k = 0; k < misses; k++) {
    const [n, e] = await wrongMathPair(page)
    await tapCard(page, n)
    await tapCard(page, e)
    await afterMiss(page)
  }
  for (const [i, j] of await mathPairs(page)) {
    await tapCard(page, i)
    await tapCard(page, j)
  }
}

// --- Memory boards (face down) ------------------------------------------

/**
 * Solves a face-down board the way a player with perfect memory would:
 * flip unknown cards, remember what they were, and match known pairs.
 * `pairKey` maps a card's label to what pairs it ("8" and "4 times 2" both
 * map to 8 in Math Match); by default identical labels pair.
 */
export async function solveMemoryBoard(
  page: Page,
  pairKey: (label: string) => string = (label) => label,
) {
  const labels = await cardLabels(page)
  const count = labels.length
  const key: (string | null)[] = Array(count).fill(null)
  const matched = new Set<number>()
  const unmark = (label: string) => label.replace(/, matched$/, '')
  // Cards matched before the solver started stay out of play.
  labels.forEach((label, i) => {
    if (!label.endsWith(', matched')) return
    key[i] = pairKey(unmark(label))
    matched.add(i)
  })
  /** Flips a card; returns whether that completed a match. */
  const flip = async (i: number) => {
    await tapCard(page, i)
    const label = (await cards(page).nth(i).getAttribute('aria-label')) ?? ''
    key[i] = pairKey(unmark(label))
    return label.endsWith(', matched')
  }
  const knownPartner = (i: number) =>
    key.findIndex((k, j) => j !== i && k === key[i] && !matched.has(j))
  const nextUnknown = () =>
    key.findIndex((k, j) => k === null && !matched.has(j))

  while (matched.size < count) {
    // A pair whose cards we've both already seen.
    const a = key.findIndex(
      (k, i) => k !== null && !matched.has(i) && knownPartner(i) !== -1,
    )
    if (a !== -1) {
      const b = knownPartner(a)
      await flip(a)
      if (!(await flip(b))) throw new Error(`cards ${a} and ${b} should match`)
      matched.add(a).add(b)
      continue
    }
    const i = nextUnknown()
    await flip(i)
    const partner = knownPartner(i)
    const j = partner !== -1 ? partner : nextUnknown()
    if (await flip(j)) {
      matched.add(i).add(j)
    } else {
      await afterMiss(page)
    }
  }
}

export async function expectWin(page: Page) {
  await expect(page.getByText('You matched them all!')).toBeVisible()
}
