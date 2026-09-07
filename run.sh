#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
printf '\nRailbound Adventures\nOpen http://localhost:8000 in your browser.\nPress Ctrl+C to stop the server.\n\n'
exec python3 -m http.server 8000 --bind 127.0.0.1
