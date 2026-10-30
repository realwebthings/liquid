// Public API guard. The files in api/ are the released surface: every export name of every
// entry, and every emitted .d.ts. The build fails when dist differs from them.
//   npm run api         compare (fails on any difference)
//   npm run api:update  accept the current dist as the new surface (do this deliberately)
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'

const dist = new URL('../dist/', import.meta.url)
const api = new URL('../api/', import.meta.url)
const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const entries = Object.keys(pkg.exports).map((k) => (k === '.' ? 'index' : k.slice(2)))

const names = {}
for (const e of entries) names[e] = Object.keys(await import(new URL(`${e}.js`, dist))).sort()
const types = Object.fromEntries(
  readdirSync(dist).filter((f) => f.endsWith('.d.ts')).sort().map((f) => [f, readFileSync(new URL(f, dist), 'utf8')]),
)

if (process.argv.includes('--update')) {
  rmSync(api, { recursive: true, force: true })
  mkdirSync(api, { recursive: true })
  writeFileSync(new URL('exports.json', api), JSON.stringify(names, null, 2) + '\n')
  for (const [f, text] of Object.entries(types)) writeFileSync(new URL(f, api), text)
  console.log(`api snapshot updated: ${entries.length} entries, ${Object.keys(types).length} type files`)
  process.exit(0)
}

let oldNames, oldTypes
try {
  oldNames = JSON.parse(readFileSync(new URL('exports.json', api), 'utf8'))
  oldTypes = Object.fromEntries(
    readdirSync(api).filter((f) => f.endsWith('.d.ts')).map((f) => [f, readFileSync(new URL(f, api), 'utf8')]),
  )
} catch {
  console.error('no api snapshot yet: run `npm run api:update`')
  process.exit(1)
}

const breaking = []
const additive = []
for (const e of new Set([...Object.keys(oldNames), ...Object.keys(names)])) {
  for (const n of oldNames[e] ?? []) if (!(names[e] ?? []).includes(n)) breaking.push(`removed export \`${n}\` from liquid${e === 'index' ? '' : '/' + e}`)
  for (const n of names[e] ?? []) if (!(oldNames[e] ?? []).includes(n)) additive.push(`new export \`${n}\` in liquid${e === 'index' ? '' : '/' + e}`)
}
for (const f of new Set([...Object.keys(oldTypes), ...Object.keys(types)])) {
  const a = oldTypes[f], b = types[f]
  if (a === b) continue
  if (b === undefined) { breaking.push(`type file ${f} removed`); continue }
  if (a === undefined) { additive.push(`type file ${f} added`); continue }
  const A = new Set(a.split('\n')), B = new Set(b.split('\n'))
  for (const l of A) if (!B.has(l) && l.trim()) breaking.push(`${f}: changed or removed: ${l.trim()}`)
  for (const l of B) if (!A.has(l) && l.trim()) additive.push(`${f}: added: ${l.trim()}`)
}

if (!breaking.length && !additive.length) {
  console.log(`api surface unchanged (${entries.length} entries)`)
  process.exit(0)
}
if (breaking.length) {
  console.error('BREAKING (removed or changed). A release with these needs a new major version:')
  for (const b of breaking) console.error('  - ' + b)
}
if (additive.length) {
  console.error('Additive:')
  for (const a of additive) console.error('  + ' + a)
}
console.error('If intended, run `npm run api:update` and record it in CHANGELOG.md.')
process.exit(1)
