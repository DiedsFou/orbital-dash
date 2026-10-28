# Security

Orbital Dash is a single JavaScript file that runs inside your Home Assistant frontend, so it can do whatever the logged-in user can. Install it only from this repository's releases.

What it does over the network: calls Home Assistant through the frontend's own `hass` object, and (optionally) sends a `GET` to the local backlight URL you configure. It loads no external scripts, fonts or images and sends nothing anywhere else.

## Reporting a vulnerability

Please do not open a public issue for security problems. Use GitHub's private reporting: **Security → Report a vulnerability** on this repository. If that is not available, open an issue asking for a private contact and leave out the details.

You can expect a first reply within a few days. This is a hobby project; fixes are best-effort.
