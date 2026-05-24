/* planui actions.js — browser-side interaction, no bundler required (ES2020) */
(function () {
  "use strict";

  // ── Data ──────────────────────────────────────────────────────────
  const dataEl = document.getElementById("planui-data");
  const plan = dataEl ? JSON.parse(dataEl.textContent || "{}") : {};
  const planId = plan.planId || "unknown";
  const PLAN_ID = planId;
  const STORAGE_KEY = "planui-state-" + planId;

  // Increment when the persisted shape is incompatible with the current schema.
  // Absent _v (Phase 1 initial release) is treated as v0 — still compatible.
  const STATE_SCHEMA_VERSION = 1;

  function loadState() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      if (raw._v !== undefined && raw._v !== STATE_SCHEMA_VERSION) return {};
      return raw;
    } catch { return {}; }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, _v: STATE_SCHEMA_VERSION }));
    } catch {}
  }
  let state = loadState();
  if (!state.steps)      state.steps      = {};
  if (!state.comments)   state.comments   = {};
  if (!state.questions)  state.questions  = {};
  if (!state.priorities) state.priorities = {};
  if (!state.expanded)   state.expanded   = {};

  // ── Pref helpers ──────────────────────────────────────────────────
  function loadPref(attr) {
    try { return localStorage.getItem("planui-pref-" + attr); } catch { return null; }
  }
  function resolveTheme(pref) {
    if (pref !== "system") return pref;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  function applyPref(attr, val) {
    const resolved = attr === "theme" ? resolveTheme(val) : val;
    document.documentElement.setAttribute("data-" + attr, resolved);
    try { localStorage.setItem("planui-pref-" + attr, val); } catch {}
    // Sync segmented control active state
    const ctrl = document.querySelector(".seg-ctrl[data-pref='" + attr + "']");
    if (ctrl) {
      ctrl.querySelectorAll(".seg-btn").forEach(function (btn) {
        btn.classList.toggle("active", btn.getAttribute("data-val") === val);
      });
    }
  }

  // ── Review semantics (canonical source of truth) ─────────────────
  // Step states:  "approved" | "struck" | "commenting" | ""
  //
  // RULE: Only "approved" and "struck" count as RESOLVED.
  // A step in "commenting" state, or a step with only text in the comments
  // field, remains UNRESOLVED — comments are advisory feedback only and
  // do NOT satisfy approval gating.
  //
  // All review gating MUST go through isStepResolved() so this rule
  // cannot be accidentally redefined in one place but not others.
  function isStepResolved(id) {
    const s = state.steps[id] || "";
    return s === "approved" || s === "struck";
  }

  // ── Questions indicator ────────────────────────────────────────────
  function updateQuestionsIndicator() {
    const indicator = document.getElementById("questions-indicator");
    if (!indicator) return;
    const qCards = Array.from(document.querySelectorAll(".question-card"));
    const total = qCards.length;
    if (total === 0) { indicator.style.display = "none"; return; }
    const unanswered = qCards.filter(function (c) {
      const qid = c.getAttribute("data-qid");
      return !(qid && state.questions[qid] && state.questions[qid].trim());
    }).length;
    const answered = total - unanswered;
    indicator.style.display = "flex";
    const textEl = document.getElementById("qi-text");
    if (textEl) textEl.textContent = answered + " / " + total + " questions answered";
    indicator.classList.toggle("all-answered", unanswered === 0);
    // Update sidebar Q-badge
    const badge = document.getElementById("toc-q-badge");
    if (badge) badge.textContent = unanswered > 0 ? String(unanswered) : "";
  }

  // ── Sidebar TOC ───────────────────────────────────────────────────
  function buildSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;
    const sections = document.querySelectorAll(".section[data-kind]");
    const stepsSection = document.getElementById("section-steps");

    sections.forEach(function (sec) {
      const kind = sec.getAttribute("data-kind");
      const heading = sec.querySelector(".section-heading");
      if (!heading) return;

      // Extract plain text (skip badge span)
      function headingText() {
        return Array.from(heading.childNodes)
          .filter(function (n) { return n.nodeType === 3; })
          .map(function (n) { return n.textContent; })
          .join("").trim() || kind;
      }

      if (kind === "steps" && stepsSection) {
        const label = document.createElement("div");
        label.className = "sidebar-label";
        label.textContent = headingText();
        sidebar.appendChild(label);

        const stepCards = sec.querySelectorAll(".step-card");
        stepCards.forEach(function (card) {
          const id = card.getAttribute("data-step-id");
          const titleEl = card.querySelector(".step-title");
          if (!titleEl || !id) return;
          const link = document.createElement("a");
          link.className = "sidebar-link";
          link.href = "#step-" + id;
          link.textContent = titleEl.textContent || id;
          link.setAttribute("data-step-sidebar", id);
          sidebar.appendChild(link);
        });
      } else {
        const div = document.createElement("div");
        div.className = "sidebar-section";
        const link = document.createElement("a");
        link.className = "sidebar-link";
        link.href = "#" + sec.id;
        link.textContent = headingText();

        if (kind === "questions") {
          const qCards = sec.querySelectorAll(".question-card");
          if (qCards.length > 0) {
            const badge = document.createElement("span");
            badge.className = "toc-q-badge";
            badge.id = "toc-q-badge";
            badge.textContent = String(qCards.length);
            link.appendChild(badge);
          }
        }

        div.appendChild(link);
        sidebar.appendChild(div);
      }
    });
  }

  // ── Gear menu — segmented controls ───────────────────────────────
  function initGear() {
    const btn = document.getElementById("gear-btn");
    const menu = document.getElementById("gear-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", function () { menu.classList.remove("open"); });

    // Restore saved prefs
    ["theme", "font", "color"].forEach(function (attr) {
      const saved = loadPref(attr);
      if (saved) {
        applyPref(attr, saved);
      } else if (attr === "theme") {
        applyPref("theme", "system");
      }
    });

    // Segmented control click handlers
    document.querySelectorAll(".seg-ctrl").forEach(function (ctrl) {
      const pref = ctrl.getAttribute("data-pref");
      if (!pref) return;
      ctrl.addEventListener("click", function (e) {
        const segBtn = e.target.closest(".seg-btn");
        if (!segBtn) return;
        const val = segBtn.getAttribute("data-val");
        if (!val) return;
        applyPref(pref, val);
      });
    });

    // Re-apply when OS colour scheme changes
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      const saved = loadPref("theme") || "system";
      if (saved === "system") applyPref("theme", "system");
    });
  }

  // ── Step cards ────────────────────────────────────────────────────
  function applyStepState(card, id) {
    const s = state.steps[id] || "";
    card.dataset.state = s;
    card.classList.toggle("approved",   s === "approved");
    card.classList.toggle("struck",     s === "struck");
    card.classList.toggle("commenting", s === "commenting");

    const approveBtn = card.querySelector(".step-btn.approve");
    const strikeBtn  = card.querySelector(".step-btn.strike");
    const commentBtn = card.querySelector(".step-btn.comment");
    if (approveBtn) approveBtn.classList.toggle("active", s === "approved");
    if (strikeBtn)  strikeBtn.classList.toggle("active",  s === "struck");
    if (commentBtn) commentBtn.classList.toggle("active", !!state.comments[id]);

    const sidebarLink = document.querySelector("[data-step-sidebar='" + id + "']");
    if (sidebarLink) {
      sidebarLink.classList.toggle("done",   s === "approved");
      sidebarLink.classList.toggle("struck", s === "struck");
    }

    const commentArea = card.querySelector(".step-comment-area");
    if (commentArea) {
      const open = s === "commenting" || !!state.comments[id];
      commentArea.classList.toggle("open", open);
    }
  }

  function initStepCards() {
    document.querySelectorAll(".step-card").forEach(function (card) {
      const id = card.getAttribute("data-step-id");
      if (!id) return;

      // Restore state
      applyStepState(card, id);

      // Restore comment text
      const textarea = card.querySelector(".step-comment-area textarea");
      if (textarea && state.comments[id]) {
        textarea.value = state.comments[id];
      }

      // Priority picker — restore + wire up
      card.querySelectorAll(".prio-btn").forEach(function (btn) {
        if (state.priorities[id] === btn.getAttribute("data-prio")) {
          btn.classList.add("active");
        }
        btn.addEventListener("click", function (e) {
          e.stopPropagation();
          const prio = btn.getAttribute("data-prio");
          const already = state.priorities[id] === prio;
          card.querySelectorAll(".prio-btn").forEach(function (b) { b.classList.remove("active"); });
          state.priorities[id] = already ? null : prio;
          if (!already) btn.classList.add("active");
          saveState();
        });
      });

      // Toggle body on header click
      const header = card.querySelector(".step-header");
      const body   = card.querySelector(".step-body");
      if (header && body) {
        header.addEventListener("click", function (e) {
          if (e.target.closest(".step-actions")) return;
          body.classList.toggle("open");
        });
      }

      // Approve button
      const approveBtnEl = card.querySelector(".step-btn.approve");
      if (approveBtnEl) {
        approveBtnEl.addEventListener("click", function (e) {
          e.stopPropagation();
          state.steps[id] = state.steps[id] === "approved" ? "" : "approved";
          saveState();
          applyStepState(card, id);
          updateApproveGating();
        });
      }

      // Strike button
      const strikeBtn = card.querySelector(".step-btn.strike");
      if (strikeBtn) {
        strikeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          state.steps[id] = state.steps[id] === "struck" ? "" : "struck";
          saveState();
          applyStepState(card, id);
          updateApproveGating();
        });
      }

      // Comment button
      const commentBtn = card.querySelector(".step-btn.comment");
      if (commentBtn) {
        commentBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          const prev = state.steps[id];
          state.steps[id] = prev === "commenting" ? "" : "commenting";
          saveState();
          applyStepState(card, id);
          const ta = card.querySelector(".step-comment-area textarea");
          if (ta && state.steps[id] === "commenting") ta.focus();
        });
      }

      // Save comment text
      if (textarea) {
        textarea.addEventListener("input", function () {
          state.comments[id] = textarea.value;
          saveState();
          const btn = card.querySelector(".step-btn.comment");
          if (btn) btn.classList.toggle("active", !!textarea.value);
        });
      }
    });
  }

  // ── Questions ─────────────────────────────────────────────────────
  function getAnswer(card) {
    const qid = card.getAttribute("data-qid");
    return (qid && state.questions[qid] && state.questions[qid].trim()) ? state.questions[qid] : null;
  }

  function initQuestions() {
    document.querySelectorAll(".question-card").forEach(function (card) {
      const qid = card.getAttribute("data-qid");
      if (!qid) return;

      const ta        = card.querySelector("textarea");
      const chipGroup = card.querySelector(".chip-group");

      if (ta) {
        if (state.questions[qid]) {
          ta.value = state.questions[qid];
          ta.classList.add("answered");
        }
        ta.addEventListener("input", function () {
          state.questions[qid] = ta.value;
          saveState();
          ta.classList.toggle("answered", !!ta.value);
          updateApproveGating();
        });
      } else if (chipGroup) {
        if (state.questions[qid]) {
          chipGroup.querySelectorAll("input[type=radio]").forEach(function (inp) {
            if (inp.value === state.questions[qid]) inp.checked = true;
          });
        }
        chipGroup.addEventListener("change", function (e) {
          const radio = e.target;
          if (radio && radio.type === "radio") {
            state.questions[qid] = radio.value;
            saveState();
            updateApproveGating();
          }
        });
      }
    });
  }

  // ── Approve gating (dual: questions + steps) ──────────────────────
  function updateApproveGating() {
    const approveBtnEl = document.getElementById("approve-btn");
    const warning      = document.getElementById("questions-warning");
    if (!approveBtnEl) return;

    const qCards = Array.from(document.querySelectorAll(".question-card"));
    const unanswered = qCards.filter(function (card) {
      const qid = card.getAttribute("data-qid");
      return !(qid && state.questions[qid] && state.questions[qid].trim());
    }).length;

    const stepCards = Array.from(document.querySelectorAll(".step-card"));
    const unresolved = stepCards.filter(function (card) {
      return !isStepResolved(card.getAttribute("data-step-id"));
    }).length;

    const approvable = unanswered === 0 && unresolved === 0;
    approveBtnEl.disabled = !approvable;

    if (approvable) {
      approveBtnEl.title = "All questions answered and steps reviewed";
    } else if (unanswered > 0 && unresolved > 0) {
      approveBtnEl.title = unanswered + " question(s) unanswered · " + unresolved + " step(s) unreviewed";
    } else if (unanswered > 0) {
      approveBtnEl.title = unanswered + " question(s) unanswered";
    } else {
      approveBtnEl.title = unresolved + " step(s) unreviewed";
    }

    if (warning) {
      if (unanswered > 0 && qCards.length > 0) {
        warning.textContent = unanswered + " unanswered question" + (unanswered !== 1 ? "s" : "");
        warning.style.display = "inline-block";
      } else {
        warning.style.display = "none";
      }
    }

    updateQuestionsIndicator();
    updateBarStatus();
  }

  // ── Bar status + progress (3-way: approved / struck / pending) ────
  function updateBarStatus() {
    const el        = document.getElementById("bar-status");
    const fill      = document.getElementById("progress-fill");
    const stepCards = Array.from(document.querySelectorAll(".step-card"));
    if (!stepCards.length) {
      if (el) el.textContent = "";
      if (fill) fill.style.width = "0%";
      return;
    }
    const total    = stepCards.length;
    const approved = stepCards.filter(function (c) { return state.steps[c.getAttribute("data-step-id")] === "approved"; }).length;
    const struck   = stepCards.filter(function (c) { return state.steps[c.getAttribute("data-step-id")] === "struck"; }).length;
    const pending  = total - approved - struck;
    if (el) el.textContent = approved + " approved · " + struck + " struck · " + pending + " pending";
    const pct = Math.round((approved + struck) / total * 100);
    if (fill) fill.style.width = pct + "%";
  }

  // ── Bulk actions ──────────────────────────────────────────────────
  function initBulkActions() {
    function bulkSet(newState) {
      document.querySelectorAll(".step-card").forEach(function (card) {
        const id = card.getAttribute("data-step-id");
        if (!id) return;
        state.steps[id] = newState;
        applyStepState(card, id);
      });
      saveState();
      updateApproveGating();
    }

    const approveAll = document.getElementById("bulk-approve-all");
    const strikeAll  = document.getElementById("bulk-strike-all");
    const clearAll   = document.getElementById("bulk-clear-all");
    const resolveBtn = document.getElementById("resolve-remaining-btn");

    if (approveAll) approveAll.addEventListener("click", function () { bulkSet("approved"); });
    if (strikeAll)  strikeAll.addEventListener("click",  function () { bulkSet("struck"); });
    if (clearAll)   clearAll.addEventListener("click",   function () { bulkSet(""); });

    if (resolveBtn) {
      resolveBtn.addEventListener("click", function () {
        document.querySelectorAll(".step-card").forEach(function (card) {
          const id = card.getAttribute("data-step-id");
          if (!id) return;
          if (!isStepResolved(id)) {
            state.steps[id] = "approved";
            applyStepState(card, id);
          }
        });
        saveState();
        updateApproveGating();
      });
    }
  }

  // ── Focus mode ────────────────────────────────────────────────────
  function initFocusMode() {
    const btn = document.getElementById("focus-btn");
    if (!btn) return;
    let active = false;
    btn.addEventListener("click", function () {
      active = !active;
      document.documentElement.setAttribute("data-review-mode", active ? "focus" : "");
      btn.classList.toggle("active", active);
      btn.textContent = active ? "Exit focus" : "Focus";
    });
  }

  // ── Copy feedback (structured format) ────────────────────────────
  function buildFeedback() {
    const qCards    = Array.from(document.querySelectorAll(".question-card"));
    const stepCards = Array.from(document.querySelectorAll(".step-card"));

    const allApproved = stepCards.length > 0 && stepCards.every(function (c) {
      return state.steps[c.getAttribute("data-step-id")] === "approved";
    });
    const anyStruck = stepCards.some(function (c) {
      return state.steps[c.getAttribute("data-step-id")] === "struck";
    });
    const action = allApproved ? "approve" : anyStruck ? "modify" : "revise";

    let out = "```planresponse " + PLAN_ID + "\n";
    out += "action: " + action + "\n";

    const answeredQs = qCards.filter(function (c) { return !!getAnswer(c); });
    if (answeredQs.length > 0) {
      out += "\nquestions:\n";
      answeredQs.forEach(function (c) {
        const qid = c.getAttribute("data-qid");
        out += "  " + qid + ": " + state.questions[qid].trim() + "\n";
      });
    }

    const stepLines = [];
    stepCards.forEach(function (c) {
      const id   = c.getAttribute("data-step-id");
      const idx  = c.getAttribute("data-step-index") || "?";
      const s    = state.steps[id] || "";
      const cmt  = (state.comments[id] || "").trim();
      const prio = state.priorities[id];
      if (s === "struck") {
        stepLines.push("  Step " + idx + " [remove]" + (cmt ? ": " + cmt : ""));
      } else if (cmt) {
        stepLines.push("  Step " + idx + " [feedback]: " + cmt + (prio ? " [" + prio + "]" : ""));
      } else if (prio) {
        stepLines.push("  Step " + idx + " [priority:" + prio + "]");
      }
    });
    if (stepLines.length > 0) {
      out += "\nsteps:\n" + stepLines.join("\n") + "\n";
    }

    out += "```";
    return out;
  }

  function copyToClipboard(text, onDone) {
    navigator.clipboard.writeText(text).then(onDone).catch(function () {
      const ta = document.createElement("textarea");
      ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select(); document.execCommand("copy");
      document.body.removeChild(ta);
      onDone();
    });
  }

  function initActionBar() {
    const copyBtn      = document.getElementById("copy-feedback-btn");
    const approveBtnEl = document.getElementById("approve-btn");
    const exportBtn    = document.getElementById("export-btn");
    const confirm      = document.getElementById("copy-confirm");

    function showConfirm(msg) {
      if (!confirm) return;
      confirm.textContent = msg || "Copied!";
      confirm.style.display = "inline";
      setTimeout(function () { confirm.style.display = "none"; confirm.textContent = "Copied!"; }, 2500);
    }

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        copyToClipboard(buildFeedback(), function () { showConfirm("Copied!"); });
      });
    }

    if (approveBtnEl) {
      approveBtnEl.addEventListener("click", function () {
        copyToClipboard(buildFeedback(), function () { showConfirm("Approval copied!"); });
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        const dataEl2 = document.getElementById("planui-data");
        if (dataEl2) {
          const planCopy = JSON.parse(dataEl2.textContent || "{}");
          planCopy.__annotations = state;
          dataEl2.textContent = JSON.stringify(planCopy);
        }
        const html = "<!DOCTYPE html>" + document.documentElement.outerHTML;
        if (dataEl2) dataEl2.textContent = JSON.stringify(plan);

        const blob = new Blob([html], { type: "text/html" });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement("a");
        const slug = (plan.title || "plan").toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
        a.href     = url;
        a.download = slug + "-annotated.html";
        a.click();
        URL.revokeObjectURL(url);
      });
    }
  }

  // ── Theme toggle button ───────────────────────────────────────────
  function initThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function currentTheme() {
      return document.documentElement.getAttribute("data-theme") || "dark";
    }
    function updateLabel() {
      const isLight = currentTheme() === "light";
      btn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
      btn.title = isLight ? "Switch to dark mode" : "Switch to light mode";
    }

    btn.addEventListener("click", function () {
      const next = currentTheme() === "light" ? "dark" : "light";
      applyPref("theme", next);
      updateLabel();
    });

    new MutationObserver(updateLabel).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["data-theme"] }
    );
    updateLabel();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────
  // Centralised keymap — extend here to add or rebind shortcuts in Phase 2+.
  const KEYMAP = {
    navigate_down: ["j", "ArrowDown"],
    navigate_up:   ["k", "ArrowUp"],
    approve:       ["a"],
    strike:        ["s"],
    comment:       ["c"],
  };

  function initKeyboard() {
    const cards = Array.from(document.querySelectorAll(".step-card"));
    let focus = -1;

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (KEYMAP.navigate_down.includes(e.key)) {
        focus = Math.min(focus + 1, cards.length - 1);
        cards[focus] && cards[focus].scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (KEYMAP.navigate_up.includes(e.key)) {
        focus = Math.max(focus - 1, 0);
        cards[focus] && cards[focus].scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (focus >= 0 && cards[focus]) {
        const card = cards[focus];
        if (KEYMAP.approve.includes(e.key))  { card.querySelector(".step-btn.approve") && card.querySelector(".step-btn.approve").click(); }
        if (KEYMAP.strike.includes(e.key))   { card.querySelector(".step-btn.strike")  && card.querySelector(".step-btn.strike").click(); }
        if (KEYMAP.comment.includes(e.key))  { card.querySelector(".step-btn.comment") && card.querySelector(".step-btn.comment").click(); }
      }
    });
  }

  // ── Mermaid (on-demand from CDN) ──────────────────────────────────
  function initMermaid() {
    const hasMermaid = document.querySelector("pre.mermaid");
    if (!hasMermaid) return;

    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js";
    script.onload = function () {
      if (window.mermaid) {
        const isDark = document.documentElement.getAttribute("data-theme") !== "light";
        window.mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "loose",
        });
        window.mermaid.run();
      }
    };
    script.onerror = function () {
      document.querySelectorAll("pre.mermaid").forEach(function (pre) {
        pre.style.fontFamily = "monospace";
        pre.style.whiteSpace = "pre";
        pre.style.color = "var(--text2)";
      });
    };
    document.head.appendChild(script);
  }

  // ── Intersection observer for sidebar active state ────────────────
  function initScrollSpy() {
    const links = document.querySelectorAll("[data-step-sidebar]");
    if (!links.length) return;
    const obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute("data-step-id") ||
                     entry.target.id.replace("step-", "");
          links.forEach(function (l) { l.classList.remove("active"); });
          const active = document.querySelector("[data-step-sidebar='" + id + "']");
          if (active) active.classList.add("active");
        }
      });
    }, { rootMargin: "-40% 0px -50% 0px" });

    document.querySelectorAll(".step-card").forEach(function (card) { obs.observe(card); });
  }

  // ── Init ──────────────────────────────────────────────────────────
  document.addEventListener("DOMContentLoaded", function () {
    buildSidebar();
    initGear();
    initThemeToggle();
    initStepCards();
    initQuestions();
    initBulkActions();
    initFocusMode();
    updateApproveGating();
    initActionBar();
    initKeyboard();
    initMermaid();
    initScrollSpy();
  });
})();
