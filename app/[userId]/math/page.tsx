'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { SubjectPageHeader } from '@/components/SubjectPageHeader'

export default function MathDashboardPage() {
  const params = useParams()
  const userId = params.userId as string

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-xl mx-auto">
        <SubjectPageHeader
          userId={userId}
          subject="Math"
          subtitle="Choisis un exercice"
          progressHref={`/${userId}/progress?branch=math`}
          progressLabel="Dashboard →"
        />

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
