#!/bin/bash

# =============================================================================
# Company Directory - Infrastructure Deployment Script
# =============================================================================
# This script deploys the production infrastructure for the Company Directory
# Usage: ./scripts/deploy-infrastructure.sh [environment] [platform]
# Environments: staging, production
# Platforms: docker, kubernetes

set -e

ENVIRONMENT=${1:-staging}
PLATFORM=${2:-docker}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRASTRUCTURE_DIR="$PROJECT_ROOT/infrastructure"

echo "🚀 Deploying Company Directory infrastructure"
echo "Environment: $ENVIRONMENT"
echo "Platform: $PLATFORM"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to wait for service to be ready
wait_for_service() {
    local service_name=$1
    local health_url=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    echo "⏳ Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if curl -f -s "$health_url" >/dev/null 2>&1; then
            echo "✅ $service_name is ready!"
            return 0
        fi
        
        echo "   Attempt $attempt/$max_attempts - $service_name not ready yet..."
        sleep 10
        attempt=$((attempt + 1))
    done
    
    echo "❌ $service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Validate environment
case $ENVIRONMENT in
    staging|production)
        echo "✅ Valid environment: $ENVIRONMENT"
        ;;
    *)
        echo "❌ Invalid environment: $ENVIRONMENT"
        echo "Valid environments: staging, production"
        exit 1
        ;;
esac

# Validate platform
case $PLATFORM in
    docker|kubernetes)
        echo "✅ Valid platform: $PLATFORM"
        ;;
    *)
        echo "❌ Invalid platform: $PLATFORM"
        echo "Valid platforms: docker, kubernetes"
        exit 1
        ;;
esac

# Check required tools
if [[ "$PLATFORM" == "docker" ]]; then
    if ! command_exists docker; then
        echo "❌ Docker is required but not installed"
        exit 1
    fi
    
    if ! command_exists docker-compose; then
        echo "❌ Docker Compose is required but not installed"
        exit 1
    fi
    
    echo "✅ Docker and Docker Compose are available"
elif [[ "$PLATFORM" == "kubernetes" ]]; then
    if ! command_exists kubectl; then
        echo "❌ kubectl is required but not installed"
        exit 1
    fi
    
    if ! command_exists helm; then
        echo "⚠️  Helm is recommended but not required"
    fi
    
    echo "✅ kubectl is available"
fi

# Create necessary directories
echo "📁 Creating necessary directories..."
mkdir -p "$INFRASTRUCTURE_DIR/secrets"
mkdir -p "$INFRASTRUCTURE_DIR/ssl"
mkdir -p "$INFRASTRUCTURE_DIR/logs"

# Generate secrets if they don't exist
echo "🔐 Setting up secrets..."
if [[ ! -f "$INFRASTRUCTURE_DIR/secrets/postgres_password.txt" ]]; then
    openssl rand -base64 32 > "$INFRASTRUCTURE_DIR/secrets/postgres_password.txt"
    echo "✅ Generated PostgreSQL password"
fi

if [[ ! -f "$INFRASTRUCTURE_DIR/secrets/minio_password.txt" ]]; then
    openssl rand -base64 32 > "$INFRASTRUCTURE_DIR/secrets/minio_password.txt"
    echo "✅ Generated MinIO password"
fi

if [[ ! -f "$INFRASTRUCTURE_DIR/secrets/grafana_password.txt" ]]; then
    openssl rand -base64 32 > "$INFRASTRUCTURE_DIR/secrets/grafana_password.txt"
    echo "✅ Generated Grafana password"
fi

# Deploy based on platform
if [[ "$PLATFORM" == "docker" ]]; then
    echo "🐳 Deploying with Docker Compose..."
    
    cd "$INFRASTRUCTURE_DIR"
    
    # Pull latest images
    echo "📥 Pulling latest images..."
    docker-compose -f docker-compose.infrastructure.yml pull
    
    # Start infrastructure services
    echo "🚀 Starting infrastructure services..."
    docker-compose -f docker-compose.infrastructure.yml up -d
    
    # Wait for services to be ready
    echo "⏳ Waiting for services to be ready..."
    sleep 30
    
    # Check service health
    wait_for_service "PostgreSQL" "http://localhost:5432" 10 || true
    wait_for_service "Redis" "http://localhost:6379" 10 || true
    wait_for_service "MinIO" "http://localhost:9000/minio/health/live" 30
    wait_for_service "Prometheus" "http://localhost:9090/-/healthy" 30
    wait_for_service "Grafana" "http://localhost:3001/api/health" 30
    
    echo ""
    echo "🎉 Infrastructure deployment complete!"
    echo ""
    echo "📊 Service URLs:"
    echo "   - MinIO Console: http://localhost:9001"
    echo "   - Prometheus: http://localhost:9090"
    echo "   - Grafana: http://localhost:3001"
    echo "   - Alertmanager: http://localhost:9093"
    echo ""
    echo "🔐 Default credentials:"
    echo "   - MinIO: minioadmin / $(cat secrets/minio_password.txt)"
    echo "   - Grafana: admin / $(cat secrets/grafana_password.txt)"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Configure MinIO buckets for file storage"
    echo "   2. Import Grafana dashboards"
    echo "   3. Configure Prometheus targets"
    echo "   4. Deploy application services"

elif [[ "$PLATFORM" == "kubernetes" ]]; then
    echo "☸️  Deploying with Kubernetes..."
    
    # Check cluster connection
    if ! kubectl cluster-info >/dev/null 2>&1; then
        echo "❌ Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    echo "✅ Connected to Kubernetes cluster"
    
    # Create namespace
    echo "📦 Creating namespace..."
    kubectl apply -f "$INFRASTRUCTURE_DIR/k8s/namespace.yaml"
    
    # Apply ConfigMaps and Secrets
    echo "⚙️  Applying configuration..."
    kubectl apply -f "$INFRASTRUCTURE_DIR/k8s/configmap.yaml"
    
    # Warning about secrets
    echo "⚠️  WARNING: Update secrets in k8s/secrets.yaml before applying!"
    echo "   The current secrets are base64 encoded placeholders"
    read -p "   Have you updated the secrets? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Please update the secrets and run the script again"
        exit 1
    fi
    
    kubectl apply -f "$INFRASTRUCTURE_DIR/k8s/secrets.yaml"
    
    # Deploy applications
    echo "🚀 Deploying applications..."
    kubectl apply -f "$INFRASTRUCTURE_DIR/k8s/backend-deployment.yaml"
    kubectl apply -f "$INFRASTRUCTURE_DIR/k8s/frontend-deployment.yaml"
    
    # Deploy ingress
    echo "🌐 Deploying ingress..."
    kubectl apply -f "$INFRASTRUCTURE_DIR/k8s/ingress.yaml"
    
    # Wait for deployments
    echo "⏳ Waiting for deployments to be ready..."
    kubectl wait --for=condition=available --timeout=300s deployment/company-directory-backend -n company-directory
    kubectl wait --for=condition=available --timeout=300s deployment/company-directory-frontend -n company-directory
    
    echo ""
    echo "🎉 Kubernetes deployment complete!"
    echo ""
    echo "📊 Check deployment status:"
    echo "   kubectl get pods -n company-directory"
    echo "   kubectl get services -n company-directory"
    echo "   kubectl get ingress -n company-directory"
    echo ""
    echo "📝 Next steps:"
    echo "   1. Configure DNS to point to your ingress controller"
    echo "   2. Verify SSL certificates are issued"
    echo "   3. Test application endpoints"
    echo "   4. Set up monitoring and alerting"
fi

echo ""
echo "✅ Infrastructure deployment completed successfully!"