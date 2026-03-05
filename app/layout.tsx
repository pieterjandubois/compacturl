import type { Metadata } from 'next'
import './globals.css'
import SessionProvider from './components/SessionProvider'

export const metadata: Metadata = {
  title: 'CompactURL - URL Shortener',
  description: 'A secure and efficient URL shortening service',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  )
}
