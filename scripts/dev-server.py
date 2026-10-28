"""Servidor local que se comporta como o GitHub Pages: arquivos estáticos e,
para qualquer endereço inexistente, o 404.html da raiz (com status 404).
É o que faz URLs como /blog/<slug> funcionarem localmente.

Uso: python scripts/dev-server.py [porta]   (padrão: 5173)
"""
import http.server
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class PagesHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def send_error(self, code, message=None, explain=None):
        page = os.path.join(ROOT, '404.html')
        if code != 404 or not os.path.exists(page):
            return super().send_error(code, message, explain)
        with open(page, 'rb') as f:
            body = f.read()
        self.send_response(404)
        self.send_header('Content-Type', 'text/html; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    with http.server.ThreadingHTTPServer(('127.0.0.1', port), PagesHandler) as httpd:
        print(f'PriceFleet em http://127.0.0.1:{port}/')
        httpd.serve_forever()
