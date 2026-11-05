# 🤖 AURA // Retro Pixel-Art AI Voice Assistant

A lightweight, voice-activated AI assistant featuring a **retro pixel-art digital robot face** with real-time expressions (*Idle, Listening, Thinking, Speaking, Happy, Error*). Powered by **Google Gemini Flash** to translate natural voice commands into live actions on your **Windows laptop** (such as popping open terminal windows, launching apps, and controlling system settings) without slowing down your computer.

Designed to turn an older mobile device (e.g., an **Android 8.1 Oppo phone with 3GB RAM**) into a dedicated desk-top AI companion over local Wi-Fi.

---

## ✨ Features

- **Expressive Retro Pixel-Art Face**:
  - CRT monitor styling with scanlines and arcade-style bevel.
  - Animated 6x6 pixel eyes that blink, think (spinning gear), smile (`^ ^`), and show confusion (`X X`).
  - Animated sound-reactive ears and mouth pulsing while talking.
- **Natural Voice Control**:
  - Uses the built-in browser Web Speech API for 0% CPU strain on your phone.
  - Text-to-Speech (TTS) synthesized robot voice for vocal feedback.
- **AI Brain (Google Gemini Flash)**:
  - Uses Google's free, fast Gemini Flash API to understand plain English and convert it into structured Windows commands.
- **Windows Command & Terminal Execution**:
  - Opens visible **Windows Terminal (`wt.exe`)**, **PowerShell**, or **Command Prompt** windows with commands typed and executed.
  - Launches desktop applications (VS Code, Chrome, Spotify, Notepad, Calculator, etc.).
  - Controls Windows system actions (Lock PC, adjust volume, mute).
- **Zero-Install Phone Setup (Progressive Web App)**:
  - The Windows laptop hosts the web app on your local Wi-Fi.
  - Open the link on your Oppo phone's Chrome browser, tap **"Add to Home screen"**, and it runs as a fullscreen app!
  - 100% compatible with Android 8.1+ and higher-end devices.

---

## 🏗️ Architecture

```
  ┌────────────────────────────────────────────────────────┐
  │              OPPO PHONE (Android 8.1)                  │
  │                                                        │
  │   [ 👾 Retro Pixel Face ]  ◄── Animations              │
  │   [ 🎙️ Tap to Talk      ]  ──► Built-in Speech-to-Text │
  └──────────────────────────┬─────────────────────────────┘
                             │
                  Wi-Fi HTTP │ Transcribed Text:
                  Request    │ "open terminal and enter ping google.com"
                             ▼
  ┌────────────────────────────────────────────────────────┐
  │              WINDOWS LAPTOP HOST AGENT                 │
  │                                                        │
  │   1. Sends prompt to Google Gemini Flash API           │
  │   2. Gemini returns structured JSON:                   │
  │      { "action": "terminal", "command": "ping..." }    │
  │   3. Spawns visible Terminal / PowerShell window       │
  │   4. Returns speech confirmation to phone              │
  └────────────────────────────────────────────────────────┘
```

---

## 🚀 Quickstart Guide

### 1. Requirements on Windows Laptop
- Windows 10 or 11
- Python 3.10+ installed ([python.org](https://www.python.org/))
- A free Google Gemini API Key ([Google AI Studio](https://aistudio.google.com/))

### 2. Setup the Windows Host Agent

1. Clone or download this repository to your Windows laptop:
   ```cmd
   git clone https://github.com/vj1233/voice-assistant.git
   cd voice-assistant/windows-agent
   ```

2. Create your `.env` configuration file:
   ```cmd
   copy .env.example .env
   ```
   Open `.env` in Notepad and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=AIzaSy...your_actual_key_here...
   ```

3. Start the agent:
   - **Double-click `start.bat`** (or run `python agent.py` in your terminal).

4. The console will display your local IP address:
   ```text
   ========================================================================
      🤖  AURA RETRO AI ASSISTANT // WINDOWS HOST SERVER
   ========================================================================
      Gemini API Key: [CONFIGURED]
      Target OS:      Windows (Active)

      👉 ACCESS ON YOUR OPPO MOBILE (or any browser on Wi-Fi):
         URL: http://192.168.1.145:5000
   ========================================================================
   ```

---

### 3. Open on Your Oppo Phone

1. Make sure your phone is connected to the **same Wi-Fi** as your laptop.
2. Open Chrome on your phone and go to:
   ```
   http://<YOUR-LAPTOP-IP>:5000
   ```
   *(For example: `http://192.168.1.145:5000`)*
3. Tap the three dots in Chrome and select **"Add to Home screen"** to run it in fullscreen!
4. Tap the robot face or the **TAP TO TALK** button and speak.

---

## 🗣️ Example Voice Commands

| Voice Command | What Happens on Your Laptop |
| :--- | :--- |
| *"Open my terminal and enter ping 8.8.8.8"* | Opens Windows Terminal/PowerShell and runs `ping 8.8.8.8` |
| *"Open terminal and check my IP address"* | Opens terminal and executes `ipconfig` |
| *"Open terminal and show git status"* | Opens terminal and runs `git status` |
| *"Launch Notepad"* | Starts `notepad.exe` |
| *"Open Visual Studio Code"* | Starts VS Code |
| *"Search YouTube for lo-fi hip hop"* | Opens default browser with search results |
| *"Turn the volume up"* | Adjusts Windows system volume |
| *"Lock my computer"* | Immediately locks the Windows workstation |

---

## 🛠️ Testing Locally (on Linux / Dev Machine)

To run the automated tests verifying the intent parser and mock executor:
```bash
python3 -m unittest discover tests
```

---

## 📦 Pushing to GitHub (`vj1233`)

```bash
git init
git add .
git commit -m "feat: complete AURA retro pixel-art AI assistant"
git remote add origin https://github.com/vj1233/voice-assistant.git
git branch -M main
git push -u origin main
```
