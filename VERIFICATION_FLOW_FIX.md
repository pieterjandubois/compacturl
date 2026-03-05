# Email Verification Flow Fix

## Problem Description

Users were experiencing issues with the email verification flow:

1. **Email Delivery**: Emails were not being sent consistently after registration
2. **Token Expiration**: Verification links showed "invalid or expired" even when clicked immediately
3. **Authentication Issues**: After verifying email, users couldn't save links and got "authentication required" errors
4. **Session Delay**: Had to logout and login again for verification to take effect

## Root Causes

### 1. Serverless Function Termination
**Problem**: In Vercel's serverless environment, functions can terminate before async operations complete.

**Impact**: Email sending was fire-and-forget, so the function might terminate before the email was actually sent.

**Solution**: Changed to await the email send operation, ensuring it completes before the function terminates.

### 2. Stale Verification Tokens
**Problem**: When deleting a user and re-registering, old verification tokens remained in the database.

**Impact**: Multiple tokens for the same email could cause confusion and validation issues.

**Solution**: Automatically delete existing verification tokens before creating new ones.

### 3. Session Caching Issue
**Problem**: NextAuth JWT tokens are created at login time and cached. The `emailVerified` status wasn't included in the token.

**Impact**: Even after verifying email, the session still showed unverified status until logout/login.

**Solution**: 
- Added `emailVerified` to JWT token and session
- Added callback to refresh user data from database when needed
- Added verification check in API endpoints

### 4. Missing Verification Check in APIs
**Problem**: API endpoints didn't check if the user's email was verified.

**Impact**: Users could potentially access protected resources before verifying their email.

**Solution**: Added verification check in links API that returns a clear error message.

## Changes Made

### 1. Email Sending (`lib/email.ts`)
```typescript
// Before: Fire-and-forget
sendVerificationEmail(email, name, token).catch(...)

// After: Await completion
await sendVerificationEmail(email, name, token)
```

**Benefits**:
- Ensures email is sent before function terminates
- Better error handling and logging
- More reliable delivery in serverless environment

### 2. Token Cleanup (`app/api/auth/register/route.ts`)
```typescript
// Delete any existing verification tokens for this email
await prisma.verificationToken.deleteMany({
  where: { identifier: email },
});
```

**Benefits**:
- Clean state for each registration
- No confusion from multiple tokens
- Prevents token conflicts

### 3. Session Enhancement (`lib/auth.ts`)
```typescript
async jwt({ token, user, trigger }) {
  // Add emailVerified to token
  if (user) {
    token.emailVerified = user.emailVerified;
  }
  
  // Refresh from database if needed
  if (trigger === 'update' || !token.emailVerified) {
    const dbUser = await prisma.user.findUnique({
      where: { id: token.id as string },
      select: { emailVerified: true, email: true, name: true }
    });
    
    if (dbUser) {
      token.emailVerified = dbUser.emailVerified;
    }
  }
  
  return token;
}
```

**Benefits**:
- Session includes verification status
- Automatically refreshes when needed
- No need to logout/login after verification

### 4. API Verification Check (`app/api/links/route.ts`)
```typescript
async function getVerifiedUser(email: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, emailVerified: true }
  });

  if (!user.emailVerified) {
    return { 
      error: { 
        code: 'EMAIL_NOT_VERIFIED', 
        message: 'Please verify your email address. Check your inbox for the verification link.' 
      }, 
      status: 403 
    };
  }

  return { user };
}
```

**Benefits**:
- Clear error message for unverified users
- Prevents access to protected resources
- Consistent verification check across endpoints

### 5. Enhanced Logging
Added detailed logging throughout the email sending process:
- Timestamps for tracking
- Request/response details
- Error categorization (rate limiting, sandbox restrictions, etc.)
- Database operation logging

**Benefits**:
- Easy debugging in Vercel logs
- Quick identification of issues
- Better monitoring of email delivery

## Expected Behavior Now

### Registration Flow
1. User registers with email and password
2. User record created in database with `emailVerified: null`
3. Verification token created
4. **Email sent and confirmed before response** ✅
5. User receives 201 response
6. User receives verification email within 1-2 minutes

### Verification Flow
1. User clicks verification link in email
2. Token validated (not expired, exists in database)
3. User's `emailVerified` field updated to current timestamp
4. Token deleted from database
5. User redirected to login page with success message
6. User can now login successfully

### Login Flow
1. User enters email and password
2. Credentials validated
3. **Email verification status checked** ✅
4. If not verified: Error message "Please verify your email before logging in"
5. If verified: Session created with `emailVerified` in token
6. User redirected to dashboard

