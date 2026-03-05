import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import URLShortener from '../URLShortener'

// Mock next-auth
jest.mock('next-auth/react')
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock fetch
global.fetch = jest.fn()

describe('URLShortener Component', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Initial Render', () => {
    it('should render the URL input form', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      render(<URLShortener />)

      expect(screen.getByLabelText(/enter your long url/i)).toBeInTheDocument()
      expect(screen.getByPlaceholderText(/https:\/\/example.com/i)).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /shorten link/i })).toBeInTheDocument()
    })

    it('should have submit button disabled when URL is empty', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      render(<URLShortener />)

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      expect(submitButton).toBeDisabled()
    })
  })

  describe('URL Input and Submission', () => {
    it('should enable submit button when URL is entered', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      expect(submitButton).not.toBeDisabled()
    })

    it('should call API and display shortened URL on successful submission', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shortenedUrl: 'http://localhost:3000/abc123',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/your shortened url:/i)).toBeInTheDocument()
      })

      expect(screen.getByDisplayValue('http://localhost:3000/abc123')).toBeInTheDocument()
    })
  })

  describe('Loading State', () => {
    it('should show loading state during API call', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({
                    data: { shortenedUrl: 'http://localhost:3000/abc123' },
                  }),
                }),
              100
            )
          )
      )

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      expect(screen.getByRole('button', { name: /shortening.../i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /shortening.../i })).toBeDisabled()

      await waitFor(() => {
        expect(screen.getByText(/your shortened url:/i)).toBeInTheDocument()
      })
    })
  })

  describe('Error Display', () => {
    it('should display error message on API failure', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({
          error: {
            message: 'Invalid URL format',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/invalid url format/i)).toBeInTheDocument()
      })
    })

    it('should display generic error message when error details are missing', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({}),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByText(/failed to shorten url/i)).toBeInTheDocument()
      })
    })
  })

  describe('Success State with Copy/Retry Buttons', () => {
    beforeEach(() => {
      Object.assign(navigator, {
        clipboard: {
          writeText: jest.fn().mockResolvedValue(undefined),
        },
      })
    })

    it('should show Copy and Retry buttons after successful shortening', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          data: {
            shortenedUrl: 'http://localhost:3000/abc123',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    })

    it('should copy shortened URL to clipboard when Copy button is clicked', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shortenedUrl: 'http://localhost:3000/abc123',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      })

      const copyButton = screen.getByRole('button', { name: /copy/i })
      fireEvent.click(copyButton)

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'http://localhost:3000/abc123'
        )
      })

      expect(screen.getByRole('button', { name: /copied!/i })).toBeInTheDocument()
    })

    it('should reset form when Retry button is clicked', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shortenedUrl: 'http://localhost:3000/abc123',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
      })

      const retryButton = screen.getByRole('button', { name: /retry/i })
      fireEvent.click(retryButton)

      expect(screen.getByLabelText(/enter your long url/i)).toBeInTheDocument()
      expect(screen.queryByText(/your shortened url:/i)).not.toBeInTheDocument()
    })
  })

  describe('Save Button Visibility', () => {
    it('should not show Save button when user is not authenticated', async () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shortenedUrl: 'http://localhost:3000/abc123',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument()
      })

      expect(screen.queryByRole('button', { name: /save link/i })).not.toBeInTheDocument()
    })

    it('should show Save button when user is authenticated', async () => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: {
            shortenedUrl: 'http://localhost:3000/abc123',
          },
        }),
      })

      render(<URLShortener />)

      const input = screen.getByLabelText(/enter your long url/i)
      fireEvent.change(input, { target: { value: 'https://example.com' } })

      const submitButton = screen.getByRole('button', { name: /shorten link/i })
      fireEvent.click(submitButton)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save link/i })).toBeInTheDocument()
      })
    })
  })
})
