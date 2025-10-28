@echo off
setlocal ENABLEDELAYEDEXPANSION
cd /d %~dp0

call :ensureInstall server
call :ensureInstall client

start "SoberMeetServer" cmd /c "cd /d %~dp0server && npm run dev"
start "SoberMeetClient" cmd /c "cd /d %~dp0client && npm run dev"

echo Ожидание запуска клиента...
:waitloop
  powershell -Command "try { (Invoke-WebRequest -Uri http://localhost:5173 -UseBasicParsing).StatusCode } catch { exit 1 }" >nul 2>&1
  if %ERRORLEVEL%==0 goto launched
  ping -n 2 127.0.0.1 >nul
goto waitloop

:launched
start http://localhost:5173

echo Приложение запущено. Закройте это окно, чтобы остановить процессы.
pause
exit /b

:ensureInstall
if not exist "%~1\node_modules" (
  pushd "%~1"
  npm install
  popd
)
exit /b
