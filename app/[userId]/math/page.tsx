'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'

export default function MathDashboardPage() {
  const params = useParams()
  const userId = params.userId as string

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        <div className="inline-flex rounded-xl border border-gray-200 bg-white p-1 mb-4">
          <Link
            href={`/${userId}/german`}
            className="rounded-lg px-4 py-1.5 text-sm font-semibold text-gray-500 hover:text-primary transition-colors"
          >
            Allemand
          </Link>
          <span className="rounded-lg bg-primary px-4 py-1.5 text-sm font-bold text-white">
            Math
          </span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-extrabold text-primary">Math</h1>
            <p className="text-gray-500 text-sm mt-0.5">Choisis un exercice</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <Link
              href={`/${userId}/checks`}
              className="text-sm font-semibold text-amber-800 border border-amber-300 rounded-xl px-4 py-2 bg-amber-50 hover:bg-amber-100 transition-colors"
            >
              Chèques
            </Link>
            <Link
              href={`/${userId}/progress`}
              className="text-sm font-semibold text-primary border border-primary/30 rounded-xl px-4 py-2 hover:bg-primary hover:text-white transition-colors"
            >
              Dashboard →
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-primary text-base">✖️ Tables de multiplication</h2>
              <p className="text-gray-400 text-sm mt-0.5">3 modes avec option chrono 3 secondes</p>
            </div>
            <Link
              href={`/${userId}/tables`}
              className="bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary-light transition-colors shadow-sm whitespace-nowrap"
            >
              Pratiquer →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
