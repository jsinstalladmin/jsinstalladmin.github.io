#!/usr/bin/env python3
"""
Local web server for the JS Closets site.

Why this exists instead of `python3 -m http.server`:
Python's built-in server does NOT answer HTTP Range requests and never sends
an Accept-Anges header. Chrome and Safari will happily *play* an mp4 served
that way, but they mark it as not seekable -- so `video.currentTime = x` is
silently ignored. The whole scroll-scrubbed hero depends on seeking, which is
why the closets never appeared: you were scrolling 7 screens of frame zero.
This server answers Range properly, so scrubbing works locally exactly like
it will on the real host.
"""
import os, re, sys, mimetypes, socketserver
from http.server import SimpleHTTPRequestHandler, HTTPServer

mimetypes.add_type('text/javascript', '.js')
mimetypes.add_type('text/javascript', '.mjs')
mimetypes.add_type('video/mp4', '.mp4')
mimetypes.add_type('image/svg+xml', '.svg')
mimetypes.add_type('application/manifest+json', '.webmanifest')

RANGE = re.compile(r'bytes=(\d*)-(\d*)')


class H(SimpleHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'

    def log_message(self, fmt, *a):
        pass                                    # keep the Terminal window quiet

    def end_headers(self):
        self.send_header('Accept-Ranges', 'bytes')
        self.send_header('Cache-Control', 'no-store')
        SimpleHTTPRequestHandler.end_headers(self)

    def do_GET(self):
        rng = self.headers.get('Range')
        if not rng:
            # A browser aborts plenty of requests mid-flight (above all video).
            # That is normal; it must not print a traceback into the window.
            try:
                return SimpleHTTPRequestHandler.do_GET(self)
            except (BrokenPipeError, ConnectionResetError):
                return

        path = self.translate_path(self.path)
        if os.path.isdir(path):
            return SimpleHTTPRequestHandler.do_GET(self)
        try:
            size = os.path.getsize(path)
            f = open(path, 'rb')
        except OSError:
            self.send_error(404, 'Not found')
            return

        m = RANGE.match(rng.strip())
        if not m:
            f.close()
            self.send_error(400, 'Bad Range')
            return

        s, e = m.group(1), m.group(2)
        if s == '':                              # bytes=-N  (last N bytes)
            length = min(int(e or 0), size)
            start = size - length
            end = size - 1
        else:
            start = int(s)
            end = int(e) if e else size - 1
        end = min(end, size - 1)

        if start >= size or start > end:
            f.close()
            self.send_response(416)
            self.send_header('Content-Range', 'bytes */%d' % size)
            self.send_header('Content-Length', '0')
            self.end_headers()
            return

        length = end - start + 1
        ctype = self.guess_type(path)
        self.send_response(206)
        self.send_header('Content-Type', ctype)
        self.send_header('Content-Range', 'bytes %d-%d/%d' % (start, end, size))
        self.send_header('Content-Length', str(length))
        self.end_headers()

        f.seek(start)
        left = length
        try:
            while left > 0:
                chunk = f.read(min(65536, left))
                if not chunk:
                    break
                self.wfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass                                 # browser aborted a seek, normal
        finally:
            f.close()


class S(socketserver.ThreadingMixIn, HTTPServer):
    daemon_threads = True
    allow_reuse_address = True

    def handle_error(self, request, client_address):
        pass                                     # never dump tracebacks at the user


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    root = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    os.chdir(root)
    S(('127.0.0.1', port), H).serve_forever()
