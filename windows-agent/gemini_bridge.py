import os
import re
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
        raw_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")
        self.api_key = raw_key.strip().strip('"\'')
        
        raw_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip().strip('"\'')
        if raw_model.startswith("models/"):
            raw_model = raw_model[7:]
        self.model_name = raw_model or "gemini-1.5-flash"

    def parse_intent(self, user_prompt: str) -> dict:
        """
        Sends the user prompt to Gemini Flash API and returns parsed action dict.
        Attempts requested model, and falls back to alternate flash versions if 404 occurs.
        """
        if not self.api_key:
            logger.warning("No GEMINI_API_KEY set. Operating in fallback mock mode.")
            return self._fallback_rule_based_parser(user_prompt)

        # Model candidates to try in case of 404
        candidate_models = [self.model_name]
        for fallback_m in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest", "gemini-1.5-pro"]:
            if fallback_m not in candidate_models:
                candidate_models.append(fallback_m)

        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
            
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
                    candidates = result.get("candidates", [])
                    if not candidates:
                        raise ValueError("No candidates returned from Gemini.")

                    content_parts = candidates[0].get("content", {}).get("parts", [])
                    if not content_parts:
                        raise ValueError("No content parts in Gemini response.")

                    raw_text = content_parts[0].get("text", "").strip()

                    # Strip any markdown code fencing
                    if raw_text.startswith("```json"):
                        raw_text = raw_text[7:]
                    if raw_text.startswith("```"):
                        raw_text = raw_text[3:]
                    if raw_text.endswith("```"):
                        raw_text = raw_text[:-3]

                    parsed_json = json.loads(raw_text.strip())
                    self.model_name = model # Remember the working model!
                    return parsed_json

            except urllib.error.HTTPError as http_err:
                err_msg = ""
                try:
                    err_body = http_err.read().decode("utf-8")
                    err_json = json.loads(err_body)
                    err_msg = err_json.get("error", {}).get("message", err_body)
                except Exception:
                    err_msg = str(http_err)

                logger.warning(f"Gemini API error ({http_err.code}) for model '{model}': {err_msg}")

                # If 404, loop will try next model candidate
                if http_err.code == 404:
                    continue
                else:
                    break

            except Exception as e:
                logger.error(f"Gemini API request failed for model '{model}': {e}")
                break

        logger.info("Falling back to local smart rule-based engine.")
        return self._fallback_rule_based_parser(user_prompt)

    def _fallback_rule_based_parser(self, text: str) -> dict:
        """
        Smart local rule engine that handles speech misrecognitions (e.g. 'comment from' for 'command prompt').
        """
        lower = text.lower().strip()

        # Phonetic / Speech correction for Windows commands
        # "comment from", "command from", "cmd" -> command prompt / terminal
        is_terminal = any(w in lower for w in [
            "terminal", "cmd", "command", "comment from", "command from",
            "powershell", "console", "prompt"
        ])

        # IP config recognition ("ip configure", "ipconfig", "my ip", "ip address")
        if any(w in lower for w in ["ip configure", "ip config", "ipconfig", "my ip", "ip address"]):
            return {
                "action": "terminal",
                "command": "ipconfig",
                "app_name": None,
                "url": None,
                "speech": "Opening command prompt and checking your Windows IP configuration."
            }

        # Ping commands
        if "ping" in lower:
            target = "google.com"
            if "ping " in lower:
                target = lower.split("ping ", 1)[1].split()[0]
            return {
                "action": "terminal",
                "command": f"ping {target}",
                "app_name": None,
                "url": None,
                "speech": f"Opening terminal and pinging {target}."
            }

        # General terminal trigger
        if is_terminal:
            for trigger in ["enter ", "run ", "command ", "terminal and ", "prompt and "]:
                if trigger in lower:
                    cmd_part = text[lower.find(trigger) + len(trigger):].strip()
                    return {
                        "action": "terminal",
                        "command": cmd_part or "dir",
                        "app_name": None,
                        "url": None,
                        "speech": f"Opening terminal and running {cmd_part or 'directory listing'}."
                    }
            return {
                "action": "terminal",
                "command": "dir",
                "app_name": None,
                "url": None,
                "speech": "Opening command prompt for you."
            }

        # App launches
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

        # Friendly greeting / chat
        if any(w in lower for w in ["hello", "hi", "hey", "aura"]):
            return {
                "action": "chat",
                "command": None,
                "app_name": None,
                "url": None,
                "speech": "Hello! I am AURA. I am ready to run commands on your Windows laptop."
            }

        # Default chat
        return {
            "action": "chat",
            "command": None,
            "app_name": None,
            "url": None,
            "speech": f"Received: {text}."
        }
