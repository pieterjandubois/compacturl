# Email Troubleshooting Guide

## Changes Made to Improve Email Reliability

### 1. Serverless Environment Fix
**Problem**: In serverless environments (Vercel), functions can terminate before async operations complete.

**Solution**: Changed from fire-and-forget to awaiting the email send operation. This ensures the email is sent before the function terminates.

### 2. Token Cleanup
**Problem**: When you delete a user and re-register, old verification tokens might still exist in the database.

**Solution**: Now automatically deletes any existing verification tokens for an email before creating a new one.

### 3. Better Error Detection
**Problem**: Hard to diagnose why emails aren't being sent.

**Solution**: Added specific error detection for:
- Rate limiting
- Sandbox restrictions
- API errors

### 4. Enhanced Logging
**Problem**: Difficult to track email sending issues.

**Solution**: Added timestamps and detailed logging at every step of the email sending process.

## Common Issues and Solutions

### Issue 1: Not Receiving Emails After Deleting User

**Symptoms**: 
- You delete your user from the database
- Register again with the same email
- Don't receive verification email

**Possible Causes**:
1. **Resend Rate Limiting**: Resend may be rate-limiting requests to the same email address
2. **Cached Tokens**: Old verification tokens weren't cleaned up (now fixed)
3. **Serverless Timeout**: Function terminated before email was sent (now fixed)

**What to Check**:
1. Check Vercel logs for the registration request
2. Look for these log messages:
   - `🚀 Sending verification email...`
   - `✅ Verification email sent successfully`
   - `❌ Failed to send verification email:` (if there's an error)

3. Check for rate limit errors:
   - `🚫 RATE LIMIT DETECTED`
   - Error message containing "rate limit" or "too many"

**Solutions**:
- Wait 5-10 minutes between registration attempts
- Check your Resend dashboard at https://resend.com/emails to see if emails are being sent
- Verify your RESEND_API_KEY is correct in Vercel environment variables

### Issue 2: Resend Sandbox Limitation

**Symptoms**:
- Emails only work for pieterjan.dubois@hotmail.com
- Other email addresses don't receive emails

**Cause**: 
Resend free tier (sandbox mode) can only send emails to the email address you used to sign up for Resend.

**Solution**:
To send to other email addresses, you need to:
1. Verify a domain at https://resend.com/domains
2. Update the `EMAIL_FROM` environment variable to use your verified domain
3. Example: `EMAIL_FROM=noreply@yourdomain.com`

### Issue 3: Intermittent Email Delivery

**Symptoms**:
- Sometimes emails arrive, sometimes they don't
- No clear pattern

**Possible Causes**:
1. **Resend Rate Limiting**: Too many requests in a short time
2. **Email Provider Delays**: Your email provider (Hotmail) may be delaying delivery
3. **Spam Filtering**: Emails might be going to spam

**What to Check**:
1. Check your spam/junk folder
2. Check Resend dashboard for email status
3. Look at Vercel logs for any errors
4. Wait a few minutes - sometimes emails are delayed

**Solutions**:
- Add noreply@resend.dev to your contacts
- Check spam folder
- Wait 5-10 minutes between registration attempts
- Verify domain to improve deliverability

## Debugging Steps

### Step 1: Check Vercel Logs
1. Go to your Vercel dashboard
2. Click on your deployment
3. Go to "Functions" tab
4. Find the `/api/auth/register` function
5. Look for these log messages:

```
🚀 Sending verification email...
Email params: { email: '...', name: '...', tokenLength: 64, timestamp: '...' }
🔧 Initializing Resend client...
✅ Resend client initialized
📧 Attempting to send email...
🔄 Calling Resend API...
Request timestamp: ...
📦 Resend API response received at: ...
✅ Email sent successfully to ...
📧 Email ID: ...
✅ Verification email sent successfully
```

### Step 2: Check for Errors
Look for these error indicators:

**Rate Limiting**:
```
🚫 RATE LIMIT DETECTED - Resend is throttling requests
```

**Sandbox Restriction**:
```
🔒 SANDBOX RESTRICTION - Can only send to verified email
```

**API Error**:
```
❌ Resend API returned an error:
Error message: ...
```

### Step 3: Check Resend Dashboard
1. Go to https://resend.com/emails
2. Look for your recent emails
3. Check their status:
   - ✅ Delivered
   - ⏳ Pending
   - ❌ Failed

### Step 4: Verify Environment Variables
In Vercel, check that these are set:
- `RESEND_API_KEY`: Your Resend API key (starts with `re_`)
- `EMAIL_FROM`: Email address to send from (default: `onboarding@resend.dev`)
- `NEXTAUTH_URL`: Your production URL (e.g., `https://v5compacturl.vercel.app`)

## Testing Recommendations

### Test 1: Fresh Registration
1. Use a completely new email address (not used before)
2. Register
3. Check Vercel logs immediately
4. Check email within 1-2 minutes

### Test 2: Re-registration After Cleanup
1. Delete user from database
2. Wait 5 minutes
3. Register again with same email
4. Check Vercel logs
5. Check email within 1-2 minutes

### Test 3: Multiple Registrations
1. Register with email A
2. Wait 2 minutes
3. Register with email B
4. Wait 2 minutes
5. Register with email C
6. Check if all emails arrive

## Rate Limiting Guidelines

Resend free tier limits:
- 100 emails per day
- Rate limits may apply (not publicly documented)

**Best Practices**:
- Wait at least 1-2 minutes between registration attempts
- Don't register the same email more than once per 5 minutes
- Monitor your Resend dashboard for usage

## Next Steps if Issues Persist

1. **Check Resend Status**: https://resend.com/status
2. **Review Resend Logs**: https://resend.com/emails
3. **Contact Resend Support**: If you see emails marked as "Delivered" but not receiving them
4. **Verify Domain**: Set up domain verification to improve deliverability
5. **Check Email Provider**: Some providers (like Hotmail) may have aggressive spam filtering

## Monitoring Email Delivery

After each registration, check:
1. ✅ Vercel logs show "Email sent successfully"
2. ✅ Resend dashboard shows email as "Delivered"
3. ✅ Email arrives in inbox (or spam folder)

If any step fails, use the debugging steps above to identify the issue.
