# Deploy Database Migrations to Vercel
# Run this after deploying to Vercel for the first time

Write-Host "🚀 Deploying database migrations to Vercel..." -ForegroundColor Green

# Check if Vercel CLI is installed
$vercelInstalled = Get-Command vercel -ErrorAction SilentlyContinue
if (-not $vercelInstalled) {
    Write-Host "❌ Vercel CLI not found. Installing..." -ForegroundColor Yellow
    npm install -g vercel
}

# Pull production environment variables
Write-Host "📥 Pulling production environment variables..." -ForegroundColor Cyan
vercel env pull .env.production

# Run migrations
Write-Host "🔄 Running database migrations..." -ForegroundColor Cyan
npx prisma migrate deploy

Write-Host "✅ Migrations deployed successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Test your deployment at your Vercel URL"
Write-Host "2. Register a test account"
Write-Host "3. Verify email functionality"
