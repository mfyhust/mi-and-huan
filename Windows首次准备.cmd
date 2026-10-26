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
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo 未找到npm，请先安装官方Node.js 24 LTS的完整Windows版本。
  pause
  exit /b 1
)
echo 首次准备需要联网安装锁文件中的工程依赖，不下载模型、不调用模型。
call npm.cmd ci
if errorlevel 1 goto failed
call npm.cmd run build:api-static
if errorlevel 1 goto failed
call npm.cmd run build:offline
if errorlevel 1 goto failed
"%MIGUI_NODE%" scripts\check-desktop.mjs
if errorlevel 1 goto failed
echo 准备完成。可双击启动API版-Windows.cmd或启动本地版-Windows.cmd。
pause
exit /b 0
:failed
echo 准备未完成，请保留窗口中的报错并反馈，不要删除业务数据。
pause
exit /b 1
