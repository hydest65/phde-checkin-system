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

set "PORT=3001"
echo PHDE check-in system is starting on port 3001...
echo.
echo Open this address in your browser:
echo http://localhost:3001
echo.
"%CODEX_NODE%" server.js

pause
