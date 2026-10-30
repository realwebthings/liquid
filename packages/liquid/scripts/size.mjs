// Cost of each export when it is the ONLY thing an app imports, bundled and minified
// the way a consumer would (react external). Tree-shaking has to work for this to hold.
import { build } from 'esbuild'
import { gzipSync } from 'node:zlib'

const dist = new URL('../dist/', import.meta.url).pathname
const entry = (names, file = 'index.js') => `export { ${names} } from '${dist}${file}'`

// [label, source, gzip budget in bytes]
const cases = [
  ['create', entry('create'), 365],
  ['createStore (vanilla, no React)', entry('createStore', 'vanilla.js'), 235],
  ['watch', entry('createStore, watch', 'vanilla.js'), 290],
  ['useStore + createStore', entry('useStore, createStore'), 355],
  ['useShallow', entry('useShallow'), 345],
  ['useHydrated', entry('useHydrated'), 225],
  ['createStoreContext', entry('createStoreContext'), 495],
  ['shallow', entry('shallow', 'shallow.js'), 215],
  ['persist (sync)', entry('persist', 'persist.js'), 460],
  ['persistAsync', entry('persistAsync', 'persist-async.js'), 490],
  ['produce / mutate', entry('mutate', 'mutable.js'), 525],
  ['crossTab',  entry('crossTab', 'cross-tab.js'), 265],
  ['create + persist', `${entry('create')}\n${entry('persist', 'persist.js')}`, 755],
]

let failed = false
console.log('export'.padEnd(34), 'min'.padStart(7), 'gzip'.padStart(7), '  budget')
for (const [label, contents, max] of cases) {
  const out = await build({
    stdin: { contents, resolveDir: dist, loader: 'js' },
    bundle: true,
    minify: true,
    format: 'esm',
    external: ['react', 'react/jsx-runtime'],
    write: false,
    logLevel: 'error',
  })
  const code = out.outputFiles[0].contents
  const gz = gzipSync(code, { level: 9 }).length
  const over = gz > max
  failed ||= over
  console.log(
    label.padEnd(34),
    `${code.length} B`.padStart(7),
    `${gz} B`.padStart(7),
    `  ${max} B`,
    over ? ' OVER' : '',
  )
}
if (failed) process.exit(1)
