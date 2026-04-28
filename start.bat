@echo off
setlocal
cd /d "%~dp0"

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%CODEX_NODE%" (
  echo Built-in Node.js runtime was not found.
  echo Please open Codex and reload workspace dependencies.
  pause
  exit /b 1
)

set "PORT=3000"
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 (
  echo Port 3000 is already in use. Starting on port 3001.
  set "PORT=3001"
)

echo PHDE check-in system is starting on port %PORT%.
echo Open this address in your browser:
echo http://localhost:%PORT%
echo.
"%CODEX_NODE%" server.js
pause
