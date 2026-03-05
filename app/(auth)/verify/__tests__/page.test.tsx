import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { useSearchParams, useRouter } from 'next/navigation'
import VerifyPage from '../page'

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useSearchParams: jest.fn(),
  useRouter: jest.fn(),
}))
const mockUseSearchParams = useSearchParams as jest.MockedFunction<typeof useSearchParams>
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

// Mock fetch
global.fetch = jest.fn()

describe('VerifyPage', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
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

  describe('Initial State', () => {
    it('should show loading state initially', () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('valid-token'),
      } as any)

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

      render(<VerifyPage />)

      expect(screen.getByText(/verifying your email.../i)).toBeInTheDocument()
      expect(
        screen.getByText(/please wait while we verify your email address/i)
      ).toBeInTheDocument()
    })
  })

  describe('Missing Token', () => {
    it('should show error when token is missing', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      } as any)

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/verification token is missing/i)).toBeInTheDocument()
    })

    it('should show register and login buttons when token is missing', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue(null),
      } as any)

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /register again/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('link', { name: /go to login/i })).toBeInTheDocument()
    })
  })

  describe('Successful Verification', () => {
    it('should call verification API with token', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('valid-token-123'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            message: 'Email verified successfully',
          },
        }),
      })

      render(<VerifyPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/auth/verify?token=valid-token-123')
      })
    })

    it('should show success message after successful verification', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('valid-token-123'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            message: 'Email verified successfully',
          },
        }),
      })

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByText(/email verified!/i)).toBeInTheDocument()
      })

      expect(
        screen.getByText(/your email has been verified successfully!/i)
      ).toBeInTheDocument()
      expect(screen.getByText(/redirecting to login page.../i)).toBeInTheDocument()
    })

    it('should redirect to login page after 3 seconds', async () => {
      jest.useFakeTimers()

      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('valid-token-123'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            message: 'Email verified successfully',
          },
        }),
      })

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByText(/email verified!/i)).toBeInTheDocument()
      })

      // Fast-forward 3 seconds
      jest.advanceTimersByTime(3000)

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/login')
      })

      jest.useRealTimers()
    })
  })

  describe('Failed Verification', () => {
    it('should show error message when verification fails', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('invalid-token'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Invalid or expired token',
          },
        }),
      })

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/invalid or expired token/i)).toBeInTheDocument()
    })

    it('should show register and login buttons on failure', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('invalid-token'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: {
            message: 'Invalid token',
          },
        }),
      })

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByRole('link', { name: /register again/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('link', { name: /go to login/i })).toBeInTheDocument()
    })

    it('should handle network errors gracefully', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('valid-token'),
      } as any)

      ;(global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'))

      render(<VerifyPage />)

      await waitFor(() => {
        expect(screen.getByText(/verification failed/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/network error/i)).toBeInTheDocument()
    })
  })

  describe('UI Elements', () => {
    it('should display CompactURL logo', () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('token'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })

      render(<VerifyPage />)

      const logo = screen.getByRole('link', { name: /compacturl/i })
      expect(logo).toBeInTheDocument()
      expect(logo).toHaveAttribute('href', '/')
    })

    it('should show appropriate icons for each state', async () => {
      mockUseSearchParams.mockReturnValue({
        get: jest.fn().mockReturnValue('token'),
      } as any)

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      })

      const { container } = render(<VerifyPage />)

      // Loading state has spinner
      expect(container.querySelector('.animate-spin')).toBeInTheDocument()

      await waitFor(() => {
        expect(screen.getByText(/email verified!/i)).toBeInTheDocument()
      })

      // Success state has checkmark (path with specific d attribute)
      const successIcon = container.querySelector('path[d*="M5 13l4 4L19 7"]')
      expect(successIcon).toBeInTheDocument()
    })
  })
})
