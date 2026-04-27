@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"

set "CODEX_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"

if not exist "%CODEX_NODE%" (
  echo Built-in Node.js runtime was not found.
  echo Please reload workspace dependencies in Codex, or ask IT to install Node.js.
  pause
  exit /b 1
)

set "PHDE_PORT=3000"
netstat -ano | findstr /R /C:":3000 .*LISTENING" >nul
if not errorlevel 1 (
  echo Port 3000 is already in use. Starting PHDE check-in system on port 3001.
  set "PHDE_PORT=3001"
)

echo PHDE check-in system is starting...
echo.
echo Open this address in your browser:
echo http://localhost:%PHDE_PORT%
echo.
set "PORT=%PHDE_PORT%"
"%CODEX_NODE%" server.js

pause
