import os
import sys
import json
import socket
import logging
from pathlib import Path

# Load local modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from gemini_bridge import GeminiBridge
from executor import WindowsExecutor

# Basic logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("aura.server")

# Resolve static web-ui directory
BASE_DIR = Path(__file__).resolve().parent
WEB_UI_DIR = BASE_DIR.parent / "web-ui"

# Load .env manually
env_file = BASE_DIR / ".env"
if env_file.exists():
    with open(env_file, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                key, val = line.split("=", 1)
                os.environ.setdefault(key.strip(), val.strip())

# Initialize Brain & Executor
gemini = GeminiBridge()
executor = WindowsExecutor()

def get_local_ip():
    """Gets the primary local LAN IP address of this machine."""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def print_banner(port: int):
    local_ip = get_local_ip()
    banner = f"""
========================================================================
   🤖  AURA RETRO AI ASSISTANT // WINDOWS HOST SERVER
========================================================================
   Gemini API Key: {'[CONFIGURED]' if gemini.api_key else '[MISSING - using rule fallback]'}
   Target OS:      {'Windows (Active)' if executor.is_windows else 'Non-Windows (Simulation mode)'}

   👉 ACCESS ON YOUR OPPO MOBILE (or any browser on Wi-Fi):
      URL: http://{local_ip}:{port}

   💡 Localhost:
      URL: http://localhost:{port}
========================================================================
"""
    print(banner)

# Try importing Flask; if not available, provide built-in http.server fallback
try:
    from flask import Flask, request, jsonify, send_from_directory
    from flask_cors import CORS

    app = Flask(__name__, static_folder=str(WEB_UI_DIR))
    CORS(app)

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def serve_web_ui(path):
        if path != "" and (WEB_UI_DIR / path).exists():
            return send_from_directory(str(WEB_UI_DIR), path)
        return send_from_directory(str(WEB_UI_DIR), "index.html")

    @app.route("/api/health", methods=["GET"])
    def health_check():
        return jsonify({
            "status": "online",
            "system": os.name,
            "is_windows": executor.is_windows,
            "gemini_ready": bool(gemini.api_key)
        })

    @app.route("/api/process", methods=["POST"])
    def process_command():
        data = request.get_json(silent=True) or {}
        user_prompt = data.get("prompt", "").strip()

        if not user_prompt:
            return jsonify({"error": "Prompt cannot be empty"}), 400

        logger.info(f"Received speech prompt: '{user_prompt}'")
        parsed_intent = gemini.parse_intent(user_prompt)
        logger.info(f"Gemini parsed intent: {parsed_intent}")
        exec_result = executor.execute(parsed_intent)
        return jsonify(exec_result)

    def run_server(port: int):
        print_banner(port)
        app.run(host="0.0.0.0", port=port, debug=False)

except ImportError:
    # ----------------- Standard Library HTTP Server Fallback -----------------
    import http.server
    import mimetypes

    class AuraHttpHandler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(WEB_UI_DIR), **kwargs)

        def end_headers(self):
            # Enable CORS
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
            super().end_headers()

        def do_OPTIONS(self):
            self.send_response(200)
            self.end_headers()

        def do_GET(self):
            if self.path == "/api/health":
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                res = json.dumps({
                    "status": "online",
                    "system": os.name,
                    "is_windows": executor.is_windows,
                    "gemini_ready": bool(gemini.api_key)
                })
                self.wfile.write(res.encode("utf-8"))
            else:
                super().do_GET()

        def do_POST(self):
            if self.path == "/api/process":
                length = int(self.headers.get("Content-Length", 0))
                body = self.rfile.read(length).decode("utf-8")
                data = json.loads(body) if body else {}
                user_prompt = data.get("prompt", "").strip()

                if not user_prompt:
                    self.send_response(400)
                    self.end_headers()
                    self.wfile.write(b'{"error": "Prompt cannot be empty"}')
                    return

                logger.info(f"Received speech prompt: '{user_prompt}'")
                parsed_intent = gemini.parse_intent(user_prompt)
                exec_result = executor.execute(parsed_intent)

                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(exec_result).encode("utf-8"))
            else:
                self.send_response(404)
                self.end_headers()

    def run_server(port: int):
        print_banner(port)
        server = http.server.ThreadingHTTPServer(("0.0.0.0", port), AuraHttpHandler)
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server.")

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    run_server(port)
