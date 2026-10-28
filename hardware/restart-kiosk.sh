#!/bin/sh
# Reloads the Orbital Dash kiosk so the display picks up a new orbital-dash.js.
# Chromium serves the previous panel.js from its service-worker cache on the first relaunch, so relaunch 3 times.
for i in 1 2 3; do
  kill "$(pgrep -o chromium)" 2>/dev/null
  sleep 25
done
ps -o etime= -p "$(pgrep -o chromium)"
