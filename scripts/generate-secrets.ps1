# Generate Secrets Script (PowerShell)
# This script generates secure random secrets for production deployment

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Production Secrets Generator" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "This script will generate secure random secrets for your production environment."
Write-Host "Copy these values to your .env.production file or secret manager."
Write-Host ""
Write-Host "⚠️  IMPORTANT: Store these secrets securely and never commit them to version control!" -ForegroundColor Yellow
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

# Function to display a secret
function Show-Secret {
    param(
        [string]$name,
        [string]$value,
        [string]$description
    )
    
    Write-Host "-----------------------------------" -ForegroundColor Gray
    Write-Host $name -ForegroundColor Green
    Write-Host "Description: $description" -ForegroundColor Gray
    Write-Host "-----------------------------------" -ForegroundColor Gray
    Write-Host $value -ForegroundColor White
    Write-Host ""
}

# Generate JWT Secret
$jwtSecret = Generate-Base64Secret -bytes 48
Show-Secret -name "JWT_SECRET" -value $jwtSecret -description "Used for signing JWT tokens (256-bit minimum)"

# Generate Session Secret
$sessionSecret = Generate-Base64Secret -bytes 48
Show-Secret -name "SESSION_SECRET" -value $sessionSecret -description "Used for session management"

# Generate Encryption Key
$encryptionKey = Generate-HexSecret -bytes 32
Show-Secret -name "ENCRYPTION_KEY" -value $encryptionKey -description "Used for encrypting sensitive data (32 bytes for AES-256)"

# Generate Database Password
$dbPassword = Generate-Base64Secret -bytes 24
Show-Secret -name "DATABASE_PASSWORD" -value $dbPassword -description "Strong password for database user"

# Generate Redis Password
$redisPassword = Generate-Base64Secret -bytes 24
Show-Secret -name "REDIS_PASSWORD" -value $redisPassword -description "Strong password for Redis"

# Generate Admin Password
$adminPassword = Generate-Base64Secret -bytes 24
Show-Secret -name "ADMIN_PASSWORD" -value $adminPassword -description "Initial admin user password (change after first login)"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host "Secrets Generated Successfully!" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Copy these secrets to your secret manager or .env.production file"
Write-Host "2. Never commit these secrets to version control"
Write-Host "3. Rotate these secrets every 90 days"
Write-Host "4. Use different secrets for each environment (dev, staging, prod)"
Write-Host ""
Write-Host "⚠️  Security Reminders:" -ForegroundColor Yellow
Write-Host "   - Store secrets in a secure secret manager (AWS Secrets Manager, Azure Key Vault, etc.)"
Write-Host "   - Use environment variables, not .env files in production"
Write-Host "   - Restrict access to secrets to only necessary personnel"
Write-Host "   - Enable audit logging for secret access"
Write-Host "   - Set up alerts for unauthorized secret access attempts"
Write-Host ""
