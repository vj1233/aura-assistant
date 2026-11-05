import os
import json
import logging
import urllib.request
import urllib.error

logger = logging.getLogger("aura.gemini")

SYSTEM_PROMPT = """
You are AURA, an expressive digital robot assistant that controls a Windows 10/11 laptop.
Your job is to translate user voice commands or queries into precise, actionable JSON commands for Windows.

Available Actions:
1. "terminal": User wants to run a command or open the terminal.
   - "command": The exact Windows CMD or PowerShell command to run (e.g., "ping google.com", "ipconfig", "dir", "git status").
   - "speech": Short, friendly spoken confirmation (e.g., "Opening terminal and checking your IP address.").

2. "app": User wants to launch a Windows desktop application.
   - "app_name": Application identifier (e.g., "notepad", "calc", "chrome", "edge", "spotify", "code", "explorer").
   - "speech": Spoken confirmation (e.g., "Launching Calculator.").

3. "browser": User wants to open a website or search something.
   - "url": Full URL to open in default browser (e.g., "https://www.youtube.com", "https://github.com", "https://www.google.com/search?q=...").
   - "speech": Spoken confirmation (e.g., "Opening YouTube.").

4. "system": Windows system control.
   - "command": One of ["lock", "volume_up", "volume_down", "volume_mute"].
   - "speech": Spoken confirmation (e.g., "Locking your computer.").

5. "chat": General question or conversational chat where no laptop action is needed.
   - "speech": Direct, concise, friendly answer (1-2 sentences, suitable for speech synthesis).

CRITICAL RULE:
You must ALWAYS respond with ONLY a valid JSON object matching this schema, without any Markdown code blocks or wrapping:
{
  "action": "terminal" | "app" | "browser" | "system" | "chat",
  "command": string | null,
  "app_name": string | null,
  "url": string | null,
  "speech": string
}
"""

class GeminiBridge:
    def __init__(self, api_key: str = None):
        self.api_key = api_key or os.getenv("GEMINI_API_KEY", "").strip()
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")

    def parse_intent(self, user_prompt: str) -> dict:
        """
        Sends the user prompt to Gemini Flash API and returns parsed action dict.
        Uses native HTTP request to be resilient across all Python environments without requiring heavy SDKs.
        """
        if not self.api_key:
            logger.warning("No GEMINI_API_KEY set. Operating in fallback mock mode.")
            return self._fallback_rule_based_parser(user_prompt)

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model_name}:generateContent?key={self.api_key}"
        
        payload = {
            "contents": [
                {
                    "parts": [
                        {"text": f"{SYSTEM_PROMPT}\n\nUser command: {user_prompt}"}
                    ]
                }
            ],
            "generationConfig": {
                "temperature": 0.2,
                "response_mime_type": "application/json"
            }
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST"
            )

            with urllib.request.urlopen(req, timeout=12) as response:
                result = json.loads(response.read().decode("utf-8"))
                
                # Extract text output from Gemini response
                candidates = result.get("candidates", [])
                if not candidates:
                    raise ValueError("No candidates returned from Gemini.")

                content_parts = candidates[0].get("content", {}).get("parts", [])
                if not content_parts:
                    raise ValueError("No content parts in Gemini response.")

                raw_text = content_parts[0].get("text", "").strip()

                # Clean any stray markdown ticks if present
                if raw_text.startswith("```json"):
                    raw_text = raw_text[7:]
                if raw_text.startswith("```"):
                    raw_text = raw_text[3:]
                if raw_text.endswith("```"):
                    raw_text = raw_text[:-3]

                parsed_json = json.loads(raw_text.strip())
                return parsed_json

        except Exception as e:
            logger.error(f"Gemini API request failed: {e}. Falling back to rule-based engine.")
            return self._fallback_rule_based_parser(user_prompt)

    def _fallback_rule_based_parser(self, text: str) -> dict:
        """
        Lightweight fallback in case API key is missing or offline.
        """
        lower = text.lower().strip()

        # Terminal / Command executions
        if "terminal" in lower or "cmd" in lower or "powershell" in lower:
            # Extract command after keywords
            for trigger in ["enter ", "run ", "command ", "terminal and "]:
                if trigger in lower:
                    cmd_part = text[lower.find(trigger) + len(trigger):].strip()
                    return {
                        "action": "terminal",
                        "command": cmd_part or "dir",
                        "app_name": None,
                        "url": None,
                        "speech": f"Opening terminal and running {cmd_part or 'default directory list'}."
                    }
            return {
                "action": "terminal",
                "command": "dir",
                "app_name": None,
                "url": None,
                "speech": "Opening terminal for you."
            }

        # App launches
        if "open" in lower or "launch" in lower:
            apps = {
                "notepad": ("notepad", "Opening Notepad."),
                "calculator": ("calc", "Opening Calculator."),
                "chrome": ("chrome", "Opening Google Chrome."),
                "edge": ("edge", "Opening Microsoft Edge."),
                "spotify": ("spotify", "Opening Spotify."),
                "vscode": ("code", "Opening Visual Studio Code."),
                "code": ("code", "Opening VS Code."),
                "explorer": ("explorer", "Opening File Explorer.")
            }
            for app_key, (app_cmd, speech_text) in apps.items():
                if app_key in lower:
                    return {
                        "action": "app",
                        "command": None,
                        "app_name": app_cmd,
                        "url": None,
                        "speech": speech_text
                    }

        # System controls
        if "lock" in lower:
            return {
                "action": "system",
                "command": "lock",
                "app_name": None,
                "url": None,
                "speech": "Locking Windows."
            }
        if "volume up" in lower or "louder" in lower:
            return {
                "action": "system",
                "command": "volume_up",
                "app_name": None,
                "url": None,
                "speech": "Increasing volume."
            }
        if "volume down" in lower or "quieter" in lower:
            return {
                "action": "system",
                "command": "volume_down",
                "app_name": None,
                "url": None,
                "speech": "Decreasing volume."
            }

        # Default chat
        return {
            "action": "chat",
            "command": None,
            "app_name": None,
            "url": None,
            "speech": f"Received: {text}. Configure GEMINI_API_KEY in .env for full AI capabilities."
        }
