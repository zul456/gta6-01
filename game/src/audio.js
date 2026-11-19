// audio.js: every sound is synthesized with WebAudio — no audio files.
// Engine hum follows the car's speed, sirens wail in two tones, gunshots are
// noise bursts, pickups blip, and a low sunset groove loops under the city.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a sine that swings between two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 720;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, seconds, type, volume, slideTo) {
    if (!ctx || muted) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + seconds);
      gain.gain.setValueAtTime(volume || 0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      osc.stop(ctx.currentTime + seconds);
    } catch {
      // Sound is garnish: never break the game for it.
    }
  }

  function noiseBurst(seconds, volume, lowpass) {
    if (!ctx || muted) return;
    try {
      const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass || 1800;
      const gain = ctx.createGain();
      gain.gain.value = volume || 0.4;
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start();
    } catch {
      // Sound is garnish.
    }
  }

  // A slow sunset groove: a bass note and a soft pad chord, one bar at a time.
  const GROOVE = [110, 130.81, 98, 146.83];
  const CHORDS = [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [146.83, 220, 277.18]];
  let bar = 0;
  function playBar() {
    if (!ctx || muted) return;
    const bass = GROOVE[bar % GROOVE.length];
    blip(bass, 1.9, 'triangle', 0.10);
    const chord = CHORDS[bar % CHORDS.length];
    for (const freq of chord) blip(freq, 1.9, 'sine', 0.035);
    bar += 1;
  }

  return {
    /** Call from a user gesture: browsers block audio before one. */
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume();
      if (!musicTimer) musicTimer = window.setInterval(playBar, 2000);
    },
    engine(speed01) {
      if (!ctx || muted) return;
      engineGain.gain.value = 0.02 + speed01 * 0.06;
      engineOsc.frequency.value = 50 + speed01 * 130;
    },
    engineOff() {
      if (!ctx) return;
      engineGain.gain.value = 0;
    },
    siren(on, time) {
      if (!ctx) return;
      if (!on) {
        sirenGain.gain.value = 0;
        return;
      }
      sirenGain.gain.value = muted ? 0 : 0.045;
      sirenOsc.frequency.value = Math.sin(time * 5.2) > 0 ? 720 : 960;
    },
    sirenOff() {
      if (!ctx) return;
      sirenGain.gain.value = 0;
    },
    shot() {
      noiseBurst(0.14, 0.5, 2600);
    },
    punch() {
      noiseBurst(0.09, 0.3, 900);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.22, 990);
    },
    cash() {
      blip(880, 0.1, 'sine', 0.2);
      window.setTimeout(() => blip(1318, 0.16, 'sine', 0.2), 90);
    },
    fanfare() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => window.setTimeout(() => blip(freq, 0.35, 'triangle', 0.2), i * 110));
    },
    busted() {
      blip(392, 0.4, 'sawtooth', 0.16, 196);
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    isStarted() {
      return started;
    },
  };
}
