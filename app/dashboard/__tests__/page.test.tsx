import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import DashboardPage from '../page'

// Mock next-auth
jest.mock('next-auth/react')
const mockUseSession = useSession as jest.MockedFunction<typeof useSession>

// Mock next/navigation
jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
}))
const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>

// Mock components
jest.mock('../../components/AuthButtons', () => {
  return function MockAuthButtons() {
    return <div data-testid="auth-buttons">Auth Buttons</div>
  }
})

jest.mock('../../components/LinkList', () => {
  return function MockLinkList({ links, onDelete, onRefresh }: any) {
    return (
      <div data-testid="link-list">
        <div>Links: {links.length}</div>
        <button onClick={() => onDelete('test-id')}>Delete Link</button>
        <button onClick={onRefresh}>Refresh</button>
      </div>
    )
  }
})

// Mock fetch
global.fetch = jest.fn()
global.alert = jest.fn()
global.confirm = jest.fn()

describe('DashboardPage', () => {
  const mockPush = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
    ;(global.fetch as jest.Mock).mockClear()
    ;(global.alert as jest.Mock).mockClear()
    ;(global.confirm as jest.Mock).mockClear()

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

  describe('Authentication Requirement', () => {
    it('should redirect to login if user is not authenticated', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'unauthenticated',
        update: jest.fn(),
      })

      render(<DashboardPage />)

      expect(mockPush).toHaveBeenCalledWith('/login')
    })

    it('should show loading state while checking authentication', () => {
      mockUseSession.mockReturnValue({
        data: null,
        status: 'loading',
        update: jest.fn(),
      })

      render(<DashboardPage />)

      expect(screen.getByText(/loading.../i)).toBeInTheDocument()
    })

    it('should render dashboard when user is authenticated', async () => {
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
        json: async () => ({ data: [] }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/my links/i)).toBeInTheDocument()
      })
    })
  })

  describe('Link List Rendering', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })
    })

    it('should fetch and display links on mount', async () => {
      const mockLinks = [
        {
          id: '1',
          shortCode: 'abc123',
          originalUrl: 'https://example.com',
          clickCount: 10,
          createdAt: '2024-01-01T00:00:00Z',
          shortenedUrl: 'http://localhost:3000/abc123',
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLinks }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('link-list')).toBeInTheDocument()
      })

      expect(screen.getByText(/links: 1/i)).toBeInTheDocument()
    })

    it('should show empty state when no links exist', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/no links yet/i)).toBeInTheDocument()
      })

      expect(screen.getByText(/get started by creating your first shortened url/i)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: /create link/i })).toHaveAttribute('href', '/')
    })

    it('should show error message when fetch fails', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Failed to fetch links' },
        }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/failed to fetch links/i)).toBeInTheDocument()
      })

      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    })
  })

  describe('Sorting Functionality', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })

      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      })
    })

    it('should fetch links with default sort (date, desc)', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/links?sort=date&order=desc')
      })
    })

    it('should refetch links when sort option changes', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Date Created')).toBeInTheDocument()
      })

      const sortSelect = screen.getByDisplayValue('Date Created')
      fireEvent.change(sortSelect, { target: { value: 'clicks' } })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/links?sort=clicks&order=desc')
      })
    })

    it('should refetch links when sort order changes', async () => {
      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByDisplayValue('Descending')).toBeInTheDocument()
      })

      const orderSelect = screen.getByDisplayValue('Descending')
      fireEvent.change(orderSelect, { target: { value: 'asc' } })

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/links?sort=date&order=asc')
      })
    })
  })

  describe('Delete Link Action', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })

      const mockLinks = [
        {
          id: '1',
          shortCode: 'abc123',
          originalUrl: 'https://example.com',
          clickCount: 10,
          createdAt: '2024-01-01T00:00:00Z',
          shortenedUrl: 'http://localhost:3000/abc123',
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLinks }),
      })
    })

    it('should show confirmation dialog before deleting link', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(false)

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('link-list')).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: /delete link/i })
      fireEvent.click(deleteButton)

      expect(global.confirm).toHaveBeenCalledWith('Are you sure you want to delete this link?')
    })

    it('should delete link when confirmed', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(true)
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('link-list')).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: /delete link/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/links/test-id', {
          method: 'DELETE',
        })
      })
    })

    it('should show error alert if delete fails', async () => {
      ;(global.confirm as jest.Mock).mockReturnValue(true)
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        json: async () => ({
          error: { message: 'Failed to delete link' },
        }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByTestId('link-list')).toBeInTheDocument()
      })

      const deleteButton = screen.getByRole('button', { name: /delete link/i })
      fireEvent.click(deleteButton)

      await waitFor(() => {
        expect(global.alert).toHaveBeenCalledWith('Failed to delete link')
      })
    })
  })

  describe('Delete All Links Action', () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({
        data: {
          user: { id: '1', email: 'test@example.com', name: 'Test User' },
          expires: '2024-12-31',
        },
        status: 'authenticated',
        update: jest.fn(),
      })
    })

    it('should show Delete All Links button when links exist', async () => {
      const mockLinks = [
        {
          id: '1',
          shortCode: 'abc123',
          originalUrl: 'https://example.com',
          clickCount: 10,
          createdAt: '2024-01-01T00:00:00Z',
          shortenedUrl: 'http://localhost:3000/abc123',
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLinks }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete all links/i })).toBeInTheDocument()
      })
    })

    it('should not show Delete All Links button when no links exist', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [] }),
      })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByText(/no links yet/i)).toBeInTheDocument()
      })

      // Button should not be present when links array is empty
      const deleteAllButton = screen.queryByRole('button', { name: /delete all links/i })
      expect(deleteAllButton).not.toBeInTheDocument()
    })

    it('should show confirmation dialog before deleting all links', async () => {
      const mockLinks = [
        {
          id: '1',
          shortCode: 'abc123',
          originalUrl: 'https://example.com',
          clickCount: 10,
          createdAt: '2024-01-01T00:00:00Z',
          shortenedUrl: 'http://localhost:3000/abc123',
        },
      ]

      ;(global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: mockLinks }),
      })
      ;(global.confirm as jest.Mock).mockReturnValue(false)

      render(<DashboardPage />)

      await waitFor(() => {
        const deleteAllButton = screen.queryByRole('button', { name: /delete all links/i })
        expect(deleteAllButton).toBeInTheDocument()
      })

      const deleteAllButton = screen.getByRole('button', { name: /delete all links/i })
      fireEvent.click(deleteAllButton)

      expect(global.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete ALL your links? This action cannot be undone.'
      )
    })

    it('should delete all links when confirmed', async () => {
      const mockLinks = [
        {
          id: '1',
          shortCode: 'abc123',
          originalUrl: 'https://example.com',
          clickCount: 10,
          createdAt: '2024-01-01T00:00:00Z',
          shortenedUrl: 'http://localhost:3000/abc123',
        },
      ]

      ;(global.confirm as jest.Mock).mockReturnValue(true)
      
      // Mock the initial fetch and the DELETE response
      ;(global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: mockLinks }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { count: 1 } }),
        })

      render(<DashboardPage />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /delete all links/i })).toBeInTheDocument()
      })

      const deleteAllButton = screen.getByRole('button', { name: /delete all links/i })
      fireEvent.click(deleteAllButton)

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/links', {
          method: 'DELETE',
        })
      })

      expect(global.alert).toHaveBeenCalledWith('Successfully deleted 1 link(s)')
    })
  })
})
