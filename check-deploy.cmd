@echo off
echo ===================================================
echo  INTENT APP: PRE-FLIGHT CHECK & VERCEL DEPLOYMENT
echo ===================================================
echo.

echo [1/4] Compiling Expo Web Bundle...
call npx expo export -p web
if %errorlevel% neq 0 (
    echo.
    echo ❌ [ERROR] Local Expo Web Export failed!
    echo Check for JavaScript or React Native errors above.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/4] Verifying Export Bundle (dist/index.html)...
if not exist dist\index.html (
    echo.
    echo ❌ [ERROR] dist\index.html was not generated.
    pause
    exit /b 1
)
echo ✓ [OK] Expo web bundle verified in dist\

echo.
echo [3/4] Pulling Vercel Project Settings...
call npx vercel pull --yes --environment=production
if %errorlevel% neq 0 (
    echo.
    echo ❌ [ERROR] Could not pull Vercel project configuration.
    pause
    exit /b %errorlevel%
)

echo.
echo [4/4] Building & Deploying Prebuilt Package to Vercel...
call npx vercel build --prod
call npx vercel deploy --prebuilt --prod

echo.
echo ===================================================
echo 🎉 SUCCESS! Your Intent app is live on Vercel!
echo ===================================================