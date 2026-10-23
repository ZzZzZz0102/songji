@echo off
cd /d "%~dp0"
set "SONGGAI_NODE=node"
where node >nul 2>&1
if errorlevel 1 set "SONGGAI_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
"%SONGGAI_NODE%" tools\public-demo.mjs stop
pause
