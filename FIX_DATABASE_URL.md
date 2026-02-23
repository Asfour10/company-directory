# How to Fix the Database URL on Render

## The Problem
Your backend is trying to connect to the wrong database (Neon) instead of the Render PostgreSQL database where we created the admin user.

## The Solution
Update the DATABASE_URL environment variable on Render.

## Step-by-Step Instructions

### 1. Go to Render Dashboard
Open your browser and go to: https://dashboard.render.com

### 2. Find Your Backend Service
- You should see a list of your services
- Look for **"company-directory-oknw"** (your backend service)
- Click on it

### 3. Go to Environment Tab
- On the left sidebar, click **"Environment"**
- OR look for tabs at the top and click **"Environment"**

### 4. Find DATABASE_URL
- Scroll through the list of environment variables
- Look for one called **"DATABASE_URL"**
- It currently points to: `ep-plain-star-aekp77vq-pooler.c-2.us-east-2.aws.neon.tech` (Neon database)

### 5. Update DATABASE_URL
Click the **Edit** button (pencil icon) next to DATABASE_URL

Replace the entire value with:
```
postgresql://company_directory_user:OCZK2sZXDFepo5UhRLKP9BSXhcMRhX5e@dpg-d64l4bpr0fns73c9n02g-a.ohio-postgres.render.com/company_directory
```

### 6. Save Changes
- Click **"Save Changes"** button at the bottom
- Render will automatically redeploy your backend (takes 2-3 minutes)

### 7. Test Login
After the deployment finishes, go to:
https://company-directory-frontend.onrender.com

Login with:
- Email: `admin@company.com`
- Password: `admin123`

## Alternative: If You Can't Find the Environment Tab

If you're having trouble finding the Environment tab:

1. On your backend service page, look for these tabs/sections:
   - **Settings**
   - **Environment** 
   - **Environment Variables**
   - **Env Vars**

2. The DATABASE_URL might also be under:
   - **Settings** → **Environment Variables**
   - **Settings** → **Environment**

## Need More Help?

If you still can't find it, tell me what you see on the screen when you click on your backend service, and I'll guide you from there.

## What We're Changing

**FROM (Neon - wrong database):**
```
postgresql://...@ep-plain-star-aekp77vq-pooler.c-2.us-east-2.aws.neon.tech/...
```

**TO (Render PostgreSQL - correct database):**
```
postgresql://company_directory_user:OCZK2sZXDFepo5UhRLKP9BSXhcMRhX5e@dpg-d64l4bpr0fns73c9n02g-a.ohio-postgres.render.com/company_directory
```

The admin user we created is in the Render PostgreSQL database, not the Neon database!
