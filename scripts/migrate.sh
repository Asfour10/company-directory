#!/bin/bash

# Database Migration Script with Rollback Support
# Usage: ./migrate.sh [deploy|rollback] [environment]

set -e

COMMAND=${1:-deploy}
ENVIRONMENT=${2:-staging}

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
    exit 1
}

# Set environment-specific variables
case $ENVIRONMENT in
    "staging")
        DATABASE_URL=${DATABASE_URL_STAGING}
        BACKUP_BUCKET="company-directory-db-backups-staging"
        ;;
    "production")
        DATABASE_URL=${DATABASE_URL_PRODUCTION}
        BACKUP_BUCKET="company-directory-db-backups-production"
        ;;
    *)
        error "Invalid environment: $ENVIRONMENT. Use 'staging' or 'production'"
        ;;
esac

if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL not set for environment: $ENVIRONMENT"
fi

# Function to create database backup
create_backup() {
    log "Creating database backup for $ENVIRONMENT..."
    
    BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
    
    # Extract database connection details
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Create backup
    PGPASSWORD=$DB_PASS pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > $BACKUP_FILE
    
    if [ $? -eq 0 ]; then
        log "Backup created: $BACKUP_FILE"
        
        # Upload to S3/cloud storage
        if command -v aws &> /dev/null; then
            aws s3 cp $BACKUP_FILE s3://$BACKUP_BUCKET/$BACKUP_FILE
            log "Backup uploaded to S3: s3://$BACKUP_BUCKET/$BACKUP_FILE"
        fi
        
        echo $BACKUP_FILE
    else
        error "Failed to create database backup"
    fi
}

# Function to restore from backup
restore_backup() {
    local backup_file=$1
    
    if [ -z "$backup_file" ]; then
        error "Backup file not specified"
    fi
    
    log "Restoring database from backup: $backup_file"
    
    # Download from S3 if not local
    if [ ! -f "$backup_file" ] && command -v aws &> /dev/null; then
        aws s3 cp s3://$BACKUP_BUCKET/$backup_file $backup_file
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    # Extract database connection details
    DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
    DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')
    DB_PASS=$(echo $DATABASE_URL | sed -n 's/.*\/\/[^:]*:\([^@]*\)@.*/\1/p')
    
    # Restore database
    PGPASSWORD=$DB_PASS psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME < $backup_file
    
    if [ $? -eq 0 ]; then
        log "Database restored successfully from $backup_file"
    else
        error "Failed to restore database from $backup_file"
    fi
}

# Function to run migrations
run_migrations() {
    log "Running Prisma migrations for $ENVIRONMENT..."
    
    cd backend
    
    # Generate Prisma client
    npx prisma generate
    
    # Run migrations
    npx prisma migrate deploy
    
    if [ $? -eq 0 ]; then
        log "Migrations completed successfully"
    else
        error "Migration failed"
    fi
    
    cd ..
}

# Function to check migration status
check_migration_status() {
    log "Checking migration status..."
    
    cd backend
    npx prisma migrate status
    cd ..
}

# Function to get the last applied migration
get_last_migration() {
    cd backend
    npx prisma migrate status --json | jq -r '.appliedMigrations[-1].name' 2>/dev/null || echo ""
    cd ..
}

# Main execution
case $COMMAND in
    "deploy")
        log "Starting database migration deployment for $ENVIRONMENT"
        
        # Check current migration status
        check_migration_status
        
        # Create backup before migration
        BACKUP_FILE=$(create_backup)
        
        # Store backup filename for potential rollback
        echo $BACKUP_FILE > .last_backup_$ENVIRONMENT
        
        # Run migrations
        run_migrations
        
        log "Migration deployment completed successfully"
        ;;
        
    "rollback")
        log "Starting database rollback for $ENVIRONMENT"
        
        # Get the last backup file
        if [ -f ".last_backup_$ENVIRONMENT" ]; then
            BACKUP_FILE=$(cat .last_backup_$ENVIRONMENT)
            warn "Rolling back to backup: $BACKUP_FILE"
            
            # Confirm rollback
            read -p "Are you sure you want to rollback the database? This will restore from backup: $BACKUP_FILE (y/N): " -n 1 -r
            echo
            
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                restore_backup $BACKUP_FILE
                log "Rollback completed successfully"
            else
                log "Rollback cancelled"
            fi
        else
            error "No backup file found for rollback. Cannot proceed."
        fi
        ;;
        
    "status")
        check_migration_status
        ;;
        
    *)
        error "Invalid command: $COMMAND. Use 'deploy', 'rollback', or 'status'"
        ;;
esac