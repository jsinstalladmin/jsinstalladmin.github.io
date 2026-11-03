#!/bin/bash
# $1 = path to open, e.g. "/" or "/home-video.html"
HERE="$(cd "$(dirname "$0")/../.." && pwd)"     # ...the client folder
SITE="$HERE/03_Site"
PORT=8787
URL="http://localhost:$PORT$1"

# already serving? then just open it.
if ! curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/" ; then
  cd "$SITE"
  nohup python3 "$SITE/_server/serve.py" "$PORT" "$SITE" >/dev/null 2>&1 &
  disown 2>/dev/null || true
  for i in 1 2 3 4 5 6 7 8 9 10; do
    curl -s -o /dev/null --max-time 1 "http://127.0.0.1:$PORT/" && break
    sleep 0.4
  done
fi

if [ -d "/Applications/Google Chrome.app" ]; then
  open -a "Google Chrome" "$URL"
else
  open "$URL"
fi
