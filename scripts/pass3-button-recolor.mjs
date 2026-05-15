#!/usr/bin/env node
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..', 'client', 'src')

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.(tsx|ts)$/.test(entry.name)) out.push(p)
  }
  return out
}

const SKIP_FILES = new Set([
  path.resolve(ROOT, 'components/TenantLayout.tsx'),
  path.resolve(ROOT, 'components/AdminLayout.tsx'),
])

const files = walk(ROOT)
let totalReplacements = 0
const modifiedFiles = []

for (const f of files) {
  if (SKIP_FILES.has(f)) continue
  const src = fs.readFileSync(f, 'utf8')

  let fileReplacements = 0

  const transformed = src.replace(
    /className=(?:"([^"]+)"|'([^']+)'|\{`([\s\S]*?)`\})/g,
    (full, dq, sq, tl) => {
      const value = dq ?? sq ?? tl
      if (!value || !value.includes('bg-gray-900') || !value.includes('hover:bg-gray-800')) return full
      const newVal = value
        .replace(/bg-gray-900/g, 'bg-primary')
        .replace(/hover:bg-gray-800/g, 'hover:bg-primary/90')
      fileReplacements++
      if (dq != null) return `className="${newVal}"`
      if (sq != null) return `className='${newVal}'`
      return 'className={`' + newVal + '`}'
    },
  )

  // Also handle string literals inside template-literal expressions like:
  //   className={`... ${cond ? 'bg-gray-900 text-white hover:bg-gray-800' : '...'} ...`}
  // The outer regex above already captured the whole template body, so the inner
  // single-quoted strings were transformed as part of that. Nothing more to do.

  if (transformed !== src) {
    fs.writeFileSync(f, transformed)
    modifiedFiles.push({ file: path.relative(path.resolve(__dirname, '..'), f), count: fileReplacements })
    totalReplacements += fileReplacements
  }
}

console.log(`\nTotal CTA buttons recolored: ${totalReplacements}`)
console.log(`Files modified: ${modifiedFiles.length}\n`)
for (const m of modifiedFiles) console.log(`  ${m.count.toString().padStart(3, ' ')}× ${m.file}`)
