#!/bin/bash

# Deploy Database Migrations to Vercel
# Run this after deploying to Vercel for the first time

echo "🚀 Deploying database migrations to Vercel..."

# Check if Vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI not found. Installing..."
    npm install -g vercel
fi

# Pull production environment variables
echo "📥 Pulling production environment variables..."
vercel env pull .env.production

# Run migrations
echo "🔄 Running database migrations..."
npx prisma migrate deploy

echo "✅ Migrations deployed successfully!"
echo ""
echo "Next steps:"
echo "1. Test your deployment at your Vercel URL"
echo "2. Register a test account"
echo "3. Verify email functionality"
