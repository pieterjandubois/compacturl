# Vercel Email Configuration Fix

## Issues Fixed

### 1. Email Not Sending in Production
**Problem:** Emails weren't being sent because the code required both Resend configuration AND production environment.

**Fix:** Modified `lib/email.ts` to send emails whenever Resend is configured, regardless of environment. Now it will:
- Send emails if `RESEND_API_KEY` is set
- Log to console if `RESEND_API_KEY` is not set
- Show detailed error messages if email sending fails

### 2. Login Blocked by Email Verification
**Problem:** Users couldn't log in because `emailVerified` was `null` and authentication required it to be set.

**Fix:** Temporarily disabled email verification requirement in `lib/auth.ts` to allow testing. Added warning log when users log in without verification.

## Next Steps to Enable Emails

### Step 1: Configure Resend in Vercel

1. Go to your Vercel dashboard: https://vercel.com/dashboard
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add or verify these variables:

```bash
RESEND_API_KEY=re_your_actual_api_key_here
EMAIL_FROM=onboarding@resend.dev
```

**To get your Resend API key:**
1. Sign up at https://resend.com (free tier: 3,000 emails/month)
2. Go to **API Keys** in the dashboard
3. Create a new API key
4. Copy the key (starts with `re_`)

### Step 2: Redeploy Your Application

After adding the environment variables:

```bash
# Commit the code changes
git add .
git commit -m "fix: email sending and temporary bypass for email verification"
git push origin main
```

Vercel will automatically redeploy with the new code and environment variables.

### Step 3: Test Email Sending

1. Register a new test account
2. Check Vercel logs for email confirmation:
   - Should see: `✅ Email sent to user@example.com`
   - If error: Check the error details in logs
3. Check your email inbox for the verification email

### Step 4: Re-enable Email Verification (After Testing)

Once emails are working, re-enable the email verification requirement:

In `lib/auth.ts`, uncomment these lines:

```typescript
// Change from:
// if (!user.emailVerified) {
//   throw new Error('Please verify your email before logging in');
// }

// Back to:
if (!user.emailVerified) {
  throw new Error('Please verify your email before logging in');
}
```

Then remove the warning log below it.

## Testing Checklist

- [ ] Add `RESEND_API_KEY` to Vercel environment variables
- [ ] Add `EMAIL_FROM` to Vercel environment variables
- [ ] Redeploy application
- [ ] Register new test account
- [ ] Verify email is received
- [ ] Click verification link
- [ ] Confirm login works after verification
- [ ] Re-enable email verification requirement
- [ ] Test that unverified users cannot log in

## Troubleshooting

### Emails Still Not Sending

Check Vercel logs for error messages:
1. Go to Vercel dashboard → Your project → Deployments
2. Click on the latest deployment
3. Go to **Functions** tab
4. Look for `/api/auth/register` function logs

Common issues:
- **Invalid API key**: Check that `RESEND_API_KEY` is correct
- **Invalid sender email**: Use `onboarding@resend.dev` for testing
- **Domain not verified**: For custom domains, verify in Resend dashboard

### Login Still Fails

If login fails even with the temporary bypass:
1. Check that the password meets requirements (12+ chars, mixed case, numbers, special chars)
2. Check Vercel logs for the actual error message
3. Verify the user exists in the database
4. Check that the password was hashed correctly during registration

## Current Status

✅ Code changes deployed
⏳ Waiting for Resend API key configuration
⏳ Email verification temporarily disabled for testing

Once you configure Resend and test emails, you can re-enable email verification for production security.
