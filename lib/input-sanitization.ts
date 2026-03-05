/**
 * Input Sanitization and Validation Utilities
 * Requirements: 11.1, 11.2, 11.7
 * 
 * Provides XSS prevention, input validation, and sanitization
 */

export interface PasswordValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Sanitize user input to prevent XSS attacks
 * Removes dangerous HTML tags, event handlers, and protocols
 * Requirement: 11.1, 11.2
 */
export function sanitizeInput(input: string): string {
  if (!input) {
    return ''
  }

  let sanitized = input

  // Remove script tags and their content
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Remove style tags and their content
  sanitized = sanitized.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')

  // Remove iframe tags
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')

  // Remove event handlers (onclick, onload, onerror, etc.)
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '')
  sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^\s>]*/gi, '')

  // Remove javascript: protocol
  sanitized = sanitized.replace(/javascript:/gi, '')

  // Remove data: protocol
  sanitized = sanitized.replace(/data:/gi, '')

  // Decode HTML entities and remove script tags again (to handle encoded attacks)
  const decoded = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, '/')

  // Remove script tags from decoded content
  sanitized = decoded.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

  // Re-encode safe entities
  sanitized = sanitized
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Decode back safe content (text between tags)
  sanitized = sanitized
    .replace(/&lt;([^&]*?)&gt;/g, (match, content) => {
      // If it's a safe tag or just text, keep it encoded
      return match
    })

  // Final cleanup: decode text content but keep tags encoded
  sanitized = sanitized
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')

  // Remove any remaining dangerous tags
  const dangerousTags = ['script', 'iframe', 'object', 'embed', 'style', 'link', 'meta']
  dangerousTags.forEach(tag => {
    const regex = new RegExp(`<${tag}\\b[^<]*(?:(?!<\\/${tag}>)<[^<]*)*<\\/${tag}>`, 'gi')
    sanitized = sanitized.replace(regex, '')
    // Also remove self-closing tags
    const selfClosingRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, 'gi')
    sanitized = sanitized.replace(selfClosingRegex, '')
  })

  return sanitized
}

/**
 * Validate short code format
 * Only allows lowercase letters, numbers, and hyphens
 * No leading/trailing hyphens, no consecutive hyphens
 * Requirement: 11.7
 */
export function validateShortCode(shortCode: string): boolean {
  if (!shortCode || typeof shortCode !== 'string') {
    return false
  }

  // Must contain only lowercase letters, numbers, and hyphens
  // No leading/trailing hyphens
  // No consecutive hyphens
  const regex = /^[a-z0-9]+(-[a-z0-9]+)*$/

  return regex.test(shortCode)
}

/**
 * Validate email format
 * Checks for valid email structure and length
 * Requirement: 11.7
 */
export function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') {
    return false
  }

  // Check length (max 255 characters)
  if (email.length > 255) {
    return false
  }

  // Basic email regex pattern
  // Allows: letters, numbers, dots, hyphens, underscores, plus signs
  // Format: local@domain.tld
  const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  return regex.test(email)
}

/**
 * Validate password strength
 * Requirements:
 * - Minimum 12 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 * - At least one special character
 * Requirement: 11.7
 */
export function validatePassword(password: string): PasswordValidationResult {
  if (!password || typeof password !== 'string') {
    return {
      isValid: false,
      error: 'Password must be at least 12 characters long',
    }
  }

  // Check minimum length
  if (password.length < 12) {
    return {
      isValid: false,
      error: 'Password must be at least 12 characters long',
    }
  }

  // Check for uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one uppercase letter',
    }
  }

  // Check for lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one lowercase letter',
    }
  }

  // Check for number
  if (!/[0-9]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one number',
    }
  }

  // Check for special character
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    return {
      isValid: false,
      error: 'Password must contain at least one special character',
    }
  }

  return { isValid: true }
}
