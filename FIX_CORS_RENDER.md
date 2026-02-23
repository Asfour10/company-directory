# Fix CORS on Render Backend

## Problem
The backend is working but not sending CORS headers. The diagnostic tool shows "Failed to fetch" which means CORS is blocking browser requests.

## Root Cause
The backend CORS configuration needs the `FRONTEND_URL` environment variable to be set in Render.

## Solution

### Step 1: Set Environment Variable in Render

1. Go to your Render dashboard: https://dashboard.render.com
2. Click on `company-directory-backend` service
3. Click "Environment" tab on the left
4. Look for `FRONTEND_URL` variable
5. If it exists, make sure it's set to: `https://company-directory-frontend.onrender.com`
6. If it doesn't exist, click "Add Environment Variable":
   - Key: `FRONTEND_URL`
   - Value: `https://company-directory-frontend.onrender.com`
7. Click "Save Changes"
8. Render will automatically redeploy the backend

### Step 2: Wait for Redeploy
- The backend will redeploy automatically (takes 3-5 minutes)
- Watch the "Events" tab until it shows "Live"

### Step 3: Test Again
1. Open `diagnose-login.html` in your browser
2. Click "Run All Tests"
3. All three tests should now PASS

## Why This Fixes It

The backend CORS configuration in `backend/src/index.ts` is:

```typescript
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://company-directory-frontend.onrender.com'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

Even though we hardcoded the frontend URL as a fallback, the CORS middleware needs to match the exact origin of incoming requests. Setting the environment variable ensures it works correctly.

## Verification

After the backend redeploys, the diagnostic tool should show:
- ✓ Backend Health: PASS
- ✓ Login Endpoint: PASS  
- ✓ CORS Configuration: PASS

Then login on the frontend will work!

## Alternative: Check Current Environment Variables

To see what environment variables are currently set:

1. Go to Render dashboard
2. Click `company-directory-backend`
3. Click "Environment" tab
4. Look for these variables:
   - `DATABASE_URL` - should be set
   - `JWT_SECRET` - should be set
   - `JWT_REFRESH_SECRET` - should be set
   - `FRONTEND_URL` - **THIS ONE MIGHT BE MISSING OR WRONG**

## Current Status

✅ Backend is running and responding
✅ Database has admin user
✅ Frontend is deployed
✗ CORS is blocking browser requests

Once you set `FRONTEND_URL` in Render and the backend redeploys, everything will work!
