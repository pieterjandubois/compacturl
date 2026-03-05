import { render, screen, fireEvent } from '@testing-library/react'
import { useSession, signOut } from 'next-auth/react'
import AuthButtons from '../AuthButtons'

// Mock next-auth
jest.mock('next-auth/react')
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>

// Mock next/link
jest.mock('next/link', () => {
  return function MockLink({ children, href, className }: any) {
    return <a href={href} className={className}>{children}</a>
  }
})

describe('AuthButtons Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('Loading State', () => {
    it('should show loading text when session is loading', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: jest.fn(),
      })

      render(<AuthButtons />)

      expect(screen.getByText(/loading.../i)).toBeInTheDocument()
    })
  })

  describe('Unauthenticated State', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })
    })

    it('should show Login and Register buttons when not authenticated', () => {
      render(<AuthButtons />)

      expect(screen.getByRole('link', { name: /login/i })).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /register/i })).toBeInTheDocument()
    })

    it('should have correct href for Login button', () => {
      render(<AuthButtons />)

      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toHaveAttribute('href', '/login')
    })

    it('should have correct href for Register button', () => {
      render(<AuthButtons />)

      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toHaveAttribute('href', '/register')
    })

    it('should not show Dashboard link when not authenticated', () => {
      render(<AuthButtons />)

      expect(screen.queryByRole('link', { name: /dashboard/i })).not.toBeInTheDocument()
    })

    it('should not show Logout button when not authenticated', () => {
      render(<AuthButtons />)

      expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
    })
  })

  describe('Authenticated State', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
          },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })
    })

    it('should show Dashboard link when authenticated', () => {
      render(<AuthButtons />)

      expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument()
    })

    it('should have correct href for Dashboard link', () => {
      render(<AuthButtons />)

      const dashboardLink = screen.getByRole('link', { name: /dashboard/i })
      expect(dashboardLink).toHaveAttribute('href', '/dashboard')
    })

    it('should show user name when authenticated', () => {
      render(<AuthButtons />)

      expect(screen.getByText('Test User')).toBeInTheDocument()
    })

    it('should show user email when name is not available', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: null,
          },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })

      render(<AuthButtons />)

      expect(screen.getByText('test@example.com')).toBeInTheDocument()
    })

    it('should show Logout button when authenticated', () => {
      render(<AuthButtons />)

      expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
    })

    it('should call signOut when Logout button is clicked', () => {
      render(<AuthButtons />)

      const logoutButton = screen.getByRole('button', { name: /logout/i })
      fireEvent.click(logoutButton)

      expect(mockSignOut).toHaveBeenCalledTimes(1)
    })

    it('should not show Login and Register buttons when authenticated', () => {
      render(<AuthButtons />)

      expect(screen.queryByRole('link', { name: /^login$/i })).not.toBeInTheDocument()
      expect(screen.queryByRole('link', { name: /^register$/i })).not.toBeInTheDocument()
    })
  })

  describe('Styling', () => {
    it('should apply correct styling to Login button', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      render(<AuthButtons />)

      const loginLink = screen.getByRole('link', { name: /login/i })
      expect(loginLink).toHaveClass('text-sm')
    })

    it('should apply correct styling to Register button', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      render(<AuthButtons />)

      const registerLink = screen.getByRole('link', { name: /register/i })
      expect(registerLink).toHaveClass('bg-blue-600')
    })

    it('should apply correct styling to Logout button', () => {
      mockUseSession.mockReturnValue({
        data: {
          user: {
            id: '1',
            email: 'test@example.com',
            name: 'Test User',
          },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })

      render(<AuthButtons />)

      const logoutButton = screen.getByRole('button', { name: /logout/i })
      expect(logoutButton).toHaveClass('text-sm')
    })
  })
})
