# Email Verification Issues - Diagnosis and Fixes

## Issues Identified

### Issue 1: Verification Page Shows Error (But Database is Updated)
**Symptom**: Clicking verification link shows "Invalid or expired token" error, but database shows `emailVerified` has a timestamp.

**Root Cause**: The verification endpoint is being called TWICE:
1. First call: Succeeds, updates database, deletes token
2. Second call: Fails because token was already deleted

**Why it happens**: Browser prefetching or the React component making duplicate requests.

**Fix**: Make the verification endpoint idempotent - if the email is already verified, return success instead of error.

### Issue 2: "Authentication Required" After Login
**Symptom**: User can login but dashboard shows "Authentication required" error.

**Root Cause**: Session is not being established properly after login, OR the session doesn't include the user ID needed by the API.

**Possible causes**:
- NextAuth session callback not working correctly
- JWT token not including user ID
- Session not being refreshed after email verification

## Fixes to Implement

### Fix 1: Make Verification Endpoint Idempotent

Update `/app/api/auth/verify/route.ts`:

```typescript
// After checking if token exists
if (!verificationToken) {
  // Check if user is already verified
  console.log('🔍 Token not found, checking if email already verified...');
  
  // Try to extract email from token pattern or check recent verifications
  // For now, return a more helpful error
  const recentlyVerifiedUsers = await prisma.user.findMany({
    where: {
      emailVerified: {
        not: null,
        gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
      }
    },
    select: { email: true, emailVerified: true }
  });
  
  console.log('Recently verified users:', recentlyVerifiedUsers.length);
  
  // If we can't find the token, it might have been used already
  // Return a success message if this looks like a duplicate request
  return NextResponse.json(
    {
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired verification token. If you just verified your email, you can proceed to login.',
      },
    },
    { status: 400 }
  );
}
```

**Better approach**: Store the token in a way that allows checking if it was recently used:

```typescript
// Before deleting the token, check if user is already verified
const user = await prisma.user.findUnique({
  where: { email: verificationToken.identifier },
  select: { emailVerified: true }
});

if (user?.emailVerified) {
  // Already verified - this is a duplicate request
  console.log('✅ Email already verified (duplicate request)');
  
  // Delete the token if it still exists
  await prisma.verificationToken.deleteMany({
    where: { identifier: verificationToken.identifier }
  });
  
  return NextResponse.json(
    {
      data: {
        message: 'Email verified successfully',
      },
    },
    { status: 200 }
  );
}
```

### Fix 2: Ensure Session Includes User ID

Check `/lib/auth.ts` callbacks:

```typescript
callbacks: {
  async jwt({ token, user }) {
    // Add user ID to token on sign in
    if (user) {
      token.id = user.id;
      console.log('JWT callback - Added user ID to token:', user.id);
    }
    return token;
  },
  
  async session({ session, token }) {
    // Add user ID to session
    if (session.user) {
      session.user.id = token.id as string;
      console.log('Session callback - User ID:', session.user.id);
    }
    return session;
  },
}
```

### Fix 3: Prevent Duplicate Verification Requests

Update `/app/(auth)/verify/page.tsx` to prevent duplicate calls:

```typescript
useEffect(() => {
  const token = searchParams.get('token')
  
  if (!token) {
    setStatus('error')
    setMessage('Verification token is missing')
    return
  }

  // Prevent duplicate calls
  let isCancelled = false

  const verifyEmail = async () => {
    try {
      const response = await fetch(`/api/auth/verify?token=${token}`)
      
      if (isCancelled) return // Ignore if component unmounted
      
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error?.message || 'Verification failed')
      }

      setStatus('success')
      setMessage('Your email has been verified successfully!')

      // Redirect to login after 3 seconds
      setTimeout(() => {
        if (!isCancelled) {
          router.push('/login')
        }
      }, 3000)
    } catch (err) {
      if (isCancelled) return
      
      setStatus('error')
      setMessage(err instanceof Error ? err.message : 'Verification failed')
    }
  }

  verifyEmail()
  
  // Cleanup function to prevent state updates after unmount
  return () => {
    isCancelled = true
  }
}, [searchParams, router])
```

## Testing Steps

1. **Deploy the fixes**
2. **Register a new account**
3. **Check Vercel logs** for:
   - "=== EMAIL VERIFICATION ATTEMPT ===" 
   - Token lookup results
   - Whether it's a duplicate request
4. **Click verification link**
5. **Check if error still appears**
6. **Try logging in**
7. **Check if dashboard loads without "Authentication required" error**

## Additional Debugging

Add these logs to help diagnose:

### In `/app/api/links/route.ts`:
```typescript
console.log('Links API - Session check:', {
  hasSession: !!session,
  hasUser: !!session?.user,
  hasEmail: !!session?.user?.email,
  email: session?.user?.email
});
```

### In `/lib/auth.ts` authorize function:
```typescript
console.log('Authorize - User found:', {
  userId: user.id,
  email: user.email,
  emailVerified: user.emailVerified,
  hasPassword: !!user.password
});
```

## Expected Behavior After Fixes

1. ✅ User registers → receives email
2. ✅ User clicks verification link → sees success message (even if called twice)
3. ✅ User logs in → session is created with user ID
4. ✅ Dashboard loads → shows user's links (or empty state)
5. ✅ No "Authentication required" errors
