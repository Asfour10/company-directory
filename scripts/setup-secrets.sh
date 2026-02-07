#!/bin/bash

# =============================================================================
# Company Directory - Secrets Setup Script
# =============================================================================
# This script helps set up secrets for different environments
# Usage: ./scripts/setup-secrets.sh [environment]
# Environments: development, staging, production

set -e

ENVIRONMENT=${1:-development}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up secrets for environment: $ENVIRONMENT"

# Function to generate a random secret
generate_secret() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to generate a UUID
generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        python3 -c "import uuid; print(str(uuid.uuid4()))"
    fi
}

# Function to create .env file
create_env_file() {
    local env_file="$1"
    local template_file="$2"
    
    echo "Creating $env_file from $template_file"
    
    if [[ -f "$env_file" ]]; then
        echo "Warning: $env_file already exists. Creating backup..."
        cp "$env_file" "$env_file.backup.$(date +%Y%m%d_%H%M%S)"
    fi
    
    # Copy template
    cp "$template_file" "$env_file"
    
    # Generate secrets
    JWT_SECRET=$(generate_secret 64)
    JWT_REFRESH_SECRET=$(generate_secret 64)
    SESSION_SECRET=$(generate_secret 64)
    ENCRYPTION_KEY=$(generate_secret 32)
    SCIM_BEARER_TOKEN=$(generate_uuid)
    
    # Replace placeholders in the .env file
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/your-super-secret-jwt-key-change-in-production-min-32-chars/$JWT_SECRET/g" "$env_file"
        sed -i '' "s/your-super-secret-refresh-key-change-in-production-min-32-chars/$JWT_REFRESH_SECRET/g" "$env_file"
        sed -i '' "s/your-session-secret-change-in-production-min-32-chars/$SESSION_SECRET/g" "$env_file"
        sed -i '' "s/your-32-character-encryption-key!!/$ENCRYPTION_KEY/g" "$env_file"
        sed -i '' "s/your-scim-bearer-token-change-in-production/$SCIM_BEARER_TOKEN/g" "$env_file"
    else
        # Linux
        sed -i "s/your-super-secret-jwt-key-change-in-production-min-32-chars/$JWT_SECRET/g" "$env_file"
        sed -i "s/your-super-secret-refresh-key-change-in-production-min-32-chars/$JWT_REFRESH_SECRET/g" "$env_file"
        sed -i "s/your-session-secret-change-in-production-min-32-chars/$SESSION_SECRET/g" "$env_file"
        sed -i "s/your-32-character-encryption-key!!/$ENCRYPTION_KEY/g" "$env_file"
        sed -i "s/your-scim-bearer-token-change-in-production/$SCIM_BEARER_TOKEN/g" "$env_file"
    fi
    
    echo "✅ Created $env_file with generated secrets"
}

# Setup based on environment
case $ENVIRONMENT in
    development)
        echo "Setting up development environment..."
        
        # Backend .env
        create_env_file "$PROJECT_ROOT/backend/.env" "$PROJECT_ROOT/backend/.env.example"
        
        # Frontend .env
        create_env_file "$PROJECT_ROOT/frontend/.env" "$PROJECT_ROOT/frontend/.env.example"
        
        echo "✅ Development environment setup complete!"
        echo ""
        echo "Next steps:"
        echo "1. Review and update the generated .env files with your specific values"
        echo "2. Start the database: docker-compose up postgres redis -d"
        echo "3. Run database migrations: cd backend && npm run migrate"
        echo "4. Start the application: npm run dev"
        ;;
        
    staging)
        echo "Setting up staging environment..."
        echo "⚠️  For staging, you should use a proper secret management system"
        echo "This script generates basic secrets for testing purposes only"
        
        # Create staging-specific env files
        create_env_file "$PROJECT_ROOT/backend/.env.staging" "$PROJECT_ROOT/backend/.env.example"
        create_env_file "$PROJECT_ROOT/frontend/.env.staging" "$PROJECT_ROOT/frontend/.env.example"
        
        # Update staging-specific values
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' 's/NODE_ENV=development/NODE_ENV=staging/g' "$PROJECT_ROOT/backend/.env.staging"
            sed -i '' 's/NODE_ENV=development/NODE_ENV=staging/g' "$PROJECT_ROOT/frontend/.env.staging"
            sed -i '' 's/LOG_LEVEL=info/LOG_LEVEL=warn/g' "$PROJECT_ROOT/backend/.env.staging"
        else
            sed -i 's/NODE_ENV=development/NODE_ENV=staging/g' "$PROJECT_ROOT/backend/.env.staging"
            sed -i 's/NODE_ENV=development/NODE_ENV=staging/g' "$PROJECT_ROOT/frontend/.env.staging"
            sed -i 's/LOG_LEVEL=info/LOG_LEVEL=warn/g' "$PROJECT_ROOT/backend/.env.staging"
        fi
        
        echo "✅ Staging environment setup complete!"
        echo ""
        echo "⚠️  IMPORTANT: Update database URLs and other staging-specific values"
        ;;
        
    production)
        echo "Setting up production environment..."
        echo "⚠️  WARNING: This is for production setup guidance only"
        echo "⚠️  DO NOT use generated secrets directly in production"
        echo ""
        echo "For production, you should:"
        echo "1. Use a proper secret management system (AWS Secrets Manager, Azure Key Vault, etc.)"
        echo "2. Generate secrets using a cryptographically secure method"
        echo "3. Rotate secrets regularly"
        echo "4. Use environment-specific values for all configurations"
        echo ""
        echo "Example production secret generation:"
        echo "JWT_SECRET: $(generate_secret 64)"
        echo "JWT_REFRESH_SECRET: $(generate_secret 64)"
        echo "SESSION_SECRET: $(generate_secret 64)"
        echo "ENCRYPTION_KEY: $(generate_secret 32)"
        echo "SCIM_BEARER_TOKEN: $(generate_uuid)"
        echo ""
        echo "See docs/ENVIRONMENT_VARIABLES.md for complete production setup guide"
        ;;
        
    *)
        echo "❌ Unknown environment: $ENVIRONMENT"
        echo "Usage: $0 [development|staging|production]"
        exit 1
        ;;
esac

echo ""
echo "🔒 Security reminders:"
echo "- Never commit .env files to version control"
echo "- Use different secrets for each environment"
echo "- Rotate secrets regularly"
echo "- Use proper secret management in production"
echo "- Review and update placeholder values in .env files"