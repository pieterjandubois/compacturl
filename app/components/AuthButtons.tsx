'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function AuthButtons() {
  const { data: session, status } = useSession()

  if (status === 'loading') {
    return <div className="text-sm text-gray-500">Loading...</div>
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="text-sm text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
        >
          Dashboard
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            {session.user.name || session.user.email}
          </span>
          <button
            onClick={() => signOut()}
            className="text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-md transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-4">
      <Link
        href="/login"
        className="text-sm px-4 py-2 text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100 transition-colors"
      >
        Login
      </Link>
      <Link
        href="/register"
        className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
      >
        Register
      </Link>
    </div>
  )
}
