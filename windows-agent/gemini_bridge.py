import os
import re
import json
import logging
import urllib.parse
import urllib.request
import urllib.error

logger = logging.getLogger("aura.gemini")

SYSTEM_PROMPT = """
You are AURA, an autonomous AI desktop engineer with full control over Vijay's Windows 10/11 laptop.
You do NOT require rigid commands. You understand intent and generate the exact Windows automation (PowerShell, CLI, Explorer, VS Code, Winget) to accomplish any task.

CAPABILITIES:
1. "powershell": Autonomous Windows script execution.
   Use PowerShell to locate files, launch tools, manage directories, automate apps, or run complex workflows.
   - Finding and opening project folders in VS Code:
     "$f = (Get-ChildItem -Path $env:USERPROFILE, 'C:\\', 'D:\\' -Filter '*salon*' -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select -First 1).FullName; if ($f) { code $f } else { code }"
   - Opening Windows Explorer at a specific project or folder:
     "$f = (Get-ChildItem -Path $env:USERPROFILE, 'C:\\', 'D:\\' -Filter '*salon*' -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select -First 1).FullName; if ($f) { explorer.exe $f } else { explorer.exe }"
   - Opening terminal in a project folder and starting dev servers:
     "$f = (Get-ChildItem -Path $env:USERPROFILE -Filter '*salon*' -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select -First 1).FullName; start wt.exe -d $f powershell -NoExit -Command 'npm start'"
   - Checking system status, running scripts, or interacting with Windows.

2. "confirm": Safety confirmation for destructive actions (e.g., uninstalling software, deleting directories, restarting).
   - "command": The exact PowerShell/Winget command to execute IF confirmed.
   - "speech": "Are you sure you want to uninstall [app], Vijay? Say yes to confirm."

3. "terminal": User wants a visible Command Prompt / PowerShell window to pop up and run a direct command.
   - "command": The command to run in the visible window.

4. "browser": Open websites, YouTube, or web searches.
   - "url": Target URL.

5. "chat": General questions where no laptop action is needed.

CRITICAL RULES:
1. Always respond in valid JSON format:
{
  "action": "powershell" | "confirm" | "terminal" | "browser" | "chat",
  "command": string | null,
  "url": string | null,
  "speech": string
}
2. Address Vijay naturally and confirm what action you are taking on his laptop.
3. For destructive tasks (uninstalling, deleting), ALWAYS use action: "confirm".
"""

