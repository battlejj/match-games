# Match Games

Matching games for kids, built as an installable, offline-capable web app
(PWA):

- **Math Match**: pair each number with an equation that equals it. Addition,
  subtraction, multiplication, or a mix, with face-up or face-down (memory)
  cards.
- **Monster Match**: a memory game with original creatures.

Both games support solo, two-player, and 2-minute timed play, with local
leaderboards for timed games. Everything is generated in the app. It makes no
network requests after it's installed.

## Development

```bash
npm install
npm run dev      # http://localhost:3000
npm run check    # Biome lint + format check
npm run typecheck
npm run build    # production build in dist/
npm run preview  # serve the production build locally
```

### Tests

```bash
npm test                          # unit tests (Vitest)
npx playwright install chromium   # once, for the end-to-end tests
npm run test:e2e                  # end-to-end tests (Playwright)
```

- Unit tests sit next to the code they test (`*.test.ts`). They cover the
  game rules (`src/match/engine.ts`), the math generator, leaderboards, best
  scores, and storage.
- End-to-end tests in `e2e/` build the app under `/match-games/` and serve it
  the way GitHub Pages does. `e2e/server.mjs` can also simulate the site being
  down or a new release being published. They play real games on a phone-sized
  screen with a fake clock, and test offline use and manual updates.
- CI (`.github/workflows/deploy.yml`) runs all checks and tests on every push to `main`
  and every pull request. It only deploys from `main`, and only if they pass.

Offline support only runs in production builds (`npm run build` +
`npm run preview`), not under `npm run dev`.

## Project layout

| Path | What it is |
|---|---|
| `src/match/engine.ts` | Game rules as a pure reducer: taps, misses, turns, timing |
| `src/match/MatchGame.tsx` | Game screen: connects the reducer to timers and the UI |
| `src/match/display.ts` | The names shown for each choice ("Beat the clock", "Face down", ...) |
| `src/match/` (other files) | Cards, the New game sheet, results, leaderboards, storage |
| `src/games/math.tsx` | Math Match: generates number/equation pairs |
| `src/games/monsters.tsx` | Monster Match: creature list and card art |
| `src/routes/` | Pages: `/` (game picker), `/math`, `/monsters` |
| `src/styles.css` | Colors and what each one means, the font, card backs |
| `src/pwa.ts` | Service worker registration and the update check |
| `public/sw.js` | Service worker. **Never edit it; see below.** |
| `vite-plugins/` | Build step that writes `LICENSES.txt` |
| `vite.config.ts` | Also writes `version.json` for offline updates |

To add a game, write a `GameDefinition` (see `src/match/types.ts`) and give it
a route that renders `<MatchGame game={...} />`.

## Offline support and updates

Installed copies of the app **never update on their own**. They only update
when the user taps **About this app → Check for updates** on the home screen.

- Each build writes `dist/version.json`: a content-based version id and the
  list of every file the app needs.
- On first launch, `public/sw.js` saves those files and serves the app from
  that copy from then on.
- Checking for updates downloads the newest `version.json`. If the version
  differs, the service worker downloads the whole new version, switches to it,
  and deletes the old one. If anything fails, the current version keeps
  working.

**Do not edit `public/sw.js`.** Browsers re-download that file in the
background and install it automatically if a single byte changes, which would
bypass the user's choice. The build fails if its hash changes (see
`SW_SHA256` in `vite.config.ts`). If it truly must change, update that hash
and accept that installed apps will pick up the new worker automatically.

## Deploying to GitHub Pages

`.github/workflows/deploy.yml` builds and publishes on every push to `main`.
One-time setup: in the repository, go to **Settings → Pages → Source** and
choose **GitHub Actions**.

Publishing makes a new version available. Installed apps get it when the user
checks for updates.

To install on iPhone or iPad, open the site in Safari, tap **Share → Add to
Home Screen**, then open the app from the Home Screen once while online so it
can save itself for offline use.

## Licenses

The app is MIT licensed (see `LICENSE`). Each build writes `LICENSES.txt`
with the app's license and the full license text of every bundled
third-party package; the app shows it under **About this app → Licenses** on the home screen.
The build fails if a bundled package has a license outside the permissive
allowlist in `vite-plugins/third-party-notices.ts`.
