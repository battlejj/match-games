import { expect, type Page, test } from '@playwright/test'
import { cards, openHomeSheet, serverRequests, setServer } from './helpers'

// The lifecycle of an installed app: first install, site down, new release
// published (ignored until asked), manual update, failed update checks.
// One long test, because each step depends on the state the last one left.

const heading = (page: Page) => page.getByRole('heading', { level: 1 })
const build = (page: Page) =>
  page.evaluate(
    () =>
      document
        .querySelector('meta[name="e2e-build"]')
        ?.getAttribute('content') ?? 'v1',
  )
const installedVersion = (page: Page) =>
  page
    .getByText(/^Version /)
    .locator('code')
    .textContent()

const openAbout = (page: Page) => openHomeSheet(page, 'About this app')

async function checkForUpdates(page: Page) {
  await openAbout(page)
  await expect(page.getByText('Ready to play offline')).toBeVisible()
  await page.getByRole('button', { name: 'Check for updates' }).click()
}

test.beforeEach(async ({ page }) => {
  await setServer(page, 'up')
})
test.afterEach(async ({ page }) => {
  await setServer(page, 'up')
})

test('offline support and manual-only updates', async ({ page }) => {
  await test.step('first visit installs the app for offline use', async () => {
    await page.goto('math') // deep link, served via 404.html like GitHub Pages
    await expect(heading(page)).toHaveText('Math Match')
    await page.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
    )
    await openAbout(page)
    await expect(page.getByText('Ready to play offline')).toBeVisible()
    await page.evaluate(() => localStorage.setItem('match-player-name', 'Ada'))
  })

  await test.step('site down: every page still works with no requests', async () => {
    await setServer(page, 'down')
    await serverRequests(page) // reset the log
    for (const [path, title] of [
      ['math', 'Math Match'],
      ['monsters', 'Monster Match'],
      ['', 'Match Games'],
    ]) {
      await page.goto(path)
      await expect(heading(page)).toHaveText(title)
    }
    await page.goto('math')
    await expect(cards(page)).toHaveCount(16)
    const requests = (await serverRequests(page)).filter(
      (p) => !p.endsWith('/sw.js'),
    )
    expect(requests).toEqual([])
  })

  await test.step('new release published: the app ignores it on its own', async () => {
    await setServer(page, 'v2')
    for (let i = 0; i < 3; i++) await page.reload()
    // Force the browser's own background check, as browsers do periodically.
    const worker = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.update()
      return { waiting: !!reg?.waiting, installing: !!reg?.installing }
    })
    expect(worker).toEqual({ waiting: false, installing: false })
    await page.reload()
    expect(await build(page)).toBe('v1')
  })

  const v1 = await test.step('read the installed version', async () => {
    await openAbout(page)
    return installedVersion(page)
  })

  await test.step('"Check for updates" installs the release', async () => {
    // The About sheet is still open from the last step.
    await expect(page.getByText('Ready to play offline')).toBeVisible()
    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Check for updates' }).click()
    await reloaded
    expect(await build(page)).toBe('v2')
    expect(
      await page.evaluate(() => localStorage.getItem('match-player-name')),
    ).toBe('Ada')
    const appCaches = await page.evaluate(async () =>
      (await caches.keys()).filter((k) => k.startsWith('match-app-')),
    )
    expect(appCaches).toHaveLength(1)
    await openAbout(page)
    expect(await installedVersion(page)).toBe(`${v1}-v2`)
  })

  await test.step('checking again reports the latest version', async () => {
    await page.getByRole('button', { name: 'Check for updates' }).click()
    await expect(page.getByText('You have the latest version.')).toBeVisible()
  })

  await test.step('the new version works offline', async () => {
    await setServer(page, 'down')
    await page.goto('math')
    expect(await build(page)).toBe('v2')
    await expect(heading(page)).toHaveText('Math Match')
  })

  await test.step('failed checks leave the app working', async () => {
    await checkForUpdates(page)
    await expect(page.locator('output')).toHaveText(
      'Update server returned 503. Your current version still works.',
    )
    await setServer(page, 'v2-no-version-json')
    await page.reload()
    await checkForUpdates(page)
    await expect(page.locator('output')).toContainText('returned 404')
    await page.reload()
    expect(await build(page)).toBe('v2')
  })

  await test.step('licenses are available offline', async () => {
    await setServer(page, 'down')
    await page.reload()
    await openAbout(page)
    await page.getByRole('button', { name: 'Licenses' }).click()
    const licenses = page.locator('pre')
    await expect(licenses).toContainText('MIT License')
    await expect(licenses).toContainText('Copyright (c) Meta Platforms')
    await expect(licenses).toContainText('tailwindcss')
  })
})
