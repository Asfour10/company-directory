@echo off
echo ========================================
echo   Company Directory - Quick Start
echo ========================================
echo.

echo [1/5] Installing backend dependencies...
cd backend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install backend dependencies
    pause
    exit /b 1
)

echo [2/5] Generating Prisma client...
call npx prisma generate
if %errorlevel% neq 0 (
    echo ERROR: Failed to generate Prisma client
    pause
    exit /b 1
)

echo [3/5] Running database migrations...
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo ERROR: Failed to run database migrations
    pause
    exit /b 1
)

echo [4/5] Installing frontend dependencies...
cd ..\frontend
call npm install
if %errorlevel% neq 0 (
    echo ERROR: Failed to install frontend dependencies
    pause
    exit /b 1
)

echo [5/5] Starting the application...
echo.
echo ========================================
echo   Starting Company Directory!
echo ========================================
echo   Backend API: http://localhost:3000
echo   Frontend:    http://localhost:5173
echo ========================================
echo.

start "Backend API" cmd /k "cd ..\backend && npm run dev"
timeout /t 3 /nobreak > nul
start "Frontend App" cmd /k "npm run dev"

echo.
echo Company Directory is starting up!
echo - Backend API will be available at: http://localhost:3000
echo - Frontend will be available at: http://localhost:5173
echo.
echo Press any key to exit this window...
pause > nul