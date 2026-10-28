#!/bin/sh
# Keeps Orbital Dash open on the round display: waits for the HA panel, runs Chromium, relaunches if it exits.
# HA serves /local files with a 31-day cache, so use a throwaway 1-byte cache: panel.js updates show on next launch.
URL=http://localhost:8123/orbital-dash
while true; do
  until curl -sf -o /dev/null "$URL"; do sleep 3; done
  chromium --ozone-platform=wayland --kiosk --password-store=basic --noerrdialogs --disable-infobars \
    --disk-cache-dir=/tmp/orbital-chromium-cache --disk-cache-size=1 "$URL"
  sleep 3
done