### API Access Flow
1. User makes API request (e.g., GET /api/links)
2. Session validated
3. **User fetched from database with verification status** ✅
4. If not verified: 403 error with clear message
5. If verified: Request processed normally

## Testing the Fix

### Test 1: Fresh Registration
1. Register with a new email
2. Check Vercel logs - should see "✅ Verification email sent successfully"
3. Check email inbox - should receive email within 1-2 minutes
4. Click verification link - should see success message
5. Login - should work immediately
6. Try to save a link - should work without issues

### Test 2: Re-registration After Cleanup
1. Delete user from database
2. Wait 2-3 minutes (avoid rate limiting)
3. Register again with same email
4. Should receive new verification email
5. Old tokens automatically cleaned up
6. Verification should work normally

### Test 3: Login Before Verification
1. Register new account
2. Try to login immediately (before clicking verification link)
3. Should get error: "Please verify your email before logging in"
4. Click verification link
5. Login again - should work
6. Dashboard access should work immediately

### Test 4: API Access Without Verification
1. Register new account
2. Somehow get a session (shouldn't be possible, but testing edge case)
3. Try to access /api/links
4. Should get 403 error: "Please verify your email address"
5. After verification, API access should work

## Monitoring

### Vercel Logs to Check
Look for these log messages in successful flow:

**Registration**:
```
🚀 Sending verification email...
🔧 Initializing Resend client...
✅ Resend client initialized
📧 Attempting to send email...
🔄 Calling Resend API...
📦 Resend API response received
✅ Email sent successfully
📧 Email ID: [id]
✅ Verification email sent successfully
```

**Verification**:
```
=== EMAIL VERIFICATION ATTEMPT ===
Token received: [token]
🔍 Looking up token in database...
Token lookup result: FOUND
✅ Token is valid, verifying email for: [email]
✅ User email verified
✅ Verification token deleted
=== VERIFICATION SUCCESSFUL ===
```

**Login**:
```
JWT callback - Added user data to token
Session callback - Session created for user
```

**API Access**:
```
Links API - Session check
✅ Email verified, processing request
```

### Error Indicators

**Email Not Sent**:
```
❌ Failed to send verification email:
```

**Rate Limiting**:
```
🚫 RATE LIMIT DETECTED - Resend is throttling requests
```

**Unverified Email**:
```
❌ Email not verified for user: [email]
```

## Troubleshooting

### Issue: Still Not Receiving Emails
1. Check Vercel logs for "✅ Verification email sent successfully"
2. Check Resend dashboard: https://resend.com/emails
3. Check spam folder
4. Wait 5 minutes between registration attempts (rate limiting)
5. Verify RESEND_API_KEY is correct in Vercel

### Issue: Token Expired Immediately
1. Check system time is correct
2. Check database timezone settings
3. Look for "Token expiration check" in Vercel logs
4. Verify token was created recently (within 24 hours)

### Issue: Can't Save Links After Verification
1. Logout completely
2. Clear browser cookies
3. Login again
4. Check Vercel logs for "Email not verified" errors
5. Verify database shows `emailVerified` timestamp

### Issue: Authentication Required After Login
1. Check session in browser DevTools (Application > Cookies)
2. Verify `next-auth.session-token` cookie exists
3. Check Vercel logs for session creation
4. Try logout and login again
5. Check if `emailVerified` is in session (should be after this fix)

## Additional Notes

### Resend Sandbox Limitation
- Free tier can only send to the email used to sign up for Resend
- To send to other emails, verify a domain at https://resend.com/domains
- Update `EMAIL_FROM` environment variable to use verified domain

### Rate Limiting
- Resend has rate limits (not publicly documented)
- Wait 1-2 minutes between registration attempts
- Monitor Resend dashboard for usage
- Consider upgrading plan for higher limits

### Session Refresh
- Sessions now include `emailVerified` status
- JWT token refreshes user data when needed
- No need to logout/login after verification (after this fix)
- Session updates automatically on next request

## Success Criteria

✅ Emails sent reliably every time
✅ Verification links work immediately after clicking
✅ Login works immediately after verification
✅ Dashboard and API access work without logout/login
✅ Clear error messages for unverified users
✅ Detailed logging for debugging
✅ Clean token management (no stale tokens)

## Files Modified

1. `lib/email.ts` - Email sending with await
2. `app/api/auth/register/route.ts` - Token cleanup and await email
3. `lib/auth.ts` - Session enhancement with emailVerified
4. `types/next-auth.d.ts` - TypeScript types for emailVerified
5. `app/api/links/route.ts` - Verification check in API
6. `EMAIL_TROUBLESHOOTING.md` - Troubleshooting guide
7. `VERIFICATION_FLOW_FIX.md` - This document
