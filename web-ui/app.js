/**
 * AURA // Retro AI Assistant - Pixel Face & Wake-Word Engine
 * Ultra-responsive Vanilla JS for Android 8.1+ & Desktop Browsers
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
    this.state = 'idle';
    this.agentUrl = localStorage.getItem('aura_agent_url') || window.location.origin;
    this.ttsEnabled = localStorage.getItem('aura_tts') !== 'false';
    this.wakeWordActive = true;
    this.isProcessing = false;
    
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

    // Settings Modal elements
    this.settingsModal = document.getElementById('settings-modal');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.agentUrlInput = document.getElementById('agent-url');
    this.voiceToggle = document.getElementById('voice-toggle');

    // Timers
    this.blinkTimer = null;
    this.thinkingTimer = null;
    this.speechPulseTimer = null;
    this.restartListenerTimer = null;
    this.thinkingFrame = 0;

    // Speech Recognition
    this.recognition = null;
    this.micPermissionGranted = false;

    this.init();
  }

  init() {
    this.initPixelEyes();
    this.renderEyes('idle');
    this.startBlinkLoop();
    this.setupEventListeners();
    this.checkAgentConnection();

    // Start auto wake-word listener
    setTimeout(() => this.startWakeWordListener(), 600);

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
        this.micLabel.textContent = 'WAKE WORD: "AURA"';
        this.startBlinkLoop();
        break;

      case 'listening':
        this.stopBlinkLoop();
        this.renderEyes('listening');
        this.micBtn.classList.add('listening');
        this.micLabel.textContent = 'HEARING AURA...';
        this.earLeft.style.height = '36px';
        this.earRight.style.height = '36px';
        this.mouth.style.height = '14px';
        if (this.logDetails) this.logDetails.style.display = 'none';
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
        setTimeout(() => this.setState('idle'), 3500);
        break;

      case 'error':
        this.stopBlinkLoop();
        this.renderEyes('error');
        this.mouth.style.height = '6px';
        this.mouth.style.width = '40px';
        setTimeout(() => this.setState('idle'), 4000);
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

  async ensureMicPermission() {
    if (this.micPermissionGranted) return true;
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(t => t.stop());
        this.micPermissionGranted = true;
        return true;
      }
    } catch (err) {
      console.warn('getUserMedia mic request:', err);
    }
    return true;
  }

  // Continuous Wake-Word Spotter
  async startWakeWordListener() {
    if (!this.wakeWordActive) return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.logTitle.textContent = '> VOICE NOT SUPPORTED';
      this.logText.textContent = 'Tap to type commands';
      return;
    }

    await this.ensureMicPermission();

    try {
      if (this.recognition) {
        try { this.recognition.abort(); } catch (e) {}
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.micLabel.textContent = 'LISTENING FOR "AURA"';
      };

      this.recognition.onresult = (event) => {
        if (this.isProcessing) return;

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const transcript = event.results[i][0].transcript.trim();
          const lower = transcript.toLowerCase();

          // Wake-word detection: "aura", "hey aura", "ora", "ara"
          if (lower.includes('aura') || lower.includes('ora') || lower.includes('ara')) {
            // Extract command following the wake-word
            const match = lower.match(/(?:hey\s+)?(?:aura|ora|ara)[,.\s]*(.*)/i);
            const commandPart = match && match[1] ? match[1].trim() : '';

            // Voice settings trigger
            if (commandPart.includes('open settings') || commandPart.includes('settings')) {
              this.openSettings();
              return;
            }
            if (commandPart.includes('close settings')) {
              this.closeSettings();
              return;
            }

            if (event.results[i].isFinal) {
              if (commandPart.length > 1) {
                this.isProcessing = true;
                this.setState('thinking', 'COMMAND RECEIVED', `"${commandPart}"`);
                this.processCommand(commandPart);
              } else {
                this.setState('listening', 'AURA LISTENING', 'Say your command...');
              }
            } else {
              this.setState('listening', 'AURA DETECTED', transcript);
            }
          }
        }
      };

      this.recognition.onerror = (event) => {
        console.warn('Recognition event:', event.error);
        if (event.error === 'not-allowed') {
          this.setState('error', 'MIC BLOCKED', 'Allow mic permission in Chrome');
          return;
        }
      };

      this.recognition.onend = () => {
        // Automatically restart wake-word listener if still active and not processing
        if (this.wakeWordActive && !this.isProcessing) {
          clearTimeout(this.restartListenerTimer);
          this.restartListenerTimer = setTimeout(() => {
            this.startWakeWordListener();
          }, 400);
        }
      };

      this.recognition.start();

    } catch (err) {
      console.warn('Recognition start caught:', err);
    }
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
      const speechMsg = data.speech || 'Command executed on laptop.';
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
        // Resume wake word listener
        setTimeout(() => this.startWakeWordListener(), 1000);
      });

    } catch (err) {
      console.error('Failed to process command:', err);
      this.setState('error', 'ERROR', `Could not reach laptop agent at ${this.agentUrl}`);
      this.isProcessing = false;
      setTimeout(() => this.startWakeWordListener(), 1500);
    }
  }

  // Voice-controlled Settings Dialog
  openSettings() {
    this.agentUrlInput.value = this.agentUrl;
    this.voiceToggle.checked = this.ttsEnabled;
    this.settingsModal.classList.remove('hidden');
    this.setState('happy', 'SETTINGS OPEN', 'Displaying configuration.');
    this.speak('Opening settings.');
  }

  closeSettings() {
    this.settingsModal.classList.add('hidden');
    this.setState('idle', 'READY', 'Say "Aura, check my IP"');
    this.speak('Settings closed.');
  }

  speak(text, onComplete = null) {
    if (!this.ttsEnabled || !window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.05;
      utterance.pitch = 1.1;

      utterance.onend = () => { if (onComplete) onComplete(); };
      utterance.onerror = () => { if (onComplete) onComplete(); };

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      if (onComplete) onComplete();
    }
  }

  // Heartbeat check: Red if offline, Blue if online (No text needed!)
  async checkAgentConnection() {
    try {
      const res = await fetch(`${this.agentUrl}/api/health`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        // ONLINE: Electric Blue UI
        document.body.classList.remove('is-offline');
        this.connectionDot.classList.add('online');
        return true;
      }
    } catch {
      // OFFLINE
    }

    // OFFLINE: Glow Red UI
    document.body.classList.add('is-offline');
    this.connectionDot.classList.remove('online');
    return false;
  }

  promptManualCommand() {
    const cmd = prompt('Enter command for Windows laptop:', 'check my IP');
    if (cmd && cmd.trim()) {
      this.setState('thinking', 'COMMAND', `"${cmd}"`);
      this.processCommand(cmd.trim());
    }
  }

  setupEventListeners() {
    // Tapping mic button or robot face toggles wake listener or prompts
    const handleTrigger = (e) => {
      e.preventDefault();
      if (this.isProcessing) return;
      this.startWakeWordListener();
    };

    this.micBtn.addEventListener('click', handleTrigger);
    this.faceContainer.addEventListener('click', handleTrigger);

    // Tap on terminal log to type manual fallback
    const logBox = document.getElementById('terminal-log');
    if (logBox) {
      logBox.addEventListener('click', () => {
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
