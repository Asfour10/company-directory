# Fix Frontend API URL on Render

## Problem
The frontend is not using the correct backend URL because the VITE_API_URL environment variable is not being properly injected during the build process.

## Solution

### Option 1: Update Render Build Command (RECOMMENDED)

1. Go to your Render dashboard
2. Click on `company-directory-frontend` service
3. Go to "Settings"
4. Find "Build Command"
5. Change it from:
   ```
   npm install && npm run build
   ```
   To:
   ```
   npm install && VITE_API_URL=https://company-directory-backend-o3xm.onrender.com npm run build
   ```

6. Click "Save Changes"
7. Render will automatically redeploy with the correct API URL

### Option 2: Use Render Environment Variable (Alternative)

If Option 1 doesn't work, try this:

1. Go to Render dashboard → `company-directory-frontend`
2. Go to "Environment" tab
3. Make sure you have:
   - Key: `VITE_API_URL`
   - Value: `https://company-directory-backend-o3xm.onrender.com`
4. **IMPORTANT**: The environment variable must be set BEFORE the build runs
5. Trigger a manual deploy

### Option 3: Hardcode the URL (Quick Fix)

If both options above don't work, we can temporarily hardcode the URL in the code:

Edit `frontend/src/services/api.ts` and change:
```typescript
baseURL: process.env.VITE_API_URL || 'http://localhost:3000/api',
```

To:
```typescript
baseURL: 'https://company-directory-backend-o3xm.onrender.com/api',
```

Then commit and push to trigger a redeploy.

## Why This Happens

Vite environment variables must:
1. Be prefixed with `VITE_` to be exposed to the client
2. Be available during BUILD time (not just runtime)
3. Be explicitly passed in the build command OR exist in `.env.production` file

Render's environment variables are available at runtime, but Vite needs them at BUILD time.

## Verification

After applying the fix:
1. Wait for Render to finish deploying
2. Open `check-frontend-api-url.html` in your browser
3. Click "Check Frontend API URL"
4. It should show the correct backend URL

## Current Status

- Backend URL: https://company-directory-backend-o3xm.onrender.com ✓ WORKING
- Frontend URL: https://company-directory-frontend.onrender.com ✗ WRONG API URL
- Admin credentials: admin@company.com / admin123 ✓ VERIFIED

The backend is working perfectly. The only issue is the frontend is not configured to talk to it.
