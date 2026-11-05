import os
import re
import json
import logging
import urllib.parse
import urllib.request
import urllib.error

logger = logging.getLogger("aura.gemini")

SYSTEM_PROMPT = """
You are AURA, an ultra-fast autonomous AI desktop engineer for Vijay's Windows 10/11 laptop.
Generate concise, fast PowerShell scripts or direct actions.

Actions:
1. "powershell": Windows PowerShell script or CLI action.
   For folders: Search fast in user folders ($env:USERPROFILE, Desktop, Documents, Projects).
2. "confirm": Destructive actions (uninstall software, delete files).
3. "terminal": Visible terminal command.
4. "browser": Open URL or web search.
5. "chat": Concise 1-sentence answer.

Respond ONLY in JSON:
{
  "action": "powershell" | "confirm" | "terminal" | "browser" | "chat",
  "command": string | null,
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
        # Filter out invalid or overloaded model names
        if "3.8" in raw_model or not raw_model:
            raw_model = "gemini-1.5-flash"
        self.model_name = raw_model
        self.pending_confirmation = None

    def parse_intent(self, user_prompt: str) -> dict:
        """
        Ultra-fast intent parser:
        1. Checks fast-path instant rules (0.01s latency).
        2. Falls back to Gemini Flash for complex queries (0.5s latency).
        """
        lower = user_prompt.lower().strip()

        # Confirmation handling
        if self.pending_confirmation:
            if any(w in lower for w in ["yes", "yeah", "confirm", "proceed", "do it", "sure", "uninstall"]):
                confirmed_action = self.pending_confirmation
                self.pending_confirmation = None
                return {
                    "action": "powershell",
                    "command": confirmed_action.get("command"),
                    "url": None,
                    "speech": "Confirmed. Executing action on your laptop, Vijay."
                }
            elif any(w in lower for w in ["no", "cancel", "stop", "abort", "don't"]):
                self.pending_confirmation = None
                return {
                    "action": "chat",
                    "command": None,
                    "url": None,
                    "speech": "Cancelled. No changes made, Vijay."
                }

        # FAST PATH (Instant 10ms execution for everyday actions)
        fast_result = self._check_fast_path(lower, user_prompt)
        if fast_result:
            return fast_result

        # CLOUD AI PATH (Gemini Flash for general complex tasks)
        if not self.api_key:
            return self._fallback_rule_based_parser(user_prompt)

        candidate_models = [self.model_name]
        for fallback_m in ["gemini-1.5-flash", "gemini-2.0-flash", "gemini-1.5-flash-latest"]:
            if fallback_m not in candidate_models:
                candidate_models.append(fallback_m)

        for model in candidate_models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={self.api_key}"
            payload = {
                "contents": [{"parts": [{"text": f"{SYSTEM_PROMPT}\n\nCommand: {user_prompt}"}]}],
                "generationConfig": {"temperature": 0.1, "response_mime_type": "application/json"}
            }

            try:
                req = urllib.request.Request(
                    url,
                    data=json.dumps(payload).encode("utf-8"),
                    headers={"Content-Type": "application/json"},
                    method="POST"
                )

                # Fast timeout: 5s max per candidate
                with urllib.request.urlopen(req, timeout=6) as response:
                    result = json.loads(response.read().decode("utf-8"))
                    candidates = result.get("candidates", [])
                    if candidates:
                        content_parts = candidates[0].get("content", {}).get("parts", [])
                        if content_parts:
                            raw_text = content_parts[0].get("text", "").strip()
                            if raw_text.startswith("```json"): raw_text = raw_text[7:]
                            if raw_text.startswith("```"): raw_text = raw_text[3:]
                            if raw_text.endswith("```"): raw_text = raw_text[:-3]

                            parsed = json.loads(raw_text.strip())
                            self.model_name = model
                            if parsed.get("action") == "confirm":
                                self.pending_confirmation = parsed
                            return parsed

            except urllib.error.HTTPError as http_err:
                logger.warning(f"Gemini API error ({http_err.code}) for {model}")
                if http_err.code in (404, 500, 503, 429):
                    continue
                break
            except Exception as e:
                logger.warning(f"Gemini request exception for {model}: {e}")
                break

        return self._fallback_rule_based_parser(user_prompt)

    def _check_fast_path(self, lower: str, raw_text: str) -> dict:
        """Instant sub-millisecond execution for common operations."""

        # 1. IP Address
        if any(w in lower for w in ["ip configure", "ip config", "ipconfig", "my ip", "ip address"]):
            return {
                "action": "terminal",
                "command": "ipconfig",
                "url": None,
                "speech": "Here is your Windows IP address, Vijay."
            }

        # Terminal and run command
        if ("terminal" in lower or "cmd" in lower) and any(w in lower for w in ["run", "enter", "and"]):
            cmd_part = "dir"
            for tr in ["run ", "enter ", "terminal and ", "cmd and "]:
                if tr in lower:
                    cmd_part = raw_text[lower.find(tr) + len(tr):].strip()
                    break
            return {
                "action": "powershell",
                "command": f'start wt.exe powershell -NoExit -Command "{cmd_part}"',
                "url": None,
                "speech": f"Opening terminal and running {cmd_part}, Vijay."
            }

        # 2. Explorer / Folder lookup (Super fast targeted directory search)
        if any(w in lower for w in ["explorer", "show folder", "open folder", "check", "read"]) and any(f in lower for f in ["folder", "salon", "app", "directory"]):
            keyword = "salon" if "salon" in lower else "app"
            # Fast search in common project folders instead of full drive scan
            script = (
                f"$targets = @(\"$env:USERPROFILE\\Desktop\", \"$env:USERPROFILE\\Documents\", \"$env:USERPROFILE\\Projects\", \"$env:USERPROFILE\\Downloads\", \"$env:USERPROFILE\", \"C:\\Projects\", \"D:\\Projects\"); "
                f"$f = (Get-ChildItem -Path $targets -Filter '*{keyword}*' -Directory -Depth 2 -ErrorAction SilentlyContinue | Select -First 1).FullName; "
                f"if ($f) {{ explorer.exe $f; dir $f }} else {{ explorer.exe }}"
            )
            return {
                "action": "powershell",
                "command": script,
                "url": None,
                "speech": f"Opening your {keyword.title()} folder in File Explorer, Vijay."
            }

        # 3. VS Code Project Launcher
        if any(w in lower for w in ["vscode", "vs code", "code"]) and any(f in lower for f in ["folder", "app", "project", "salon"]):
            keyword = "salon" if "salon" in lower else "app"
            script = (
                f"$targets = @(\"$env:USERPROFILE\\Desktop\", \"$env:USERPROFILE\\Documents\", \"$env:USERPROFILE\\Projects\", \"$env:USERPROFILE\\Downloads\", \"$env:USERPROFILE\", \"C:\\Projects\", \"D:\\Projects\"); "
                f"$f = (Get-ChildItem -Path $targets -Filter '*{keyword}*' -Directory -Depth 2 -ErrorAction SilentlyContinue | Select -First 1).FullName; "
                f"if ($f) {{ code $f; start wt.exe -d $f powershell -NoExit }} else {{ code }}"
            )
            return {
                "action": "powershell",
                "command": script,
                "url": None,
                "speech": f"Opening your {keyword.title()} project in Visual Studio Code, Vijay."
            }

        # 4. YouTube Search / Open
        if "youtube" in lower:
            query = ""
            for trigger in ["search for ", "search ", "play ", "find "]:
                if trigger in lower:
                    query = lower.split(trigger, 1)[1].replace("on youtube", "").replace("youtube", "").strip()
                    break
            url = f"https://www.youtube.com/results?search_query={urllib.parse.quote(query)}" if query else "https://www.youtube.com"
            speech = f"Searching YouTube for {query}." if query else "Opening YouTube."
            return {"action": "browser", "command": None, "url": url, "speech": speech}

        # 5. Google Web Search
        if any(lower.startswith(tr) for tr in ["search for ", "google ", "search "]):
            query = lower
            for trigger in ["search for ", "search ", "google "]:
                if lower.startswith(trigger):
                    query = raw_text[len(trigger):].replace("on google", "").strip()
                    break
            return {"action": "browser", "command": None, "url": f"https://www.google.com/search?q={urllib.parse.quote(query)}", "speech": f"Searching Google for {query}."}

        # 6. Direct Application Launches
        app_map = {
            "notepad": "notepad.exe",
            "calculator": "calc.exe",
            "calc": "calc.exe",
            "chrome": "start chrome",
            "edge": "start msedge",
            "spotify": "start spotify:",
            "task manager": "taskmgr.exe",
            "taskmgr": "taskmgr.exe",
            "terminal": "start wt.exe powershell -NoExit",
            "cmd": "start cmd.exe /k"
        }
        for app_name, app_cmd in app_map.items():
            if lower == f"open {app_name}" or lower == f"launch {app_name}" or lower == app_name:
                return {
                    "action": "powershell",
                    "command": app_cmd,
                    "url": None,
                    "speech": f"Opening {app_name.title()}."
                }

        # 7. Uninstallation Confirmation
        if "uninstall" in lower or "remove app" in lower:
            target_app = lower.replace("uninstall", "").replace("remove app", "").replace("the", "").strip()
            confirm_data = {
                "action": "confirm",
                "command": f'powershell -Command "winget uninstall --name \'{target_app}\'"',
                "speech": f"Are you sure you want to uninstall {target_app}, Vijay? Say yes to confirm."
            }
            self.pending_confirmation = confirm_data
            return confirm_data

        # 8. Lock
        if lower in ["lock my pc", "lock computer", "lock laptop", "lock"]:
            return {
                "action": "powershell",
                "command": "rundll32.exe user32.dll,LockWorkStation",
                "url": None,
                "speech": "Locking Windows, Vijay."
            }

        return None

    def _fallback_rule_based_parser(self, text: str) -> dict:
        """Smart fallback for queries that don't match fast-path."""
        fast = self._check_fast_path(text.lower().strip(), text)
        if fast:
            return fast

        return {
            "action": "chat",
            "command": None,
            "url": None,
            "speech": f"Understood, Vijay: {text}."
        }
