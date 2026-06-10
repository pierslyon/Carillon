(() => {
  "use strict";

  // Keys assigned left-to-right to the bells (home row, then top row for the
  // higher bells). The first N are used.
  const KEYS = [
    "a", "s", "d", "f", "g", "h", "j", "k", "l",
    "q", "w", "e", "r", "t", "y", "u", "i", "o", "p",
  ];

  // Semitone offsets of a major scale; repeats up the octaves for taller sets.
  const MAJOR = [0, 2, 4, 5, 7, 9, 11];
  const G_BASE = 392.0; // G4 — the default lowest, largest bell on the left.
  const E_BASE = 329.63; // E4 — for a change-ringing "eight bells on E".

  const TWO_ROW_FROM = 12; // split the bells onto two rows at this count and up.

  const bellsEl = document.getElementById("bells");
  const beamEl = document.querySelector(".beam");
  const skyEl = document.getElementById("sky");
  const countInput = document.getElementById("count");
  const countVal = document.getElementById("countVal");
  const volInput = document.getElementById("vol");
  const resonanceInput = document.getElementById("resonance");
  const etuneBtn = document.getElementById("etune");
  const fartBtn = document.getElementById("fart");

  let bellEls = [];
  let freqs = [];
  let keyMap = {};
  let volume = 0.7;
  let resonance = 1.0;
  let fartMode = false; // when true, bells play fart noises instead of tones
  let eTuning = false; // when true, a ring of 8 is tuned to E major
  let audioCtx = null;

  // The bell silhouette: crown loop, body, mouth lip, a highlight and the clapper.
  const BELL_SVG = `
    <svg viewBox="0 0 100 116" aria-hidden="true">
      <path class="metal" d="M44 7 C40 7 38 10 38 13 C38 17 41 19 45 20 L55 20 C59 19 62 17 62 13 C62 10 60 7 56 7 C56 12 44 12 44 7 Z"/>
      <path class="metal" d="M37 21 C37 29 33 33 30 43 C26 55 22 70 15 92 C28 99 72 99 85 92 C78 70 74 55 70 43 C67 33 63 29 63 21 C63 18 58 18 50 18 C42 18 37 18 37 21 Z"/>
      <path d="M15 92 C28 99 72 99 85 92 L85 99 C72 106 28 106 15 99 Z" fill="url(#bellLip)"/>
      <path d="M41 25 C37 42 32 64 28 86" stroke="rgba(255,255,255,0.4)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="88" rx="7" ry="7" fill="url(#clapperGrad)"/>
    </svg>`;

  // Bell i of a ring of n. A ring of exactly 8 with E-tuning on sounds E major.
  function noteFreqFor(i, n) {
    const base = eTuning && n === 8 ? E_BASE : G_BASE;
    const octave = Math.floor(i / MAJOR.length);
    const semitones = octave * 12 + MAJOR[i % MAJOR.length];
    return base * Math.pow(2, semitones / 12);
  }

  function keyLabel(k) {
    return k === "\\" ? "\\" : k.toUpperCase();
  }

  function makeBell(i, key, w) {
    const bell = document.createElement("button");
    bell.className = "bell";
    bell.type = "button";
    bell.style.setProperty("--w", w.toFixed(1) + "px");
    bell.style.zIndex = String(100 - i); // larger bells overlap smaller ones
    bell.setAttribute("aria-label", `Bell ${i + 1}, key ${keyLabel(key)}`);
    bell.innerHTML =
      `<span class="bell__rope"></span>` +
      `<span class="bell__halo"></span>` +
      `<span class="bell__pivot">${BELL_SVG}</span>` +
      `<kbd class="bell__key">${keyLabel(key)}</kbd>`;

    // Stagger the idle sway so the bells don't move in lockstep.
    const pivot = bell.querySelector(".bell__pivot");
    pivot.style.animationDelay = (-((i * 0.37) % 4)).toFixed(2) + "s";

    bell.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      ensureAudio();
      strike(i);
    });
    return bell;
  }

  // (Re)build the bells for a given count. From 12 bells up they split onto
  // two rows so each bell stays a usable size.
  function build(n) {
    bellsEl.innerHTML = "";
    bellEls = [];
    freqs = [];
    keyMap = {};

    const twoRows = n >= TWO_ROW_FROM;
    const perRow = twoRows ? Math.ceil(n / 2) : n;

    // Size the bells to the available width so a row never overflows. The
    // largest (lowest) bell is on the left and they taper down to the right.
    const cs = getComputedStyle(bellsEl);
    const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const rowGap = twoRows ? 14 : parseFloat(cs.columnGap || cs.gap) || 14;
    const avail = bellsEl.clientWidth - padX;
    const cap = twoRows ? 116 : 132;
    const unit = (avail - rowGap * (perRow - 1)) / perRow;
    const maxW = Math.max(38, Math.min(cap, unit));
    const minW = maxW * 0.56;

    bellsEl.classList.toggle("bells--stacked", twoRows);
    if (beamEl) beamEl.style.display = twoRows ? "none" : "";

    let row1 = bellsEl;
    let row2 = null;
    if (twoRows) {
      row1 = document.createElement("div");
      row1.className = "bell-row";
      row2 = document.createElement("div");
      row2.className = "bell-row";
      bellsEl.append(row1, row2);
    }

    for (let i = 0; i < n; i++) {
      const w = n === 1 ? maxW : maxW - (maxW - minW) * (i / (n - 1));
      const key = KEYS[i];
      freqs[i] = noteFreqFor(i, n);
      keyMap[key] = i;

      const bell = makeBell(i, key, w);
      (twoRows ? (i < perRow ? row1 : row2) : bellsEl).appendChild(bell);
      bellEls[i] = bell;
    }

    // Two rows can be taller than the belfry; shrink the bells until they fit
    // its height so the lower row (and its key caps) never clip.
    if (twoRows) {
      for (let pass = 0; pass < 4 && bellsEl.scrollHeight > bellsEl.clientHeight + 2; pass++) {
        const factor = (bellsEl.clientHeight - 4) / bellsEl.scrollHeight;
        for (const b of bellEls) {
          const cur = parseFloat(b.style.getPropertyValue("--w")) || maxW;
          b.style.setProperty("--w", Math.max(34, cur * factor).toFixed(1) + "px");
        }
      }
    }
  }

  // Ring a bell: restart its swing animation and play a tone (or a fart).
  function strike(i) {
    const bell = bellEls[i];
    if (!bell) return;

    bell.classList.remove("is-ringing");
    void bell.offsetWidth; // force reflow so the animation can re-trigger
    bell.classList.add("is-ringing");
    clearTimeout(bell._ringTimer);
    bell._ringTimer = setTimeout(() => bell.classList.remove("is-ringing"), 950);

    if (fartMode) playFart(freqs[i]);
    else playTone(freqs[i]);
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  // Additive synthesis of a bell: a set of inharmonic partials, each with its
  // own gain and decay. The ~1.19 "minor third" partial gives the bell timbre.
  function playTone(freq) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const master = audioCtx.createGain();
    master.gain.value = volume;
    master.connect(audioCtx.destination);

    // [frequency ratio, peak gain, decay seconds]
    const partials = [
      [0.5, 0.16, 3.4],  // hum tone
      [1.0, 0.5, 2.8],   // strike / prime
      [1.19, 0.34, 2.4], // minor third — the bell's signature
      [1.5, 0.2, 1.9],   // perfect fifth
      [2.0, 0.26, 1.7],  // nominal (octave)
      [2.55, 0.12, 1.2],
      [3.0, 0.1, 1.0],
      [4.2, 0.06, 0.7],
    ];

    for (const [ratio, gain, decay] of partials) {
      const d = decay * resonance; // resonance slider stretches/shortens the ring
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;

      const env = audioCtx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 0.005);
      env.gain.exponentialRampToValueAtTime(0.0008, now + d);

      osc.connect(env).connect(master);
      osc.start(now);
      osc.stop(now + d + 0.05);
    }

    // Short filtered-noise transient for the metallic "strike".
    const noiseDur = 0.05;
    const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * noiseDur), audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const bandpass = audioCtx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = freq * 2.2;
    bandpass.Q.value = 0.7;
    const noiseEnv = audioCtx.createGain();
    noiseEnv.gain.setValueAtTime(0.25, now);
    noiseEnv.gain.exponentialRampToValueAtTime(0.0008, now + noiseDur);

    noise.connect(bandpass).connect(noiseEnv).connect(master);
    noise.start(now);
    noise.stop(now + noiseDur);
  }

  // A wetter, more realistic fart. The key to not sounding like a laser is an
  // IRREGULAR low pitch (a random walk, not a smooth glide), an uneven
  // "raspberry" flutter chopping the amplitude, and band-limited turbulence
  // noise mixed in — all muffled by a low-pass.
  function playFart(freq) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    const dur = 0.35 + Math.random() * 0.45;
    const base = Math.max(70, Math.min(170, freq / 5.5)); // low; loosely tracks the bell
    const peak = Math.max(0.0008, volume);

    const master = audioCtx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.linearRampToValueAtTime(peak, now + 0.025);
    master.gain.setValueAtTime(peak, now + dur * 0.6);
    master.gain.exponentialRampToValueAtTime(0.0008, now + dur);
    master.connect(audioCtx.destination);

    const lp = audioCtx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(620, now);
    lp.frequency.linearRampToValueAtTime(360, now + dur);
    lp.Q.value = 3;
    lp.connect(master);

    // Irregular "raspberry" flutter — modulates the amplitude of the whole sound.
    const flutter = audioCtx.createGain();
    const fN = Math.max(16, Math.floor(dur * 160));
    const fcurve = new Float32Array(fN);
    const dt = dur / fN;
    let phase = 0;
    let rate = 11 + Math.random() * 8;
    for (let i = 0; i < fN; i++) {
      phase += 2 * Math.PI * rate * dt;
      rate += (Math.random() - 0.5) * 4;
      rate = Math.max(7, Math.min(22, rate));
      const sq = Math.sin(phase) >= 0 ? 1 : -1;
      fcurve[i] = 0.5 + 0.5 * sq * (0.55 + 0.45 * Math.random());
    }
    flutter.gain.setValueCurveAtTime(fcurve, now, dur);
    flutter.connect(lp);

    // Buzzy tone with a random-walk pitch (the anti-laser fix).
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    const pN = Math.max(8, Math.floor(dur * 30));
    const pcurve = new Float32Array(pN);
    let f = base * (0.9 + Math.random() * 0.2);
    for (let i = 0; i < pN; i++) {
      f += (Math.random() - 0.5) * base * 0.4;
      f = Math.max(base * 0.55, Math.min(base * 1.5, f));
      pcurve[i] = f * (1 - 0.12 * (i / pN)); // gentle deflation
    }
    osc.frequency.setValueCurveAtTime(pcurve, now, dur);
    osc.connect(flutter);

    // Wet turbulence: band-limited noise, chopped by the same flutter.
    const nbuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * dur), audioCtx.sampleRate);
    const nd = nbuf.getChannelData(0);
    for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = nbuf;
    const nbp = audioCtx.createBiquadFilter();
    nbp.type = "bandpass";
    nbp.frequency.value = base * 2.2;
    nbp.Q.value = 1.1;
    const ng = audioCtx.createGain();
    ng.gain.value = 0.4;
    noise.connect(nbp).connect(ng).connect(flutter);

    osc.start(now);
    osc.stop(now + dur + 0.05);
    noise.start(now);
    noise.stop(now + dur + 0.05);
  }

  // Sprinkle a few stars behind the bells for depth.
  function makeStars() {
    if (!skyEl) return;
    let html = "";
    for (let i = 0; i < 46; i++) {
      const x = (Math.random() * 100).toFixed(2);
      const y = (Math.random() * 76).toFixed(2);
      const s = (Math.random() * 2 + 1).toFixed(2);
      const o = (Math.random() * 0.6 + 0.25).toFixed(2);
      html += `<span class="star" style="left:${x}%;top:${y}%;width:${s}px;height:${s}px;opacity:${o}"></span>`;
    }
    skyEl.innerHTML = html;
  }

  // ---------- events ----------
  window.addEventListener("keydown", (e) => {
    if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k in keyMap) {
      ensureAudio();
      strike(keyMap[k]);
      e.preventDefault();
    }
  });

  countInput.addEventListener("input", () => {
    countVal.textContent = countInput.value;
    build(parseInt(countInput.value, 10));
  });

  volInput.addEventListener("input", () => {
    volume = parseInt(volInput.value, 10) / 100;
  });

  // Resonance slider: how long the bells ring out, like a piano sustain pedal.
  // Maps 0–100 to a decay multiplier of ~0.15 (damped tap) to ~3.0 (long ring).
  function sliderResonance() {
    return 0.15 + (parseInt(resonanceInput.value, 10) / 100) * 2.85;
  }
  resonanceInput.addEventListener("input", () => {
    resonance = sliderResonance();
  });

  // "8 bells on E" toggle — snaps to 8 bells and tunes them to E major.
  etuneBtn.addEventListener("click", () => {
    eTuning = !eTuning;
    etuneBtn.setAttribute("aria-pressed", String(eTuning));
    if (eTuning && parseInt(countInput.value, 10) !== 8) {
      countInput.value = "8";
      countVal.textContent = "8";
    }
    build(parseInt(countInput.value, 10));
  });

  // Fart mode toggle — the fun button.
  fartBtn.addEventListener("click", () => {
    fartMode = !fartMode;
    fartBtn.setAttribute("aria-pressed", String(fartMode));
    ensureAudio();
  });

  // Re-fit the bells to the new width when the window resizes (debounced).
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => build(parseInt(countInput.value, 10)), 150);
  });

  // Browsers need a user gesture before audio can start.
  window.addEventListener("pointerdown", ensureAudio, { once: true });

  // ---------- init ----------
  makeStars();
  volume = parseInt(volInput.value, 10) / 100;
  resonance = sliderResonance();
  build(parseInt(countInput.value, 10));
})();
