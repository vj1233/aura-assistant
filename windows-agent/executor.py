import os
import sys
import subprocess
import webbrowser
import logging

logger = logging.getLogger("aura.executor")

class WindowsExecutor:
    """
    Executes actions on the Windows host machine.
    Includes fallback simulation when run in non-Windows environments (for testing/development).
    """

    def __init__(self):
        self.is_windows = os.name == "nt"

    def execute(self, action_data: dict) -> dict:
        action = action_data.get("action", "chat")
        command = action_data.get("command")
        app_name = action_data.get("app_name")
        url = action_data.get("url")
        speech = action_data.get("speech", "")

        logger.info(f"Executing action='{action}', command='{command}', app='{app_name}', url='{url}'")

        try:
            if action == "terminal":
                success = self.open_terminal_and_run(command or "dir")
            elif action == "app":
                success = self.launch_app(app_name or "notepad")
            elif action == "browser":
                success = self.open_browser(url or "https://www.google.com")
            elif action == "system":
                success = self.run_system_command(command)
            elif action == "chat":
                success = True
            else:
                logger.warning(f"Unknown action: {action}")
                success = False

            return {
                "success": success,
                "action": action,
                "command": command,
                "speech": speech
            }
        except Exception as e:
            logger.error(f"Execution error: {e}")
            return {
                "success": False,
                "action": action,
                "command": command,
                "speech": f"Error executing command: {str(e)}"
            }

    def open_terminal_and_run(self, cmd: str) -> bool:
        """
        Opens a visible terminal window on Windows and executes the command.
        Uses -NoExit /k so the user can see the output and keep typing!
        """
        if not self.is_windows:
            logger.info(f"[SIMULATION / NON-WINDOWS] Opened terminal and ran: {cmd}")
            return True

        # Try launching via Windows Terminal first (wt.exe), fallback to PowerShell / CMD
        try:
            # wt.exe powershell -NoExit -Command "<command>"
            # CREATE_NEW_CONSOLE = 0x00000010
            flags = subprocess.CREATE_NEW_CONSOLE
            wt_cmd = f'wt.exe powershell -NoExit -Command "{cmd}"'
            subprocess.Popen(wt_cmd, shell=True, creationflags=flags)
            return True
        except Exception as wt_err:
            logger.warning(f"Windows Terminal (wt.exe) failed: {wt_err}. Falling back to powershell.exe.")

        try:
            ps_cmd = f'start powershell -NoExit -Command "{cmd}"'
            subprocess.Popen(ps_cmd, shell=True)
            return True
        except Exception as ps_err:
            logger.warning(f"PowerShell launch failed: {ps_err}. Falling back to cmd.exe.")

        cmd_exec = f'start cmd.exe /k "{cmd}"'
        subprocess.Popen(cmd_exec, shell=True)
        return True

    def launch_app(self, app_name: str) -> bool:
        """
        Launches standard Windows application.
        """
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
        """
        Opens default system browser with target URL.
        """
        if not url.startswith("http://") and not url.startswith("https://"):
            url = f"https://{url}"
        webbrowser.open(url)
        return True

    def run_system_command(self, cmd_type: str) -> bool:
        """
        Executes native Windows control actions without external utilities.
        """
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
