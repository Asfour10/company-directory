#!/bin/bash

# Validation script for migration setup
# This script validates that all migration components are properly configured

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] ✓ $1${NC}"
}

# Check if required files exist
check_files() {
    log "Checking required migration files..."
    
    local files=(
        "scripts/migrate.sh"
        "scripts/migrate.ps1"
        "backend/scripts/migration-helper.ts"
        ".github/workflows/migrate.yml"
        ".github/workflows/deploy.yml"
        "k8s/staging/migration-job.yaml"
        "k8s/production/migration-job.yaml"
        "docs/DATABASE_MIGRATIONS.md"
    )
    
    for file in "${files[@]}"; do
        if [ -f "$file" ]; then
            success "$file exists"
        else
            error "$file is missing"
            return 1
        fi
    done
}

# Check if required directories exist
check_directories() {
    log "Checking required directories..."
    
    local dirs=(
        "scripts"
        "backend/scripts"
        ".github/workflows"
        "k8s/staging"
        "k8s/production"
        "docs"
    )
    
    for dir in "${dirs[@]}"; do
        if [ -d "$dir" ]; then
            success "$dir directory exists"
        else
            error "$dir directory is missing"
            return 1
        fi
    done
}

# Check script permissions
check_permissions() {
    log "Checking script permissions..."
    
    if [ -x "scripts/migrate.sh" ]; then
        success "migrate.sh is executable"
    else
        warn "migrate.sh is not executable, attempting to fix..."
        chmod +x scripts/migrate.sh
        if [ -x "scripts/migrate.sh" ]; then
            success "migrate.sh permissions fixed"
        else
            error "Failed to make migrate.sh executable"
            return 1
        fi
    fi
}

# Check Node.js and npm dependencies
check_dependencies() {
    log "Checking dependencies..."
    
    # Check Node.js
    if command -v node &> /dev/null; then
        NODE_VERSION=$(node --version)
        success "Node.js is installed: $NODE_VERSION"
    else
        error "Node.js is not installed"
        return 1
    fi
    
    # Check npm
    if command -v npm &> /dev/null; then
        NPM_VERSION=$(npm --version)
        success "npm is installed: $NPM_VERSION"
    else
        error "npm is not installed"
        return 1
    fi
    
    # Check if backend dependencies are installed
    if [ -d "backend/node_modules" ]; then
        success "Backend dependencies are installed"
    else
        warn "Backend dependencies not found, installing..."
        cd backend && npm install && cd ..
        success "Backend dependencies installed"
    fi
}

# Check Prisma setup
check_prisma() {
    log "Checking Prisma setup..."
    
    cd backend
    
    # Check if Prisma schema exists
    if [ -f "prisma/schema.prisma" ]; then
        success "Prisma schema exists"
    else
        error "Prisma schema not found"
        cd ..
        return 1
    fi
    
    # Check if Prisma client can be generated
    if npx prisma generate &> /dev/null; then
        success "Prisma client generation works"
    else
        error "Prisma client generation failed"
        cd ..
        return 1
    fi
    
    cd ..
}

# Check GitHub Actions workflow syntax
check_workflows() {
    log "Checking GitHub Actions workflows..."
    
    # This is a basic check - in a real environment you might use actionlint
    local workflows=(
        ".github/workflows/ci-cd.yml"
        ".github/workflows/deploy.yml"
        ".github/workflows/migrate.yml"
    )
    
    for workflow in "${workflows[@]}"; do
        if [ -f "$workflow" ]; then
            # Basic YAML syntax check
            if python3 -c "import yaml; yaml.safe_load(open('$workflow'))" 2>/dev/null; then
                success "$workflow has valid YAML syntax"
            else
                error "$workflow has invalid YAML syntax"
                return 1
            fi
        else
            error "$workflow is missing"
            return 1
        fi
    done
}

# Check Kubernetes manifests
check_k8s_manifests() {
    log "Checking Kubernetes manifests..."
    
    local manifests=(
        "k8s/staging/namespace.yaml"
        "k8s/staging/configmap.yaml"
        "k8s/staging/migration-job.yaml"
        "k8s/production/namespace.yaml"
        "k8s/production/configmap.yaml"
        "k8s/production/migration-job.yaml"
    )
    
    for manifest in "${manifests[@]}"; do
        if [ -f "$manifest" ]; then
            # Basic YAML syntax check
            if python3 -c "import yaml; yaml.safe_load(open('$manifest'))" 2>/dev/null; then
                success "$manifest has valid YAML syntax"
            else
                error "$manifest has invalid YAML syntax"
                return 1
            fi
        else
            error "$manifest is missing"
            return 1
        fi
    done
}

# Test migration helper script
test_migration_helper() {
    log "Testing migration helper script..."
    
    cd backend
    
    # Test if the script can run
    if tsx scripts/migration-helper.ts --help &> /dev/null || tsx scripts/migration-helper.ts 2>&1 | grep -q "Usage"; then
        success "Migration helper script is functional"
    else
        error "Migration helper script is not working"
        cd ..
        return 1
    fi
    
    cd ..
}

# Main validation function
main() {
    log "Starting migration setup validation..."
    
    local failed=0
    
    check_files || failed=1
    check_directories || failed=1
    check_permissions || failed=1
    check_dependencies || failed=1
    check_prisma || failed=1
    check_workflows || failed=1
    check_k8s_manifests || failed=1
    test_migration_helper || failed=1
    
    if [ $failed -eq 0 ]; then
        success "All migration setup validation checks passed!"
        log "Migration system is ready for use."
        
        echo ""
        log "Next steps:"
        echo "1. Set up environment variables for database connections"
        echo "2. Configure GitHub secrets for CI/CD"
        echo "3. Set up Kubernetes cluster and configure kubectl"
        echo "4. Test migrations on staging environment"
        echo "5. Review and customize the migration workflows as needed"
        
    else
        error "Some validation checks failed. Please fix the issues above."
        exit 1
    fi
}

# Run validation
main