'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'

export default function URLShortener() {
  const { data: session } = useSession()
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shortenedUrl, setShortenedUrl] = useState<string | null>(null)
  const [copySuccess, setCopySuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setCopySuccess(false)

    try {
      const response = await fetch('/api/shorten', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Failed to shorten URL')
      }

      setShortenedUrl(data.data.shortUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (shortenedUrl) {
      try {
        await navigator.clipboard.writeText(shortenedUrl)
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (err) {
        console.error('Failed to copy:', err)
      }
    }
  }

  const handleRetry = () => {
    setUrl('')
    setShortenedUrl(null)
    setError(null)
    setCopySuccess(false)
  }

  const handleSave = async () => {
    if (!shortenedUrl) return

    try {
      const shortCode = shortenedUrl.split('/').pop()
      const response = await fetch('/api/links/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ shortCode }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error?.message || 'Failed to save link')
      }

      alert('Link saved successfully!')
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to save link')
    }
  }

  if (shortenedUrl) {
    return (
      <div className="w-full max-w-2xl mx-auto space-y-4">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
            Your shortened URL:
          </h3>
          <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-700 rounded-md">
            <input
              type="text"
              value={shortenedUrl}
              readOnly
              className="flex-1 bg-transparent text-gray-900 dark:text-gray-100 outline-none"
            />
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleCopy}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
            >
              {copySuccess ? 'Copied!' : 'Copy'}
            </button>
            <button
              onClick={handleRetry}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-md transition-colors"
            >
              Retry
            </button>
            {session && (
              <button
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors"
              >
                Save Link
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <label
            htmlFor="url"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Enter your long URL
          </label>
          <input
            type="url"
            id="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/very/long/url"
            required
            disabled={loading}
            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !url}
            className="w-full mt-4 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-md transition-colors disabled:cursor-not-allowed"
          >
            {loading ? 'Shortening...' : 'Shorten Link'}
          </button>
        </div>
      </form>
    </div>
  )
}
