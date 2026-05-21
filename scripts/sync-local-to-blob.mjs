/**
 * Merges local data/  files into Vercel Blob, deduplicating by content.
 * Safe to run multiple times (idempotent).
 *
 * Usage: node scripts/sync-local-to-blob.mjs
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { createRequire } from 'module'

// Load .env.local
const envPath = path.resolve(process.cwd(), '.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^([^=]+)=(.*)$/)
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^"|"$/g, '')
  }
}

const TOKEN = process.env.BLOB_READ_WRITE_TOKEN
if (!TOKEN) {
  console.error('No BLOB_READ_WRITE_TOKEN found — run `vercel env pull` first.')
  process.exit(1)
}

const require = createRequire(import.meta.url)
const { get, put } = require('@vercel/blob')

const DATA_DIR = path.resolve(process.cwd(), 'data')

async function blobRead(filename) {
  try {
    const out = await get(filename, { access: 'private', token: TOKEN, useCache: false })
    if (!out || out.statusCode !== 200 || !out.stream) return null
    const text = await new Response(out.stream).text()
    if (!text.trim()) return null
    return JSON.parse(text)
  } catch {
    return null
  }
}

async function blobWrite(filename, data) {
  await put(filename, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token: TOKEN,
  })
}

function localRead(filename) {
  const p = path.join(DATA_DIR, filename)
  if (!fs.existsSync(p)) return null
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'))
  } catch {
    return null
  }
}

// Deduplicate two arrays of objects with auto-assigned IDs.
// keyFn extracts a string signature for dedup — items with the same sig are the same event.
// Returns merged array with freshly-assigned sequential IDs starting at 1.
function mergeById(local, remote, keyFn) {
  const seen = new Map()
  for (const item of [...(remote ?? []), ...(local ?? [])]) {
    const k = keyFn(item)
    if (!seen.has(k)) seen.set(k, item)
  }
  const sorted = [...seen.values()].sort((a, b) => {
    // Sort by timestamp field if present
    const ta = a.attempted_at ?? a.started_at ?? a.completed_at ?? a.created_at ?? ''
    const tb = b.attempted_at ?? b.started_at ?? b.completed_at ?? b.created_at ?? ''
    return ta.localeCompare(tb)
  })
  return sorted.map((item, i) => ({ ...item, id: i + 1 }))
}

async function syncFile(filename, keyFn) {
  const local = localRead(filename)
  if (!local || !Array.isArray(local) || local.length === 0) {
    console.log(`  ${filename}: no local data, skipping`)
    return { local: 0, remote: 0, merged: 0 }
  }

  const remote = await blobRead(filename)
  const remoteArr = Array.isArray(remote) ? remote : []

  const merged = mergeById(local, remoteArr, keyFn)
  await blobWrite(filename, merged)

  return { local: local.length, remote: remoteArr.length, merged: merged.length }
}

const FILES = [
  // German vocab results
  {
    files: [1, 2, 3].map(u => `results-${u}.json`),
    key: r => `${r.vocab_id}|${r.mode}|${r.attempted_at}|${r.correct}`,
  },
  // German verb results
  {
    files: [1, 2, 3].map(u => `verb-results-${u}.json`),
    key: r => `${r.verb_id}|${r.attempted_at}|${r.correct_count}`,
  },
  // German quiz sessions
  {
    files: [1, 2, 3].map(u => `quiz-sessions-${u}.json`),
    key: s => `${s.started_at}|${s.ended_at ?? ''}|${s.mode ?? ''}`,
  },
  // English vocab results
  {
    files: [1, 2, 3].map(u => `english-results-${u}.json`),
    key: r => `${r.vocab_id}|${r.mode}|${r.attempted_at}|${r.correct}`,
  },
  // English sessions
  {
    files: [1, 2, 3].map(u => `english-sessions-${u}.json`),
    key: s => `${s.completed_at ?? s.started_at}|${s.mode ?? ''}|${s.units ?? ''}`,
  },
  // French results
  {
    files: [1, 2, 3].map(u => `french-results-${u}.json`),
    key: r => `${r.verb}|${r.tense}|${r.pronoun}|${r.mode}|${r.attempted_at}`,
  },
  // French sessions
  {
    files: [1, 2, 3].map(u => `french-sessions-${u}.json`),
    key: s => `${s.started_at}|${s.mode ?? ''}|${s.points ?? ''}`,
  },
  // Tables results
  {
    files: [1, 2, 3].map(u => `tables-results-${u}.json`),
    key: r => `${r.table_a ?? ''}|${r.table_b ?? ''}|${r.attempted_at}|${r.correct}`,
  },
  // Tables sessions
  {
    files: [1, 2, 3].map(u => `tables-sessions-${u}.json`),
    key: s => `${s.completed_at}|${s.perfect_series_bonus ?? ''}`,
  },
  // Check redemptions
  {
    files: [1, 2, 3].map(u => `check-redemptions-${u}.json`),
    key: r => `${r.created_at}|${r.checks_used}|${r.note}`,
  },
]

async function main() {
  console.log('Syncing local data → Vercel Blob...\n')

  for (const group of FILES) {
    for (const filename of group.files) {
      const result = await syncFile(filename, group.key)
      if (result.local > 0) {
        console.log(`  ✓ ${filename}: local=${result.local} remote=${result.remote} → merged=${result.merged}`)
      }
    }
  }

  console.log('\nDone. Now triggering ledger recompute for each user...')

  for (const uid of [1, 2, 3]) {
    try {
      const res = await fetch(`https://revisions-allemand.vercel.app/api/checks/${uid}`)
      const ok = res.ok ? '✓' : '✗'
      console.log(`  ${ok} User ${uid} ledger recomputed (status ${res.status})`)
    } catch (e) {
      console.log(`  ✗ User ${uid}: ${e.message}`)
    }
  }

  console.log('\nSync complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
