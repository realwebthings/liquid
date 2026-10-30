// tsc emits extensionless imports in .d.ts, which Node16/NodeNext consumers can't
// resolve. Rewrite them with explicit extensions and emit a .d.cts twin for CJS.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const dir = new URL('../dist/', import.meta.url)
for (const f of readdirSync(dir).filter((f) => f.endsWith('.d.ts'))) {
  const src = readFileSync(new URL(f, dir), 'utf8')
  const rewrite = (ext) => src.replace(/from '\.\/([\w-]+)'/g, `from './$1.${ext}'`)
  writeFileSync(new URL(f, dir), rewrite('js'))
  writeFileSync(new URL(f.replace(/\.d\.ts$/, '.d.cts'), dir), rewrite('cjs'))
}
