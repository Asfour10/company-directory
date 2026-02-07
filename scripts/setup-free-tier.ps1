# Free Tier Setup Script (PowerShell)
# This script helps you set up the Company Directory app on free services

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Company Directory - Free Tier Setup" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# Function to generate random bytes and convert to base64
function Generate-Base64Secret {
    param([int]$bytes = 48)
    $randomBytes = New-Object byte[] $bytes
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($randomBytes)
    return [Convert]::ToBase64String($randomBytes)
}

# Function to generate random bytes and convert to hex
function Generate-HexSecret {
    param([int]$bytes = 32)
    $randomBytes = New-Object byte[] $bytes
    $rng = [System.Security.Cryptography.RNGCryptoServiceProvider]::new()
    $rng.GetBytes($randomBytes)
    return ($randomBytes | ForEach-Object { $_.ToString("x2") }) -join ''
}

# Step 1: Generate Secrets
Write-Host "Step 1: Generating Secrets" -ForegroundColor Yellow
Write-Host "Generating secure secrets for your deployment..."
Write-Host ""

$JWT_SECRET = Generate-Base64Secret -bytes 48
$SESSION_SECRET = Generate-Base64Secret -bytes 48
$ENCRYPTION_KEY = Generate-HexSecret -bytes 32
$ADMIN_PASSWORD = Generate-Base64Secret -bytes 24

Write-Host "[OK] Secrets generated successfully" -ForegroundColor Green
Write-Host ""

# Step 2: Save secrets to file
Write-Host "Step 2: Saving Secrets" -ForegroundColor Yellow
$secretsContent = @"
# IMPORTANT: Keep this file secure and never commit to version control!
# Generated: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")

JWT_SECRET=$JWT_SECRET
SESSION_SECRET=$SESSION_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
ADMIN_PASSWORD=$ADMIN_PASSWORD

# Copy these values to your Render.com environment variables
"@

$secretsContent | Out-File -FilePath ".secrets.txt" -Encoding UTF8
Write-Host "[OK] Secrets saved to .secrets.txt" -ForegroundColor Green
Write-Host ""

# Step 3: Create environment template
Write-Host "Step 3: Creating Environment Template" -ForegroundColor Yellow
$envContent = @"
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
"@

$envContent | Out-File -FilePath "backend\.env.render" -Encoding UTF8
Write-Host "[OK] Environment template created: backend\.env.render" -ForegroundColor Green
Write-Host ""

# Step 4: Create frontend environment
$frontendEnv = @"
# Frontend Environment Variables
VITE_API_URL=https://company-directory-backend.onrender.com
"@

$frontendEnv | Out-File -FilePath "frontend\.env.production" -Encoding UTF8
Write-Host "[OK] Frontend environment created" -ForegroundColor Green
Write-Host ""

# Step 5: Add .secrets.txt to .gitignore
if (Test-Path ".gitignore") {
    $gitignoreContent = Get-Content ".gitignore" -Raw
    if ($gitignoreContent -notmatch ".secrets.txt") {
        Add-Content -Path ".gitignore" -Value "`n.secrets.txt"
        Write-Host "[OK] Added .secrets.txt to .gitignore" -ForegroundColor Green
    }
} else {
    ".secrets.txt" | Out-File -FilePath ".gitignore" -Encoding UTF8
    Write-Host "[OK] Created .gitignore with .secrets.txt" -ForegroundColor Green
}

# Step 6: Display next steps
Write-Host ""
Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your secrets have been generated and saved." -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Sign up for free services:" -ForegroundColor Cyan
Write-Host "   - Neon.tech - PostgreSQL database"
Write-Host "   - Upstash.com - Redis cache"
Write-Host "   - Cloudflare.com - R2 object storage"
Write-Host "   - Render.com - Application hosting"
Write-Host ""
Write-Host "2. Get your connection strings:" -ForegroundColor Cyan
Write-Host "   - Neon: Copy PostgreSQL connection string"
Write-Host "   - Upstash: Copy Redis connection string"
Write-Host "   - Cloudflare R2: Create bucket and get API keys"
Write-Host ""
Write-Host "3. Deploy to Render:" -ForegroundColor Cyan
Write-Host "   - Push code to GitHub"
Write-Host "   - Connect repository to Render"
Write-Host "   - Render will use render.yaml for configuration"
Write-Host "   - Add environment variables from backend\.env.render"
Write-Host ""
Write-Host "4. Run database migrations:" -ForegroundColor Cyan
Write-Host "   - Open Render shell for backend service"
Write-Host "   - Run: npm run prisma:migrate deploy"
Write-Host ""
Write-Host "5. Create admin user:" -ForegroundColor Cyan
Write-Host "   - In Render shell, run: npm run seed:production"
Write-Host "   - Admin email: admin@company.com"
Write-Host "   - Admin password: (saved in .secrets.txt)"
Write-Host ""
Write-Host "IMPORTANT SECURITY NOTES:" -ForegroundColor Red
Write-Host "   - Keep .secrets.txt secure and never commit it"
Write-Host "   - Change admin password after first login"
Write-Host "   - Rotate secrets every 90 days"
Write-Host ""
Write-Host "For detailed instructions, see:" -ForegroundColor Green
Write-Host "   docs\FREE_TIER_DEPLOYMENT.md"
Write-Host ""
Write-Host "Quick Links:" -ForegroundColor Cyan
Write-Host "   - Neon: https://neon.tech"
Write-Host "   - Upstash: https://upstash.com"
Write-Host "   - Cloudflare: https://cloudflare.com"
Write-Host "   - Render: https://render.com"
Write-Host ""
