import { defineConfig } from 'tsup'

const shared = {
  format: ['esm', 'cjs'] as ('esm' | 'cjs')[],
  minify: true,
  external: ['react'],
}

export default defineConfig([
  {
    ...shared,
    entry: { index: 'src/index.ts' },
    clean: true,
    // index pulls in hooks: mark as client module for Next.js App Router
    banner: { js: "'use client'" },
  },
  {
    ...shared,
    entry: {
      vanilla: 'src/vanilla.ts',
      shallow: 'src/shallow.ts',
      persist: 'src/persist.ts',
      'persist-async': 'src/persist-async.ts',
      'cross-tab': 'src/cross-tab.ts',
      mutable: 'src/mutable.ts',
    },
  },
])
