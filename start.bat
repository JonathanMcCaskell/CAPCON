@echo off
REM Windows double-click launcher for Authentic Inventory

if not exist "dist\server.cjs" (
  echo Production build not found. Building application...
  call npx vite build
  call npx esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist\server.cjs
)

echo.
echo ========================================================
echo   Authentic Inventory is running at http://localhost:3000
echo ========================================================
echo.

node dist\server.cjs
pause
