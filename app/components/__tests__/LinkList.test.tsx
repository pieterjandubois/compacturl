import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import LinkList from '../LinkList'

// Mock QRCodeGenerator component
jest.mock('../QRCodeGenerator', () => {
  return function MockQRCodeGenerator({ url, onClose }: any) {
    return (
      <div data-testid="qr-modal">
        <div>QR Code for: {url}</div>
        <button onClick={onClose}>Close QR</button>
      </div>
    )
  }
})

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn().mockResolvedValue(undefined),
  },
})

describe('LinkList Component', () => {
  const mockLinks = [
    {
      id: '1',
      shortCode: 'abc123',
      originalUrl: 'https://example.com/very/long/url',
      clickCount: 10,
      createdAt: '2024-01-15T10:00:00Z',
      shortenedUrl: 'http://localhost:3000/abc123',
    },
    {
      id: '2',
      shortCode: 'xyz789',
      originalUrl: 'https://another-example.com',
      clickCount: 5,
      createdAt: '2024-01-16T10:00:00Z',
      shortenedUrl: 'http://localhost:3000/xyz789',
    },
  ]

  const mockOnDelete = jest.fn()
  const mockOnRefresh = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Link Rendering', () => {
    it('should render all links in desktop table view', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      // Both desktop and mobile views render, so use getAllByText
      expect(screen.getAllByText('abc123').length).toBeGreaterThan(0)
      expect(screen.getAllByText('xyz789').length).toBeGreaterThan(0)
      expect(screen.getAllByText('10').length).toBeGreaterThan(0)
      expect(screen.getAllByText('5').length).toBeGreaterThan(0)
    })

    it('should display short codes as clickable links', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const link = screen.getAllByRole('link', { name: /abc123/i })[0]
      expect(link).toHaveAttribute('href', 'http://localhost:3000/abc123')
      expect(link).toHaveAttribute('target', '_blank')
      expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    })

    it('should display original URLs as clickable links', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const links = screen.getAllByRole('link')
      const originalUrlLink = links.find((link) =>
        link.getAttribute('href')?.includes('example.com/very/long/url')
      )

      expect(originalUrlLink).toBeInTheDocument()
      expect(originalUrlLink).toHaveAttribute('target', '_blank')
    })

    it('should truncate long URLs', () => {
      const longUrlLink = {
        ...mockLinks[0],
        originalUrl: 'https://example.com/' + 'a'.repeat(100),
      }

      render(
        <LinkList links={[longUrlLink]} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />
      )

      // Should show truncated version with ellipsis (appears in both desktop and mobile views)
      const linkTexts = screen.getAllByText(/\.\.\./i)
      expect(linkTexts.length).toBeGreaterThan(0)
    })

    it('should display click counts', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      expect(screen.getByText('10')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('should format creation dates', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      // Dates appear in both desktop and mobile views
      expect(screen.getAllByText(/jan 15, 2024/i).length).toBeGreaterThan(0)
      expect(screen.getAllByText(/jan 16, 2024/i).length).toBeGreaterThan(0)
    })
  })

  describe('Copy URL Functionality', () => {
    it('should copy URL to clipboard when copy button is clicked', async () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const copyButtons = screen.getAllByTitle('Copy URL')
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
          'http://localhost:3000/abc123'
        )
      })
    })

    it('should show success checkmark after copying', async () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const copyButtons = screen.getAllByTitle('Copy URL')
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        // Check for checkmark SVG path
        const checkmark = document.querySelector('path[d*="M5 13l4 4L19 7"]')
        expect(checkmark).toBeInTheDocument()
      })
    })

    it('should reset copy success state after 2 seconds', async () => {
      jest.useFakeTimers()

      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const copyButtons = screen.getAllByTitle('Copy URL')
      fireEvent.click(copyButtons[0])

      await waitFor(() => {
        const checkmark = document.querySelector('path[d*="M5 13l4 4L19 7"]')
        expect(checkmark).toBeInTheDocument()
      })

      // Fast-forward 2 seconds
      jest.advanceTimersByTime(2000)

      await waitFor(() => {
        const checkmark = document.querySelector('path[d*="M5 13l4 4L19 7"]')
        expect(checkmark).not.toBeInTheDocument()
      })

      jest.useRealTimers()
    })
  })

  describe('QR Code Generation', () => {
    it('should open QR code modal when QR button is clicked', async () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const qrButtons = screen.getAllByTitle('Generate QR Code')
      fireEvent.click(qrButtons[0])

      await waitFor(() => {
        expect(screen.getByTestId('qr-modal')).toBeInTheDocument()
      })

      expect(screen.getByText(/qr code for: http:\/\/localhost:3000\/abc123/i)).toBeInTheDocument()
    })

    it('should close QR code modal when close button is clicked', async () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const qrButtons = screen.getAllByTitle('Generate QR Code')
      fireEvent.click(qrButtons[0])

      await waitFor(() => {
        expect(screen.getByTestId('qr-modal')).toBeInTheDocument()
      })

      const closeButton = screen.getByRole('button', { name: /close qr/i })
      fireEvent.click(closeButton)

      await waitFor(() => {
        expect(screen.queryByTestId('qr-modal')).not.toBeInTheDocument()
      })
    })
  })

  describe('Delete Functionality', () => {
    it('should call onDelete with link ID when delete button is clicked', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const deleteButtons = screen.getAllByTitle('Delete')
      fireEvent.click(deleteButtons[0])

      expect(mockOnDelete).toHaveBeenCalledWith('1')
    })

    it('should call onDelete for correct link', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const deleteButtons = screen.getAllByTitle('Delete')
      fireEvent.click(deleteButtons[1])

      expect(mockOnDelete).toHaveBeenCalledWith('2')
    })
  })

  describe('Mobile View', () => {
    it('should render mobile card layout', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      // Mobile view uses different class names
      const mobileContainer = document.querySelector('.md\\:hidden')
      expect(mobileContainer).toBeInTheDocument()
    })

    it('should show QR Code and Delete buttons in mobile view', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      // In mobile view, buttons have text labels
      const qrButtons = screen.getAllByRole('button', { name: /qr code/i })
      const deleteButtons = screen.getAllByRole('button', { name: /delete/i })

      expect(qrButtons.length).toBeGreaterThan(0)
      expect(deleteButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Empty State', () => {
    it('should handle empty links array', () => {
      render(<LinkList links={[]} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      // Should render table/card structure but with no rows
      expect(screen.queryByText('abc123')).not.toBeInTheDocument()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA labels for icon buttons', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      expect(screen.getAllByTitle('Copy URL').length).toBeGreaterThan(0)
      expect(screen.getAllByTitle('Generate QR Code').length).toBeGreaterThan(0)
      expect(screen.getAllByTitle('Delete').length).toBeGreaterThan(0)
    })

    it('should have proper link attributes for external links', () => {
      render(<LinkList links={mockLinks} onDelete={mockOnDelete} onRefresh={mockOnRefresh} />)

      const externalLinks = screen.getAllByRole('link')
      externalLinks.forEach((link) => {
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      })
    })
  })
})
