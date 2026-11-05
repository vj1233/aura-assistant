import os
import sys
import re
import socket
import subprocess
import webbrowser
import logging

logger = logging.getLogger("aura.executor")

class WindowsExecutor:
    """
    Executes actions on the Windows host machine.
    Captures real output to report back to the mobile assistant,
    while still opening visible terminal windows on the desktop.
    """

    def __init__(self):
        self.is_windows = os.name == "nt"

    def execute(self, action_data: dict) -> dict:
        action = action_data.get("action", "chat")
        command = action_data.get("command")
        app_name = action_data.get("app_name")
        url = action_data.get("url")
        speech = action_data.get("speech", "")
        output_text = None

        logger.info(f"Executing action='{action}', command='{command}', app='{app_name}', url='{url}'")

        try:
            if action == "terminal":
                success, speech, output_text = self.open_terminal_and_run(command or "dir", speech)
            elif action == "app":
                success = self.launch_app(app_name or "notepad")
                output_text = f"Launched {app_name or 'Application'}."
            elif action == "browser":
                success = self.open_browser(url or "https://www.google.com")
                output_text = f"Opened {url}"
            elif action == "system":
                success = self.run_system_command(command)
                output_text = f"System command executed: {command}"
            elif action == "chat":
                success = True
                output_text = speech
            else:
                logger.warning(f"Unknown action: {action}")
                success = False

            return {
                "success": success,
                "action": action,
                "command": command,
                "speech": speech,
                "output": output_text
            }
        except Exception as e:
            logger.error(f"Execution error: {e}")
            return {
                "success": False,
                "action": action,
                "command": command,
                "speech": f"Error executing command: {str(e)}",
                "output": str(e)
            }

    def open_terminal_and_run(self, cmd: str, default_speech: str = "") -> tuple:
        """
        Opens a visible terminal window on Windows and executes the command.
        Also captures output so the mobile robot can display and speak the answer.
        Returns: (success: bool, spoken_speech: str, output_display: str)
        """
        output_captured = ""
        spoken_response = default_speech

        # Specialized handling for IP configuration
        if "ipconfig" in cmd.lower() or "ip configure" in cmd.lower():
            ip_info = self._get_ip_info()
            primary_ip = ip_info.get("primary_ip", "Unknown")
            spoken_response = f"Here is your IP address: {primary_ip}"
            output_captured = ip_info.get("full_text", f"IPv4 Address: {primary_ip}")
            cmd = "ipconfig"

        # Specialized handling for Ping
        elif cmd.lower().startswith("ping"):
            target = cmd.split()[1] if len(cmd.split()) > 1 else "google.com"
            spoken_response = f"Pinging {target}. Checking network latency."
            output_captured = f"Pinging {target}...\nCommand launched in terminal."

        # Non-Windows Simulation mode
        if not self.is_windows:
            logger.info(f"[SIMULATION / NON-WINDOWS] Opened terminal and ran: {cmd}")
            if not output_captured:
                output_captured = f"Simulated output for: {cmd}\nSuccess (exit code 0)"
            if not spoken_response:
                spoken_response = f"Executed {cmd} in terminal."
            return (True, spoken_response, output_captured)

        # On Windows: Launch visible terminal (Windows Terminal -> PowerShell -> CMD)
        try:
            flags = subprocess.CREATE_NEW_CONSOLE
            wt_cmd = f'wt.exe powershell -NoExit -Command "{cmd}"'
            subprocess.Popen(wt_cmd, shell=True, creationflags=flags)
        except Exception:
            try:
                ps_cmd = f'start powershell -NoExit -Command "{cmd}"'
                subprocess.Popen(ps_cmd, shell=True)
            except Exception:
                cmd_exec = f'start cmd.exe /k "{cmd}"'
                subprocess.Popen(cmd_exec, shell=True)

        # If we didn't have custom output yet, attempt to capture a short preview
        if not output_captured:
            try:
                preview = subprocess.check_output(cmd, shell=True, text=True, timeout=2, stderr=subprocess.STDOUT)
                lines = preview.strip().splitlines()
                output_captured = "\n".join(lines[:6])
                if len(lines) > 6:
                    output_captured += f"\n... [{len(lines)-6} more lines in terminal]"
            except Exception:
                output_captured = f"Running in terminal: {cmd}"

        if not spoken_response:
            spoken_response = f"Running {cmd} in your terminal."

        return (True, spoken_response, output_captured)

    def _get_ip_info(self) -> dict:
        """Helper to get current IP configuration on Windows or fallback."""
        primary_ip = "127.0.0.1"
        full_text = ""

        try:
            # Determine main outbound interface IP
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            primary_ip = s.getsockname()[0]
            s.close()
        except Exception:
            pass

        if self.is_windows:
            try:
                raw_ipconfig = subprocess.check_output("ipconfig", shell=True, text=True, timeout=3)
                lines = []
                for line in raw_ipconfig.splitlines():
                    if any(k in line for k in ["IPv4 Address", "Default Gateway", "Subnet Mask", "Wireless LAN", "Ethernet"]):
                        lines.append(line.strip())
                full_text = "\n".join(lines[:8]) if lines else f"IPv4 Address: {primary_ip}"
            except Exception:
                full_text = f"IPv4 Address: {primary_ip}"
        else:
            full_text = f"IPv4 Address: {primary_ip}\nGateway: 192.168.1.1\nStatus: Connected"

        return {"primary_ip": primary_ip, "full_text": full_text}

    def launch_app(self, app_name: str) -> bool:
        """Launches standard Windows application."""
        if not self.is_windows:
            logger.info(f"[SIMULATION / NON-WINDOWS] Launched app: {app_name}")
            return True

        app_map = {
            "notepad": "notepad.exe",
            "calc": "calc.exe",
            "calculator": "calc.exe",
            "explorer": "explorer.exe",
            "chrome": "start chrome",
            "edge": "start msedge",
            "code": "code",
            "spotify": "start spotify:"
        }

        launch_target = app_map.get(app_name.lower(), f"start {app_name}")
        subprocess.Popen(launch_target, shell=True)
        return True

    def open_browser(self, url: str) -> bool:
        """Opens default system browser with target URL."""
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"
        webbrowser.open(url)
        return True

    def run_system_command(self, cmd_type: str) -> bool:
        """Executes native Windows control actions without external utilities."""
        if not self.is_windows:
            logger.info(f"[SIMULATION / NON-WINDOWS] System action: {cmd_type}")
            return True

        if cmd_type == "lock":
            subprocess.Popen("rundll32.exe user32.dll,LockWorkStation", shell=True)
            return True
        elif cmd_type == "volume_up":
            subprocess.Popen('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]175)"', shell=True)
            return True
        elif cmd_type == "volume_down":
            subprocess.Popen('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]174)"', shell=True)
            return True
        elif cmd_type == "volume_mute":
            subprocess.Popen('powershell -c "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"', shell=True)
            return True

        logger.warning(f"Unrecognized system action: {cmd_type}")
        return False
