/* planui actions.js — browser-side interaction, no bundler required (ES2020) */
(function () {
  "use strict";

  // ── Data ──────────────────────────────────────────────────────────
  const dataEl = document.getElementById("planui-data");
  const plan = dataEl ? JSON.parse(dataEl.textContent || "{}") : {};
  const planId = plan.planId || "unknown";
  const STORAGE_KEY = "planui-state-" + planId;

  // State: { steps: { [id]: "approved"|"struck"|"" }, comments: { [id]: string }, questions: { [id]: string } }
  function loadState() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
  }
  function saveState(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }
  let state = loadState();
  if (!state.steps)    state.steps    = {};
  if (!state.comments) state.comments = {};
  if (!state.questions) state.questions = {};

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

      if (kind === "steps" && stepsSection) {
        const label = document.createElement("div");
        label.className = "sidebar-label";
        label.textContent = heading.textContent || "Steps";
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
        link.textContent = heading.textContent || kind;
        div.appendChild(link);
        sidebar.appendChild(div);
      }
    });
  }

  // ── Gear menu (theme/font/color) ──────────────────────────────────
  function resolveTheme(pref) {
    if (pref !== "system") return pref;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  function initGear() {
    const btn = document.getElementById("gear-btn");
    const menu = document.getElementById("gear-menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      menu.classList.toggle("open");
    });
    document.addEventListener("click", function () { menu.classList.remove("open"); });

    function applyPref(attr, val) {
      const resolved = attr === "theme" ? resolveTheme(val) : val;
      document.documentElement.setAttribute("data-" + attr, resolved);
      try { localStorage.setItem("planui-pref-" + attr, val); } catch {}
    }

    // Restore saved prefs; default theme to system preference if never set
    ["theme", "font", "color"].forEach(function (attr) {
      const saved = (function () {
        try { return localStorage.getItem("planui-pref-" + attr); } catch { return null; }
      })();
      const defaultVal = document.documentElement.getAttribute("data-" + attr);
      const sel = document.getElementById("gear-" + attr);
      if (saved) {
        applyPref(attr, saved);
        if (sel) sel.value = saved;
      } else if (attr === "theme") {
        applyPref("theme", "system");
        if (sel) sel.value = "system";
      } else if (defaultVal && sel) {
        sel.value = defaultVal;
      }
      if (sel) {
        sel.addEventListener("change", function () { applyPref(attr, sel.value); });
      }
    });

    // Re-apply when OS colour scheme changes (only matters if "system" is selected)
    window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", function () {
      try {
        const saved = localStorage.getItem("planui-pref-theme") || "system";
        if (saved === "system") applyPref("theme", "system");
      } catch {}
    });
  }

  // ── Step cards ────────────────────────────────────────────────────
  function applyStepState(card, id) {
    const s = state.steps[id] || "";
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
      sidebarLink.classList.toggle("done",  s === "approved");
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
      const approveBtn = card.querySelector(".step-btn.approve");
      if (approveBtn) {
        approveBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          state.steps[id] = state.steps[id] === "approved" ? "" : "approved";
          saveState(state);
          applyStepState(card, id);
          updateBarStatus();
        });
      }

      // Strike button
      const strikeBtn = card.querySelector(".step-btn.strike");
      if (strikeBtn) {
        strikeBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          state.steps[id] = state.steps[id] === "struck" ? "" : "struck";
          saveState(state);
          applyStepState(card, id);
          updateBarStatus();
        });
      }

      // Comment button
      const commentBtn = card.querySelector(".step-btn.comment");
      if (commentBtn) {
        commentBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          const prev = state.steps[id];
          state.steps[id] = prev === "commenting" ? "" : "commenting";
          saveState(state);
          applyStepState(card, id);
          const ta = card.querySelector(".step-comment-area textarea");
          if (ta && state.steps[id] === "commenting") ta.focus();
        });
      }

      // Save comment text
      if (textarea) {
        textarea.addEventListener("input", function () {
          state.comments[id] = textarea.value;
          saveState(state);
          const btn = card.querySelector(".step-btn.comment");
          if (btn) btn.classList.toggle("active", !!textarea.value);
        });
      }
    });
  }

  // ── Questions ─────────────────────────────────────────────────────
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
          saveState(state);
          ta.classList.toggle("answered", !!ta.value);
          updateApproveGating();
        });
      } else if (chipGroup) {
        // Restore saved chip selection
        if (state.questions[qid]) {
          const inputs = chipGroup.querySelectorAll("input[type=radio]");
          inputs.forEach(function (inp) {
            if (inp.value === state.questions[qid]) inp.checked = true;
          });
        }
        chipGroup.addEventListener("change", function (e) {
          const radio = e.target;
          if (radio && radio.type === "radio") {
            state.questions[qid] = radio.value;
            saveState(state);
            updateApproveGating();
          }
        });
      }
    });
  }

  // ── Approve gating ────────────────────────────────────────────────
  function updateApproveGating() {
    const approveBtn = document.getElementById("approve-btn");
    const warning    = document.getElementById("questions-warning");
    if (!approveBtn) return;
    const qCards = document.querySelectorAll(".question-card");
    const unanswered = Array.from(qCards).filter(function (card) {
      const qid = card.getAttribute("data-qid");
      return !(qid && state.questions[qid] && state.questions[qid].trim());
    }).length;
    const allAnswered = unanswered === 0;
    approveBtn.disabled = !allAnswered;
    approveBtn.title = allAnswered ? "" : "Answer all open questions before approving";
    if (warning) {
      if (unanswered > 0 && qCards.length > 0) {
        warning.textContent = unanswered + " unanswered question" + (unanswered !== 1 ? "s" : "");
        warning.style.display = "inline-block";
      } else {
        warning.style.display = "none";
      }
    }
  }

  // ── Bar status + progress ─────────────────────────────────────────
  function updateBarStatus() {
    const el   = document.getElementById("bar-status");
    const fill = document.getElementById("progress-fill");
    const stepCards = document.querySelectorAll(".step-card");
    if (!stepCards.length) {
      if (el) el.textContent = "";
      if (fill) fill.style.width = "0%";
      return;
    }
    const resolved = Array.from(stepCards).filter(function (c) {
      const s = state.steps[c.getAttribute("data-step-id")];
      return s === "approved" || s === "struck";
    }).length;
    const approved = Array.from(stepCards).filter(function (c) {
      return state.steps[c.getAttribute("data-step-id")] === "approved";
    }).length;
    if (el) el.textContent = approved + " / " + stepCards.length + " steps approved";
    if (fill) fill.style.width = (resolved / stepCards.length * 100) + "%";
  }

  // ── Copy feedback ─────────────────────────────────────────────────
  function buildFeedback() {
    const lines = [];
    lines.push("```planresponse " + planId);

    // Determine action
    const allApproved = Array.from(document.querySelectorAll(".step-card")).every(function (c) {
      const id = c.getAttribute("data-step-id");
      return state.steps[id] === "approved";
    });
    const hasComments = Object.values(state.comments).some(Boolean);
    const action = (hasComments || !allApproved) ? "modify" : "approve";
    lines.push(action);

    // Questions
    document.querySelectorAll(".question-card").forEach(function (card) {
      const qid = card.getAttribute("data-qid");
      const val = (qid && state.questions[qid]) ? state.questions[qid].trim() : "(no answer)";
      const textEl = card.querySelector(".question-text");
      lines.push((qid || "q") + ": " + val);
    });

    // Step annotations
    const annotations = [];
    document.querySelectorAll(".step-card").forEach(function (card) {
      const id = card.getAttribute("data-step-id");
      if (!id) return;
      const stepState = state.steps[id] || "";
      const comment   = state.comments[id] || "";
      const titleEl   = card.querySelector(".step-title");
      const num       = card.getAttribute("data-step-index") || "?";
      const title     = titleEl ? titleEl.textContent.trim() : id;
      if (stepState === "struck") {
        annotations.push("Step " + num + " [remove]: " + title);
      } else if (comment) {
        annotations.push("Step " + num + " [feedback]: " + comment);
      }
    });

    if (annotations.length) {
      lines.push("");
      lines.push("feedback:");
      annotations.forEach(function (a) { lines.push("  " + a); });
    }

    lines.push("```");
    return lines.join("\n");
  }

  function initActionBar() {
    const copyBtn   = document.getElementById("copy-feedback-btn");
    const approveBtn = document.getElementById("approve-btn");
    const exportBtn  = document.getElementById("export-btn");
    const confirm   = document.getElementById("copy-confirm");

    if (copyBtn) {
      copyBtn.addEventListener("click", function () {
        const text = buildFeedback();
        navigator.clipboard.writeText(text).then(function () {
          if (confirm) {
            confirm.style.display = "inline";
            setTimeout(function () { confirm.style.display = "none"; }, 2000);
          }
        }).catch(function () {
          // Fallback for non-HTTPS
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
          if (confirm) {
            confirm.style.display = "inline";
            setTimeout(function () { confirm.style.display = "none"; }, 2000);
          }
        });
      });
    }

    if (approveBtn) {
      approveBtn.addEventListener("click", function () {
        // Build approve response and copy
        const lines = [];
        lines.push("```planresponse " + planId);
        lines.push("approve");
        document.querySelectorAll(".question-card").forEach(function (card) {
          const qid = card.getAttribute("data-qid");
          const val = (qid && state.questions[qid]) ? state.questions[qid].trim() : "";
          if (qid) lines.push(qid + ": " + val);
        });
        lines.push("```");
        const text = lines.join("\n");
        navigator.clipboard.writeText(text).catch(function () {
          const ta = document.createElement("textarea");
          ta.value = text; ta.style.position = "fixed"; ta.style.opacity = "0";
          document.body.appendChild(ta); ta.select(); document.execCommand("copy");
          document.body.removeChild(ta);
        });
        if (confirm) {
          confirm.textContent = "Approval copied!";
          confirm.style.display = "inline";
          setTimeout(function () { confirm.style.display = "none"; confirm.textContent = "Copied!"; }, 2500);
        }
      });
    }

    if (exportBtn) {
      exportBtn.addEventListener("click", function () {
        // Embed current state into the page's data island and download
        const dataEl2 = document.getElementById("planui-data");
        if (dataEl2) {
          const planCopy = JSON.parse(dataEl2.textContent || "{}");
          planCopy.__annotations = state;
          dataEl2.textContent = JSON.stringify(planCopy);
        }
        const html = "<!DOCTYPE html>" + document.documentElement.outerHTML;
        // Restore original
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
  var SVG_SUN  = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  var SVG_MOON = '<svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function initThemeToggle() {
    const btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function currentTheme() {
      return document.documentElement.getAttribute("data-theme") || "dark";
    }

    function updateBtn() {
      const isLight = currentTheme() === "light";
      btn.innerHTML = isLight ? SVG_MOON : SVG_SUN;
      btn.setAttribute("aria-label", isLight ? "Switch to dark mode" : "Switch to light mode");
      btn.title = isLight ? "Switch to dark mode" : "Switch to light mode";
    }

    btn.addEventListener("click", function () {
      const next = currentTheme() === "light" ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("planui-pref-theme", next); } catch {}
      const sel = document.getElementById("gear-theme");
      if (sel) sel.value = next;
      updateBtn();
    });

    new MutationObserver(updateBtn).observe(
      document.documentElement,
      { attributes: true, attributeFilter: ["data-theme"] }
    );

    updateBtn();
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────
  function initKeyboard() {
    const cards = Array.from(document.querySelectorAll(".step-card"));
    let focus = -1;

    document.addEventListener("keydown", function (e) {
      if (e.target.tagName === "TEXTAREA" || e.target.tagName === "INPUT") return;
      if (e.key === "j" || e.key === "ArrowDown") {
        focus = Math.min(focus + 1, cards.length - 1);
        cards[focus] && cards[focus].scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (e.key === "k" || e.key === "ArrowUp") {
        focus = Math.max(focus - 1, 0);
        cards[focus] && cards[focus].scrollIntoView({ behavior: "smooth", block: "nearest" });
      } else if (focus >= 0 && cards[focus]) {
        const card = cards[focus];
        const id   = card.getAttribute("data-step-id");
        if (!id) return;
        if (e.key === "a") { card.querySelector(".step-btn.approve") && card.querySelector(".step-btn.approve").click(); }
        if (e.key === "s") { card.querySelector(".step-btn.strike")  && card.querySelector(".step-btn.strike").click(); }
        if (e.key === "c") { card.querySelector(".step-btn.comment") && card.querySelector(".step-btn.comment").click(); }
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
      // Fallback: show raw source
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
    updateApproveGating();
    updateBarStatus();
    initActionBar();
    initKeyboard();
    initMermaid();
    initScrollSpy();
  });
})();
