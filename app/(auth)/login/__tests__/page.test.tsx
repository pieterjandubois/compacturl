import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import LoginPage from '../page'

// Mock next-auth
jest.mock('next-auth/react')
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

describe('LoginPage', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    mockUseRouter.mockReturnValue({
      push: mockPush,
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    } as any)
  })

  afterEach(() => {
    cleanup()
  })

  describe('Initial Render', () => {
    it('should render login form with email and password inputs', () => {
      render(<LoginPage />)

      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/password/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^sign in$/i })).toBeInTheDocument()
    })

    it('should render Google OAuth button', () => {
      render(<LoginPage />)

      expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
    })

    it('should render link to registration page', () => {
      render(<LoginPage />)

      const signUpLink = screen.getByRole('link', { name: /sign up/i })
      expect(signUpLink).toBeInTheDocument()
      expect(signUpLink).toHaveAttribute('href', '/register')
    })
  })

  describe('Form Submission', () => {
    it('should call signIn with credentials on form submit', async () => {
      mockSignIn.mockResolvedValueOnce({ ok: true, error: null } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('credentials', {
          email: 'test@example.com',
          password: 'password123',
          redirect: false,
        })
      })
    })

    it('should redirect to dashboard on successful login', async () => {
      mockSignIn.mockResolvedValueOnce({ ok: true, error: null } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should display error message on failed login', async () => {
      mockSignIn.mockResolvedValueOnce({ ok: false, error: 'Invalid credentials' } as any)

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'wrongpassword' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid email or password/i)).toBeInTheDocument()
      })
    })

    it('should show loading state during submission', async () => {
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, error: null } as any), 100)
          )
      )

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      expect(screen.getByRole('button', { name: /signing in.../i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /signing in.../i })).toBeDisabled()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })

    it('should disable inputs during submission', async () => {
      mockSignIn.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ ok: true, error: null } as any), 100)
          )
      )

      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/password/i)
      const submitButton = screen.getByRole('button', { name: /^sign in$/i })

      fireEvent.change(emailInput, { target: { value: 'test@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'password123' } })
      fireEvent.click(submitButton)

      expect(emailInput).toBeDisabled()
      expect(passwordInput).toBeDisabled()

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard')
      })
    })
  })

  describe('Google OAuth', () => {
    it('should call signIn with google provider when Google button is clicked', async () => {
      mockSignIn.mockResolvedValueOnce(undefined as any)

      render(<LoginPage />)

      const googleButton = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard' })
      })
    })

    it('should display error if Google sign-in fails', async () => {
      mockSignIn.mockRejectedValueOnce(new Error('Google sign-in failed'))

      render(<LoginPage />)

      const googleButton = screen.getByRole('button', { name: /sign in with google/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to sign in with google/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should require email field', () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toBeRequired()
    })

    it('should require password field', () => {
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toBeRequired()
    })

    it('should have email input type', () => {
      render(<LoginPage />)

      const emailInput = screen.getByLabelText(/email address/i)
      expect(emailInput).toHaveAttribute('type', 'email')
    })

    it('should have password input type', () => {
      render(<LoginPage />)

      const passwordInput = screen.getByLabelText(/password/i)
      expect(passwordInput).toHaveAttribute('type', 'password')
    })
  })
})