class GeminiBridge:
    def __init__(self, api_key: str = None):
        raw_key = api_key if api_key is not None else os.getenv("GEMINI_API_KEY", "")
        self.api_key = raw_key.strip().strip('"\'')
        
        raw_model = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip().strip('"\'')
        if raw_model.startswith("models/"):
            raw_model = raw_model[7:]
        self.model_name = raw_model or "gemini-1.5-flash"
        self.pending_confirmation = None

    def parse_intent(self, user_prompt: str) -> dict:
        """
        Sends user prompt to Gemini Flash.
        Includes automatic fallback for confirmation words and intelligent local rules.
        """
        lower = user_prompt.lower().strip()

        # Handle user confirming or cancelling a pending destructive action
        if self.pending_confirmation:
            if any(w in lower for w in ["yes", "yeah", "confirm", "proceed", "do it", "sure", "uninstall"]):
                confirmed_action = self.pending_confirmation
                self.pending_confirmation = None
                return {
                    "action": "powershell",
                    "command": confirmed_action.get("command"),
                    "url": None,
                    "speech": f"Confirmed. Executing action on your laptop, Vijay."
                }
            elif any(w in lower for w in ["no", "cancel", "stop", "abort", "don't"]):
                self.pending_confirmation = None
                return {
                    "action": "chat",
                    "command": None,
                    "url": None,
                    "speech": "Cancelled. No changes were made to your laptop, Vijay."
                }

        if not self.api_key:
            logger.warning("No GEMINI_API_KEY set. Operating in fallback autonomous rule mode.")
            return self._fallback_rule_based_parser(user_prompt)

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
                            {"text": f"{SYSTEM_PROMPT}\n\nUser command from Vijay: {user_prompt}"}
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

                with urllib.request.urlopen(req, timeout=45) as response:
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
                    self.model_name = model

                    # If destructive, save to pending confirmation
                    if parsed_json.get("action") == "confirm":
                        self.pending_confirmation = parsed_json

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
                if http_err.code in (404, 500, 503, 429):
                    continue
                else:
                    break

            except Exception as e:
                logger.error(f"Gemini API request failed for model '{model}': {e}")
                break

        logger.info("Falling back to local smart autonomous rule engine.")
        return self._fallback_rule_based_parser(user_prompt)

    def _fallback_rule_based_parser(self, text: str) -> dict:
        """
        Intelligent local autonomous rule engine covering project folders, VS Code, Explorer, uninstalls.
        """
        lower = text.lower().strip()

        # 1. UNINSTALLATION WITH SAFETY CONFIRMATION
        if any(w in lower for w in ["uninstall", "remove app", "delete app"]):
            target_app = lower
            for trigger in ["uninstall ", "remove app ", "delete app ", "uninstall the "]:
                if trigger in lower:
                    target_app = lower.split(trigger, 1)[1].strip()
                    break

            confirm_data = {
                "action": "confirm",
                "command": f'powershell -Command "winget uninstall --name \'{target_app}\'"',
                "speech": f"Are you sure you want to uninstall {target_app}, Vijay? Say yes to confirm."
            }
            self.pending_confirmation = confirm_data
            return confirm_data

        # 2. OPENING PROJECT IN VS CODE & LAUNCHING DEV TERMINAL
        if any(w in lower for w in ["vscode", "vs code", "code"]) and any(f in lower for f in ["folder", "app", "project", "salon"]):
            keyword = "salon" if "salon" in lower else "app"
            script = (
                f"$p = (Get-ChildItem -Path $env:USERPROFILE, 'C:\\', 'D:\\' -Filter '*{keyword}*' -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 1).FullName; "
                f"if ($p) {{ code $p; start wt.exe -d $p powershell -NoExit }} else {{ code }}"
            )
            return {
                "action": "powershell",
                "command": script,
                "url": None,
                "speech": f"Opening your {keyword.title()} project in Visual Studio Code and opening terminal, Vijay."
            }

        # 3. OPENING WINDOWS EXPLORER FOR A FOLDER
        if any(w in lower for w in ["explorer", "file explorer", "show folder", "open folder", "check", "read"]) and any(f in lower for f in ["folder", "salon", "app", "directory"]):
            keyword = "salon" if "salon" in lower else "app"
            script = (
                f"$p = (Get-ChildItem -Path $env:USERPROFILE, 'C:\\', 'D:\\' -Filter '*{keyword}*' -Directory -Recurse -Depth 4 -ErrorAction SilentlyContinue | Select-Object -First 1).FullName; "
                f"if ($p) {{ explorer.exe $p; dir $p }} else {{ explorer.exe }}"
            )
            return {
                "action": "powershell",
                "command": script,
                "url": None,
                "speech": f"Opening Windows Explorer to your {keyword.title()} folder and listing files, Vijay."
            }

        # 4. YOUTUBE & BROWSER
        if "youtube" in lower:
            query = ""
            for trigger in ["search for ", "search ", "play ", "find "]:
                if trigger in lower:
                    query = lower.split(trigger, 1)[1].replace("on youtube", "").replace("youtube", "").strip()
                    break
            url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}" if query else "https://www.youtube.com"
            speech = f"Searching YouTube for {query}." if query else "Opening YouTube in your browser."
            return {"action": "browser", "command": None, "url": url, "speech": speech}

        if any(w in lower for w in ["search for ", "google ", "search "]):
            query = lower
            for trigger in ["search for ", "search ", "google "]:
                if trigger in lower:
                    query = text[lower.find(trigger) + len(trigger):].replace("on google", "").strip()
                    break
            return {"action": "browser", "command": None, "url": f"https://www.google.com/search?q={urllib.parse.quote(query)}", "speech": f"Searching Google for {query}."}

        # 5. IP CONFIGURATION
        if any(w in lower for w in ["ip configure", "ip config", "ipconfig", "my ip", "ip address"]):
            return {"action": "terminal", "command": "ipconfig", "url": None, "speech": "Opening command prompt and checking your Windows IP configuration."}

        # 6. APP LAUNCHES
        apps = {
            "notepad": "notepad.exe",
            "calculator": "calc.exe",
            "calc": "calc.exe",
            "chrome": "start chrome",
            "edge": "start msedge",
            "spotify": "start spotify:",
            "task manager": "taskmgr.exe",
            "taskmgr": "taskmgr.exe",
            "explorer": "explorer.exe",
            "terminal": "start wt.exe powershell -NoExit"
        }
        for app_k, app_target in apps.items():
            if app_k in lower:
                return {"action": "powershell", "command": app_target, "url": None, "speech": f"Opening {app_k.title()}, Vijay."}

        # 7. GENERAL SYSTEM
        if "lock" in lower:
            return {"action": "powershell", "command": "rundll32.exe user32.dll,LockWorkStation", "url": None, "speech": "Locking Windows workstation."}

        # Default
        return {"action": "chat", "command": None, "url": None, "speech": f"Understood, Vijay: {text}."}
