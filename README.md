# CompactURL

A modern URL shortening service with intelligent link management and real-time analytics.

**🌐 Live Demo:** [https://v5compacturl.vercel.app](https://v5compacturl.vercel.app)

---

## What It Does

CompactURL transforms long URLs into short, memorable links with smart naming based on the URL content. For example, `https://kubernetes.io/docs/tutorials/kubernetes-basics/create-cluster/cluster-intro/` becomes `https://v5compacturl.vercel.app/kubernetes`.

### Key Features

- **Smart Short Codes** - Automatically generates meaningful codes from domain + path
- **Click Analytics** - Track how many times your links are clicked (with bot detection)
- **QR Code Generation** - Instant QR codes for any shortened URL
- **Link Management** - Save, organize, and delete your links
- **User Accounts** - Register to save links permanently and get higher rate limits
- **Fast Redirects** - Sub-100ms redirect times with Redis caching

### For Anonymous Users
- Shorten URLs without registration
- 40 links per hour per IP
- Links expire after 2 days

### For Registered Users
- 100 links per hour
- Saved links never expire
- Full dashboard with analytics
- Sort by date, name, or clicks

---

## How It's Built

### Technology Stack

**Frontend**
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

**Backend**
- Next.js API Routes
- NextAuth.js (Email/Password + Google OAuth)
- bcrypt password hashing

**Database & Caching**
- PostgreSQL (Neon) with Prisma ORM
- Redis (Upstash) for caching and rate limiting

**Services**
- Resend for email verification
- Vercel for deployment

### Architecture Highlights

- **3-Tier URL Validation** - Format → DNS → HTTP checks ensure only valid URLs
- **Smart Naming Engine** - Extracts meaningful parts from URLs for readable codes
- **Cache-Aside Pattern** - Redis caching with 1-hour TTL for hot links
- **Async Click Tracking** - Non-blocking click counting for performance
- **Property-Based Testing** - 15 correctness properties validated with fast-check

### Security Features

- bcrypt password hashing (cost factor 12)
- Mandatory email verification
- CSRF protection
- Rate limiting (IP-based and account-based)
- Security headers (CSP, X-Frame-Options, HSTS)
- Input sanitization and XSS prevention

---

## Testing the App

**⚠️ Important Note:** Due to Resend's free tier limitations, only the email configured for the account's API key can receive verification emails. This means:

- You can use the app anonymously without any restrictions
- Registration/login is currently limited to the configured email address (no confirmation mail will be received for email addresses other than the Resend configured one.

---
