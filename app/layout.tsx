import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Deutsch Üben',
  description: 'Révise ton vocabulaire allemand',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="fr">
      <body className="min-h-screen bg-background font-sans">
        {children}
      </body>
    </html>
  )
}
