/**
 * AURA // Retro AI Assistant - Smart Conversational Engine for Vijay
 * Bulletproof 24/7 Desk-Mode Controller with Live Real-Time Transcripts
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
    this.deskModeActive = false;
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
        if (this.deskModeActive) {
          this.micLabel.textContent = '🟢 DESK MODE: ACTIVE';
        } else {
          this.micLabel.textContent = 'TAP TO START DESK MODE';
        }
        this.startBlinkLoop();
        break;

      case 'waiting_command':
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
            this.setState('idle', 'READY', 'Listening for your voice...');
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

  unlockAudioContext() {
    if (this.audioUnlocked) return;
    try {
      if (window.speechSynthesis) {
        window.speechSynthesis.resume();
      }
      this.audioUnlocked = true;
    } catch (e) {}
  }

  // Activate Desk Mode: Fullscreen + WakeLock (Never sleeps) + Continuous Mic
  async activateDeskMode() {
    this.deskModeActive = true;
    this.unlockAudioContext();

    // 1. Enter Fullscreen on mobile
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if (document.documentElement.webkitRequestFullscreen) {
        await document.documentElement.webkitRequestFullscreen();
      }
    } catch (e) {
      console.warn('Fullscreen request:', e);
    }

    // 2. Prevent screen from sleeping (WakeLock API)
    try {
      if ('wakeLock' in navigator) {
        await navigator.wakeLock.request('screen');
        console.log('Screen WakeLock active');
      }
    } catch (e) {
      console.warn('WakeLock request:', e);
    }

    // 3. Keep hardware microphone open continuously using Web Audio
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) {
          const audioCtx = new AudioContext();
          const source = audioCtx.createMediaStreamSource(stream);
          const gain = audioCtx.createGain();
          gain.gain.value = 0; // Mute local monitor loop
          source.connect(gain);
          gain.connect(audioCtx.destination);
        }
      }
    } catch (e) {
      console.warn('MediaStream lock:', e);
    }

    this.setState('idle', 'DESK MODE ACTIVE', 'Say "Aura" or any command...');
    this.micLabel.textContent = '🟢 DESK MODE: ACTIVE';
    
    // START LISTENER IMMEDIATELY from this user gesture!
    this.restartListener();

    // Play welcome audio
    this.speak("Aura desk mode activated. I am listening.");
  }

  // Safe Continuous Listener Loop
  restartListener() {
    if (!this.deskModeActive) return;
    if (this.isProcessing) return; // Do not interrupt if sending command to Gemini

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      this.logTitle.textContent = '> VOICE NOT SUPPORTED';
      this.logText.textContent = 'Tap to type commands';
      return;
    }

    try {
      if (this.recognition) {
        this.recognition.onstart = null;
        this.recognition.onresult = null;
        this.recognition.onerror = null;
        this.recognition.onend = null;
        try { this.recognition.abort(); } catch (e) {}
      }

      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true; // Show live transcription in real time!
      this.recognition.lang = localStorage.getItem('aura_lang') || 'en-IN';

      this.recognition.onstart = () => {
        this.isListeningActive = true;
        this.logTitle.textContent = '> 🎙️ LISTENING NOW';
        this.micBtn.classList.add('listening');
      };

      this.recognition.onresult = (event) => {
        let interimText = '';
        let finalText = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalText += event.results[i][0].transcript;
          } else {
            interimText += event.results[i][0].transcript;
          }
        }

        // Live visual transcript: show what the phone is hearing while speaking!
        if (interimText) {
          this.logTitle.textContent = '> 🎤 HEARING YOU...';
          this.logText.textContent = `"${interimText}"`;
        }

        if (finalText) {
          this.isListeningActive = false;
          this.handleHeardSpeech(finalText);
        }
      };

      this.recognition.onerror = (event) => {
        this.isListeningActive = false;
        if (event.error === 'not-allowed') {
          this.logTitle.textContent = '> ⚠️ MIC BLOCKED';
          this.logText.textContent = 'Tap to allow mic in Chrome';
          this.micLabel.textContent = 'TAP TO ALLOW MIC';
        } else if (event.error !== 'no-speech' && event.error !== 'aborted') {
          console.warn('Speech recognition error:', event.error);
        }
      };

      this.recognition.onend = () => {
        this.isListeningActive = false;
        // Keep listening in desk mode as long as we're not busy
        if (this.deskModeActive && !this.isProcessing) {
          setTimeout(() => this.restartListener(), 200);
        }
      };

      this.recognition.start();

    } catch (err) {
      console.warn('Listener start exception:', err);
      setTimeout(() => this.restartListener(), 800);
    }
  }

  // Process any speech heard with immediate live visual feedback
  handleHeardSpeech(rawText) {
    const text = rawText.trim();
    if (!text) {
      this.restartListener();
      return;
    }

    const lower = text.toLowerCase();

    // 1. LIVE VISUAL FEEDBACK: Show the exact words on screen immediately!
    this.logTitle.textContent = '> HEARD:';
    this.logText.textContent = `"${text}"`;

    // Check for Wake Word variations
    const wakePattern = /(?:hey\s+)?(?:aura|awra|awruh|aw-ruh|ora|ara|aara|aur|aurora|order|auto)/i;
    const hasWakeWord = wakePattern.test(lower);

    // CASE 1: Currently waiting for command after greeting
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

    // CASE 2: Wake Word Detected
    if (hasWakeWord) {
      const afterWake = lower.replace(wakePattern, '').replace(/^[,.\s]+/, '').trim();

      if (afterWake.length > 1) {
        // Full command said together: "Aura check my IP"
        if (afterWake.includes('settings')) {
          this.openSettings();
        } else {
          this.setState('thinking', 'COMMAND RECEIVED', `"${afterWake}"`);
          this.processCommand(afterWake);
        }
      } else {
        // Just "Aura" was said! Prompt Vijay
        this.setState('waiting_command', 'AURA READY', 'Yes Vijay? I am listening...');
        this.speak("Yes Vijay? What can I do for you?", () => {
          this.restartListener();
        });
      }
      return;
    }

    // CASE 3: Any command spoken directly (even without saying "Aura"!)
    // If the user says "check my IP", "open terminal", "ipconfig", "open notepad", etc.
    if (lower.length > 2) {
      if (lower.includes('settings')) {
        this.openSettings();
      } else {
        this.setState('thinking', 'COMMAND RECEIVED', `"${text}"`);
        this.processCommand(text);
      }
      return;
    }

    // Otherwise, resume listening loop
    setTimeout(() => this.restartListener(), 250);
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
          this.setState('idle', 'DESK MODE ACTIVE', 'Say "Aura" or any command');
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

  // Audio Speaker Output with Watchdog (Cannot freeze listener)
  speak(text, onComplete = null) {
    if (!this.ttsEnabled) {
      if (onComplete) onComplete();
      return;
    }

    this.isSpeaking = true;
    this.unlockAudioContext();

    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      this.isSpeaking = false;
      if (onComplete) onComplete();
    };

    // 5-second watchdog: guaranteed recovery if mobile audio hangs
    setTimeout(() => {
      if (!completed) {
        console.warn('Speech watchdog forced finish');
        finish();
      }
    }, 5000);

    // Method 1: Hardware-direct MP3 Stream
    try {
      if (this.currentAudio) {
        try { this.currentAudio.pause(); } catch(e) {}
      }
      const ttsUrl = `${this.agentUrl}/api/tts?text=${encodeURIComponent(text)}`;
      const audio = new Audio(ttsUrl);
      this.currentAudio = audio;
      
      audio.onended = finish;
      audio.onerror = () => {
        this.fallbackNativeSpeech(text, finish);
      };

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Audio play catch:', err);
          this.fallbackNativeSpeech(text, finish);
        });
      }
    } catch (err) {
      this.fallbackNativeSpeech(text, finish);
    }
  }

  fallbackNativeSpeech(text, finish) {
    if (!window.speechSynthesis) {
      finish();
      return;
    }
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = localStorage.getItem('aura_lang') || 'en-IN';
      utterance.rate = 1.0;
      utterance.pitch = 1.1;

      window.__activeUtterance = utterance;

      utterance.onend = finish;
      utterance.onerror = finish;

      window.speechSynthesis.speak(utterance);
    } catch (e) {
      finish();
    }
  }

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
    this.setState('idle', 'DESK MODE ACTIVE', 'Say "Aura, check my IP"');
    this.speak('Settings closed, Vijay.', () => {
      this.restartListener();
    });
  }

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
    const handleActivate = (e) => {
      e.preventDefault();
      if (!this.deskModeActive) {
        this.activateDeskMode();
      } else {
        this.restartListener();
      }
    };

    this.micBtn.addEventListener('click', handleActivate);
    this.faceContainer.addEventListener('click', handleActivate);

    const logBox = document.getElementById('terminal-log');
    if (logBox) {
      logBox.addEventListener('click', (e) => {
        e.stopPropagation();
        this.promptManualCommand();
      });
    }

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
