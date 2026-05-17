(() => {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;

  const PRESETS = {
    participant: [
      { delay: 0, duration: 0.1, frequency: 784, gain: 0.045 },
      { delay: 0.16, duration: 0.18, frequency: 1046, gain: 0.055 }
    ],
    admin: [
      { delay: 0, duration: 0.08, frequency: 659, gain: 0.04 },
      { delay: 0.12, duration: 0.08, frequency: 659, gain: 0.035 },
      { delay: 0.26, duration: 0.18, frequency: 988, gain: 0.05 }
    ],
    default: [
      { delay: 0, duration: 0.1, frequency: 740, gain: 0.04 },
      { delay: 0.14, duration: 0.16, frequency: 988, gain: 0.05 }
    ]
  };

  function createController(options = {}) {
    const statusNode = options.statusNode || null;
    const idleMessage = String(
      options.idleMessage || 'Le son des notifications sera actif apres un premier clic sur cette page.'
    );

    let audioContext = null;
    let listenersAttached = false;
    let interactionHandler = null;

    function setStatus(message, tone = 'muted') {
      if (!statusNode) return;
      statusNode.textContent = message;
      statusNode.dataset.tone = tone;
    }

    function ensureContext() {
      if (!AudioContextClass) {
        setStatus('Audio indisponible sur ce navigateur.', 'error');
        return null;
      }

      if (!audioContext) {
        audioContext = new AudioContextClass();
      }

      return audioContext;
    }

    function detachInteractionListeners() {
      if (!listenersAttached || !interactionHandler) return;
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.removeEventListener(eventName, interactionHandler);
      });
      listenersAttached = false;
    }

    async function unlock() {
      const context = ensureContext();
      if (!context) return false;

      try {
        if (context.state !== 'running') {
          await context.resume();
        }
      } catch {
        setStatus(idleMessage, 'warning');
        return false;
      }

      if (context.state === 'running') {
        detachInteractionListeners();
        setStatus('Notifications sonores actives.', 'success');
        return true;
      }

      setStatus(idleMessage, 'warning');
      return false;
    }

    function attachInteractionListeners() {
      if (listenersAttached) return;
      interactionHandler = () => {
        unlock();
      };
      ['pointerdown', 'keydown', 'touchstart'].forEach((eventName) => {
        window.addEventListener(eventName, interactionHandler, { passive: true });
      });
      listenersAttached = true;
    }

    function playTone(context, startAt, tone) {
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();
      const attackEnd = startAt + 0.02;
      const releaseStart = startAt + Math.max(0.02, tone.duration - 0.04);
      const stopAt = startAt + tone.duration;

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(tone.frequency, startAt);

      gainNode.gain.setValueAtTime(0.0001, startAt);
      gainNode.gain.exponentialRampToValueAtTime(tone.gain, attackEnd);
      gainNode.gain.exponentialRampToValueAtTime(tone.gain * 0.9, releaseStart);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, stopAt);

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start(startAt);
      oscillator.stop(stopAt + 0.02);
    }

    function play(kind = 'default') {
      const context = ensureContext();
      if (!context) return false;
      if (context.state !== 'running') {
        setStatus(idleMessage, 'warning');
        return false;
      }

      const preset = PRESETS[kind] || PRESETS.default;
      const baseTime = context.currentTime + 0.02;

      preset.forEach((tone) => {
        playTone(context, baseTime + tone.delay, tone);
      });

      setStatus('Notifications sonores actives.', 'success');
      return true;
    }

    attachInteractionListeners();
    setStatus(idleMessage, 'muted');
    unlock();

    return {
      play,
      unlock
    };
  }

  window.SDNotificationSound = {
    createController
  };
})();
