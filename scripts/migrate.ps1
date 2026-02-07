# Database Migration Script with Rollback Support (PowerShell)
# Usage: .\migrate.ps1 [deploy|rollback|status] [staging|production]

param(
    [Parameter(Position=0)]
    [ValidateSet("deploy", "rollback", "status")]
    [string]$Command = "deploy",
    
    [Parameter(Position=1)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging"
)

# Colors for output
$Red = "Red"
$Green = "Green"
$Yellow = "Yellow"

function Write-Log {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $Message" -ForegroundColor $Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] WARNING: $Message" -ForegroundColor $Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] ERROR: $Message" -ForegroundColor $Red
    exit 1
}

# Set environment-specific variables
switch ($Environment) {
    "staging" {
        $DatabaseUrl = $env:DATABASE_URL_STAGING
        $BackupBucket = "company-directory-db-backups-staging"
    }
    "production" {
        $DatabaseUrl = $env:DATABASE_URL_PRODUCTION
        $BackupBucket = "company-directory-db-backups-production"
    }
    default {
        Write-Error "Invalid environment: $Environment. Use 'staging' or 'production'"
    }
}

if (-not $DatabaseUrl) {
    Write-Error "DATABASE_URL not set for environment: $Environment"
}

function New-DatabaseBackup {
    Write-Log "Creating database backup for $Environment..."
    
    $BackupFile = "backup_$(Get-Date -Format 'yyyyMMdd_HHmmss').sql"
    
    # Parse database URL
    if ($DatabaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)") {
        $DbUser = $Matches[1]
        $DbPass = $Matches[2]
        $DbHost = $Matches[3]
        $DbPort = $Matches[4]
        $DbName = $Matches[5]
    } else {
        Write-Error "Invalid database URL format"
    }
    
    # Set password environment variable for pg_dump
    $env:PGPASSWORD = $DbPass
    
    try {
        # Create backup using pg_dump
        & pg_dump -h $DbHost -p $DbPort -U $DbUser -d $DbName | Out-File -FilePath $BackupFile -Encoding UTF8
        
        Write-Log "Backup created: $BackupFile"
        
        # Upload to S3 if AWS CLI is available
        if (Get-Command aws -ErrorAction SilentlyContinue) {
            & aws s3 cp $BackupFile "s3://$BackupBucket/$BackupFile"
            Write-Log "Backup uploaded to S3: s3://$BackupBucket/$BackupFile"
        }
        
        return $BackupFile
    }
    catch {
        Write-Error "Failed to create database backup: $_"
    }
    finally {
        # Clear password environment variable
        $env:PGPASSWORD = $null
    }
}

function Restore-DatabaseBackup {
    param([string]$BackupFile)
    
    if (-not $BackupFile) {
        Write-Error "Backup file not specified"
    }
    
    Write-Log "Restoring database from backup: $BackupFile"
    
    # Download from S3 if not local
    if (-not (Test-Path $BackupFile) -and (Get-Command aws -ErrorAction SilentlyContinue)) {
        & aws s3 cp "s3://$BackupBucket/$BackupFile" $BackupFile
    }
    
    if (-not (Test-Path $BackupFile)) {
        Write-Error "Backup file not found: $BackupFile"
    }
    
    # Parse database URL
    if ($DatabaseUrl -match "postgresql://([^:]+):([^@]+)@([^:]+):(\d+)/([^?]+)") {
        $DbUser = $Matches[1]
        $DbPass = $Matches[2]
        $DbHost = $Matches[3]
        $DbPort = $Matches[4]
        $DbName = $Matches[5]
    } else {
        Write-Error "Invalid database URL format"
    }
    
    # Set password environment variable
    $env:PGPASSWORD = $DbPass
    
    try {
        # Restore database
        Get-Content $BackupFile | & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName
        Write-Log "Database restored successfully from $BackupFile"
    }
    catch {
        Write-Error "Failed to restore database from $BackupFile: $_"
    }
    finally {
        # Clear password environment variable
        $env:PGPASSWORD = $null
    }
}

function Invoke-Migrations {
    Write-Log "Running Prisma migrations for $Environment..."
    
    Push-Location backend
    
    try {
        # Generate Prisma client
        & npx prisma generate
        if ($LASTEXITCODE -ne 0) { throw "Prisma generate failed" }
        
        # Run migrations
        & npx prisma migrate deploy
        if ($LASTEXITCODE -ne 0) { throw "Prisma migrate deploy failed" }
        
        Write-Log "Migrations completed successfully"
    }
    catch {
        Write-Error "Migration failed: $_"
    }
    finally {
        Pop-Location
    }
}

function Get-MigrationStatus {
    Write-Log "Checking migration status..."
    
    Push-Location backend
    try {
        & npx prisma migrate status
    }
    finally {
        Pop-Location
    }
}

# Main execution
switch ($Command) {
    "deploy" {
        Write-Log "Starting database migration deployment for $Environment"
        
        # Check current migration status
        Get-MigrationStatus
        
        # Create backup before migration
        $BackupFile = New-DatabaseBackup
        
        # Store backup filename for potential rollback
        $BackupFile | Out-File -FilePath ".last_backup_$Environment" -Encoding UTF8
        
        # Run migrations
        Invoke-Migrations
        
        Write-Log "Migration deployment completed successfully"
    }
    
    "rollback" {
        Write-Log "Starting database rollback for $Environment"
        
        # Get the last backup file
        if (Test-Path ".last_backup_$Environment") {
            $BackupFile = Get-Content ".last_backup_$Environment" -Raw
            $BackupFile = $BackupFile.Trim()
            
            Write-Warning "Rolling back to backup: $BackupFile"
            
            # Confirm rollback
            $Confirmation = Read-Host "Are you sure you want to rollback the database? This will restore from backup: $BackupFile (y/N)"
            
            if ($Confirmation -eq 'y' -or $Confirmation -eq 'Y') {
                Restore-DatabaseBackup $BackupFile
                Write-Log "Rollback completed successfully"
            } else {
                Write-Log "Rollback cancelled"
            }
        } else {
            Write-Error "No backup file found for rollback. Cannot proceed."
        }
    }
    
    "status" {
        Get-MigrationStatus
    }
    
    default {
        Write-Error "Invalid command: $Command. Use 'deploy', 'rollback', or 'status'"
    }
}