(() => {
  "use strict";

  // ---- CONFIG ----------------------------------------------------------------
  // Paste your Google Apps Script web-app URL here (ends in /exec). Until it's
  // set, submissions are logged to the console instead of sent.
  const ENDPOINT = "";
  // Shared token — must match the SECRET in the Apps Script. Light spam guard.
  const TOKEN = "carillon-james-7f3a";
  // ----------------------------------------------------------------------------

  const MOODS = [
    { key: "happy", emoji: "😊", label: "Good" },
    { key: "mid", emoji: "😐", label: "OK" },
    { key: "sad", emoji: "😞", label: "Tough" },
  ];
  const REASONS = ["Work", "People", "Health"];
  const LEAD = { happy: "good", mid: "OK", sad: "tough" };

  let mood = null;

  // ---- modal -----------------------------------------------------------------
  const modal = document.createElement("div");
  modal.className = "mood-modal";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="mood-card" role="dialog" aria-modal="true" aria-labelledby="mood-q">
      <button class="mood-close" type="button" aria-label="Close">×</button>
      <h2 id="mood-q" class="mood-q">How was your day, James?</h2>
      <div class="mood-step mood-step--emoji">
        ${MOODS.map((m) => `<button class="mood-emoji" type="button" data-mood="${m.key}"><span aria-hidden="true">${m.emoji}</span>${m.label}</button>`).join("")}
      </div>
      <div class="mood-step mood-step--reason" hidden>
        <p class="mood-sub">What made it <strong class="mood-lead"></strong>?</p>
        <div class="mood-reasons">
          ${REASONS.map((r) => `<button class="mood-reason" type="button" data-reason="${r}">${r}</button>`).join("")}
        </div>
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

  function open() {
    mood = null;
    showStep("emoji");
    modal.hidden = false;
    document.body.classList.add("mood-open");
    requestAnimationFrame(() => modal.classList.add("is-open"));
    const first = stepEmoji.querySelector("button");
    if (first) first.focus();
  }

  function close() {
    modal.classList.remove("is-open");
    document.body.classList.remove("mood-open");
    setTimeout(() => { modal.hidden = true; }, 250);
  }

  // ---- flow ------------------------------------------------------------------
  modal.querySelector(".mood-close").addEventListener("click", close);
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) close(); }); // backdrop
  modal.querySelector(".mood-back").addEventListener("click", () => showStep("emoji"));

  stepEmoji.querySelectorAll(".mood-emoji").forEach((b) => {
    b.addEventListener("click", () => {
      mood = b.dataset.mood;
      leadEl.textContent = LEAD[mood] || "";
      showStep("reason");
    });
  });

  stepReason.querySelectorAll(".mood-reason").forEach((b) => {
    b.addEventListener("click", () => {
      send(mood, b.dataset.reason);
      showStep("thanks");
      setTimeout(close, 1600);
    });
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) close();
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
    trigger.addEventListener("click", open);
    tabs.appendChild(trigger);
  }

  // ---- auto-prompt once per day ---------------------------------------------
  try {
    const key = "mood:lastPrompt";
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(key) !== today) {
      localStorage.setItem(key, today);
      setTimeout(open, 1500); // let the welcome banner appear first
    }
  } catch (_) {
    /* localStorage unavailable — skip the auto-prompt, the button still works */
  }
})();
