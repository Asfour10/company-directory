# Render Deployment Steps

## ✅ Completed
- [x] Fixed all TypeScript compilation errors
- [x] Resolved security vulnerabilities (11 → 4, all safe)
- [x] Made Stripe optional
- [x] Added root health check endpoint
- [x] Pushed changes to GitHub
- [x] Render deployment triggered automatically

## 🚀 Next Steps

### 1. Monitor the Build on Render

Go to your Render dashboard and watch the build logs. The build should:
- Install dependencies
- Run `npm run build` (TypeScript compilation)
- Start the server with `npm start`

**Expected Success**: You should see "Build successful 🎉" and the server starting on port 10000.

### 2. Add PostgreSQL Database

Once the backend build succeeds:

1. **In Render Dashboard**:
   - Click "New +" → "PostgreSQL"
   - Name: `company-directory-db`
   - Region: Same as your backend service
   - Plan: Free tier (256MB RAM, 1GB storage)
   - Click "Create Database"

2. **Copy the Internal Database URL**:
   - Go to your new database
   - Copy the "Internal Database URL" (starts with `postgresql://`)

### 3. Configure Environment Variables

In your backend service on Render:

1. Go to "Environment" tab
2. Add these variables:

```bash
# Required - Database
DATABASE_URL=<paste-internal-database-url-here>

# Required - Authentication
JWT_SECRET=<generate-random-32-char-string>
JWT_REFRESH_SECRET=<generate-random-32-char-string>

# Required - Server
NODE_ENV=production
PORT=10000

# Optional - Redis (can skip for now)
# REDIS_URL=redis://...

# Optional - File uploads (can skip for now)
# AWS_ACCESS_KEY_ID=
# AWS_SECRET_ACCESS_KEY=
# AWS_REGION=us-east-1
# AWS_S3_BUCKET=

# Optional - Stripe (already optional in code)
# STRIPE_SECRET_KEY=
# STRIPE_WEBHOOK_SECRET=
```

3. Click "Save Changes" - this will trigger a redeploy

### 4. Run Database Migrations

After the service redeploys with DATABASE_URL:

**Option A: Using Render Shell** (Recommended)
1. In your backend service, go to "Shell" tab
2. Run: `npm run prisma:migrate:deploy`

**Option B: Using Local Connection**
1. Copy the External Database URL from Render
2. In your local terminal:
   ```bash
   cd backend
   DATABASE_URL="<external-database-url>" npm run prisma:migrate:deploy
   ```

### 5. Verify Deployment

Once migrations complete, test your API:

```bash
# Get your Render URL (e.g., https://company-directory-api.onrender.com)
curl https://your-app.onrender.com/

# Should return:
# {
#   "status": "ok",
#   "message": "Company Directory API",
#   "version": "1.0.0",
#   "endpoints": [...]
# }
```

### 6. Create Initial Admin User

You'll need to create an admin user to access the system. You can do this via:

**Option A: Direct Database Insert**
```sql
-- Connect to your database and run:
INSERT INTO "User" (id, email, password, role, "tenantId", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'admin@company.com',
  '$2b$10$...',  -- Use bcrypt to hash 'admin123'
  'ADMIN',
  (SELECT id FROM "Tenant" LIMIT 1),
  NOW(),
  NOW()
);
```

**Option B: Create via API** (after deployment)
- Use the `/api/auth/register` endpoint (if enabled)
- Or create a seed script

## 🎯 Success Criteria

Your backend is successfully deployed when:
- ✅ Build completes without errors
- ✅ Health check endpoint returns 200 OK
- ✅ Database migrations run successfully
- ✅ You can create/login users via API

## 📝 Common Issues

### Issue: "No open ports detected"
**Solution**: Already fixed! We added the root route handler.

### Issue: "STRIPE_SECRET_KEY environment variable is required"
**Solution**: Already fixed! Stripe is now optional.

### Issue: Database connection fails
**Solution**: 
- Verify DATABASE_URL is the Internal URL (not External)
- Check database is in same region as backend
- Ensure database is running

### Issue: Migrations fail
**Solution**:
- Check DATABASE_URL is correct
- Verify database is accessible
- Try running migrations from local machine with External URL

## 🔜 After Backend is Live

1. **Deploy Frontend**:
   - Create new Static Site on Render
   - Build command: `npm run build --workspace=frontend`
   - Publish directory: `frontend/dist`
   - Add environment variable: `VITE_API_URL=<your-backend-url>`

2. **Test Full Application**:
   - Access frontend URL
   - Login with admin credentials
   - Create test employees
   - Verify all features work

3. **Optional Enhancements**:
   - Add Redis for session management
   - Configure S3 for file uploads
   - Set up custom domain
   - Enable SSL/TLS

## 📚 Resources

- [Render Docs](https://render.com/docs)
- [Prisma Migrations](https://www.prisma.io/docs/concepts/components/prisma-migrate)
- [Your Security Audit](./backend/SECURITY_AUDIT.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)

---

**Current Status**: ✅ Code pushed to GitHub, Render building...

**Next Action**: Monitor build on Render dashboard, then add PostgreSQL database.
