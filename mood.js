(() => {
  "use strict";

  // ---- CONFIG ----------------------------------------------------------------
  // Paste your Google Apps Script web-app URL here (ends in /exec). Until it's
  // set, submissions are logged to the console instead of sent.
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbx_XJNjmVXMamfdZIf0YnskE1AqWNZCWty3EetQDgzdZf2BSRljToxNHMefs8wACrCnlA/exec";
  // Shared token — must match the SECRET in the Apps Script. Light spam guard.
  const TOKEN = "carillon-james-7f3a";

  // Mandatory daily gate: on the first visit each day during this window (local
  // 24h time) James must complete the tracker before he can play. Override for
  // testing/demo with ?gate=FROM-TO (e.g. ?gate=0-24 to always gate).
  let GATE_FROM = 15; // 15:00
  let GATE_TO = 20; // 20:00 (exclusive)
  const gp = new URLSearchParams(location.search).get("gate");
  if (gp && /^\d{1,2}-\d{1,2}$/.test(gp)) {
    const parts = gp.split("-").map(Number);
    GATE_FROM = parts[0];
    GATE_TO = parts[1];
  }
  // ----------------------------------------------------------------------------

  const MOODS = [
    { key: "happy", emoji: "😊", label: "Good" },
    { key: "mid", emoji: "😐", label: "OK" },
    { key: "sad", emoji: "😞", label: "Tough" },
  ];
  // Contextual reasons per mood, in concrete, gentle language with an icon for
  // visual support. Covers James's world: people/friendships, freedom & being
  // told what to do, big feelings, and things he enjoys. Edit freely.
  const REASONS = {
    happy: [
      { emoji: "🫂", label: "Someone was kind" },
      { emoji: "🙌", label: "I got to choose" },
      { emoji: "⭐", label: "Did something I like" },
    ],
    mid: [
      { emoji: "🙂", label: "Just a normal day" },
      { emoji: "🤷", label: "A bit of both" },
      { emoji: "🥱", label: "A bit boring" },
    ],
    sad: [
      { emoji: "👥", label: "People stuff" },
      { emoji: "🛑", label: "Told what to do" },
      { emoji: "🌪️", label: "Big feelings" },
    ],
  };
  const LEAD = { happy: "good", mid: "just OK", sad: "tough" };

  let mood = null;
  let gateMode = false;

  // ---- modal -----------------------------------------------------------------
  const modal = document.createElement("div");
  modal.className = "mood-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="mood-card" role="dialog" aria-modal="true" aria-labelledby="mood-q">
      <button class="mood-close" type="button" aria-label="Close">×</button>
      <h2 id="mood-q" class="mood-q">How was your day, James?</h2>
      <p class="mood-gatenote">A quick check-in before you play 🔔</p>
      <div class="mood-step mood-step--emoji">
        ${MOODS.map((m) => `<button class="mood-emoji" type="button" data-mood="${m.key}"><span aria-hidden="true">${m.emoji}</span>${m.label}</button>`).join("")}
      </div>
      <div class="mood-step mood-step--reason" hidden>
        <p class="mood-sub">What made today <strong class="mood-lead"></strong>?</p>
        <div class="mood-reasons"></div>
        <button class="mood-back" type="button">← back</button>
      </div>
      <div class="mood-step mood-step--thanks" hidden>
        <p class="mood-thanks">Thanks — logged it! 🔔</p>
      </div>
    </div>`;
  document.body.appendChild(modal);

  const stepEmoji = modal.querySelector(".mood-step--emoji");
  const stepReason = modal.querySelector(".mood-step--reason");
  const stepThanks = modal.querySelector(".mood-step--thanks");
  const leadEl = modal.querySelector(".mood-lead");

  function showStep(which) {
    stepEmoji.hidden = which !== "emoji";
    stepReason.hidden = which !== "reason";
    stepThanks.hidden = which !== "thanks";
  }

  function open(gate) {
    gateMode = !!gate;
    modal.classList.toggle("mood-modal--gate", gateMode);
    mood = null;
    showStep("emoji");
    modal.hidden = false;
    document.body.classList.add("mood-open");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    const first = stepEmoji.querySelector("button");
    if (first) first.focus();
  }

  function close(force) {
    if (gateMode && !force) return; // the daily gate can't be dismissed
    gateMode = false;
    modal.classList.remove("is-open", "mood-modal--gate");
    document.body.classList.remove("mood-open");
    setTimeout(() => { modal.hidden = true; }, 250);
  }

  // ---- "done today" tracking -------------------------------------------------
  function doneKey() {
    return "mood:done:" + new Date().toISOString().slice(0, 10);
  }
  function doneToday() {
    try { return localStorage.getItem(doneKey()) === "1"; } catch (_) { return false; }
  }
  function markDone() {
    try { localStorage.setItem(doneKey(), "1"); } catch (_) {}
  }

  // ---- flow ------------------------------------------------------------------
  modal.querySelector(".mood-close").addEventListener("click", () => close());
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) close(); }); // backdrop
  modal.querySelector(".mood-back").addEventListener("click", () => showStep("emoji"));
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
  });

  const reasonsWrap = modal.querySelector(".mood-reasons");

  function renderReasons(moodKey) {
    reasonsWrap.innerHTML = (REASONS[moodKey] || [])
      .map((r) => `<button class="mood-reason" type="button" data-reason="${r.label}"><span class="mood-reason__emoji" aria-hidden="true">${r.emoji}</span>${r.label}</button>`)
      .join("");
    reasonsWrap.querySelectorAll(".mood-reason").forEach((b) => {
      b.addEventListener("click", () => {
        send(moodKey, b.dataset.reason);
        markDone();
        showStep("thanks");
        setTimeout(() => close(true), 1600); // force-close, lifting any gate
      });
    });
  }

  stepEmoji.querySelectorAll(".mood-emoji").forEach((b) => {
    b.addEventListener("click", () => {
      mood = b.dataset.mood;
      leadEl.textContent = LEAD[mood] || "";
      renderReasons(mood);
      showStep("reason");
    });
  });

  function send(moodKey, reason) {
    const data = {
      token: TOKEN,
      timestamp: new Date().toISOString(),
      mood: moodKey,
      reason: reason,
      page: location.pathname.split("/").pop() || "index.html",
    };
    if (!ENDPOINT) {
      console.log("[mood] no endpoint set — would send:", data);
      return;
    }
    fetch(ENDPOINT, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data),
    }).catch((err) => console.warn("[mood] send failed", err));
  }

  // ---- trigger button in the tab bar ----------------------------------------
  const tabs = document.querySelector(".tabs");
  if (tabs) {
    const trigger = document.createElement("button");
    trigger.className = "mood-trigger";
    trigger.type = "button";
    trigger.title = "Log how your day was";
    trigger.innerHTML = `🙂&nbsp;<span>Your day</span>`;
    trigger.addEventListener("click", () => open(false));
    tabs.appendChild(trigger);
  }

  // ---- daily gate ------------------------------------------------------------
  // On the first visit of the day within the window, force the tracker.
  try {
    const hour = new Date().getHours();
    const inWindow = hour >= GATE_FROM && hour < GATE_TO;
    if (inWindow && !doneToday()) {
      setTimeout(() => open(true), 300);
    }
  } catch (_) {
    /* time/localStorage unavailable — skip the gate; the button still works */
  }
})();
