import path from 'path'
import fs from 'fs'

/**
 * Default name is BLOB_READ_WRITE_TOKEN; Vercel Blob "Advanced options" can add a prefix,
 * producing e.g. MYAPP_BLOB_READ_WRITE_TOKEN. The @vercel/blob SDK only reads the default name.
 */
function resolveBlobReadWriteToken(): string | undefined {
  const direct = process.env.BLOB_READ_WRITE_TOKEN?.trim()
  if (direct) return direct

  const suffix = 'BLOB_READ_WRITE_TOKEN'
  for (const key of Object.keys(process.env)) {
    if (key === suffix || key.endsWith(`_${suffix}`)) {
      const v = process.env[key]?.trim()
      if (v) return v
    }
  }
  return undefined
}

function useBlobStorage(): boolean {
  return !!resolveBlobReadWriteToken()
}

const DATA_DIR = path.resolve(process.cwd(), 'data')

// ── Local filesystem (dev) ─────────────────────────────

function localRead<T>(filename: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, filename), 'utf-8'))
  } catch {
    return fallback
  }
}

function localWrite<T>(filename: string, data: T): void {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2))
}

// ── Vercel Blob (production) ───────────────────────────

async function blobRead<T>(filename: string, fallback: T): Promise<T> {
  const { get } = await import('@vercel/blob')
  const token = resolveBlobReadWriteToken()
  if (!token) return fallback
  try {
    const out = await get(filename, { access: 'private', token, useCache: false })
    if (!out || out.statusCode !== 200 || !out.stream) return fallback
    const text = await new Response(out.stream).text()
    if (!text.trim()) return fallback
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

async function blobWrite<T>(filename: string, data: T): Promise<void> {
  const { put } = await import('@vercel/blob')
  const token = resolveBlobReadWriteToken()
  if (!token) {
    throw new Error(
      'No Vercel Blob read-write token found (expected BLOB_READ_WRITE_TOKEN or * _BLOB_READ_WRITE_TOKEN).'
    )
  }
  await put(filename, JSON.stringify(data), {
    access: 'private',
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: 'application/json',
    token,
  })
}

// ── Public API ─────────────────────────────────────────

export async function readJson<T>(filename: string, fallback: T): Promise<T> {
  if (useBlobStorage()) return blobRead(filename, fallback)
  return localRead(filename, fallback)
}

export async function writeJson<T>(filename: string, data: T): Promise<void> {
  if (process.env.VERCEL && !resolveBlobReadWriteToken()) {
    throw new Error(
      'Vercel Blob token missing at runtime. Link the store to this project, then redeploy. ' +
        'If you set a custom env prefix in Blob settings, the variable name must still end with BLOB_READ_WRITE_TOKEN. ' +
        'Do not use NEXT_PUBLIC_ on the read-write token.'
    )
  }
  if (useBlobStorage()) return blobWrite(filename, data)
  localWrite(filename, data)
}

export function nextId(rows: { id: number }[]): number {
  return rows.length > 0 ? Math.max(...rows.map(r => r.id)) + 1 : 1
}
