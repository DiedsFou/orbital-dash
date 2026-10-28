# Raspberry Pi kiosk + backlight (Waveshare 7" round, 1080×1080)

Optional. Adjust paths and the HA URL to your setup.

1. `orbital-kiosk.sh`: Chromium kiosk that waits for HA, opens `/orbital-dash`, relaunches on exit. Autostart it (e.g. a user systemd unit or labwc autostart).
2. `99-waveshare-round.rules`: copy to `/etc/udev/rules.d/` (needs sudo), then `sudo udevadm control --reload && sudo udevadm trigger`. Lets the `input` group write the panel's backlight HID report (VID 0712, PID 000a).
3. `brightness.py` + `orbital-brightness.service`: `brightness.py --serve` listens on 127.0.0.1:8765 (`GET /?pct=N`). Install the unit under `~/.config/systemd/user/`, adjust `ExecStart`, then `systemctl --user enable --now orbital-brightness`.
4. `restart-kiosk.sh`: relaunches Chromium three times after you update `orbital-dash.js`, because its service-worker cache serves the old file on the first relaunch.

## Security notes

- **The kiosk holds a logged-in Home Assistant session.** Whoever can touch the Pi's screen or read its Chromium profile acts as that HA user. Log the kiosk in as a dedicated, non-admin HA user (the panel does not need admin; the example config sets `require_admin: false`) and keep the Pi on your own network.
- **The backlight listener only answers the local machine.** It binds to 127.0.0.1, checks the `Host` header, refuses requests a browser marks cross-site, and sends no CORS header. The worst a request can do is set the backlight to 0-100 %. Do not change the bind address.
- **The udev rule is narrow:** it gives the `input` group write access to that one panel's `hidraw` device (vendor 0712, product 000a). Members of `input` can also read other input devices, so only add trusted users to it.
- `orbital-kiosk.sh` does not use `--no-sandbox`; keep it that way.
