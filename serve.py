import subprocess
import threading
import sys
import re
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

class BoxForgeRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        super().end_headers()

def run_tunnel():
    cmd = [r"C:\Program Files (x86)\cloudflared\cloudflared.exe", "tunnel", "--url", "http://127.0.0.1:8080"]
    while True:
        try:
            p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, bufsize=1)
            for line in p.stdout:
                match = re.search(r'https://[a-zA-Z0-9-]+\.trycloudflare\.com', line)
                if match:
                    url = match.group(0)
                    with open("tunnel_url.txt", "w", encoding="utf-8") as f:
                        f.write(url)
                    print(f"\n=========================================\nBOXFORGE PHONE URL: {url}\n=========================================\n")
                    sys.stdout.flush()
            p.wait()
        except Exception as e:
            print(f"Tunnel restart: {e}")
            sys.stdout.flush()
            time.sleep(2)

if __name__ == '__main__':
    t = threading.Thread(target=run_tunnel, daemon=True)
    t.start()
    
    server = ThreadingHTTPServer(('0.0.0.0', 8080), BoxForgeRequestHandler)
    print("BoxForge Multi-Threaded Server listening on 0.0.0.0:8080...")
    sys.stdout.flush()
    server.serve_forever()
