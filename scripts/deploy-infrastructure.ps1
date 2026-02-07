# =============================================================================
# Company Directory - Infrastructure Deployment Script (PowerShell)
# =============================================================================
# This script deploys the production infrastructure for the Company Directory
# Usage: .\scripts\deploy-infrastructure.ps1 [environment] [platform]
# Environments: staging, production
# Platforms: docker, kubernetes

param(
    [Parameter(Position=0)]
    [ValidateSet("staging", "production")]
    [string]$Environment = "staging",
    
    [Parameter(Position=1)]
    [ValidateSet("docker", "kubernetes")]
    [string]$Platform = "docker"
)

$ErrorActionPreference = "Stop"

Write-Host "🚀 Deploying Company Directory infrastructure" -ForegroundColor Green
Write-Host "Environment: $Environment" -ForegroundColor Yellow
Write-Host "Platform: $Platform" -ForegroundColor Yellow
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$InfrastructureDir = Join-Path $ProjectRoot "infrastructure"

# Function to check if command exists
function Test-Command {
    param([string]$Command)
    try {
        Get-Command $Command -ErrorAction Stop | Out-Null
        return $true
    }
    catch {
        return $false
    }
}

# Function to wait for service to be ready
function Wait-ForService {
    param(
        [string]$ServiceName,
        [string]$HealthUrl,
        [int]$MaxAttempts = 30
    )
    
    Write-Host "⏳ Waiting for $ServiceName to be ready..." -ForegroundColor Yellow
    
    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $HealthUrl -UseBasicParsing -TimeoutSec 5
            if ($response.StatusCode -eq 200) {
                Write-Host "✅ $ServiceName is ready!" -ForegroundColor Green
                return $true
            }
        }
        catch {
            # Service not ready yet
        }
        
        Write-Host "   Attempt $attempt/$MaxAttempts - $ServiceName not ready yet..." -ForegroundColor Gray
        Start-Sleep -Seconds 10
    }
    
    Write-Host "❌ $ServiceName failed to become ready after $MaxAttempts attempts" -ForegroundColor Red
    return $false
}

# Generate random password
function New-RandomPassword {
    param([int]$Length = 32)
    
    $chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*"
    $password = ""
    for ($i = 0; $i -lt $Length; $i++) {
        $password += $chars[(Get-Random -Maximum $chars.Length)]
    }
    return $password
}

Write-Host "✅ Valid environment: $Environment" -ForegroundColor Green
Write-Host "✅ Valid platform: $Platform" -ForegroundColor Green

# Check required tools
if ($Platform -eq "docker") {
    if (-not (Test-Command "docker")) {
        Write-Host "❌ Docker is required but not installed" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Command "docker-compose")) {
        Write-Host "❌ Docker Compose is required but not installed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Docker and Docker Compose are available" -ForegroundColor Green
}
elseif ($Platform -eq "kubernetes") {
    if (-not (Test-Command "kubectl")) {
        Write-Host "❌ kubectl is required but not installed" -ForegroundColor Red
        exit 1
    }
    
    if (-not (Test-Command "helm")) {
        Write-Host "⚠️  Helm is recommended but not required" -ForegroundColor Yellow
    }
    
    Write-Host "✅ kubectl is available" -ForegroundColor Green
}

# Create necessary directories
Write-Host "📁 Creating necessary directories..." -ForegroundColor Cyan
$SecretsDir = Join-Path $InfrastructureDir "secrets"
$SslDir = Join-Path $InfrastructureDir "ssl"
$LogsDir = Join-Path $InfrastructureDir "logs"

New-Item -ItemType Directory -Force -Path $SecretsDir | Out-Null
New-Item -ItemType Directory -Force -Path $SslDir | Out-Null
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

# Generate secrets if they don't exist
Write-Host "🔐 Setting up secrets..." -ForegroundColor Cyan

$PostgresPasswordFile = Join-Path $SecretsDir "postgres_password.txt"
if (-not (Test-Path $PostgresPasswordFile)) {
    New-RandomPassword | Out-File -FilePath $PostgresPasswordFile -Encoding UTF8 -NoNewline
    Write-Host "✅ Generated PostgreSQL password" -ForegroundColor Green
}

$MinioPasswordFile = Join-Path $SecretsDir "minio_password.txt"
if (-not (Test-Path $MinioPasswordFile)) {
    New-RandomPassword | Out-File -FilePath $MinioPasswordFile -Encoding UTF8 -NoNewline
    Write-Host "✅ Generated MinIO password" -ForegroundColor Green
}

$GrafanaPasswordFile = Join-Path $SecretsDir "grafana_password.txt"
if (-not (Test-Path $GrafanaPasswordFile)) {
    New-RandomPassword | Out-File -FilePath $GrafanaPasswordFile -Encoding UTF8 -NoNewline
    Write-Host "✅ Generated Grafana password" -ForegroundColor Green
}

