(() => {
  "use strict";

  // Shown on every page load (both the Carillon and Bell Pull pages).
  const MESSAGE = "Hello James, I hope you’ve had a good day";

  const el = document.createElement("div");
  el.className = "welcome";
  el.setAttribute("role", "status");
  el.textContent = MESSAGE;

  function dismiss() {
    el.classList.remove("is-shown");
    el.classList.add("is-hiding");
    setTimeout(() => el.remove(), 600);
  }

  el.addEventListener("click", dismiss);
  document.body.appendChild(el);

  // Commit the opacity:0 start state via a forced reflow, then transition in.
  // (Avoids requestAnimationFrame, which is paused in hidden/background tabs.)
  void el.offsetWidth;
  el.classList.add("is-shown");

  // Auto-dismiss after a few seconds.
  setTimeout(dismiss, 5200);
})();
