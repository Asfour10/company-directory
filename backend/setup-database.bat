@echo off
setlocal enabledelayedexpansion

REM Database Setup Script for Company Directory (Windows)
REM This script sets up the database schema and generates Prisma client

echo 🚀 Setting up Company Directory database...

REM Check if Node.js is available
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js is not installed. Please install Node.js first.
    exit /b 1
)

REM Check if npm is available
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ npm is not available. Please install npm first.
    exit /b 1
)

REM Install dependencies if node_modules doesn't exist
if not exist "node_modules" (
    echo 📦 Installing dependencies...
    npm install
    if errorlevel 1 (
        echo ❌ Failed to install dependencies
        exit /b 1
    )
)

REM Generate Prisma client
echo 🔧 Generating Prisma client...
npm run prisma:generate
if errorlevel 1 (
    echo ❌ Failed to generate Prisma client
    exit /b 1
)

REM Check if DATABASE_URL is set
if "%DATABASE_URL%"=="" (
    echo ⚠️  DATABASE_URL environment variable is not set.
    echo 📋 Please copy .env.example to .env and configure your database connection:
    echo    copy .env.example .env
    echo    # Edit .env with your database credentials
    echo.
    echo 🔗 Example DATABASE_URL:
    echo    DATABASE_URL=postgresql://postgres:postgres@localhost:5432/company_directory?schema=public^&connection_limit=20^&pool_timeout=20
    exit /b 1
)

REM Test database connection
echo 🔍 Testing database connection...
npm run test:db
if errorlevel 1 (
    echo ❌ Database connection test failed
    exit /b 1
)

REM Run database migrations
echo 📊 Running database migrations...
npm run prisma:migrate
if errorlevel 1 (
    echo ❌ Database migration failed
    exit /b 1
)

REM Verify database schema
echo ✅ Verifying database schema...
npm run verify:schema
if errorlevel 1 (
    echo ❌ Database schema verification failed
    exit /b 1
)

REM Test audit and analytics functionality
echo 🔐 Testing audit and analytics...
npm run test:audit
if errorlevel 1 (
    echo ❌ Audit and analytics test failed
    exit /b 1
)

echo.
echo 🎉 Database setup completed successfully!
echo.
echo 📚 Available commands:
echo    npm run dev              - Start development server
echo    npm run prisma:studio    - Open Prisma Studio
echo    npm run test:db          - Test database connection
echo    npm run verify:schema    - Verify database schema
echo    npm run test:audit       - Test audit functionality
echo.
echo 🔧 Database is ready for development!