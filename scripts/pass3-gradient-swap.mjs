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

// Skip the layout files — `bg-primary` there is the active-nav-item state, not a CTA button.
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
      if (!value) return full
      // Only swap when both tokens are present together (CTA button signature from Pass 3).
      if (!value.includes('bg-primary') || !value.includes('hover:bg-primary/90')) return full

      // Replace `bg-primary hover:bg-primary/90` (with possible token order/whitespace)
      // by removing both tokens and inserting `btn-primary` once.
      const tokens = value.split(/\s+/).filter(Boolean)
      const out = []
      let injected = false
      for (const t of tokens) {
        if (t === 'bg-primary' || t === 'hover:bg-primary/90') {
          if (!injected) {
            out.push('btn-primary')
            injected = true
          }
          continue
        }
        out.push(t)
      }
      const newVal = out.join(' ')
      if (newVal === value) return full
      fileReplacements++
      if (dq != null) return `className="${newVal}"`
      if (sq != null) return `className='${newVal}'`
      return 'className={`' + newVal + '`}'
    },
  )

  if (transformed !== src) {
    fs.writeFileSync(f, transformed)
    modifiedFiles.push({ file: path.relative(path.resolve(__dirname, '..'), f), count: fileReplacements })
    totalReplacements += fileReplacements
  }
}

console.log(`\nTotal CTA buttons swapped to btn-primary: ${totalReplacements}`)
console.log(`Files modified: ${modifiedFiles.length}\n`)
for (const m of modifiedFiles) console.log(`  ${m.count.toString().padStart(3, ' ')}× ${m.file}`)
