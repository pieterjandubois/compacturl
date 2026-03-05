# Complete Authentication Flow Test Guide

## What Was Fixed

The authentication flow had a timing/session issue where:
1. ✅ Email verification was working (database was updated)
2. ❌ But the verification page showed an error
3. ❌ User could login but got "authentication required" errors
4. ❌ Had to logout/login again for everything to work

**Root Cause**: Session wasn't refreshing after email verification. The JWT token was created at login time with old user data (emailVerified: null), and it wasn't being refreshed.

**Fixes Applied**:
1. Added `emailVerified` to JWT token and session
2. Session now refreshes user data from database when needed
3. Verification page now handles duplicate verification gracefully
4. API endpoints check fresh user data from database

## Step-by-Step Test

### Prerequisites
- Delete your user from the database
- Wait 2-3 minutes (to avoid Resend rate limiting)
- Clear browser cookies/cache (optional but recommended)

### Step 1: Register
1. Go to https://v5compacturl.vercel.app/register
2. Enter:
   - Email: `pieterjan.dubois@hotmail.com`
   - Password: `TestPassword123!`
   - Name: `Test User`
3. Click "Sign up"
4. **Expected**: 
   - ✅ See "Registration successful" message
   - ✅ Receive email within 1-2 minutes

### Step 2: Verify Email
1. Check your email inbox
2. Click the verification link
3. **Expected**:
   - ✅ See "Email Verified!" success message (NOT error)
   - ✅ Automatically redirected to login page after 2 seconds
   - ✅ See "Email verified successfully! You can now sign in." message on login page

### Step 3: Login
1. On login page, enter:
   - Email: `pieterjan.dubois@hotmail.com`
   - Password: `TestPassword123!`
2. Click "Sign in"
3. **Expected**:
   - ✅ Redirected to dashboard immediately
   - ✅ NO "authentication required" errors
   - ✅ Dashboard loads successfully

### Step 4: Save a Link
1. On dashboard, enter a URL (e.g., `https://www.google.com`)
2. Click "Shorten URL"
3. **Expected**:
   - ✅ Link created successfully
   - ✅ Short URL displayed
   - ✅ NO "authentication required" errors
   - ✅ NO need to logout/login again

### Step 5: Verify Session Persistence
1. Refresh the page (F5)
2. **Expected**:
   - ✅ Still logged in
   - ✅ Dashboard still accessible
   - ✅ Can still create/save links

### Step 6: Logout and Login Again
1. Click logout
2. Login again with same credentials
3. **Expected**:
   - ✅ Login works immediately
   - ✅ Dashboard accessible
   - ✅ Can create/save links without any delays

## What to Check in Vercel Logs

### Successful Registration
```
🚀 Sending verification email...
✅ Verification email sent successfully
```

### Successful Verification
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

### Successful Login
```
JWT callback - Added user data to token
Session callback - Session created for user
```

### Successful API Access
```
Links API - Session check
✅ Email verified, processing request
```

## Common Issues and Solutions

### Issue 1: Still Seeing "Invalid Token" Error on Verification
**Cause**: Browser cached the old page or there's a timing issue

**Solution**:
1. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
2. Clear browser cache
3. Try the verification link again
4. Check Vercel logs for "=== VERIFICATION SUCCESSFUL ==="

### Issue 2: "Authentication Required" Error After Login
**Cause**: Session not refreshing with emailVerified status

**Solution**:
1. Check browser DevTools (F12 → Application → Cookies)
2. Verify `next-auth.session-token` cookie exists
3. Logout completely
4. Clear all cookies
5. Login again
6. Check Vercel logs for "Session callback - Session created"

### Issue 3: Getting Logged Out Unexpectedly
**Cause**: Session expiration or cookie issues

**Solution**:
1. Check session timeout (default: 7 days)
2. Verify cookies are not being blocked
3. Check browser privacy settings
4. Try in incognito/private mode
5. Check Vercel logs for any session errors

### Issue 4: Can't Create/Save Links After Login
**Cause**: API not recognizing verified email status

**Solution**:
1. Logout and login again
2. Check Vercel logs for "Email not verified" errors
3. Verify database shows `emailVerified` timestamp
4. Check if session includes `emailVerified` in JWT token

## Monitoring Checklist

After each step, verify:

### Registration
- [ ] Email sent successfully (check Vercel logs)
- [ ] Email received in inbox
- [ ] Email contains correct verification link
- [ ] Link format: `https://v5compacturl.vercel.app/verify?token=[token]`

### Verification
- [ ] Verification page shows success (not error)
- [ ] Redirects to login automatically
- [ ] Database shows `emailVerified` timestamp
- [ ] Vercel logs show "=== VERIFICATION SUCCESSFUL ==="

### Login
- [ ] Login succeeds immediately
- [ ] No "authentication required" errors
- [ ] Dashboard loads without delays
- [ ] Session cookie created

### API Access
- [ ] Can create shortened URLs
- [ ] Can save links
- [ ] No "authentication required" errors
- [ ] No need to logout/login again

## Performance Expectations

| Action | Expected Time |
|--------|---|
| Register | < 1 second |
| Email delivery | 1-2 minutes |
| Verification | < 1 second |
| Login | < 1 second |
| Create link | < 1 second |
| Save link | < 1 second |
| Dashboard load | < 2 seconds |

## Success Criteria

✅ **All of these should be true**:
1. Email verification shows success (not error)
2. Can login immediately after verification
3. Can create/save links without "authentication required" errors
4. No need to logout/login after verification
5. Session persists across page refreshes
6. Can logout and login again without issues
7. All actions complete within expected times

## If Issues Persist

1. **Check Vercel Logs**:
   - Go to Vercel dashboard
   - Click on deployment
   - Check "Functions" tab
   - Look for error messages

2. **Check Database**:
   - Verify user record exists
   - Check `emailVerified` field has timestamp
   - Check `verificationToken` table is empty (tokens deleted after use)

3. **Check Environment Variables**:
   - `RESEND_API_KEY` is set
   - `NEXTAUTH_URL` is correct
   - `NEXTAUTH_SECRET` is set

4. **Clear Everything**:
   - Delete user from database
   - Clear browser cookies
   - Hard refresh page
   - Try registration again

5. **Contact Support**:
   - Provide Vercel logs
   - Describe exact steps taken
   - Include error messages
   - Include browser console errors

## Next Steps After Successful Test

Once the complete flow works:
1. Test with different email addresses (if domain verified)
2. Test logout/login cycle multiple times
3. Test on different browsers
4. Test on mobile devices
5. Monitor Vercel logs for any errors
6. Check Resend dashboard for email delivery status

## Notes

- First verification might take a few seconds (cold start)
- Subsequent verifications should be instant
- Session lasts 7 days by default
- Verification tokens expire after 24 hours
- Resend free tier limited to 100 emails/day
