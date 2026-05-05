'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: number
  name: string
}

export default function HomePage() {
  const router = useRouter()
  const [users, setUsers] = useState<User[]>([])
  const [showNew, setShowNew] = useState(false)
  const [newName, setNewName] = useState('')
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/users')
      .then(async r => {
        const data = await r.json().catch(() => null)
        if (!r.ok) {
          setLoadError(
            typeof data?.error === 'string' ? data.error : 'Impossible de charger les profils.'
          )
          return
        }
        if (Array.isArray(data)) {
          setUsers(data)
          setLoadError('')
        }
      })
      .finally(() => setLoading(false))
  }, [])

  async function handleCreateUser() {
    if (!newName.trim()) return
    setError('')
    const res = await fetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    })
    const data = await res.json().catch(() => null)
    if (res.status === 409) {
      setError(typeof data?.error === 'string' ? data.error : 'Ce nom existe déjà.')
      return
    }
    if (!res.ok) {
      setError(
        typeof data?.error === 'string'
          ? data.error
          : `Erreur serveur (${res.status}). Réessaie ou vérifie la configuration.`
      )
      return
    }
    if (!data || typeof data.id !== 'number') {
      setError('Réponse invalide du serveur.')
      return
    }
    router.push(`/${data.id}`)
  }

  function getInitial(name: string) {
    return name.charAt(0).toUpperCase()
  }

  const avatarColors = [
    'bg-primary text-white',
    'bg-accent text-white',
    'bg-emerald-500 text-white',
    'bg-rose-400 text-white',
    'bg-violet-500 text-white',
  ]

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-extrabold text-primary mb-2">Revisions</h1>
          <p className="text-lg text-gray-500 font-medium">Allemand · Maths · Français</p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {loadError}
          </div>
        )}

        {/* User grid */}
        {loading ? (
          <div className="text-center text-gray-400">Chargement…</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
            {users.map((user, i) => (
              <button
                key={user.id}
                onClick={() => router.push(`/${user.id}`)}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border-2 border-transparent hover:border-accent hover:shadow-lg transition-all duration-200 group"
              >
                <div className={`w-16 h-16 rounded-full flex items-center justify-center text-2xl font-extrabold ${avatarColors[i % avatarColors.length]} shadow-md group-hover:scale-110 transition-transform duration-200`}>
                  {getInitial(user.name)}
                </div>
                <span className="font-semibold text-primary text-base">{user.name}</span>
              </button>
            ))}

            {/* New profile card */}
            {!showNew && (
              <button
                onClick={() => setShowNew(true)}
                className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-white border-2 border-dashed border-gray-300 hover:border-accent hover:shadow-lg transition-all duration-200 text-gray-400 hover:text-accent"
              >
                <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl bg-gray-100">
                  +
                </div>
                <span className="font-semibold text-sm">Nouveau profil</span>
              </button>
            )}
          </div>
        )}

        {/* New profile form */}
        {showNew && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-md p-6 mb-6">
            <p className="font-semibold text-primary mb-3">Créer un nouveau profil</p>
            <div className="flex gap-2">
              <input
                autoFocus
                type="text"
                placeholder="Ton prénom…"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreateUser()}
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2 text-primary font-medium outline-none focus:border-accent transition-colors"
              />
              <button
                onClick={handleCreateUser}
                className="bg-primary text-white rounded-xl px-5 py-2 font-semibold hover:bg-primary-light transition-colors"
              >
                OK
              </button>
              <button
                onClick={() => { setShowNew(false); setError('') }}
                className="text-gray-400 hover:text-gray-600 px-3 py-2 rounded-xl transition-colors"
              >
                Annuler
              </button>
            </div>
            {error && <p className="text-rose-500 text-sm mt-2">{error}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
