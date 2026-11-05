/**
 * AURA // Retro AI Assistant - Pixel Face & Voice Controller
 * Lightweight Vanilla JS engine for Android 8.1+ & Desktop Browsers
 */

// 6x6 Matrix Patterns for Expressive Pixel Eyes
const EYE_PATTERNS = {
  // Neutral center gaze
  idle: [
    [0,0,0,0,0,0],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,1,1,1,1,0],
    [0,0,0,0,0,0]
  ],
  // Blink / closed eyes
  blink: [
    [0,0,0,0,0,0],
    [0,0,0,0,0,0],
    [1,1,1,1,1,1],
    [1,1,1,1,1,1],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0]
  ],
  // Alert / listening (wide eyes with hollow center)
  listening: [
    [1,1,1,1,1,1],
    [1,0,0,0,0,1],
    [1,0,1,1,0,1],
    [1,0,1,1,0,1],
    [1,0,0,0,0,1],
    [1,1,1,1,1,1]
  ],
  // Happy crescents (^ ^)
  happy: [
    [0,1,1,1,1,0],
    [1,0,0,0,0,1],
    [1,0,0,0,0,0],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0],
    [0,0,0,0,0,0]
  ],
  // Thinking frame 1 (rotating pixel/gear)
  thinking1: [
    [1,1,0,0,0,0],
    [0,1,1,0,0,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
    [0,0,0,1,1,0],
    [0,0,0,0,1,1]
  ],
  // Thinking frame 2
  thinking2: [
    [0,0,0,0,1,1],
    [0,0,0,1,1,0],
    [0,0,1,1,0,0],
    [0,0,1,1,0,0],
    [0,1,1,0,0,0],
    [1,1,0,0,0,0]
  ],
  // Error / Confused (X X)
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
    this.state = 'idle'; // idle | listening | thinking | speaking | happy | error
    this.agentUrl = localStorage.getItem('aura_agent_url') || window.location.origin;
    this.ttsEnabled = localStorage.getItem('aura_tts') !== 'false';
    
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
    this.micBtn = document.getElementById('mic-btn');
    this.micLabel = document.getElementById('mic-label');
    this.connectionDot = document.getElementById('connection-dot');
    this.connectionText = document.getElementById('connection-text');
    this.faceContainer = document.getElementById('face-container');

    // Settings elements
    this.settingsModal = document.getElementById('settings-modal');
    this.settingsBtn = document.getElementById('settings-btn');
    this.closeSettingsBtn = document.getElementById('close-settings-btn');
    this.saveSettingsBtn = document.getElementById('save-settings-btn');
    this.agentUrlInput = document.getElementById('agent-url');
    this.voiceToggle = document.getElementById('voice-toggle');
    this.testBtn = document.getElementById('test-btn');

    // Timers
    this.blinkTimer = null;
    this.thinkingTimer = null;
    this.speechPulseTimer = null;
    this.thinkingFrame = 0;

    // Speech Recognition
    this.recognition = null;
    this.isListening = false;

    this.init();
  }

  init() {
    this.initPixelEyes();
    this.renderEyes('idle');
    this.startBlinkLoop();
    this.initSpeechRecognition();
    this.setupEventListeners();
    this.checkAgentConnection();

    // Periodic heartbeat every 10 seconds
    setInterval(() => this.checkAgentConnection(), 10000);
  }

  // Create 6x6 grid cells for both eyes
  initPixelEyes() {
    this.leftEyeMatrix.innerHTML = '';
    this.rightEyeMatrix.innerHTML = '';

    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        const cellL = document.createElement('div');
        cellL.className = 'pixel-cell';
        cellL.dataset.row = r;
        cellL.dataset.col = c;
        this.leftEyeMatrix.appendChild(cellL);

        const cellR = document.createElement('div');
        cellR.className = 'pixel-cell';
        cellR.dataset.row = r;
        cellR.dataset.col = c;
        this.rightEyeMatrix.appendChild(cellR);
      }
    }
  }

  // Render a pattern into the pixel matrices
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

  // Set the Robot state
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
        this.micLabel.textContent = 'TAP TO TALK';
        this.startBlinkLoop();
        break;

      case 'listening':
        this.stopBlinkLoop();
        this.renderEyes('listening');
        this.micBtn.classList.add('listening');
        this.micLabel.textContent = 'LISTENING...';
        this.earLeft.style.height = '36px';
        this.earRight.style.height = '36px';
        this.mouth.style.height = '14px';
        break;

      case 'thinking':
        this.stopBlinkLoop();
        this.micBtn.classList.remove('listening');
        this.micLabel.textContent = 'THINKING...';
        this.thinkingFrame = 0;
        this.thinkingTimer = setInterval(() => {
          this.thinkingFrame = (this.thinkingFrame + 1) % 2;
          this.renderEyes(this.thinkingFrame === 0 ? 'thinking1' : 'thinking2');
          // Alternating ears
          if (this.thinkingFrame === 0) {
            this.earLeft.style.height = '32px';
            this.earRight.style.height = '18px';
          } else {
            this.earLeft.style.height = '18px';
            this.earRight.style.height = '32px';
          }
        }, 250);
        break;

      case 'speaking':
        this.stopBlinkLoop();
        this.renderEyes('idle');
        this.micBtn.classList.remove('listening');
        this.micLabel.textContent = 'SPEAKING...';
        // Pulse mouth to simulate speaking
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
        setTimeout(() => this.setState('idle'), 3000);
        break;

      case 'error':
        this.stopBlinkLoop();
        this.renderEyes('error');
        this.mouth.style.height = '6px';
        this.mouth.style.width = '40px';
        setTimeout(() => this.setState('idle'), 3500);
        break;
    }
  }

  // Periodic blinking in idle mode
  startBlinkLoop() {
    this.stopBlinkLoop();
    const scheduleNextBlink = () => {
      const delay = Math.random() * 3000 + 2000;
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

  // Speech Recognition Setup (Web Speech API)
  initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('SpeechRecognition not supported in this browser.');
      this.logTitle.textContent = '> VOICE NOT SUPPORTED';
      this.logText.textContent = 'Browser missing Web Speech API. Use Test button.';
      return;
    }

    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.lang = 'en-US';

    this.recognition.onstart = () => {
      this.isListening = true;
      this.setState('listening', 'LISTENING', 'Speak your command now...');
    };

    this.recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      this.setState('thinking', 'COMMAND RECEIVED', `"${transcript}"`);
      this.processCommand(transcript);
    };

    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      this.isListening = false;
      this.setState('error', 'VOICE ERROR', `Recognition failed: ${event.error}`);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      if (this.state === 'listening') {
        this.setState('idle', 'IDLE', 'Tap to speak again');
      }
    };
  }

  toggleListening() {
    if (!this.recognition) {
      alert('Speech Recognition is not supported by your current browser.');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
      this.isListening = false;
    } else {
      try {
        this.recognition.start();
      } catch (err) {
        console.error('Recognition start error:', err);
      }
    }
  }

  // Send speech text to Laptop Agent
  async processCommand(userText) {
    try {
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
      
      // Update with executed info
      const speechMsg = data.speech || 'Command executed on laptop.';
      this.setState('speaking', 'ACTION EXECUTED', `${data.action.toUpperCase()}: ${data.command || speechMsg}`);
      
      this.speak(speechMsg, () => {
        this.setState('happy', 'COMPLETE', speechMsg);
      });

    } catch (err) {
      console.error('Failed to process command:', err);
      this.setState('error', 'ERROR', `Could not reach laptop agent at ${this.agentUrl}`);
    }
  }

  // Text-to-Speech Output
  speak(text, onComplete = null) {
    if (!this.ttsEnabled || !window.speechSynthesis) {
      if (onComplete) onComplete();
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 1.1; // Slightly robotic tone

    utterance.onend = () => {
      if (onComplete) onComplete();
    };

    utterance.onerror = () => {
      if (onComplete) onComplete();
    };

    window.speechSynthesis.speak(utterance);
  }

  // Heartbeat check to Windows Agent
  async checkAgentConnection() {
    try {
      const res = await fetch(`${this.agentUrl}/api/health`, { method: 'GET', mode: 'cors' });
      if (res.ok) {
        this.connectionDot.classList.add('online');
        this.connectionText.textContent = 'LINK: ONLINE';
        return true;
      }
    } catch {
      // Offline
    }
    this.connectionDot.classList.remove('online');
    this.connectionText.textContent = 'LINK: OFFLINE';
    return false;
  }

  setupEventListeners() {
    // Tap face or mic button to talk
    this.micBtn.addEventListener('click', () => this.toggleListening());
    this.faceContainer.addEventListener('click', () => this.toggleListening());

    // Test button (simulate voice command without needing mic permission)
    this.testBtn.addEventListener('click', () => {
      const sample = prompt('Enter test command for Windows laptop:', 'open terminal and check ip address');
      if (sample) {
        this.setState('thinking', 'TEST COMMAND', `"${sample}"`);
        this.processCommand(sample);
      }
    });

    // Settings Modal
    this.settingsBtn.addEventListener('click', () => {
      this.agentUrlInput.value = this.agentUrl;
      this.voiceToggle.checked = this.ttsEnabled;
      this.settingsModal.classList.remove('hidden');
    });

    this.closeSettingsBtn.addEventListener('click', () => {
      this.settingsModal.classList.add('hidden');
    });

    this.saveSettingsBtn.addEventListener('click', () => {
      let url = this.agentUrlInput.value.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      this.agentUrl = url || window.location.origin;
      this.ttsEnabled = this.voiceToggle.checked;

      localStorage.setItem('aura_agent_url', this.agentUrl);
      localStorage.setItem('aura_tts', this.ttsEnabled);

      this.settingsModal.classList.add('hidden');
      this.checkAgentConnection();
      this.setState('happy', 'SETTINGS SAVED', 'Config updated successfully.');
    });
  }
}

// Instantiate once DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  window.aura = new AuraRobot();
});
