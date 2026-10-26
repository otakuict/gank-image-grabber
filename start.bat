@echo off
cd /d "%~dp0"

npm start

if errorlevel 1 (
  echo.
  echo Failed to run npm start.
  pause
)
