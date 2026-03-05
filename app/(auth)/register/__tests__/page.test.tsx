import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { signIn } from 'next-auth/react'
import RegisterPage from '../page'

// Mock next-auth
jest.mock('next-auth/react')
const mockSignIn = signIn as jest.MockedFunction<typeof signIn>

// Mock fetch
global.fetch = jest.fn()

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Initial Render', () => {
    it('should render registration form with name, email, and password inputs', () => {
      render(<RegisterPage />)

      expect(screen.getByLabelText(/full name/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/email address/i)).toBeInTheDocument()
      expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^create account$/i })).toBeInTheDocument()
    })

    it('should render Google OAuth button', () => {
      render(<RegisterPage />)

      expect(screen.getByRole('button', { name: /sign up with google/i })).toBeInTheDocument()
    })

    it('should render link to login page', () => {
      render(<RegisterPage />)

      const signInLink = screen.getByRole('link', { name: /sign in/i })
      expect(signInLink).toBeInTheDocument()
      expect(signInLink).toHaveAttribute('href', '/login')
    })
  })

  describe('Password Strength Indicator', () => {
    it('should not show password strength indicator when password is empty', () => {
      render(<RegisterPage />)

      expect(screen.queryByText(/password strength:/i)).not.toBeInTheDocument()
    })

    it('should show "Weak" for short password', () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      fireEvent.change(passwordInput, { target: { value: 'pass' } })

      expect(screen.getByText(/weak/i)).toBeInTheDocument()
    })

    it('should show "Good" for password with length, mixed case, and numbers', () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      fireEvent.change(passwordInput, { target: { value: 'Password1234' } })

      expect(screen.getByText(/good/i)).toBeInTheDocument()
    })

    it('should show "Strong" for password with all requirements', () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      fireEvent.change(passwordInput, { target: { value: 'Password123!@#' } })

      expect(screen.getByText(/strong/i)).toBeInTheDocument()
    })

    it('should show "Fair" for password with length but missing some requirements', () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      fireEvent.change(passwordInput, { target: { value: 'passwordonly12' } })

      expect(screen.getByText(/fair/i)).toBeInTheDocument()
    })

    it('should display password requirements hint', () => {
      render(<RegisterPage />)

      const passwordInput = screen.getByLabelText(/^password$/i)
      fireEvent.change(passwordInput, { target: { value: 'test' } })

      expect(
        screen.getByText(/use 12\+ characters with mixed case, numbers, and symbols/i)
      ).toBeInTheDocument()
    })
  })

  describe('Form Submission', () => {
    it('should call registration API on form submit', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            message: 'Registration successful',
          },
        }),
      })

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const submitButton = screen.getByRole('button', { name: /^create account$/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123!@#' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: 'John Doe',
            email: 'john@example.com',
            password: 'Password123!@#',
          }),
        })
      })
    })

    it('should show success message after successful registration', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            message: 'Registration successful',
          },
        }),
      })

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const submitButton = screen.getByRole('button', { name: /^create account$/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123!@#' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/registration successful!/i)).toBeInTheDocument()
      })

      expect(
        screen.getByText(/we've sent a verification email to/i)
      ).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /go to login/i })).toBeInTheDocument()
    })

    it('should display error message on failed registration', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Email already exists',
          },
        }),
      })

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const submitButton = screen.getByRole('button', { name: /^create account$/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'existing@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123!@#' } })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/email already exists/i)).toBeInTheDocument()
      })
    })

    it('should show loading state during submission', async () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ data: { message: 'Success' } }),
                }),
              100
            )
          )
      )

      render(<RegisterPage />)

      const nameInput = screen.getByLabelText(/full name/i)
      const emailInput = screen.getByLabelText(/email address/i)
      const passwordInput = screen.getByLabelText(/^password$/i)
      const submitButton = screen.getByRole('button', { name: /^create account$/i })

      fireEvent.change(nameInput, { target: { value: 'John Doe' } })
      fireEvent.change(emailInput, { target: { value: 'john@example.com' } })
      fireEvent.change(passwordInput, { target: { value: 'Password123!@#' } })
      fireEvent.click(submitButton)

      expect(screen.getByRole('button', { name: /creating account.../i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /creating account.../i })).toBeDisabled()

      await waitFor(() => {
        expect(screen.getByText(/registration successful!/i)).toBeInTheDocument()
      })
    })
  })

  describe('Google OAuth', () => {
    it('should call signIn with google provider when Google button is clicked', async () => {
      mockSignIn.mockResolvedValueOnce(undefined as unknown as ReturnType<typeof signIn>)

      render(<RegisterPage />)

      const googleButton = screen.getByRole('button', { name: /sign up with google/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(mockSignIn).toHaveBeenCalledWith('google', { callbackUrl: '/dashboard' })
      })
    })

    it('should display error if Google sign-up fails', async () => {
      mockSignIn.mockRejectedValueOnce(new Error('Google sign-up failed'))

      render(<RegisterPage />)

      const googleButton = screen.getByRole('button', { name: /sign up with google/i })
      fireEvent.click(googleButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to sign up with google/i)).toBeInTheDocument()
      })
    })
  })

  describe('Form Validation', () => {
    it('should require all fields', () => {
      render(<RegisterPage />)

      expect(screen.getByLabelText(/full name/i)).toBeRequired()
      expect(screen.getByLabelText(/email address/i)).toBeRequired()
      expect(screen.getByLabelText(/^password$/i)).toBeRequired()
    })

    it('should have correct input types', () => {
      render(<RegisterPage />)

      expect(screen.getByLabelText(/full name/i)).toHaveAttribute('type', 'text')
      expect(screen.getByLabelText(/email address/i)).toHaveAttribute('type', 'email')
      expect(screen.getByLabelText(/^password$/i)).toHaveAttribute('type', 'password')
    })
  })
})
