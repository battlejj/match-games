import { expect, test } from '@playwright/test'
import {
  advance,
  afterMiss,
  cardLabels,
  cards,
  choose,
  expectWin,
  mathPairs,
  openHomeSheet,
  openNewGame,
  parseMathLabel,
  solveFaceUpMath,
  solveMemoryBoard,
  startGame,
  stat,
  tapCard,
  wrongMathPair,
} from './helpers'

// Fake timers: tests jump past the clock, miss delays, and board deals.
test.beforeEach(async ({ page }) => {
  await page.clock.install()
})

const playAgain = (page: import('@playwright/test').Page) =>
  page.getByRole('button', { name: 'Play again' }).click()

test('home page links to both games and back', async ({ page }) => {
  await page.goto('./')
  await page.getByRole('link', { name: /Math Match/ }).click()
  await expect(page.getByRole('heading', { name: 'Math Match' })).toBeVisible()
  await page.getByRole('link', { name: 'All games' }).click()
  await page.getByRole('link', { name: /Monster Match/ }).click()
  await expect(
    page.getByRole('heading', { name: 'Monster Match' }),
  ).toBeVisible()
})

test.describe('Math Match', () => {
  test('defaults: practice, addition, medium, face up', async ({ page }) => {
    await page.goto('math')
    await expect(page.getByText('Practice: Add, Medium, Face up')).toBeVisible()
    await expect(cards(page)).toHaveCount(16)
    const labels = (await cardLabels(page)).map(parseMathLabel)
    expect(labels.filter((c) => c.kind === 'number')).toHaveLength(8)
  })

  test('solo win records a best score only on a real improvement', async ({
    page,
  }) => {
    await page.goto('math')
    await solveFaceUpMath(page, { misses: 2 })
    await expectWin(page)
    await expect(page.getByText('10 moves')).toBeVisible()
    await expect(page.getByText('New best!')).toBeVisible()

    await playAgain(page)
    await solveFaceUpMath(page, { misses: 2 }) // ties 10
    await expectWin(page)
    await expect(page.getByText('New best!')).toBeHidden()

    await playAgain(page)
    await expect(stat(page, 'Best')).toHaveText('10')
    await solveFaceUpMath(page) // 8 moves
    await expectWin(page)
    await expect(page.getByText('New best!')).toBeVisible()
    await playAgain(page)
    await expect(stat(page, 'Best')).toHaveText('8')
  })

  test('picks explain themselves and can be deselected', async ({ page }) => {
    await page.goto('math')
    const [[number, equation]] = await mathPairs(page)

    // Tapping a selected card again deselects it.
    await tapCard(page, number)
    await expect(cards(page).nth(number)).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await tapCard(page, number)
    await expect(cards(page).nth(number)).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    await expect(stat(page, 'Moves')).toHaveText('0')

    // Wrong equation: explained, counted, then deselected.
    const [n, wrong] = await wrongMathPair(page)
    await tapCard(page, n)
    await tapCard(page, wrong)
    const numberValue =
      (await cards(page).nth(n).getAttribute('aria-label')) ?? ''
    await expect(
      page.getByText(new RegExp(`= \\d+, not ${numberValue}$`)),
    ).toBeVisible()
    await expect(stat(page, 'Moves')).toHaveText('1')
    await afterMiss(page)
    await expect(cards(page).nth(n)).toHaveAttribute('aria-pressed', 'false')

    // Two numbers.
    const labels = (await cardLabels(page)).map(parseMathLabel)
    const numbers = labels.flatMap((c, i) => (c.kind === 'number' ? [i] : []))
    await tapCard(page, numbers[0])
    await tapCard(page, numbers[1])
    await expect(
      page.getByText('Two numbers: match a number with an equation'),
    ).toBeVisible()
    await afterMiss(page)

    // A correct pair.
    await tapCard(page, number)
    await tapCard(page, equation)
    await expect(page.getByText(/ = \d+ ✓$/)).toBeVisible()
    await expect(cards(page).nth(number)).toHaveAttribute(
      'aria-label',
      /, matched$/,
    )
    await expect(cards(page).nth(equation)).toHaveAttribute(
      'aria-label',
      /, matched$/,
    )
    await expect(stat(page, 'Pairs')).toHaveText('1/8')
  })

  test('face-down memory game', async ({ page }) => {
    await page.goto('math')
    await startGame(page, {
      cards: 'Face down',
      operation: 'Multiply',
      difficulty: 'Easy',
    })
    await expect(
      page.getByText('Practice: Multiply, Easy, Face down'),
    ).toBeVisible()
    expect(new Set(await cardLabels(page))).toEqual(new Set(['Hidden card']))

    // Flip neighboring cards until a pair doesn't match (an accidental match
    // just stays matched), then check that both cards flip back over.
    let missed: [number, number] | null = null
    for (let i = 0; i < 12 && !missed; i += 2) {
      await tapCard(page, i)
      await tapCard(page, i + 1)
      const label =
        (await cards(page)
          .nth(i + 1)
          .getAttribute('aria-label')) ?? ''
      if (!label.endsWith(', matched')) missed = [i, i + 1]
    }
    if (!missed) throw new Error('every neighboring pair matched')
    await expect(cards(page).nth(missed[0])).not.toHaveAttribute(
      'aria-label',
      'Hidden card',
    )
    await afterMiss(page)
    await expect(cards(page).nth(missed[0])).toHaveAttribute(
      'aria-label',
      'Hidden card',
    )
    await expect(cards(page).nth(missed[1])).toHaveAttribute(
      'aria-label',
      'Hidden card',
    )

    await solveMemoryBoard(page, (label) => String(parseMathLabel(label).value))
    await expectWin(page)
  })

  test('two players: a miss passes the turn, a match keeps it', async ({
    page,
  }) => {
    await page.goto('math')
    await startGame(page, { mode: 'Two players' })
    await expect(
      page.getByText('Two players: Add, Medium, Face up'),
    ).toBeVisible()
    const turnOf = (player: string) =>
      page.locator('div', { hasText: new RegExp(`^${player}Your turn$`) })

    await expect(turnOf('Player 1')).toBeVisible()
    const [n, wrong] = await wrongMathPair(page)
    await tapCard(page, n)
    await tapCard(page, wrong)
    await afterMiss(page)
    await expect(turnOf('Player 2')).toBeVisible()

    // Player 2 matches everything without giving up the turn.
    for (const [i, j] of await mathPairs(page)) {
      await tapCard(page, i)
      await tapCard(page, j)
      await expect(cards(page).nth(j)).toHaveAttribute(
        'aria-label',
        /, matched$/,
      )
    }
    await expect(page.getByText('Player 2 wins!')).toBeVisible()
    await expect(page.getByText('0 – 8', { exact: true })).toBeVisible()
    await expect(page.getByText(/^9 moves in /)).toBeVisible()
    await expect(stat(page, 'Best')).toHaveCount(0) // no best scores in 2-player
  })

  test('new game: how to play comes first, other choices stay put', async ({
    page,
  }) => {
    await page.goto('math')
    const sheet = await openNewGame(page)
    const mode = sheet.getByRole('group', { name: 'How do you want to play?' })
    await expect(mode.getByRole('button', { pressed: true })).toHaveText(
      /^Practice/,
    )
    const start = sheet.getByRole('button', { name: /^Start / })
    await expect(start).toHaveText('Start practice')
    await expect(sheet.getByText('16 cards. Sums up to 20.')).toBeVisible()

    // Board choices survive every mode change.
    await choose(sheet, 'What to practice', 'Multiply')
    await choose(sheet, 'Difficulty', 'Hard')
    await expect(
      sheet.getByText(/^24 cards\. The 1–\d+ times tables\.$/),
    ).toBeVisible()
    for (const [name, label] of [
      ['Two players', 'Start two-player game'],
      ['Beat the clock', 'Start 2-minute game'],
      ['Practice', 'Start practice'],
    ]) {
      await choose(sheet, 'How do you want to play?', new RegExp(`^${name}`))
      await expect(start).toHaveText(label)
      for (const [group, value] of [
        ['What to practice', 'Multiply'],
        ['Difficulty', 'Hard'],
        ['Cards', 'Face up'],
      ]) {
        await expect(
          sheet.getByRole('group', { name: group }).getByRole('button', {
            pressed: true,
          }),
        ).toHaveText(value)
      }
    }

    // Only Beat the clock has top scores.
    await expect(sheet.getByText(/top score/i)).toHaveCount(0)
    await choose(sheet, 'How do you want to play?', /^Beat the clock/)
    await expect(
      sheet.getByText('No top score yet for these choices.'),
    ).toBeVisible()

    // Closing changes nothing; starting applies every choice.
    await sheet.getByRole('button', { name: 'Close' }).click()
    await expect(page.getByText('Practice: Add, Medium, Face up')).toBeVisible()
    await startGame(page, {
      mode: 'Beat the clock',
      operation: 'Multiply',
      difficulty: 'Hard',
    })
    await expect(
      page.getByText('Beat the clock: Multiply, Hard, Face up'),
    ).toBeVisible()
    await expect(cards(page)).toHaveCount(24)
  })

  test('timed: boards keep coming, then the score can be saved', async ({
    page,
  }) => {
    await page.goto('math')
    await startGame(page, { mode: 'Beat the clock' })
    await expect(
      page.getByText('Tap a card to start the 2-minute clock.'),
    ).toBeVisible()
    await expect(stat(page, 'Time left')).toHaveText('2:00')

    await solveFaceUpMath(page)
    await advance(page, 600) // next board is dealt
    await expect(stat(page, 'Board')).toHaveText('2')
    await expect(stat(page, 'Matches')).toHaveText('8')
    await expect(cards(page).first()).not.toHaveAttribute(
      'aria-label',
      /, matched$/,
    )

    const [[i, j]] = await mathPairs(page)
    await tapCard(page, i)
    await tapCard(page, j)
    await expect(stat(page, 'Matches')).toHaveText('9')

    await advance(page, 125_000)
    await expect(
      page.getByRole('heading', { name: "Time's up!" }),
    ).toBeVisible()
    const summary = page.locator('dl')
    for (const [label, value] of [
      ['Boards cleared', '1'],
      ['Moves', '9'],
      ['Accuracy', '100%'],
    ]) {
      await expect(summary.locator('div', { hasText: label })).toContainText(
        value,
      )
    }
    await expect(page.getByText('You made the leaderboard: #1!')).toBeVisible()
    await page.getByLabel('Name for the leaderboard').fill('Ada')
    await page.getByRole('button', { name: 'Save score' }).click()
    await expect(page.locator('li', { hasText: 'Ada' })).toBeVisible()

    await expect(
      page.getByText('Top scores: Add, Medium, Face up'),
    ).toBeVisible()

    await playAgain(page)
    await expect(stat(page, 'Top')).toHaveText('9')
    const sheet = await openNewGame(page)
    await expect(
      sheet.getByText('Top score for these choices: 9 matches.'),
    ).toBeVisible()
    await page.keyboard.press('Escape')

    const scores = await openHomeSheet(page, 'Top scores')
    await expect(scores.locator('li', { hasText: 'Ada' })).toContainText('9')
  })

  test('timed: declining keeps the score off the leaderboard', async ({
    page,
  }) => {
    await page.goto('math')
    await startGame(page, { mode: 'Beat the clock' })
    const [[i, j]] = await mathPairs(page)
    await tapCard(page, i)
    await tapCard(page, j)
    await advance(page, 125_000)
    await page.getByRole('button', { name: 'No thanks' }).click()
    await expect(
      page.getByText('Score not saved to the leaderboard.'),
    ).toBeVisible()
    await expect(
      page.getByText('No scores yet. Play Beat the clock to set one!'),
    ).toBeVisible()
  })

  test('resetting leaderboards needs confirmation and spares other games', async ({
    page,
  }) => {
    await page.goto('math')
    await page.evaluate(() =>
      localStorage.setItem(
        'match-leaderboards-v3',
        JSON.stringify({
          'math:addition:medium:up': [
            {
              id: 'a',
              name: 'Zed',
              matches: 30,
              moves: 40,
              boards: 3,
              date: '2026-11-01T00:00:00Z',
            },
          ],
          'monsters:all:medium:down': [
            {
              id: 'b',
              name: 'Mo',
              matches: 5,
              moves: 9,
              boards: 0,
              date: '2026-11-01T00:00:00Z',
            },
          ],
        }),
      ),
    )
    const sheet = await openHomeSheet(page, 'Top scores')
    await expect(
      sheet
        .getByRole('group', { name: 'Game' })
        .getByRole('button', { pressed: true }),
    ).toHaveText('Math Match')
    await expect(page.locator('li', { hasText: 'Zed' })).toBeVisible()
    await choose(sheet, 'Game', 'Monster Match')
    await expect(page.locator('li', { hasText: 'Mo' })).toBeVisible()
    await choose(sheet, 'Game', 'Math Match')

    await page.getByRole('button', { name: 'Reset leaderboards' }).click()
    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.locator('li', { hasText: 'Zed' })).toBeVisible()

    await page.getByRole('button', { name: 'Reset leaderboards' }).click()
    await page.getByRole('button', { name: 'Yes, reset' }).click()
    await expect(page.getByText('Leaderboards reset.')).toBeVisible()
    await expect(page.locator('li', { hasText: 'Zed' })).toHaveCount(0)
    const left = await page.evaluate(() =>
      Object.keys(
        JSON.parse(localStorage.getItem('match-leaderboards-v3') ?? '{}'),
      ),
    )
    expect(left).toEqual(['monsters:all:medium:down'])
  })
})

test.describe('Monster Match', () => {
  test('memory game plays to a win; no face-up option', async ({ page }) => {
    await page.goto('monsters')
    await expect(page.getByText('Practice: Medium')).toBeVisible()
    const sheet = await openNewGame(page)
    await expect(sheet.getByRole('group')).toHaveCount(2) // mode, difficulty
    await expect(sheet.getByText('16 cards.')).toBeVisible()
    await page.keyboard.press('Escape')

    expect(new Set(await cardLabels(page))).toEqual(new Set(['Hidden card']))
    await solveMemoryBoard(page)
    await expectWin(page)
  })
})
