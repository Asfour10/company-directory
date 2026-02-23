# Deploy Backend to Render

## The Issue
Your backend service is missing from your Render account. We need to create it.

## Steps to Create Backend Service

### 1. Go to Render Dashboard
https://dashboard.render.com

### 2. Click "New +" Button
Look for a blue "New +" button (usually in the top right)

### 3. Select "Web Service"
From the dropdown menu, click "Web Service"

### 4. Connect Your GitHub Repository
- If you see your repository "Asfour10/company-directory", click "Connect"
- If you don't see it, click "Configure account" to give Render access to your GitHub

### 5. Configure the Service

Fill in these settings:

**Name:** `company-directory-backend`

**Region:** `Ohio (US East)` (same as your database)

**Branch:** `main`

**Root Directory:** `backend`

**Runtime:** `Node`

**Build Command:** `npm install && npx prisma generate && npm run build`

**Start Command:** `npm start`

**Instance Type:** `Free`

### 6. Add Environment Variables

Click "Add Environment Variable" for each of these:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `DATABASE_URL` | `postgresql://company_directory_user:OCZK2sZXDFepo5UhRLKP9BSXhcMRhX5e@dpg-d64l4bpr0fns73c9n02g-a.ohio-postgres.render.com/company_directory` |
| `JWT_SECRET` | `Z7NeZwIujIma0KiP9aGUUixVOLcPcpCHr6lxAEy44vnXQFIJyV1zdiOuukCadrW0` |
| `JWT_REFRESH_SECRET` | `9o2jk/1i9wRw0g3/n5XiKmt13IrrNuZEexq/e5qMFra4vkMojMQ5wsXVd8QlZaBc` |
| `FRONTEND_URL` | `https://company-directory-frontend.onrender.com` |

### 7. Click "Create Web Service"

Render will start building and deploying your backend. This takes about 3-5 minutes.

### 8. Get the Backend URL

Once deployed, you'll see a URL like:
`https://company-directory-backend-xxxx.onrender.com`

### 9. Update Frontend Environment Variable

Go to your frontend service and update the backend URL:
1. Click on "company-directory-frontend"
2. Go to "Environment" tab
3. Find `VITE_API_URL` 
4. Update it to your new backend URL
5. Click "Save Changes"

### 10. Test Login

After both services redeploy, go to:
https://company-directory-frontend.onrender.com

Login with:
- Email: `admin@company.com`
- Password: `admin123`

## Why This Happened

The backend at https://company-directory-oknw.onrender.com is either:
- Deployed under a different Render account
- An old deployment that needs to be replaced

By creating a new backend service in YOUR Render account, you'll have full control over it.
