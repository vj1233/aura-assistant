/**
 * AURA // Retro AI Assistant - Smart Conversational Engine for Vijay
 * Engineered for Rock-Solid Reliability on Android 8.1+ & Desktop
 */

// 6x6 Matrix Patterns for Expressive Pixel Eyes
const EYE_PATTERNS = {
  idle: [
    [0,0,0,0,0,0],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,0,0,0,0,0]
  ],
  blink: [
    [0,0,0,0,0,0],
    [0,0,0,0,0,0],
    [1,1,1,1,1,1],
    [1,1,1,1,1,1],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0]
  ],
  listening: [
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,0,1,1,0,1],
    [1,0,1,1,0,1],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1]
  ],
  happy: [
    [0,1,1,1,1,0],
    [1,0,0,0,0,1],
    [1,0,0,0,0,0],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0]
  ],
  thinking1: [
    [1,1,0,0,0,0],
    [0,1,1,0,0,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
    [0,0,0,1,1,0],
    [0,0,0,0,1,1]
  ],
  thinking2: [
    [0,0,0,0,1,1],
    [0,0,0,1,1,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
    [0,1,1,0,0,0],
    [1,1,0,0,0,0]
  ],
  error: [
    [1,0,0,0,0,1],
    [0,1,0,0,1,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
    [0,1,0,0,1,0],
    [1,0,0,0,0,1]
  ]
};

class AuraRobot {
  constructor() {
    this.state = 'idle'; // idle | waiting_command | thinking | speaking | happy | error
    this.agentUrl = localStorage.getItem('aura_agent_url') || window.location.origin;
    this.ttsEnabled = localStorage.getItem('aura_tts') !== 'false';
    this.isSpeaking = false;
    this.isProcessing = false;
    this.audioUnlocked = false;

    // DOM Elements
    this.leftEyeMatrix = document.getElementById('left-eye-matrix');
    this.rightEyeMatrix = document.getElementById('right-eye-matrix');
    this.mouth = document.getElementById('mouth');
    this.earLeft = document.getElementById('ear-left');
    this.earRight = document.getElementById('ear-right');
    this.blushLeft = document.getElementById('blush-left');
    this.blushRight = document.getElementById('blush-right');
    this.logTitle = document.querySelector('.log-title');
    this.logText = document.getElementById('log-text');
    this.logDetails = document.getElementById('log-details');
    this.micBtn = document.getElementById('mic-btn');
    this.micLabel = document.getElementById('mic-label');
    this.connectionDot = document.getElementById('connection-dot');
    this.faceContainer = document.getElementById('face-container');

    // Settings Modal
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.agentUrlInput = document.getElementById('agent-url');
    this.voiceToggle = document.getElementById('voice-toggle');

    // Timers
    this.blinkTimer = null;
    this.thinkingTimer = null;
    this.speechPulseTimer = null;
    this.watchdogTimer = null;
    this.thinkingFrame = 0;

    // Speech Recognition
    this.recognition = null;
    this.isListeningActive = false;

    this.init();
  }

  init() {
    this.initPixelEyes();
    this.renderEyes('idle');
    this.startBlinkLoop();
    this.setupEventListeners();
    this.checkAgentConnection();

    // Start listening on boot
    setTimeout(() => this.restartListener(), 800);

    // Heartbeat every 8s
    setInterval(() => this.checkAgentConnection(), 8000);
  }

  initPixelEyes() {
    this.leftEyeMatrix.innerHTML = '';
    this.rightEyeMatrix.innerHTML = '';

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const cellL = document.createElement('div');
        cellL.className = 'pixel-cell';
        this.leftEyeMatrix.appendChild(cellL);

        const cellR = document.createElement('div');
        cellR.className = 'pixel-cell';
        this.rightEyeMatrix.appendChild(cellR);
      }
    }
  }

  renderEyes(patternName) {
    const pattern = EYE_PATTERNS[patternName] || EYE_PATTERNS.idle;
    const cellsL = this.leftEyeMatrix.children;
    const cellsR = this.rightEyeMatrix.children;

    let index = 0;
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const isActive = pattern[r][c] === 1;
        if (isActive) {
          cellsL[index].classList.add('active');
          cellsR[index].classList.add('active');
        } else {
          cellsL[index].classList.remove('active');
          cellsR[index].classList.remove('active');
        }
        index++;
      }
    }
  }

  setState(newState, statusTitle = null, message = null) {
    this.state = newState;
    clearInterval(this.thinkingTimer);
    clearInterval(this.speechPulseTimer);
    clearTimeout(this.watchdogTimer);

    if (statusTitle) this.logTitle.textContent = `> ${statusTitle.toUpperCase()}`;
    if (message) this.logText.textContent = message;

    // Reset visual accents
    this.blushLeft.classList.remove('active');
    this.blushRight.classList.remove('active');
    this.earLeft.style.height = '24px';
    this.earRight.style.height = '24px';
    this.mouth.style.height = '8px';
    this.mouth.style.width = '60px';

    switch (newState) {
      case 'idle':
        this.renderEyes('idle');
        this.micBtn.classList.remove('listening');
        this.micLabel.textContent = 'LISTENING: SAY "AURA"';
        this.startBlinkLoop();
        break;

      case 'waiting_command':
        // AURA is actively waiting for Vijay's command!
        this.stopBlinkLoop();
        this.renderEyes('listening');
        this.micBtn.classList.add('listening');
        this.micLabel.textContent = 'AURA: "YES VIJAY?"';
        this.earLeft.style.height = '36px';
        this.earRight.style.height = '36px';
        this.mouth.style.height = '14px';

        // 8-second watchdog: if no command received, return to idle
        this.watchdogTimer = setTimeout(() => {
          if (this.state === 'waiting_command') {
            this.setState('idle', 'READY', 'Say "Aura" anytime');
            this.restartListener();
          }
        }, 8000);
        break;

      case 'thinking':
        this.stopBlinkLoop();
        this.micBtn.classList.remove('listening');
        this.micLabel.textContent = 'THINKING...';
        this.thinkingFrame = 0;
        this.thinkingTimer = setInterval(() => {
          this.thinkingFrame = (this.thinkingFrame + 1) % 2;
          this.renderEyes(this.thinkingFrame === 0 ? 'thinking1' : 'thinking2');
          if (this.thinkingFrame === 0) {
            this.earLeft.style.height = '32px';
            this.earRight.style.height = '18px';
          } else {
            this.earLeft.style.height = '18px';
            this.earRight.style.height = '32px';
          }
        }, 220);
        break;

      case 'speaking':
        this.stopBlinkLoop();
        this.renderEyes('idle');
        this.micBtn.classList.remove('listening');
        this.micLabel.textContent = 'SPEAKING...';
        let mouthPulse = false;
        this.speechPulseTimer = setInterval(() => {
          mouthPulse = !mouthPulse;
          this.mouth.style.height = mouthPulse ? '20px' : '8px';
          this.mouth.style.width = mouthPulse ? '70px' : '50px';
        }, 180);
        break;

      case 'happy':
        this.stopBlinkLoop();
        this.renderEyes('happy');
        this.blushLeft.classList.add('active');
        this.blushRight.classList.add('active');
        this.mouth.style.height = '14px';
        this.mouth.style.width = '70px';
        break;

      case 'error':
        this.stopBlinkLoop();
        this.renderEyes('error');
        this.mouth.style.height = '6px';
        this.mouth.style.width = '40px';
        setTimeout(() => {
          this.setState('idle');
          this.restartListener();
        }, 3500);
        break;
    }
  }

  startBlinkLoop() {
    this.stopBlinkLoop();
    const scheduleNextBlink = () => {
      const delay = Math.random() * 3200 + 2000;
      this.blinkTimer = setTimeout(() => {
        if (this.state === 'idle') {
          this.renderEyes('blink');
          setTimeout(() => {
            if (this.state === 'idle') {
              this.renderEyes('idle');
              scheduleNextBlink();
            }
          }, 150);
        }
      }, delay);
    };
    scheduleNextBlink();
  }

  stopBlinkLoop() {
    if (this.blinkTimer) clearTimeout(this.blinkTimer);
  }

  // Ensure Audio Context is unlocked on mobile
  unlockAudioContext() {
    if (this.audioUnlocked) return;
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      this.audioUnlocked = true;
    } catch (e) {}
  }

  // Safe Listener Loop (Avoids Android 8.1 Zombie State)
  restartListener() {
    // If speaking or processing, wait until finished
    if (this.isSpeaking || this.isProcessing) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    try {
      if (this.recognition) {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        try { this.recognition.abort(); } catch (e) {}
      }

      this.recognition = new SpeechRecognition();
      // On mobile Android, continuous=false with auto-loop is 10x more stable than continuous=true!
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListeningActive = true;
      };

      this.recognition.onresult = (event) => {
        this.isListeningActive = false;
        const transcript = event.results[0][0].transcript.trim();
        this.handleHeardSpeech(transcript);
      };

      this.recognition.onerror = (event) => {
        this.isListeningActive = false;
        // Ignore normal no-speech timeouts, just restart
        if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition error:', event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        // Auto-loop: immediately re-listen if not speaking or processing
        if (!this.isSpeaking && !this.isProcessing) {
          setTimeout(() => this.restartListener(), 300);
        }
      };

      this.recognition.start();

    } catch (err) {
      console.warn('Listener start exception:', err);
      setTimeout(() => this.restartListener(), 1000);
    }
  }

  // Process any speech heard
  handleHeardSpeech(rawText) {
    const text = rawText.trim();
    const lower = text.toLowerCase();

    // Check for Wake Word variations: "aura", "hey aura", "ora", "ara", "aurora"
    const hasWakeWord = /(^|\b)(aura|ora|ara|aurora)(\b|$)/i.test(lower);

    // CASE 1: Currently waiting for a command after saying "Yes Vijay?"
    if (this.state === 'waiting_command') {
      clearTimeout(this.watchdogTimer);
      if (lower.includes('settings')) {
        this.openSettings();
      } else {
        this.setState('thinking', 'COMMAND RECEIVED', `"${text}"`);
        this.processCommand(text);
      }
      return;
    }

    // CASE 2: Wake-word detected!
    if (hasWakeWord) {
      // Extract whatever command was spoken in the SAME sentence (e.g. "Aura check my IP")
      const afterWake = lower.replace(/(?:hey\s+)?(?:aura|ora|ara|aurora)[,.\s]*/i, '').trim();

      if (afterWake.length > 1) {
        // Full command spoken together! E.g. "Aura check my IP"
        if (afterWake.includes('settings')) {
          this.openSettings();
        } else {
          this.setState('thinking', 'COMMAND RECEIVED', `"${afterWake}"`);
          this.processCommand(afterWake);
        }
      } else {
        // Just "Aura" was spoken! Prompt Vijay with voice!
        this.setState('waiting_command', 'AURA READY', 'Yes Vijay? I am listening...');
        this.speak("Yes Vijay? What can I do for you?", () => {
          // Immediately after speaking, ensure listener is primed for Vijay's reply
          this.restartListener();
        });
      }
      return;
    }

    // Fallback: If not waiting and no wake word, just keep listening
    this.restartListener();
  }

  // Send command to Laptop Agent
  async processCommand(userText) {
    try {
      this.isProcessing = true;
      this.setState('thinking', 'QUERYING GEMINI...', `Consulting Gemini Flash...`);

      const response = await fetch(`${this.agentUrl}/api/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: userText })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      const speechMsg = data.speech || 'Command executed on laptop, Vijay.';
      this.setState('speaking', data.action ? data.action.toUpperCase() : 'EXECUTED', speechMsg);

      if (data.output && this.logDetails) {
        this.logDetails.textContent = data.output;
        this.logDetails.style.display = 'block';
      } else if (this.logDetails) {
        this.logDetails.style.display = 'none';
      }

      this.speak(speechMsg, () => {
        this.setState('happy', 'COMPLETE', speechMsg);
        this.isProcessing = false;
        setTimeout(() => {
          this.setState('idle', 'READY', 'Say "AURA" anytime');
          this.restartListener();
        }, 3000);
      });

    } catch (err) {
      console.error('Failed to process command:', err);
      this.setState('error', 'ERROR', `Could not reach laptop agent at ${this.agentUrl}`);
      this.isProcessing = false;
      setTimeout(() => {
        this.setState('idle');
        this.restartListener();
      }, 3000);
    }
  }

  // Text-to-Speech Output with active flag
  speak(text, onComplete = null) {
    if (!this.ttsEnabled || !window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }

    this.isSpeaking = true;
    this.unlockAudioContext();

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.1; // Friendly robotic pitch

      const finishSpeech = () => {
        this.isSpeaking = false;
        if (onComplete) onComplete();
      };

      utterance.onend = finishSpeech;
      utterance.onerror = finishSpeech;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      this.isSpeaking = false;
      if (onComplete) onComplete();
    }
  }

  // Voice Settings Dialog
  openSettings() {
    this.agentUrlInput.value = this.agentUrl;
    this.voiceToggle.checked = this.ttsEnabled;
    this.settingsModal.classList.remove('hidden');
    this.setState('happy', 'SETTINGS OPEN', 'Displaying configuration.');
    this.speak('Opening settings for you, Vijay.', () => {
      this.restartListener();
    });
  }

  closeSettings() {
    this.settingsModal.classList.add('hidden');
    this.setState('idle', 'READY', 'Say "Aura, check my IP"');
    this.speak('Settings closed, Vijay.', () => {
      this.restartListener();
    });
  }

  // Heartbeat check: Red if offline, Blue if online
  async checkAgentConnection() {
    try {
      const res = await fetch(`${this.agentUrl}/api/health`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        document.body.classList.remove('is-offline');
        this.connectionDot.classList.add('online');
        return true;
      }
    } catch {}

    document.body.classList.add('is-offline');
    this.connectionDot.classList.remove('online');
    return false;
  }

  promptManualCommand() {
    this.unlockAudioContext();
    const cmd = prompt('Enter command for Windows laptop:', 'check my IP');
    if (cmd && cmd.trim()) {
      this.setState('thinking', 'COMMAND', `"${cmd}"`);
      this.processCommand(cmd.trim());
    }
  }

  setupEventListeners() {
    // Tapping anywhere unlocks audio on mobile and resets listener
    const handleTap = (e) => {
      this.unlockAudioContext();
      if (this.isProcessing) return;

      if (this.state === 'idle') {
        // Direct conversation starter:
        this.setState('waiting_command', 'AURA READY', 'Yes Vijay? I am listening...');
        this.speak("Yes Vijay? What can I do for you?", () => {
          this.restartListener();
        });
      } else {
        this.restartListener();
      }
    };

    this.micBtn.addEventListener('click', handleTap);
    this.faceContainer.addEventListener('click', handleTap);

    // Tap on terminal log to type manual fallback
    const logBox = document.getElementById('terminal-log');
    if (logBox) {
      logBox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptManualCommand();
      });
    }

    // Settings actions
    this.closeSettingsBtn.addEventListener('click', () => this.closeSettings());

    this.saveSettingsBtn.addEventListener('click', () => {
      let url = this.agentUrlInput.value.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      this.agentUrl = url || window.location.origin;
      this.ttsEnabled = this.voiceToggle.checked;

      localStorage.setItem('aura_agent_url', this.agentUrl);
      localStorage.setItem('aura_tts', this.ttsEnabled);

      this.closeSettings();
      this.checkAgentConnection();
    });
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.aura = new AuraRobot();
});
