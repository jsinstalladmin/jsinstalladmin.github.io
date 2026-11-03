#!/bin/bash
pkill -f "_server/serve.py" 2>/dev/null
osascript -e 'display notification "The site server has been stopped." with title "JS Closets"' 2>/dev/null
exit 0
