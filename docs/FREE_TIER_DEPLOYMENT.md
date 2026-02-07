# Free Tier Deployment Guide

## Overview
This guide shows you how to deploy the Company Directory application using free or very low-cost services. Perfect for testing, demos, or small-scale production use.

## Total Cost Estimate
- **Completely Free Option:** $0/month (with limitations)
- **Low-Cost Option:** $5-15/month (better performance and reliability)

---

## Option 1: Completely Free Deployment

### Stack Overview
- **Hosting:** Render.com (Free tier)
- **Database:** Neon.tech (Free tier - 0.5GB storage)
- **Redis:** Upstash (Free tier - 10,000 commands/day)
- **Object Storage:** Cloudflare R2 (Free tier - 10GB storage)
- **Domain:** Free subdomain from hosting provider
- **SSL:** Automatic and free

**Limitations:**
- Services may sleep after inactivity (30 min on Render)
- Limited storage and bandwidth
- Shared resources (slower performance)
- Good for: Testing, demos, small teams (<50 users)

---

## Step-by-Step Free Deployment

### 1. Set Up Free PostgreSQL Database (Neon.tech)

**Why Neon:** Free PostgreSQL with 0.5GB storage, auto-scaling, and branching.

1. **Sign up at [neon.tech](https://neon.tech)**
   - Use GitHub/Google login (free)
   - No credit card required

2. **Create a new project**
   - Project name: `company-directory`
   - Region: Choose closest to your users
   - PostgreSQL version: 15

3. **Get connection string**
   ```
   postgresql://user:password@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require
   ```
   - Copy this - you'll need it later
   - Neon automatically includes SSL

4. **Enable required extensions**
   ```sql
   -- Connect using Neon's SQL Editor or psql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_trgm";
   ```

**Free Tier Limits:**
- 0.5 GB storage
- 1 project
- Automatic backups (7 days)
- Branches for development

---

### 2. Set Up Free Redis (Upstash)

**Why Upstash:** Serverless Redis with generous free tier.

1. **Sign up at [upstash.com](https://upstash.com)**
   - Use GitHub/Google login (free)
   - No credit card required

2. **Create a Redis database**
   - Name: `company-directory-cache`
   - Type: Regional
   - Region: Choose closest to your app
   - TLS: Enabled

3. **Get connection details**
   ```
   redis://default:password@region.upstash.io:6379
   ```
   - Copy the connection string
   - Also note the REST API URL (useful for serverless)

**Free Tier Limits:**
- 10,000 commands per day
- 256 MB storage
- TLS encryption included

---

### 3. Set Up Free Object Storage (Cloudflare R2)

**Why Cloudflare R2:** Free tier with 10GB storage, no egress fees.

1. **Sign up at [cloudflare.com](https://cloudflare.com)**
   - Create account (free)
   - Credit card required but won't be charged on free tier

2. **Create R2 bucket**
   - Go to R2 Object Storage
   - Create bucket: `company-directory-files`
   - Location: Automatic

3. **Create API token**
   - Go to R2 > Manage R2 API Tokens
   - Create API token with read/write permissions
   - Save Access Key ID and Secret Access Key

4. **Get bucket URL**
   ```
   https://[account-id].r2.cloudflarestorage.com
   ```

**Free Tier Limits:**
- 10 GB storage
- 1 million Class A operations/month
- 10 million Class B operations/month
- No egress fees (huge savings!)

---

### 4. Deploy Application (Render.com)

**Why Render:** Free tier for web services, automatic deployments from GitHub.

#### 4.1 Prepare Your Repository

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/company-directory.git
   git push -u origin main
   ```

2. **Create `render.yaml` in project root**
   ```yaml
   services:
     # Backend API
     - type: web
       name: company-directory-backend
       env: node
       region: oregon
       plan: free
       buildCommand: cd backend && npm install && npm run build
       startCommand: cd backend && npm start
       envVars:
         - key: NODE_ENV
           value: production
         - key: PORT
           value: 3000
         - key: DATABASE_URL
           sync: false
         - key: REDIS_URL
           sync: false
         - key: JWT_SECRET
           generateValue: true
         - key: ENCRYPTION_KEY
           generateValue: true
         - key: SESSION_SECRET
           generateValue: true
       healthCheckPath: /health
       
     # Frontend
     - type: web
       name: company-directory-frontend
       env: static
       region: oregon
       plan: free
       buildCommand: cd frontend && npm install && npm run build
       staticPublishPath: frontend/dist
       routes:
         - type: rewrite
           source: /*
           destination: /index.html
   ```

#### 4.2 Deploy on Render

1. **Sign up at [render.com](https://render.com)**
   - Use GitHub login (free)
   - No credit card required

2. **Create new Web Service**
   - Connect your GitHub repository
   - Render will detect `render.yaml`
   - Or manually create services:

3. **Backend Service**
   - Name: `company-directory-backend`
   - Environment: Node
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
   - Plan: Free

4. **Add Environment Variables**
   ```
   NODE_ENV=production
   PORT=3000
   DATABASE_URL=<your-neon-connection-string>
   REDIS_URL=<your-upstash-connection-string>
   JWT_SECRET=<generate-with-script>
   ENCRYPTION_KEY=<generate-with-script>
   SESSION_SECRET=<generate-with-script>
   AWS_ACCESS_KEY_ID=<cloudflare-r2-key>
   AWS_SECRET_ACCESS_KEY=<cloudflare-r2-secret>
   S3_BUCKET_NAME=company-directory-files
   S3_ENDPOINT=https://[account-id].r2.cloudflarestorage.com
   AWS_REGION=auto
   FRONTEND_URL=https://company-directory-frontend.onrender.com
   ```

5. **Frontend Service**
   - Name: `company-directory-frontend`
   - Environment: Static Site
   - Build Command: `cd frontend && npm install && npm run build`
   - Publish Directory: `frontend/dist`
   - Plan: Free

6. **Update Frontend Environment**
   - Create `frontend/.env.production`:
   ```
   VITE_API_URL=https://company-directory-backend.onrender.com
   ```

**Free Tier Limits:**
- 750 hours/month (enough for 1 service 24/7)
- Services sleep after 15 min inactivity
- 100 GB bandwidth/month
- Automatic SSL certificates

---

### 5. Run Database Migrations

1. **Connect to your backend service**
   - Go to Render dashboard
   - Open Shell for backend service

2. **Run migrations**
   ```bash
   npm run prisma:migrate deploy
   ```

3. **Create initial admin user**
   ```bash
   npm run seed:production
   ```

---

### 6. Test Your Deployment

1. **Check backend health**
   ```bash
   curl https://company-directory-backend.onrender.com/health
   ```

2. **Open frontend**
   ```
   https://company-directory-frontend.onrender.com
   ```

3. **Login with admin credentials**
   - Email: admin@company.com
   - Password: (from seed script)

---

## Option 2: Low-Cost Deployment ($5-15/month)

For better performance and no sleep time:

### Railway.app ($5/month)
- **Database:** Railway PostgreSQL ($5/month for 1GB)
- **Redis:** Railway Redis ($5/month for 256MB)
- **App Hosting:** Railway ($5/month for 512MB RAM)
- **Total:** ~$15/month
- **Benefits:** No sleep, better performance, 24/7 uptime

### Setup:
1. Sign up at [railway.app](https://railway.app)
2. Create new project
3. Add PostgreSQL plugin
4. Add Redis plugin
5. Deploy from GitHub
6. Railway provides automatic SSL and domains

---

## Option 3: Fly.io (Free + Low Cost)

### Free Tier Includes:
- 3 shared-cpu-1x VMs with 256MB RAM each
- 3GB persistent volume storage
- 160GB outbound data transfer

### Setup:
```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
flyctl auth login

# Launch app
flyctl launch

# Deploy
flyctl deploy
```

**Cost:** Free for small apps, ~$5-10/month for production

---

## Option 4: Vercel + PlanetScale (Free Tier)

### Stack:
- **Frontend:** Vercel (Free - 100GB bandwidth)
- **Backend:** Vercel Serverless Functions (Free - 100GB-hrs)
- **Database:** PlanetScale (Free - 5GB storage)
- **Redis:** Upstash (Free - 10k commands/day)

**Note:** Requires adapting backend to serverless functions

---

## Comparison Table

| Service | Free Tier | Paid Tier | Best For |
|---------|-----------|-----------|----------|
| **Render** | ✅ 750hrs/month, sleeps | $7/month, always on | Easy deployment |
| **Railway** | ❌ $5 credit | $5-15/month | Best performance |
| **Fly.io** | ✅ 3 VMs, 256MB | $5-10/month | Global deployment |
| **Vercel** | ✅ 100GB bandwidth | $20/month | Serverless |
| **Neon** | ✅ 0.5GB DB | $19/month, 10GB | PostgreSQL |
| **Upstash** | ✅ 10k commands | $0.20/100k | Redis |
| **Cloudflare R2** | ✅ 10GB storage | $0.015/GB | Object storage |

---

## Recommended Free Stack

**For Testing/Demo:**
```
Frontend: Render (Free)
Backend: Render (Free)
Database: Neon (Free)
Redis: Upstash (Free)
Storage: Cloudflare R2 (Free)
Total: $0/month
```

**For Small Production (<100 users):**
```
Frontend: Vercel (Free)
Backend: Railway ($5)
Database: Railway ($5)
Redis: Upstash (Free)
Storage: Cloudflare R2 (Free)
Total: $10/month
```

**For Growing Production (100-1000 users):**
```
Frontend: Vercel (Free)
Backend: Railway ($10)
Database: Railway ($10)
Redis: Railway ($5)
Storage: Cloudflare R2 (Free)
Total: $25/month
```

---

## Tips for Staying Free

1. **Optimize Database Usage**
   - Use connection pooling
   - Add indexes for common queries
   - Clean up old data regularly

2. **Reduce Redis Usage**
   - Set appropriate TTLs
   - Cache only frequently accessed data
   - Use database for less critical caching

3. **Minimize Storage**
   - Compress images before upload
   - Set file size limits (2MB)
   - Clean up unused files

4. **Monitor Usage**
   - Check Neon dashboard for storage
   - Monitor Upstash command count
   - Track Render bandwidth

5. **Keep Services Warm**
   - Use UptimeRobot (free) to ping your app every 5 minutes
   - Prevents Render from sleeping

---

## Migration Path

Start free, upgrade as you grow:

**Phase 1: Free (0-50 users)**
- Use all free tiers
- Accept sleep time on Render
- Monitor usage limits

**Phase 2: Low-Cost ($10-25/month, 50-500 users)**
- Upgrade to Railway or paid Render
- Keep free Redis and storage
- Add monitoring

**Phase 3: Production ($50-100/month, 500+ users)**
- Move to AWS/Azure/GCP
- Use managed services
- Add CDN and load balancing

---

## Quick Start Script

```bash
#!/bin/bash

echo "Setting up free deployment..."

# 1. Generate secrets
./scripts/generate-secrets.sh > secrets.txt
echo "✓ Secrets generated (saved to secrets.txt)"

# 2. Create .env.production
cat > backend/.env.production << EOF
NODE_ENV=production
DATABASE_URL=<paste-neon-url>
REDIS_URL=<paste-upstash-url>
JWT_SECRET=$(grep JWT_SECRET secrets.txt | cut -d' ' -f2)
ENCRYPTION_KEY=$(grep ENCRYPTION_KEY secrets.txt | cut -d' ' -f2)
SESSION_SECRET=$(grep SESSION_SECRET secrets.txt | cut -d' ' -f2)
EOF

echo "✓ Environment file created"

# 3. Push to GitHub
git add .
git commit -m "Ready for deployment"
git push

echo "✓ Code pushed to GitHub"
echo ""
echo "Next steps:"
echo "1. Sign up at render.com"
echo "2. Connect your GitHub repo"
echo "3. Deploy using render.yaml"
echo "4. Add environment variables from backend/.env.production"
```

---

## Support Resources

### Free Tier Documentation
- [Render Free Tier](https://render.com/docs/free)
- [Neon Free Tier](https://neon.tech/docs/introduction/billing)
- [Upstash Free Tier](https://docs.upstash.com/redis/features/freeti er)
- [Cloudflare R2 Pricing](https://developers.cloudflare.com/r2/pricing/)

### Community Support
- Render Community: https://community.render.com
- Neon Discord: https://discord.gg/neon
- Upstash Discord: https://discord.gg/upstash

---

## Troubleshooting Free Tier

### Render Service Sleeping
**Problem:** App takes 30+ seconds to wake up

**Solutions:**
1. Use UptimeRobot to ping every 5 minutes
2. Upgrade to paid tier ($7/month)
3. Accept the delay for free tier

### Neon Storage Limit
**Problem:** Approaching 0.5GB limit

**Solutions:**
1. Clean up old audit logs
2. Optimize image storage (use R2)
3. Upgrade to paid tier ($19/month for 10GB)

### Upstash Command Limit
**Problem:** Exceeding 10k commands/day

**Solutions:**
1. Increase cache TTLs
2. Cache less frequently
3. Upgrade to paid tier ($0.20 per 100k commands)

---

**Last Updated:** 2024-02-06

**Note:** Free tier limits and pricing may change. Always check provider websites for current offerings.
