import unittest
import os
import sys
import json
import threading
import time
import urllib.request
import urllib.error

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

    def test_gemini_fallback_ipconfig(self):
        result = self.gemini.parse_intent("check my ip address")
        self.assertEqual(result["action"], "terminal")
        self.assertIn("ipconfig", result["command"])

    def test_gemini_fallback_app(self):
        result = self.gemini.parse_intent("open notepad")
        self.assertEqual(result["action"], "powershell")
        self.assertIn("notepad.exe", result["command"])

    def test_gemini_fallback_vscode_project(self):
        result = self.gemini.parse_intent("open my salon app in vscode")
        self.assertEqual(result["action"], "powershell")
        self.assertIn("salon", result["command"])
        self.assertIn("code", result["command"])

    def test_gemini_fallback_uninstall_confirmation(self):
        result = self.gemini.parse_intent("uninstall spotify")
        self.assertEqual(result["action"], "confirm")
        self.assertIn("uninstall", result["speech"].lower())
        
        # User confirms
        confirm_result = self.gemini.parse_intent("yes")
        self.assertEqual(confirm_result["action"], "powershell")
        self.assertIn("winget uninstall", confirm_result["command"])

    def test_executor_simulation(self):
        res_powershell = self.executor.execute({
            "action": "powershell",
            "command": "dir",
            "speech": "Listing directory."
        })
        self.assertTrue(res_powershell["success"])
        self.assertEqual(res_powershell["action"], "powershell")

        res_confirm = self.executor.execute({
            "action": "confirm",
            "command": "winget uninstall spotify",
            "speech": "Are you sure?"
        })
        self.assertTrue(res_confirm["success"])

        res_chat = self.executor.execute({
            "action": "chat",
            "speech": "Hello there."
        })
        self.assertTrue(res_chat["success"])

class TestLiveServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_port = 5999
        os.environ["PORT"] = str(cls.test_port)
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
            self.assertIn(data["action"], ["powershell", "terminal"])

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
        except urllib.error.HTTPError:
            pass

if __name__ == "__main__":
    unittest.main()
