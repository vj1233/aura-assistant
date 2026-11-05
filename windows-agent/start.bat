@echo off
title AURA Retro AI Assistant - Windows Host
cd /d "%~dp0"

echo ========================================================================
echo    AURA Retro AI Assistant // Starting Host Agent...
echo ========================================================================

:: Check for Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH!
    echo Please install Python 3.10+ from https://www.python.org/
    pause
    exit /b 1
)

:: Check for .env file
if not exist ".env" (
    echo [SETUP] Creating .env from .env.example...
    copy ".env.example" ".env" >nul
    echo Please edit .env to insert your GEMINI_API_KEY!
)

:: Virtual environment check
if not exist ".venv" (
    echo [SETUP] Creating Python virtual environment...
    python -m venv .venv
    call .venv\Scripts\activate.bat
    echo [SETUP] Installing required dependencies...
    pip install -r requirements.txt
) else (
    call .venv\Scripts\activate.bat
)

:: Run the agent
python agent.py
pause
