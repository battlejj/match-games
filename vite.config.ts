import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackRouter } from '@tanstack/router-plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { thirdPartyNotices } from './vite-plugins/third-party-notices'

// public/sw.js must stay byte-for-byte identical across releases (see the
// comment at its top). If you really mean to change it, update this hash and
// accept that installed apps will pick up the new worker automatically.
const SW_SHA256 =
  'fdb00b7699cabb4e8c51f0b865a54a3ba63c5150d075c76beda8da25f6722591'

function sha256(data: Buffer | string) {
  return createHash('sha256').update(data).digest('hex')
}

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name)
    return entry.isDirectory() ? listFiles(full) : [full]
  })
}

/**
 * After each production build, writes dist/version.json listing every file
 * the app needs offline, with a version id derived from their contents. The
 * service worker downloads exactly these files when the user updates.
 */
function offlineVersionManifest(): Plugin {
  let outDir = 'dist'
  return {
    name: 'offline-version-manifest',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      // closeBundle also runs after a failed build (Vite empties outDir first,
      // so no index.html means nothing was written). Bail out so the original
      // error is the one reported.
      if (!existsSync(join(outDir, 'index.html'))) return
      const sw = readFileSync(join(outDir, 'sw.js'))
      if (sha256(sw) !== SW_SHA256) {
        throw new Error(
          `public/sw.js changed (sha256 ${sha256(sw)}). It must stay frozen so ` +
            'installed apps only update when the user asks. See vite.config.ts.',
        )
      }

      // GitHub Pages has no single-page-app fallback; serving index.html as
      // the 404 page makes deep links like /math work on a first visit.
      copyFileSync(join(outDir, 'index.html'), join(outDir, '404.html'))

      const skip = new Set(['sw.js', 'version.json', '404.html'])
      const files = listFiles(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter(
          (f) =>
            !skip.has(f) &&
            !f.endsWith('.map') &&
            !f.split('/').some((part) => part.startsWith('.')),
        )
        .sort()

      const hash = createHash('sha256')
      for (const f of files) {
        hash.update(f).update('\0').update(readFileSync(join(outDir, f)))
      }
      const manifest = {
        version: hash.digest('hex').slice(0, 12),
        built: new Date().toISOString(),
        files,
      }
      writeFileSync(
        join(outDir, 'version.json'),
        `${JSON.stringify(manifest, null, 2)}\n`,
      )
      this.info(`version.json: ${manifest.version} (${files.length} files)`)
    },
  }
}

const config = defineConfig({
  // GitHub Pages project sites live under /<repo>/; set BASE_PATH=/<repo>/.
  base: process.env.BASE_PATH ?? '/',
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    tailwindcss(),
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    viteReact(),
    // Tailwind isn't a bundled module, but its generated CSS ships in the app.
    thirdPartyNotices({
      appName: 'Match Games',
      appLicenseFile: 'LICENSE',
      alwaysInclude: ['tailwindcss'],
    }),
    offlineVersionManifest(),
  ],
})

export default config
