"""Static server for the 2.5D preview build + POST /__shot?name=x to save a JPEG data URL.

Lets the agent look at offscreen renders while the browser pane is hidden.
"""
import base64
import http.server
import os
import re
import sys
from urllib.parse import parse_qs, urlparse

ROOT = sys.argv[1]
SHOTS = sys.argv[2]
PORT = int(sys.argv[3]) if len(sys.argv) > 3 else 5180
os.makedirs(SHOTS, exist_ok=True)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def do_POST(self):
        u = urlparse(self.path)
        if u.path != '/__shot':
            self.send_error(404)
            return
        name = re.sub(r'[^a-zA-Z0-9_-]', '', parse_qs(u.query).get('name', ['shot'])[0]) or 'shot'
        body = self.rfile.read(int(self.headers.get('Content-Length', 0))).decode()
        data = base64.b64decode(body.split(',', 1)[-1])
        with open(os.path.join(SHOTS, f'{name}.jpg'), 'wb') as f:
            f.write(data)
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, *a):
        pass


http.server.ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
