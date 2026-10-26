@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set "MIGUI_NODE=node"
if exist ".runtime\node.exe" set "MIGUI_NODE=%CD%\.runtime\node.exe"
"%MIGUI_NODE%" -e "const [a,b]=process.versions.node.split('.').map(Number);if(a<22||(a===22&&b<13))process.exit(1);require('node:sqlite')" >nul 2>&1
if errorlevel 1 (
  echo 需要 Windows x64 的 Node.js 22.13 或更新版本，推荐24 LTS。
  echo 请使用完整Windows测试包，或者从 https://nodejs.org/ 安装Node.js。
  pause
  exit /b 1
)
"%MIGUI_NODE%" api\server.mjs
set "MIGUI_RESULT=%ERRORLEVEL%"
echo.
echo 窗口中的服务退出后，网页将无法继续使用。
pause
exit /b %MIGUI_RESULT%
