import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Révisions',
  description: 'Révise l\'allemand, le français et les maths',
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
