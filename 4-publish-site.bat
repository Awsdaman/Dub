@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
for /f "delims=" %%b in ('git branch --show-current') do set "DUB_PUBLISH_BRANCH=%%b"
if not "%DUB_PUBLISH_BRANCH%"=="main" (
  echo Switch to the main branch before publishing.
  pause
  exit /b 1
)
".venv\Scripts\python.exe" export.py
if errorlevel 1 goto failed
git add -- site clips.json
if errorlevel 1 goto failed
git diff --cached --quiet -- site clips.json
if not errorlevel 1 goto push
git commit --only -m "Update game clips" -- site clips.json
if errorlevel 1 goto failed
:push
git push origin main
if errorlevel 1 goto failed
echo.
echo Published to GitHub. Vercel will update the website shortly.
echo https://dub-ashen-ten.vercel.app/
pause
exit /b 0
:failed
echo.
echo Publishing stopped. Read the error above; no force-push was used.
pause
exit /b 1