# Deploy based on platform
if ($Platform -eq "docker") {
    Write-Host "🐳 Deploying with Docker Compose..." -ForegroundColor Cyan
    
    Set-Location $InfrastructureDir
    
    # Pull latest images
    Write-Host "📥 Pulling latest images..." -ForegroundColor Yellow
    docker-compose -f docker-compose.infrastructure.yml pull
    
    # Start infrastructure services
    Write-Host "🚀 Starting infrastructure services..." -ForegroundColor Yellow
    docker-compose -f docker-compose.infrastructure.yml up -d
    
    # Wait for services to be ready
    Write-Host "⏳ Waiting for services to be ready..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
    
    # Check service health
    Wait-ForService -ServiceName "MinIO" -HealthUrl "http://localhost:9000/minio/health/live" -MaxAttempts 30
    Wait-ForService -ServiceName "Prometheus" -HealthUrl "http://localhost:9090/-/healthy" -MaxAttempts 30
    Wait-ForService -ServiceName "Grafana" -HealthUrl "http://localhost:3001/api/health" -MaxAttempts 30
    
    Write-Host ""
    Write-Host "🎉 Infrastructure deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Service URLs:" -ForegroundColor Cyan
    Write-Host "   - MinIO Console: http://localhost:9001"
    Write-Host "   - Prometheus: http://localhost:9090"
    Write-Host "   - Grafana: http://localhost:3001"
    Write-Host "   - Alertmanager: http://localhost:9093"
    Write-Host ""
    Write-Host "🔐 Default credentials:" -ForegroundColor Cyan
    Write-Host "   - MinIO: minioadmin / $(Get-Content $MinioPasswordFile)"
    Write-Host "   - Grafana: admin / $(Get-Content $GrafanaPasswordFile)"
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Configure MinIO buckets for file storage"
    Write-Host "   2. Import Grafana dashboards"
    Write-Host "   3. Configure Prometheus targets"
    Write-Host "   4. Deploy application services"
}
elseif ($Platform -eq "kubernetes") {
    Write-Host "☸️  Deploying with Kubernetes..." -ForegroundColor Cyan
    
    # Check cluster connection
    try {
        kubectl cluster-info | Out-Null
        Write-Host "✅ Connected to Kubernetes cluster" -ForegroundColor Green
    }
    catch {
        Write-Host "❌ Cannot connect to Kubernetes cluster" -ForegroundColor Red
        exit 1
    }
    
    # Create namespace
    Write-Host "📦 Creating namespace..." -ForegroundColor Yellow
    kubectl apply -f "$InfrastructureDir\k8s\namespace.yaml"
    
    # Apply ConfigMaps and Secrets
    Write-Host "⚙️  Applying configuration..." -ForegroundColor Yellow
    kubectl apply -f "$InfrastructureDir\k8s\configmap.yaml"
    
    # Warning about secrets
    Write-Host "⚠️  WARNING: Update secrets in k8s\secrets.yaml before applying!" -ForegroundColor Red
    Write-Host "   The current secrets are base64 encoded placeholders" -ForegroundColor Yellow
    $response = Read-Host "   Have you updated the secrets? (y/N)"
    if ($response -notmatch "^[Yy]$") {
        Write-Host "❌ Please update the secrets and run the script again" -ForegroundColor Red
        exit 1
    }
    
    kubectl apply -f "$InfrastructureDir\k8s\secrets.yaml"
    
    # Deploy applications
    Write-Host "🚀 Deploying applications..." -ForegroundColor Yellow
    kubectl apply -f "$InfrastructureDir\k8s\backend-deployment.yaml"
    kubectl apply -f "$InfrastructureDir\k8s\frontend-deployment.yaml"
    
    # Deploy ingress
    Write-Host "🌐 Deploying ingress..." -ForegroundColor Yellow
    kubectl apply -f "$InfrastructureDir\k8s\ingress.yaml"
    
    # Wait for deployments
    Write-Host "⏳ Waiting for deployments to be ready..." -ForegroundColor Yellow
    kubectl wait --for=condition=available --timeout=300s deployment/company-directory-backend -n company-directory
    kubectl wait --for=condition=available --timeout=300s deployment/company-directory-frontend -n company-directory
    
    Write-Host ""
    Write-Host "🎉 Kubernetes deployment complete!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Check deployment status:" -ForegroundColor Cyan
    Write-Host "   kubectl get pods -n company-directory"
    Write-Host "   kubectl get services -n company-directory"
    Write-Host "   kubectl get ingress -n company-directory"
    Write-Host ""
    Write-Host "📝 Next steps:" -ForegroundColor Yellow
    Write-Host "   1. Configure DNS to point to your ingress controller"
    Write-Host "   2. Verify SSL certificates are issued"
    Write-Host "   3. Test application endpoints"
    Write-Host "   4. Set up monitoring and alerting"
}

Write-Host ""
Write-Host "✅ Infrastructure deployment completed successfully!" -ForegroundColor Green