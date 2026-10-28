#!/usr/bin/env python3
"""Set the Waveshare 7" round panel backlight (0-100 %) over its HID vendor report.

Packet = report id 0x09, 0x08, 0xF7, level, ~level (same bytes as the vendor HID_brightness.py).
Usage: brightness.py 10        set once
       brightness.py --serve   HTTP listener on 127.0.0.1:8765, GET /?pct=10 (used by Orbital Dash idle mode)
"""
import glob, sys, os

HID_ID = "HID_ID=0003:00000712:0000000A"


def find_hidraw():
    for d in glob.glob("/sys/class/hidraw/hidraw*"):
        try:
            if HID_ID in open(d + "/device/uevent").read():
                return "/dev/" + os.path.basename(d)
        except OSError:
            pass
    raise RuntimeError("Waveshare panel not found")


def set_percent(pct):
    pct = max(0, min(100, int(pct)))
    level = int(pct / 100 * 255)
    fd = os.open(find_hidraw(), os.O_WRONLY)
    try:
        # the vendor script sends 0 first, then the level twice
        for lv in (0, level, level):
            os.write(fd, bytes([0x09, 0x08, 0xF7, lv, (~lv) & 0xFF]))
    finally:
        os.close(fd)
    return pct


def serve(port=8765):
    from http.server import BaseHTTPRequestHandler, HTTPServer
    from urllib.parse import urlparse, parse_qs
    import re

    cur = [None]
    # Only the local panel should drive the backlight. The listener is bound to 127.0.0.1, and on top of that:
    #  - the Host header must name the loopback address (stops DNS-rebinding from a web page),
    #  - requests a browser marks cross-site are refused (a web page on another site cannot fire this GET),
    #  - no CORS header is sent: the panel uses a no-cors fetch and never reads the answer.
    host_ok = re.compile(r"^(127\.0\.0\.1|localhost|\[::1\])(:%d)?$" % port)

    class H(BaseHTTPRequestHandler):
        def _reply(self, code, body):
            self.send_response(code)
            self.send_header("Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if not host_ok.match(self.headers.get("Host", "")):
                return self._reply(403, b"forbidden")
            if self.headers.get("Sec-Fetch-Site", "same-origin") not in ("same-origin", "same-site", "none"):
                return self._reply(403, b"forbidden")
            try:
                raw = parse_qs(urlparse(self.path).query)["pct"][0]
                if not re.fullmatch(r"\d{1,3}", raw):
                    raise ValueError("pct must be 0-100")
                pct = int(raw)
                if pct != cur[0]:
                    cur[0] = set_percent(pct)
                self._reply(200, b"ok")
            except Exception:
                cur[0] = None
                self._reply(400, b"bad request")

        def log_message(self, *a):
            pass

    HTTPServer(("127.0.0.1", port), H).serve_forever()


if __name__ == "__main__":
    if sys.argv[1:] == ["--serve"]:
        serve()
    elif len(sys.argv) == 2:
        print(set_percent(sys.argv[1]))
    else:
        raise SystemExit(__doc__)
