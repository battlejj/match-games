import { readdirSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, sep } from 'node:path'
import type { Plugin } from 'vite'

// Licenses whose terms are met by reproducing the license text (and any
// NOTICE file). Anything else fails the build so it gets a human look.
const ALLOWED = new Set([
  'MIT',
  'ISC',
  '0BSD',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  // Fonts (Andika). Bundling with software is allowed; the font can't be
  // sold on its own, and the license text must ship with it.
  'OFL-1.1',
])

interface PackageInfo {
  name: string
  version: string
  license: string
  homepage?: string
  licenseText: string
  noticeText?: string
}

const NODE_MODULES = `${sep}node_modules${sep}`

/** Package root for a bundled module path, or null if it isn't a dependency. */
function packageDirFor(moduleId: string): string | null {
  const id = moduleId.replace(/^\0/, '').split('?')[0]
  const at = id.lastIndexOf(NODE_MODULES)
  if (at === -1) return null
  const rest = id.slice(at + NODE_MODULES.length).split(sep)
  const nameParts = rest[0].startsWith('@') ? 2 : 1
  return (
    id.slice(0, at + NODE_MODULES.length) + rest.slice(0, nameParts).join(sep)
  )
}

function findFile(dir: string, pattern: RegExp) {
  const name = readdirSync(dir).find((f) => pattern.test(f))
  return name ? readFileSync(join(dir, name), 'utf8').trim() : undefined
}

function repoUrl(pkg: Record<string, unknown>): string | undefined {
  const repo = pkg.repository
  const raw =
    typeof repo === 'string'
      ? repo
      : (repo as { url?: string } | undefined)?.url
  if (!raw) return typeof pkg.homepage === 'string' ? pkg.homepage : undefined
  return raw
    .replace(/^git\+/, '')
    .replace(/^git:\/\//, 'https://')
    .replace(/\.git$/, '')
    .replace(/^github:/, 'https://github.com/')
}

function readPackage(dir: string): PackageInfo {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const license = typeof pkg.license === 'string' ? pkg.license : 'UNKNOWN'
  const licenseText = findFile(dir, /^licen[cs]e(\.(md|txt))?$/i)
  if (!ALLOWED.has(license)) {
    throw new Error(
      `${pkg.name}@${pkg.version} is licensed "${license}", which isn't on the ` +
        'allowlist in vite-plugins/third-party-notices.ts. Review its terms ' +
        'before adding it.',
    )
  }
  if (!licenseText) {
    throw new Error(
      `${pkg.name}@${pkg.version} (${license}) ships no license file to ` +
        'reproduce. Add its license text manually before shipping it.',
    )
  }
  return {
    name: pkg.name,
    version: pkg.version,
    license,
    homepage: repoUrl(pkg),
    licenseText,
    noticeText: findFile(dir, /^notice(\.(md|txt))?$/i),
  }
}

/**
 * Writes LICENSES.txt into the build: the app's own license, then the full
 * license text of every package bundled into the app, as MIT and similar
 * licenses require.
 */
export function thirdPartyNotices(options: {
  appName: string
  /** The app's own license file, relative to the project root. */
  appLicenseFile: string
  /**
   * Packages whose output reaches the app without being a bundled module
   * (e.g. tailwindcss, which generates the CSS).
   */
  alwaysInclude?: string[]
}): Plugin {
  const require = createRequire(import.meta.url)
  let root = process.cwd()
  return {
    name: 'third-party-notices',
    apply: 'build',
    configResolved(config) {
      root = config.root
    },
    generateBundle(_options, bundle) {
      const dirs = new Set<string>()
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue
        for (const id of output.moduleIds) {
          const dir = packageDirFor(id)
          if (dir) dirs.add(dir)
        }
      }
      for (const name of options.alwaysInclude ?? []) {
        dirs.add(dirname(require.resolve(`${name}/package.json`)))
      }

      const packages = [...dirs]
        .map(readPackage)
        .sort((a, b) => a.name.localeCompare(b.name))
      const rule = '='.repeat(78)
      const thin = '-'.repeat(78)
      const sections = packages.map((p) =>
        [
          rule,
          `${p.name} ${p.version}`,
          `License: ${p.license}`,
          ...(p.homepage ? [p.homepage] : []),
          thin,
          p.licenseText,
          ...(p.noticeText ? ['', 'NOTICE:', p.noticeText] : []),
        ].join('\n'),
      )
      const appLicense = readFileSync(
        join(root, options.appLicenseFile),
        'utf8',
      ).trim()

      this.emitFile({
        type: 'asset',
        fileName: 'LICENSES.txt',
        source: [
          `${options.appName}: licenses`,
          '',
          rule,
          options.appName,
          thin,
          appLicense,
          '',
          rule,
          'Third-party software',
          thin,
          'This app includes the open-source software listed below. Each',
          "package's copyright notice and license are reproduced in full.",
          '',
          ...packages.map((p) => `  - ${p.name} ${p.version} (${p.license})`),
          '',
          ...sections,
          '',
        ].join('\n'),
      })
      this.info(`LICENSES.txt: app + ${packages.length} third-party packages`)
    },
  }
}
