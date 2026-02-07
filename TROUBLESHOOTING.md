# Troubleshooting Guide

## Current Issues and Solutions

### 1. TypeScript Errors (15 problems)

**Problem:** You're seeing TypeScript errors about missing type definitions.

**Solution:** These errors will disappear once you install dependencies:

```bash
npm install
```

This installs all the packages including the TypeScript type definitions (`@types/*` packages).

### 2. Docker Compose Command Not Found

**Problem:** `docker-compose` command not recognized on Windows.

**Solution:** Modern Docker Desktop uses `docker compose` (without hyphen):

```bash
# Use this command (no hyphen)
docker compose up -d

# Instead of (with hyphen)
docker-compose up -d
```

If you have an older Docker version, use `docker-compose` with the hyphen.

## Step-by-Step Setup (Windows)

Here's the correct order to get everything working:

### Step 1: Install Dependencies

```bash
npm install
```

Wait for this to complete. This will:
- Install root dependencies
- Install backend dependencies
- Install frontend dependencies
- The TypeScript errors should disappear

### Step 2: Start Docker Services

```bash
docker compose up -d
```

This starts PostgreSQL and Redis in the background.

### Step 3: Verify Docker Services

```bash
docker compose ps
```

You should see both `company-directory-db` and `company-directory-redis` running.

### Step 4: Set Up Environment

```bash
cp backend/.env.example backend/.env
```

The default values in `.env.example` work for local development.

### Step 5: Set Up Database

```bash
cd backend
npm run prisma:generate
cd ..
```

**Note:** We'll run migrations in the next task when we create the database schema.

### Step 6: Start Development Servers

```bash
npm run dev
```

This starts both backend (port 3000) and frontend (port 5173).

## Common Issues

### Issue: npm install fails

**Solution:**
1. Make sure you have Node.js 20+ installed: `node --version`
2. Clear npm cache: `npm cache clean --force`
3. Delete `node_modules` and try again:
   ```bash
   rm -rf node_modules
   npm install
   ```

### Issue: Docker Desktop not installed

**Solution:**
1. Download Docker Desktop for Windows from https://www.docker.com/products/docker-desktop
2. Install and restart your computer
3. Start Docker Desktop
4. Try `docker compose up -d` again

### Issue: Port already in use

**Problem:** Error like "port 3000 is already allocated"

**Solution:**
1. Find what's using the port:
   ```bash
   netstat -ano | findstr :3000
   ```
2. Stop that process or change the port in `.env`

### Issue: Cannot connect to Docker daemon

**Solution:**
1. Make sure Docker Desktop is running
2. Check Docker Desktop settings
3. Restart Docker Desktop

## Verification Checklist

After setup, verify everything works:

- [ ] `npm install` completed without errors
- [ ] No TypeScript errors in Problems tab
- [ ] `docker compose ps` shows 2 services running
- [ ] Backend starts: `npm run dev:backend`
- [ ] Frontend starts: `npm run dev:frontend`
- [ ] Can access http://localhost:3000/health
- [ ] Can access http://localhost:5173

## Need More Help?

If you're still having issues:

1. Check the error message carefully
2. Look for the specific file or command that's failing
3. Share the complete error message for more specific help
