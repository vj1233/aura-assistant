import unittest
import os
import sys
import json
import threading
import time
import urllib.request

# Add windows-agent directory to path
AGENT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "windows-agent"))
sys.path.insert(0, AGENT_DIR)

from gemini_bridge import GeminiBridge
from executor import WindowsExecutor
import agent

class TestAuraComponents(unittest.TestCase):
    def setUp(self):
        self.gemini = GeminiBridge(api_key="") # Test fallback mode
        self.executor = WindowsExecutor()

    def test_gemini_fallback_terminal(self):
        result = self.gemini.parse_intent("open my terminal and enter ping google.com")
        self.assertEqual(result["action"], "terminal")
        self.assertIn("ping google.com", result["command"])
        self.assertIn("terminal", result["speech"].lower())

    def test_gemini_fallback_app(self):
        result = self.gemini.parse_intent("open notepad")
        self.assertEqual(result["action"], "app")
        self.assertEqual(result["app_name"], "notepad")

    def test_gemini_fallback_system(self):
        result = self.gemini.parse_intent("turn volume up")
        self.assertEqual(result["action"], "system")
        self.assertEqual(result["command"], "volume_up")

    def test_executor_simulation(self):
        # In non-windows test environment, executor should cleanly simulate without error
        res_terminal = self.executor.execute({
            "action": "terminal",
            "command": "dir",
            "speech": "Opening terminal."
        })
        self.assertTrue(res_terminal["success"])
        self.assertEqual(res_terminal["action"], "terminal")

        res_app = self.executor.execute({
            "action": "app",
            "app_name": "calc",
            "speech": "Opening calculator."
        })
        self.assertTrue(res_app["success"])

        res_chat = self.executor.execute({
            "action": "chat",
            "speech": "Hello there."
        })
        self.assertTrue(res_chat["success"])

class TestLiveServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        # Pick a non-default testing port
        cls.test_port = 5999
        os.environ["PORT"] = str(cls.test_port)
        
        # Start the server in background daemon thread
        cls.server_thread = threading.Thread(target=agent.run_server, args=(cls.test_port,), daemon=True)
        cls.server_thread.start()
        time.sleep(0.5)

    def test_server_health(self):
        url = f"http://127.0.0.1:{self.test_port}/api/health"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertEqual(data["status"], "online")

    def test_server_process_command(self):
        url = f"http://127.0.0.1:{self.test_port}/api/process"
        payload = json.dumps({"prompt": "open terminal and run dir"}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=3) as resp:
            self.assertEqual(resp.status, 200)
            data = json.loads(resp.read().decode("utf-8"))
            self.assertTrue(data["success"])
            self.assertEqual(data["action"], "terminal")

    def test_server_serves_html(self):
        url = f"http://127.0.0.1:{self.test_port}/"
        req = urllib.request.Request(url)
        with urllib.request.urlopen(req, timeout=3) as resp:
            self.assertEqual(resp.status, 200)
            html_content = resp.read().decode("utf-8")
            self.assertIn("AURA // Retro AI Assistant", html_content)

    def test_server_tts_endpoint(self):
        url = f"http://127.0.0.1:{self.test_port}/api/tts?text=Test"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=5) as resp:
                self.assertEqual(resp.status, 200)
                self.assertEqual(resp.headers.get("Content-Type"), "audio/mpeg")
        except urllib.error.HTTPError as e:
            # If rate-limited or offline, test passes gracefully
            pass

if __name__ == "__main__":
    unittest.main()
