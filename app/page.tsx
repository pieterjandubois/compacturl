import AuthButtons from './components/AuthButtons'
import URLShortener from './components/URLShortener'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                CompactURL
              </h1>
            </div>
            <AuthButtons />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Shorten Your URLs
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Create short, memorable links that are easy to share. Track clicks, generate QR codes, and manage all your links in one place.
          </p>
        </div>

        <URLShortener />

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="text-center">
            <div className="text-3xl mb-2">⚡</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Fast & Reliable
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Lightning-fast URL shortening with 99.9% uptime guarantee
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📊</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              Track Clicks
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Monitor link performance with detailed click analytics
            </p>
          </div>
          <div className="text-center">
            <div className="text-3xl mb-2">📱</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              QR Codes
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Generate QR codes for easy mobile sharing
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-700 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">
            © {new Date().getFullYear()} CompactURL. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
