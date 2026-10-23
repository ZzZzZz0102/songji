@echo off
cd /d "%~dp0"
set "SONGGAI_NODE=node"
where node >nul 2>&1
if errorlevel 1 set "SONGGAI_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%SONGGAI_NODE%" --version
if errorlevel 1 (
  echo Node.js 24 or newer is required.
  pause
  exit /b 1
)
"%SONGGAI_NODE%" tools\bootstrap-local.mjs
if errorlevel 1 exit /b 1
"%SONGGAI_NODE%" server\main.mjs
