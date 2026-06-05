(() => {
  "use strict";

  // Bell sizes: bigger = lower pitch, longer resonance, larger on screen.
  const SIZES = [
    { name: "Treble — small & high", freq: 523.25, scale: 0.5, res: 1.0 },
    { name: "Soprano", freq: 392.0, scale: 0.62, res: 1.3 },
    { name: "Alto", freq: 293.66, scale: 0.76, res: 1.7 },
    { name: "Tenor — large & low", freq: 196.0, scale: 0.9, res: 2.2 },
    { name: "Bourdon — giant & deep", freq: 130.81, scale: 1.0, res: 2.8 },
  ];
  const DEFAULT_SIZE = 3; // Tenor
  const MAX_ANGLE = 24; // how far the bell tips at a full pull
  const RING_THRESHOLD = 0.28; // fraction of the pull range needed to ring

  // Tower-bell partials [frequency ratio, peak gain, base decay seconds].
  const TOWER_PARTIALS = [
    [0.5, 0.5, 4.2], // hum — strong on a big bell
    [1.0, 0.5, 3.6], // strike / prime
    [1.18, 0.3, 3.0], // minor third
    [1.5, 0.16, 2.2], // fifth
    [2.0, 0.22, 2.0], // nominal (octave)
    [2.67, 0.1, 1.3],
    [3.4, 0.07, 1.0],
  ];

  const BELL_SVG = `
    <svg viewBox="0 0 100 116" aria-hidden="true">
      <path class="metal" d="M44 7 C40 7 38 10 38 13 C38 17 41 19 45 20 L55 20 C59 19 62 17 62 13 C62 10 60 7 56 7 C56 12 44 12 44 7 Z"/>
      <path class="metal" d="M37 21 C37 29 33 33 30 43 C26 55 22 70 15 92 C28 99 72 99 85 92 C78 70 74 55 70 43 C67 33 63 29 63 21 C63 18 58 18 50 18 C42 18 37 18 37 21 Z"/>
      <path d="M15 92 C28 99 72 99 85 92 L85 99 C72 106 28 106 15 99 Z" fill="url(#bellLip)"/>
      <path d="M41 25 C37 42 32 64 28 86" stroke="rgba(255,255,255,0.4)" stroke-width="3" fill="none" stroke-linecap="round"/>
      <ellipse cx="50" cy="88" rx="7" ry="7" fill="url(#clapperGrad)"/>
    </svg>`;

  const ringer = document.getElementById("ringer");
  const bigbell = document.getElementById("bigbell");
  const rope = document.getElementById("rope");
  const sally = document.getElementById("sally");
  const ropeTail = document.getElementById("ropeTail");
  const sizeSel = document.getElementById("size");
  const volInput = document.getElementById("vol");
  const skyEl = document.getElementById("sky");

  let cur = SIZES[DEFAULT_SIZE];
  let volume = 0.8;
  let audioCtx = null;

  let pull = 0; // current pull, 0 (rest) .. 1 (fully down)
  let dragging = false;
  let grabOffset = 0;
  const geo = {};

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const clamp01 = (v) => Math.max(0, Math.min(1, v));

  function populateSizes() {
    sizeSel.innerHTML = SIZES.map(
      (s, i) => `<option value="${i}"${i === DEFAULT_SIZE ? " selected" : ""}>${s.name}</option>`
    ).join("");
  }

  function buildBell() {
    bigbell.innerHTML = `<div class="bigbell__halo"></div>${BELL_SVG}`;
  }

  // Recompute the geometry of bell, rope, sally and tail for the current size.
  function layout() {
    geo.H = ringer.clientHeight;
    geo.W = ringer.clientWidth;
    geo.cx = geo.W / 2;

    const maxBellH = geo.H * 0.4;
    const baseW = Math.min(maxBellH / 1.16, geo.W * 0.5);
    const bellW = baseW * cur.scale;
    bigbell.style.width = bellW + "px";
    geo.bellH = bigbell.offsetHeight || bellW * 1.16;

    const bellTop = geo.H * 0.02;
    bigbell.style.top = bellTop + "px";
    geo.anchorY = bellTop + geo.bellH * 0.66; // rope appears to leave the bell

    geo.restTop = Math.max(geo.anchorY + 30, geo.H * 0.52);
    geo.maxTop = geo.H * 0.78;
    geo.sallyW = Math.round(42 + cur.scale * 16);
    geo.sallyH = clamp(geo.H * 0.16, 70, 150);
    geo.tailLen = geo.H * 0.1;

    sally.style.width = geo.sallyW + "px";
    sally.style.height = geo.sallyH + "px";

    applyPull(pull);
  }

  // Position the rope, sally and tail, and tip the bell, for a pull amount.
  function applyPull(p) {
    pull = clamp01(p);
    const sallyTop = geo.restTop + (geo.maxTop - geo.restTop) * pull;

    rope.style.top = geo.anchorY + "px";
    rope.style.height = Math.max(0, sallyTop - geo.anchorY) + "px";

    sally.style.top = sallyTop + "px";

    ropeTail.style.top = sallyTop + geo.sallyH + "px";
    ropeTail.style.height = geo.tailLen + "px";

    bigbell.style.transform = `translateX(-50%) rotate(${(-MAX_ANGLE * pull).toFixed(2)}deg)`;
  }

  function localY(e) {
    return e.clientY - ringer.getBoundingClientRect().top;
  }
  function localX(e) {
    return e.clientX - ringer.getBoundingClientRect().left;
  }

  function onDown(e) {
    const x = localX(e);
    const y = localY(e);
    const band = Math.max(geo.sallyW * 0.7, 28);
    const top = geo.anchorY - 6;
    const bottom = geo.maxTop + geo.sallyH + geo.tailLen + 10;
    if (Math.abs(x - geo.cx) > band || y < top || y > bottom) return; // not on the rope

    dragging = true;
    ensureAudio();
    const sallyTop = geo.restTop + (geo.maxTop - geo.restTop) * pull;
    grabOffset = y - sallyTop;

    ringer.classList.remove("springing");
    bigbell.classList.remove("springing");
    [sally, rope, ropeTail].forEach((el) => el.classList.add("is-grabbing"));
    try { ringer.setPointerCapture(e.pointerId); } catch (_) {}
    e.preventDefault();
  }

  function onMove(e) {
    if (!dragging) return;
    const sallyTop = clamp(localY(e) - grabOffset, geo.restTop, geo.maxTop);
    applyPull((sallyTop - geo.restTop) / (geo.maxTop - geo.restTop));
    e.preventDefault();
  }

  function onUp() {
    if (!dragging) return;
    dragging = false;
    [sally, rope, ropeTail].forEach((el) => el.classList.remove("is-grabbing"));

    const strength = pull;
    ringer.classList.add("springing");
    bigbell.classList.add("springing");
    applyPull(0); // spring back to rest (with overshoot from the CSS easing)
    if (strength > RING_THRESHOLD) ring(strength);

    setTimeout(() => {
      ringer.classList.remove("springing");
      bigbell.classList.remove("springing");
    }, 950);
  }

  function ring(strength) {
    bigbell.classList.remove("is-ringing");
    void bigbell.offsetWidth;
    bigbell.classList.add("is-ringing");
    setTimeout(() => bigbell.classList.remove("is-ringing"), 850);
    playBell(cur.freq, cur.res, volume * (0.55 + 0.45 * clamp01(strength)));
  }

  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
  }

  function playBell(freq, res, vol) {
    if (!audioCtx) return;
    const now = audioCtx.currentTime;

    const master = audioCtx.createGain();
    master.gain.value = vol;
    master.connect(audioCtx.destination);

    for (const [ratio, gain, decay] of TOWER_PARTIALS) {
      const d = decay * res;
      const osc = audioCtx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * ratio;

      const env = audioCtx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(gain, now + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0008, now + d);

      osc.connect(env).connect(master);
      osc.start(now);
      osc.stop(now + d + 0.05);
    }

    // metallic strike transient
    const noiseDur = 0.07;
    const buffer = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * noiseDur), audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const bp = audioCtx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = freq * 1.6;
    bp.Q.value = 0.6;
    const ng = audioCtx.createGain();
    ng.gain.setValueAtTime(0.3, now);
    ng.gain.exponentialRampToValueAtTime(0.0008, now + noiseDur);

    noise.connect(bp).connect(ng).connect(master);
    noise.start(now);
    noise.stop(now + noiseDur);
  }

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
  ringer.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);

  sizeSel.addEventListener("change", () => {
    cur = SIZES[parseInt(sizeSel.value, 10)] || SIZES[DEFAULT_SIZE];
    layout();
  });
  volInput.addEventListener("input", () => {
    volume = parseInt(volInput.value, 10) / 100;
  });

  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(layout, 150);
  });

  // ---------- init ----------
  makeStars();
  populateSizes();
  buildBell();
  volume = parseInt(volInput.value, 10) / 100;
  layout();
})();
