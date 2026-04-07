import { NextRequest, NextResponse } from 'next/server'
import { readJson, writeJson, nextId } from '@/lib/store'

interface User { id: number; name: string; created_at: string }

export async function GET() {
  try {
    const users = await readJson<User[]>('users.json', [])
    return NextResponse.json(users.map(u => ({ id: u.id, name: u.name })))
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to load users'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const name =
      body && typeof body === 'object' && 'name' in body
        ? (body as { name: unknown }).name
        : undefined
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }
    const users = await readJson<User[]>('users.json', [])
    if (users.find(u => u.name === name.trim())) {
      return NextResponse.json({ error: 'Name already exists' }, { status: 409 })
    }
    const user: User = {
      id: nextId(users),
      name: name.trim(),
      created_at: new Date().toISOString(),
    }
    await writeJson('users.json', [...users, user])
    return NextResponse.json({ id: user.id, name: user.name }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create user'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
