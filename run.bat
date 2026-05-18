@echo off
echo Starting TINT App...
echo.

node -v >/dev/null 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed.
    echo Please download it from https://nodejs.org and install it, then run this file again.
    pause
    exit
)

if not exist "node_modules" (
    echo Installing dependencies for the first time...
    npm install
)

echo.
echo Launching TINT on Expo...
echo Scan the QR code with Expo Go on your phone.
echo.
npx expo start
