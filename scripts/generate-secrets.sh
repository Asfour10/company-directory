#!/bin/bash

# Generate Secrets Script
# This script generates secure random secrets for production deployment

set -e

echo "=================================="
echo "Production Secrets Generator"
echo "=================================="
echo ""
echo "This script will generate secure random secrets for your production environment."
echo "Copy these values to your .env.production file or secret manager."
echo ""
echo "⚠️  IMPORTANT: Store these secrets securely and never commit them to version control!"
echo ""

# Function to generate and display a secret
generate_secret() {
    local name=$1
    local command=$2
    local description=$3
    
    echo "-----------------------------------"
    echo "$name"
    echo "Description: $description"
    echo "-----------------------------------"
    local value=$(eval $command)
    echo "$value"
    echo ""
}

# Generate JWT Secret
generate_secret \
    "JWT_SECRET" \
    "openssl rand -base64 64 | tr -d '\n'" \
    "Used for signing JWT tokens (256-bit minimum)"

# Generate Session Secret
generate_secret \
    "SESSION_SECRET" \
    "openssl rand -base64 64 | tr -d '\n'" \
    "Used for session management"

# Generate Encryption Key
generate_secret \
    "ENCRYPTION_KEY" \
    "openssl rand -hex 32" \
    "Used for encrypting sensitive data (32 bytes for AES-256)"

# Generate Database Password
generate_secret \
    "DATABASE_PASSWORD" \
    "openssl rand -base64 24 | tr -d '\n'" \
    "Strong password for database user"

# Generate Redis Password
generate_secret \
    "REDIS_PASSWORD" \
    "openssl rand -base64 24 | tr -d '\n'" \
    "Strong password for Redis"

# Generate Admin Password
generate_secret \
    "ADMIN_PASSWORD" \
    "openssl rand -base64 24 | tr -d '\n'" \
    "Initial admin user password (change after first login)"

echo "=================================="
echo "Secrets Generated Successfully!"
echo "=================================="
echo ""
echo "Next Steps:"
echo "1. Copy these secrets to your secret manager or .env.production file"
echo "2. Never commit these secrets to version control"
echo "3. Rotate these secrets every 90 days"
echo "4. Use different secrets for each environment (dev, staging, prod)"
echo ""
echo "⚠️  Security Reminders:"
echo "   - Store secrets in a secure secret manager (AWS Secrets Manager, Azure Key Vault, etc.)"
echo "   - Use environment variables, not .env files in production"
echo "   - Restrict access to secrets to only necessary personnel"
echo "   - Enable audit logging for secret access"
echo "   - Set up alerts for unauthorized secret access attempts"
echo ""
