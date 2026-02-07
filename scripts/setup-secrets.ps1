# =============================================================================
# Company Directory - Secrets Setup Script (PowerShell)
# =============================================================================
# This script helps set up secrets for different environments
# Usage: .\scripts\setup-secrets.ps1 [environment]
# Environments: development, staging, production

param(
    [Parameter(Position=0)]
    [ValidateSet("development", "staging", "production")]
    [string]$Environment = "development"
)

$ErrorActionPreference = "Stop"

Write-Host "Setting up secrets for environment: $Environment" -ForegroundColor Green

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

# Function to generate a random secret
function Generate-Secret {
    param([int]$Length = 32)
    
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    $secret = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $secret += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $secret
}

# Function to generate a UUID
function Generate-UUID {
    return [System.Guid]::NewGuid().ToString().ToLower()
}

# Function to create .env file
function Create-EnvFile {
    param(
        [string]$EnvFile,
        [string]$TemplateFile
    )
    
    Write-Host "Creating $EnvFile from $TemplateFile" -ForegroundColor Yellow
    
    if (Test-Path $EnvFile) {
        Write-Host "Warning: $EnvFile already exists. Creating backup..." -ForegroundColor Yellow
        $backupName = "$EnvFile.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss')"
        Copy-Item $EnvFile $backupName
    }
    
    # Copy template
    Copy-Item $TemplateFile $EnvFile
    
    # Generate secrets
    $jwtSecret = Generate-Secret -Length 64
    $jwtRefreshSecret = Generate-Secret -Length 64
    $sessionSecret = Generate-Secret -Length 64
    $encryptionKey = Generate-Secret -Length 32
    $scimBearerToken = Generate-UUID
    
    # Read file content
    $content = Get-Content $EnvFile -Raw
    
    # Replace placeholders
    $content = $content -replace "your-super-secret-jwt-key-change-in-production-min-32-chars", $jwtSecret
    $content = $content -replace "your-super-secret-refresh-key-change-in-production-min-32-chars", $jwtRefreshSecret
    $content = $content -replace "your-session-secret-change-in-production-min-32-chars", $sessionSecret
    $content = $content -replace "your-32-character-encryption-key!!", $encryptionKey
    $content = $content -replace "your-scim-bearer-token-change-in-production", $scimBearerToken
    
    # Write back to file
    Set-Content -Path $EnvFile -Value $content -NoNewline
    
    Write-Host "✅ Created $EnvFile with generated secrets" -ForegroundColor Green
}

# Setup based on environment
switch ($Environment) {
    "development" {
        Write-Host "Setting up development environment..." -ForegroundColor Cyan
        
        # Backend .env
        Create-EnvFile -EnvFile "$ProjectRoot\backend\.env" -TemplateFile "$ProjectRoot\backend\.env.example"
        
        # Frontend .env
        Create-EnvFile -EnvFile "$ProjectRoot\frontend\.env" -TemplateFile "$ProjectRoot\frontend\.env.example"
        
        Write-Host "✅ Development environment setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "Next steps:" -ForegroundColor Yellow
        Write-Host "1. Review and update the generated .env files with your specific values"
        Write-Host "2. Start the database: docker-compose up postgres redis -d"
        Write-Host "3. Run database migrations: cd backend && npm run migrate"
        Write-Host "4. Start the application: npm run dev"
    }
    
    "staging" {
        Write-Host "Setting up staging environment..." -ForegroundColor Cyan
        Write-Host "⚠️  For staging, you should use a proper secret management system" -ForegroundColor Yellow
        Write-Host "This script generates basic secrets for testing purposes only" -ForegroundColor Yellow
        
        # Create staging-specific env files
        Create-EnvFile -EnvFile "$ProjectRoot\backend\.env.staging" -TemplateFile "$ProjectRoot\backend\.env.example"
        Create-EnvFile -EnvFile "$ProjectRoot\frontend\.env.staging" -TemplateFile "$ProjectRoot\frontend\.env.example"
        
        # Update staging-specific values
        $backendContent = Get-Content "$ProjectRoot\backend\.env.staging" -Raw
        $backendContent = $backendContent -replace "NODE_ENV=development", "NODE_ENV=staging"
        $backendContent = $backendContent -replace "LOG_LEVEL=info", "LOG_LEVEL=warn"
        Set-Content -Path "$ProjectRoot\backend\.env.staging" -Value $backendContent -NoNewline
        
        $frontendContent = Get-Content "$ProjectRoot\frontend\.env.staging" -Raw
        $frontendContent = $frontendContent -replace "NODE_ENV=development", "NODE_ENV=staging"
        Set-Content -Path "$ProjectRoot\frontend\.env.staging" -Value $frontendContent -NoNewline
        
        Write-Host "✅ Staging environment setup complete!" -ForegroundColor Green
        Write-Host ""
        Write-Host "⚠️  IMPORTANT: Update database URLs and other staging-specific values" -ForegroundColor Yellow
    }
    
    "production" {
        Write-Host "Setting up production environment..." -ForegroundColor Cyan
        Write-Host "⚠️  WARNING: This is for production setup guidance only" -ForegroundColor Red
        Write-Host "⚠️  DO NOT use generated secrets directly in production" -ForegroundColor Red
        Write-Host ""
        Write-Host "For production, you should:" -ForegroundColor Yellow
        Write-Host "1. Use a proper secret management system (AWS Secrets Manager, Azure Key Vault, etc.)"
        Write-Host "2. Generate secrets using a cryptographically secure method"
        Write-Host "3. Rotate secrets regularly"
        Write-Host "4. Use environment-specific values for all configurations"
        Write-Host ""
        Write-Host "Example production secret generation:" -ForegroundColor Cyan
        Write-Host "JWT_SECRET: $(Generate-Secret -Length 64)"
        Write-Host "JWT_REFRESH_SECRET: $(Generate-Secret -Length 64)"
        Write-Host "SESSION_SECRET: $(Generate-Secret -Length 64)"
        Write-Host "ENCRYPTION_KEY: $(Generate-Secret -Length 32)"
        Write-Host "SCIM_BEARER_TOKEN: $(Generate-UUID)"
        Write-Host ""
        Write-Host "See docs/ENVIRONMENT_VARIABLES.md for complete production setup guide" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "🔒 Security reminders:" -ForegroundColor Magenta
Write-Host "- Never commit .env files to version control"
Write-Host "- Use different secrets for each environment"
Write-Host "- Rotate secrets regularly"
Write-Host "- Use proper secret management in production"
Write-Host "- Review and update placeholder values in .env files"