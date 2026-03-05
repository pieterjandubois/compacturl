import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'
import QRCodeGenerator from '../QRCodeGenerator'

// Mock fetch
global.fetch = jest.fn()
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url')
global.URL.revokeObjectURL = jest.fn()

describe('QRCodeGenerator Component', () => {
  const mockUrl = 'http://localhost:3000/abc123'
  const mockOnClose = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  describe('Initial Render and Loading', () => {
    it('should show loading state initially', () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      expect(screen.getByText(/generating qr code.../i)).toBeInTheDocument()
    })

    it('should show loading spinner during QR code generation', () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      const spinner = document.querySelector('.animate-spin')
      expect(spinner).toBeInTheDocument()
    })

    it('should fetch QR code from API on mount', () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['mock-qr-code'], { type: 'image/png' }),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      expect(global.fetch).toHaveBeenCalledWith(
        `/api/qr?url=${encodeURIComponent(mockUrl)}`
      )
    })
  })

  describe('Successful QR Code Generation', () => {
    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['mock-qr-code'], { type: 'image/png' }),
      })
    })

    it('should display QR code image after successful generation', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const qrImage = screen.getByAltText('QR Code')
        expect(qrImage).toBeInTheDocument()
      })
    })

    it('should display the URL below the QR code', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText(mockUrl)).toBeInTheDocument()
      })
    })

    it('should show Download button after successful generation', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
      })
    })

    it('should show Close button after successful generation', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const closeButtons = screen.getAllByRole('button', { name: /close/i })
        expect(closeButtons.length).toBeGreaterThan(0)
      })
    })

    it('should create object URL from blob', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(global.URL.createObjectURL).toHaveBeenCalled()
      })
    })

    it('should set QR code image src to object URL', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const qrImage = screen.getByAltText('QR Code') as HTMLImageElement
        expect(qrImage.src).toContain('blob:mock-url')
      })
    })
  })

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText(/failed to generate qr code/i)).toBeInTheDocument()
      })
    })

    it('should display error icon when generation fails', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const errorIcon = document.querySelector('.text-red-500')
        expect(errorIcon).toBeInTheDocument()
      })
    })

    it('should show Close button in error state', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /close/i })).toBeInTheDocument()
      })
    })

    it('should handle network errors gracefully', async () => {
      ;(global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'))

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.getByText(/network error/i)).toBeInTheDocument()
      })
    })

    it('should not show Download button in error state', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument()
      })
    })
  })

  describe('Close Functionality', () => {
    it('should call onClose when X button is clicked', () => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      const closeButton = screen.getByLabelText(/close/i)
      fireEvent.click(closeButton)

      expect(mockOnClose).toHaveBeenCalledTimes(1)
    })

    it('should call onClose when Close button is clicked in success state', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['mock-qr-code'], { type: 'image/png' }),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const closeButtons = screen.getAllByRole('button', { name: /close/i })
        fireEvent.click(closeButtons[0])
      })

      expect(mockOnClose).toHaveBeenCalled()
    })

    it('should call onClose when Close button is clicked in error state', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        blob: async () => new Blob(),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const closeButton = screen.getByRole('button', { name: /close/i })
        fireEvent.click(closeButton)
      })

      expect(mockOnClose).toHaveBeenCalled()
    })
  })

  describe('Download Functionality', () => {
    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['mock-qr-code'], { type: 'image/png' }),
      })
    })

    it('should show Download button after successful generation', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download/i })
        expect(downloadButton).toBeInTheDocument()
      })
    })

    it('should have Download button with correct styling', async () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const downloadButton = screen.getByRole('button', { name: /download/i })
        expect(downloadButton).toHaveClass('bg-blue-600')
      })
    })
  })

  describe('Modal Styling and Accessibility', () => {
    beforeEach(() => {
      ;(global.fetch as jest.Mock).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      )
    })

    it('should render modal with backdrop', () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      const backdrop = document.querySelector('.fixed.inset-0.bg-black.bg-opacity-50')
      expect(backdrop).toBeInTheDocument()
    })

    it('should have QR Code title', () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      expect(screen.getByText('QR Code')).toBeInTheDocument()
    })

    it('should have aria-label on close button', () => {
      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      const closeButton = screen.getByLabelText(/close/i)
      expect(closeButton).toBeInTheDocument()
    })

    it('should display QR code with correct dimensions', async () => {
      ;(global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        blob: async () => new Blob(['mock-qr-code'], { type: 'image/png' }),
      })

      render(<QRCodeGenerator url={mockUrl} onClose={mockOnClose} />)

      await waitFor(() => {
        const qrImage = screen.getByAltText('QR Code')
        expect(qrImage).toHaveClass('w-64', 'h-64')
      })
    })
  })
})
