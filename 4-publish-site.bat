@echo off
chcp 65001 >nul
set PYTHONUTF8=1
cd /d "%~dp0"
for /f "delims=" %%b in ('git branch --show-current') do set "DUB_PUBLISH_BRANCH=%%b"
if "%DUB_PUBLISH_BRANCH%"=="main" goto on_main
echo Publishing always happens from main. Moving there from %DUB_PUBLISH_BRANCH%...
git switch main
if errorlevel 1 goto no_switch
if "%DUB_PUBLISH_BRANCH%"=="" goto on_main
set "DUB_NOT_ON_MAIN=0"
for /f "delims=" %%n in ('git rev-list --count main..%DUB_PUBLISH_BRANCH%') do set "DUB_NOT_ON_MAIN=%%n"
if "%DUB_NOT_ON_MAIN%"=="0" goto on_main
echo.
echo NOTE: %DUB_NOT_ON_MAIN% saved change[s] on %DUB_PUBLISH_BRANCH% are not on main and will NOT be published.
echo.
:on_main
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
:no_switch
echo.
echo Could not move to the main branch, so nothing was published.
echo Read the error above; your files were not changed.
pause
exit /b 1
:failed
echo.
echo Publishing stopped. Read the error above; no force-push was used.
pause
exit /b 1
