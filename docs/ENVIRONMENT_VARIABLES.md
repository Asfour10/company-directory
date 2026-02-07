# Environment Variables Documentation

This document describes all environment variables used in the Company Directory application.

## Table of Contents

- [Backend Environment Variables](#backend-environment-variables)
- [Frontend Environment Variables](#frontend-environment-variables)
- [Docker Environment Variables](#docker-environment-variables)
- [Production Deployment](#production-deployment)
- [Security Considerations](#security-considerations)

## Backend Environment Variables

### Server Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Application environment (development, production, test) |
| `PORT` | No | `3000` | Port for the HTTP server |
| `HOST` | No | `0.0.0.0` | Host address to bind the server |
| `LOG_LEVEL` | No | `info` | Logging level (error, warn, info, debug) |
| `LOG_FORMAT` | No | `json` | Log format (json, simple) |
| `ENABLE_CORS` | No | `true` | Enable CORS for development |
| `CORS_ORIGIN` | No | `http://localhost:5173` | Allowed CORS origins |

### Database Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DB_POOL_MIN` | No | `2` | Minimum database connections |
| `DB_POOL_MAX` | No | `20` | Maximum database connections |
| `DB_POOL_TIMEOUT` | No | `20000` | Connection timeout in milliseconds |
| `DB_SSL_MODE` | No | `prefer` | SSL mode (disable, prefer, require) |
| `DB_SSL_CERT` | No | - | Path to SSL certificate |
| `DB_SSL_KEY` | No | - | Path to SSL private key |
| `DB_SSL_ROOT_CERT` | No | - | Path to SSL root certificate |

### Redis Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | `redis://localhost:6379` | Redis connection string |
| `REDIS_PASSWORD` | No | - | Redis password |
| `REDIS_DB` | No | `0` | Redis database number |
| `REDIS_CONNECT_TIMEOUT` | No | `10000` | Connection timeout in milliseconds |
| `REDIS_COMMAND_TIMEOUT` | No | `5000` | Command timeout in milliseconds |

### Authentication & Security

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JWT_SECRET` | Yes | - | Secret key for JWT signing (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `8h` | JWT token expiration time |
| `JWT_REFRESH_SECRET` | Yes | - | Secret key for refresh tokens (min 32 chars) |
| `JWT_REFRESH_EXPIRES_IN` | No | `7d` | Refresh token expiration time |
| `SESSION_SECRET` | Yes | - | Session secret key (min 32 chars) |
| `SESSION_TIMEOUT` | No | `28800000` | Session timeout in milliseconds |
| `RATE_LIMIT_WINDOW_MS` | No | `900000` | Rate limiting window in milliseconds |
| `RATE_LIMIT_MAX_REQUESTS` | No | `100` | Maximum requests per window |

### Encryption Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ENCRYPTION_KEY` | Yes | - | 32-character encryption key |
| `ENCRYPTION_ALGORITHM` | No | `aes-256-gcm` | Encryption algorithm |
| `DB_ENCRYPTION_ENABLED` | No | `false` | Enable database encryption |
| `ENCRYPTION_PROVIDER` | No | `local` | Key provider (local, aws, azure) |
| `AWS_KMS_KEY_ID` | No | - | AWS KMS key ID |
| `AZURE_KEY_VAULT_URL` | No | - | Azure Key Vault URL |
| `AZURE_KEY_NAME` | No | - | Azure key name |

### SSL/TLS Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `HTTPS_ENABLED` | No | `false` | Enable HTTPS |
| `HTTPS_PORT` | No | `3443` | HTTPS port |
| `SSL_KEY_PATH` | No | - | Path to SSL private key |
| `SSL_CERT_PATH` | No | - | Path to SSL certificate |
| `SSL_CA_PATH` | No | - | Path to SSL CA certificate |
| `ENFORCE_HTTPS` | No | `false` | Redirect HTTP to HTTPS |
| `TLS_MIN_VERSION` | No | `1.2` | Minimum TLS version |
| `TLS_MAX_VERSION` | No | `1.3` | Maximum TLS version |

### File Storage Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `MAX_FILE_SIZE` | No | `2097152` | Maximum file size in bytes (2MB) |
| `ALLOWED_FILE_TYPES` | No | `image/jpeg,image/png,image/gif,image/webp` | Allowed MIME types |
| `UPLOAD_PATH` | No | `uploads` | Local upload directory |
| `AWS_REGION` | No | `us-east-1` | AWS region |
| `AWS_ACCESS_KEY_ID` | No | - | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | No | - | AWS secret key |
| `AWS_S3_BUCKET` | No | - | S3 bucket name |
| `AZURE_STORAGE_ACCOUNT` | No | - | Azure storage account |
| `AZURE_STORAGE_KEY` | No | - | Azure storage key |
| `AZURE_STORAGE_CONTAINER` | No | `uploads` | Azure container name |

### SSO Provider Configuration

#### Azure AD
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `AZURE_AD_CLIENT_ID` | No | - | Azure AD application client ID |
| `AZURE_AD_CLIENT_SECRET` | No | - | Azure AD application client secret |
| `AZURE_AD_TENANT_ID` | No | - | Azure AD tenant ID |
| `AZURE_AD_CALLBACK_URL` | No | - | Azure AD callback URL |

#### Google OAuth
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | No | - | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | No | - | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | No | - | Google OAuth callback URL |

#### Okta
| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OKTA_DOMAIN` | No | - | Okta domain |
| `OKTA_CLIENT_ID` | No | - | Okta client ID |
| `OKTA_CLIENT_SECRET` | No | - | Okta client secret |
| `OKTA_CALLBACK_URL` | No | - | Okta callback URL |

### SCIM Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SCIM_BEARER_TOKEN` | No | - | SCIM API bearer token |
| `SCIM_ENDPOINT_PREFIX` | No | `/scim/v2` | SCIM endpoint prefix |

### Billing Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | No | - | Stripe secret key |
| `STRIPE_PUBLISHABLE_KEY` | No | - | Stripe publishable key |
| `STRIPE_WEBHOOK_SECRET` | No | - | Stripe webhook secret |
| `BASIC_PLAN_USER_LIMIT` | No | `50` | Basic plan user limit |
| `PREMIUM_PLAN_USER_LIMIT` | No | `500` | Premium plan user limit |
| `ENTERPRISE_PLAN_USER_LIMIT` | No | `10000` | Enterprise plan user limit |

### Email Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `SMTP_HOST` | No | - | SMTP server host |
| `SMTP_PORT` | No | `587` | SMTP server port |
| `SMTP_SECURE` | No | `false` | Use SSL/TLS |
| `SMTP_USER` | No | - | SMTP username |
| `SMTP_PASSWORD` | No | - | SMTP password |
| `SMTP_FROM` | No | - | From email address |
| `SMTP_FROM_NAME` | No | `Company Directory` | From name |

### Monitoring Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `METRICS_ENABLED` | No | `true` | Enable Prometheus metrics |
| `METRICS_PORT` | No | `9090` | Metrics server port |
| `METRICS_PATH` | No | `/metrics` | Metrics endpoint path |
| `HEALTH_CHECK_ENABLED` | No | `true` | Enable health checks |
| `HEALTH_CHECK_PATH` | No | `/health` | Health check endpoint |
| `READINESS_CHECK_PATH` | No | `/ready` | Readiness check endpoint |

### Cache Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `CACHE_TTL_EMPLOYEE_PROFILE` | No | `300` | Employee profile cache TTL (seconds) |
| `CACHE_TTL_SEARCH_RESULTS` | No | `300` | Search results cache TTL (seconds) |
| `CACHE_TTL_TENANT_CONFIG` | No | `3600` | Tenant config cache TTL (seconds) |
| `CACHE_TTL_SESSION` | No | `28800` | Session cache TTL (seconds) |

### Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `FEATURE_ANALYTICS` | No | `true` | Enable analytics features |
| `FEATURE_CUSTOM_FIELDS` | No | `true` | Enable custom fields |
| `FEATURE_BULK_IMPORT` | No | `true` | Enable bulk import |
| `FEATURE_SCIM` | No | `true` | Enable SCIM provisioning |
| `FEATURE_BILLING` | No | `true` | Enable billing features |
| `FEATURE_ENCRYPTION` | No | `false` | Enable field encryption |
| `FEATURE_GDPR` | No | `true` | Enable GDPR features |

## Frontend Environment Variables

### Application Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NODE_ENV` | Yes | `development` | Application environment |
| `VITE_APP_NAME` | No | `Company Directory` | Application name |
| `VITE_APP_VERSION` | No | `1.0.0` | Application version |

### API Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_API_URL` | Yes | `http://localhost:3000` | Backend API URL |
| `VITE_API_TIMEOUT` | No | `10000` | API request timeout (ms) |
| `VITE_WS_URL` | No | - | WebSocket URL |

### Feature Flags

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_FEATURE_ANALYTICS` | No | `true` | Enable analytics UI |
| `VITE_FEATURE_CUSTOM_FIELDS` | No | `true` | Enable custom fields UI |
| `VITE_FEATURE_BULK_IMPORT` | No | `true` | Enable bulk import UI |
| `VITE_FEATURE_ORG_CHART` | No | `true` | Enable org chart |
| `VITE_FEATURE_ADVANCED_SEARCH` | No | `true` | Enable advanced search |
| `VITE_FEATURE_EXPORT` | No | `true` | Enable data export |

### UI Configuration

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `VITE_DEFAULT_PAGE_SIZE` | No | `20` | Default pagination size |
| `VITE_MAX_PAGE_SIZE` | No | `100` | Maximum pagination size |
| `VITE_SEARCH_DEBOUNCE_MS` | No | `300` | Search debounce delay (ms) |
| `VITE_SEARCH_MIN_CHARS` | No | `2` | Minimum search characters |

## Docker Environment Variables

When using Docker, you can override environment variables using:

1. **Docker Compose**: Set variables in `docker-compose.yml` or `docker-compose.override.yml`
2. **Environment Files**: Use `.env` files with Docker Compose
3. **Command Line**: Pass variables with `-e` flag

Example Docker Compose configuration:

```yaml
services:
  backend:
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://user:pass@db:5432/company_directory
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
```

## Production Deployment

### Required Variables for Production

**Backend (Minimum Required):**
- `NODE_ENV=production`
- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `SESSION_SECRET`
- `ENCRYPTION_KEY`

**Frontend (Minimum Required):**
- `NODE_ENV=production`
- `VITE_API_URL`

### Recommended Production Variables

**Security:**
- `HTTPS_ENABLED=true`
- `ENFORCE_HTTPS=true`
- `DB_SSL_MODE=require`
- `TLS_MIN_VERSION=1.2`

**Performance:**
- `DB_POOL_MAX=50`
- `REDIS_CONNECT_TIMEOUT=5000`
- `CACHE_TTL_*` (appropriate values)

**Monitoring:**
- `METRICS_ENABLED=true`
- `HEALTH_CHECK_ENABLED=true`
- `LOG_LEVEL=info`

## Security Considerations

### Secret Management

1. **Never commit secrets to version control**
2. **Use environment-specific secret management:**
   - Development: `.env` files (gitignored)
   - Production: AWS Secrets Manager, Azure Key Vault, or Kubernetes secrets
3. **Rotate secrets regularly**
4. **Use strong, randomly generated secrets (minimum 32 characters)**

### Environment Separation

1. **Use different secrets for each environment**
2. **Restrict access to production secrets**
3. **Use least-privilege access principles**
4. **Monitor secret access and usage**

### Validation

The application validates environment variables on startup and will fail to start if required variables are missing or invalid.

### Example Production Setup

```bash
# Production environment variables
NODE_ENV=production
DATABASE_URL=postgresql://user:$(cat /run/secrets/db_password)@db.example.com:5432/company_directory
JWT_SECRET=$(cat /run/secrets/jwt_secret)
ENCRYPTION_KEY=$(cat /run/secrets/encryption_key)
HTTPS_ENABLED=true
SSL_CERT_PATH=/etc/ssl/certs/app.crt
SSL_KEY_PATH=/etc/ssl/private/app.key
```

For more information on deployment, see the [Deployment Guide](./DEPLOYMENT.md).