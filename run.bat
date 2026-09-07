@echo off
cd /d "%~dp0"
echo Railbound Adventures
echo Open http://localhost:8000 in your browser.
echo Press Ctrl+C to stop the server.
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 -m http.server 8000 --bind 127.0.0.1
) else (
  python -m http.server 8000 --bind 127.0.0.1
)
pause
