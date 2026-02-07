#!/bin/bash

# Free Tier Setup Script
# This script helps you set up the Company Directory app on free services

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=================================="
echo "Company Directory - Free Tier Setup"
echo -e "==================================${NC}"
echo ""

# Step 1: Generate Secrets
echo -e "${YELLOW}Step 1: Generating Secrets${NC}"
echo "Generating secure secrets for your deployment..."
echo ""

JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
SESSION_SECRET=$(openssl rand -base64 64 | tr -d '\n')
ENCRYPTION_KEY=$(openssl rand -hex 32)
ADMIN_PASSWORD=$(openssl rand -base64 24 | tr -d '\n')

echo -e "${GREEN}✓ Secrets generated successfully${NC}"
echo ""

# Step 2: Save secrets to file
echo -e "${YELLOW}Step 2: Saving Secrets${NC}"
cat > .secrets.txt << EOF
# IMPORTANT: Keep this file secure and never commit to version control!
# Generated: $(date)

JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Copy these values to your Render.com environment variables
EOF

echo -e "${GREEN}✓ Secrets saved to .secrets.txt${NC}"
echo ""

# Step 3: Create environment template
echo -e "${YELLOW}Step 3: Creating Environment Template${NC}"
cat > backend/.env.render << EOF
# Render.com Environment Variables
# Copy these to your Render service settings

NODE_ENV=production
PORT=10000

# Database (Get from Neon.tech)
DATABASE_URL=postgresql://user:password@host.neon.tech/neondb?sslmode=require

# Redis (Get from Upstash)
REDIS_URL=redis://default:password@region.upstash.io:6379

# Secrets (Generated above)
JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY

# URLs (Update after deployment)
FRONTEND_URL=https://company-directory-frontend.onrender.com
API_URL=https://company-directory-backend.onrender.com
CORS_ORIGINS=https://company-directory-frontend.onrender.com

# Object Storage (Get from Cloudflare R2)
AWS_ACCESS_KEY_ID=your-r2-access-key
AWS_SECRET_ACCESS_KEY=your-r2-secret-key
S3_BUCKET_NAME=company-directory-files
S3_ENDPOINT=https://account-id.r2.cloudflarestorage.com
AWS_REGION=auto

# Optional Features (Disable to save resources on free tier)
ENABLE_METRICS=false
ENABLE_SSO=false
ENABLE_BILLING=false

# Rate Limiting
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_WINDOW_MS=900000
EOF

echo -e "${GREEN}✓ Environment template created: backend/.env.render${NC}"
echo ""

# Step 4: Create frontend environment
cat > frontend/.env.production << EOF
# Frontend Environment Variables
VITE_API_URL=https://company-directory-backend.onrender.com
EOF

echo -e "${GREEN}✓ Frontend environment created${NC}"
echo ""

# Step 5: Add .secrets.txt to .gitignore
if ! grep -q ".secrets.txt" .gitignore 2>/dev/null; then
    echo ".secrets.txt" >> .gitignore
    echo -e "${GREEN}✓ Added .secrets.txt to .gitignore${NC}"
fi

# Step 6: Display next steps
echo ""
echo -e "${BLUE}=================================="
echo "Setup Complete!"
echo -e "==================================${NC}"
echo ""
echo -e "${GREEN}Your secrets have been generated and saved.${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. ${BLUE}Sign up for free services:${NC}"
echo "   • Neon.tech - PostgreSQL database"
echo "   • Upstash.com - Redis cache"
echo "   • Cloudflare.com - R2 object storage"
echo "   • Render.com - Application hosting"
echo ""
echo "2. ${BLUE}Get your connection strings:${NC}"
echo "   • Neon: Copy PostgreSQL connection string"
echo "   • Upstash: Copy Redis connection string"
echo "   • Cloudflare R2: Create bucket and get API keys"
echo ""
echo "3. ${BLUE}Deploy to Render:${NC}"
echo "   • Push code to GitHub"
echo "   • Connect repository to Render"
echo "   • Render will use render.yaml for configuration"
echo "   • Add environment variables from backend/.env.render"
echo ""
echo "4. ${BLUE}Run database migrations:${NC}"
echo "   • Open Render shell for backend service"
echo "   • Run: npm run prisma:migrate deploy"
echo ""
echo "5. ${BLUE}Create admin user:${NC}"
echo "   • In Render shell, run: npm run seed:production"
echo "   • Admin email: admin@company.com"
echo "   • Admin password: (saved in .secrets.txt)"
echo ""
echo -e "${RED}⚠️  IMPORTANT SECURITY NOTES:${NC}"
echo "   • Keep .secrets.txt secure and never commit it"
echo "   • Change admin password after first login"
echo "   • Rotate secrets every 90 days"
echo ""
echo -e "${GREEN}For detailed instructions, see:${NC}"
echo "   docs/FREE_TIER_DEPLOYMENT.md"
echo ""
echo -e "${BLUE}Quick Links:${NC}"
echo "   • Neon: https://neon.tech"
echo "   • Upstash: https://upstash.com"
echo "   • Cloudflare: https://cloudflare.com"
echo "   • Render: https://render.com"
echo ""
