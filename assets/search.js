// Vanilla search: substring match over title/tags/snippet. Zero deps.
// Expects on the page:
//   <div class="search-wrap">
//     <input id="q" type="search" placeholder="Search runbooks (press /)" />
//     <span class="kbd">/</span>
//     <div id="results" class="search-results" role="listbox"></div>
//   </div>
// And a data attribute on <body data-root="."> giving the relative path
// from this page to the site root (so search-index.json + result URLs resolve).

(function () {
  const root = (document.body.dataset.root || ".").replace(/\/?$/, "/");
  const $q = document.getElementById("q");
  const $r = document.getElementById("results");
  if (!$q || !$r) return;

  // Index is loaded synchronously by a <script src="assets/search-index.js">
  // tag that must appear BEFORE this file. That way search works when the
  // page is opened via file:// (fetch is blocked in that origin).
  let INDEX = Array.isArray(window.SRE_INDEX) ? window.SRE_INDEX : [];
  let items = []; // rendered <a> nodes
  let active = -1;

  if (!INDEX.length) {
    // Fallback for setups that only ship the JSON.
    fetch(root + "assets/search-index.json")
      .then((r) => r.json())
      .then((data) => { INDEX = data; })
      .catch(() => {
        console.warn(
          "[sre-runbook] search index unavailable. " +
          "If you opened the page via file://, add " +
          "<script src=\"" + root + "assets/search-index.js\"></script> " +
          "before search.js, or serve the site (python3 -m http.server)."
        );
      });
  }

  function haystack(entry) {
    return (entry.title + " " + (entry.tags || []).join(" ") + " " + (entry.snippet || "")).toLowerCase();
  }

  function render(matches) {
    $r.innerHTML = "";
    active = -1;
    if (!matches.length) {
      $r.innerHTML = '<div class="empty">No runbooks match.</div>';
      return;
    }
    matches.slice(0, 8).forEach((m, i) => {
      const a = document.createElement("a");
      a.href = root + m.url;
      a.setAttribute("role", "option");
      a.dataset.i = i;
      const tags = (m.tags || []).slice(0, 3)
        .map((t) => `<span class="r-tag">${t}</span>`).join("");
      a.innerHTML =
        `<div class="r-title">${escapeHtml(m.title)}${tags}</div>` +
        (m.snippet ? `<div class="r-snippet">${escapeHtml(m.snippet)}</div>` : "");
      $r.appendChild(a);
    });
    items = Array.from($r.querySelectorAll("a"));
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  }

  function update() {
    const q = $q.value.trim().toLowerCase();
    if (!q) { close(); return; }
    const scored = INDEX
      .map((e) => ({ e, s: score(e, q) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.e);
    render(scored);
    $r.classList.add("open");
  }

  function score(entry, q) {
    const t = entry.title.toLowerCase();
    const h = haystack(entry);
    let s = 0;
    if (t.includes(q)) s += 10;
    if (t.startsWith(q)) s += 5;
    if (h.includes(q)) s += 2;
    // Per-word bonus for space-separated queries.
    q.split(/\s+/).forEach((w) => { if (w && h.includes(w)) s += 1; });
    return s;
  }

  function close() {
    $r.classList.remove("open");
    active = -1;
  }

  function move(delta) {
    if (!items.length) return;
    if (active >= 0) items[active].classList.remove("active");
    active = (active + delta + items.length) % items.length;
    items[active].classList.add("active");
    items[active].scrollIntoView({ block: "nearest" });
  }

  $q.addEventListener("input", update);
  $q.addEventListener("focus", () => { if ($q.value) update(); });
  $q.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter") {
      if (active >= 0) { e.preventDefault(); items[active].click(); }
    } else if (e.key === "Escape") { $q.blur(); close(); }
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".search-wrap")) close();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
    if (e.key === "/") { e.preventDefault(); $q.focus(); }
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      e.preventDefault(); $q.focus();
    }
  });
})();

// --- Theme toggle ---
(function () {
  const $btn = document.getElementById("theme-toggle");
  if (!$btn) return;
  const STORAGE = "sre-runbook-theme";
  try {
    const saved = localStorage.getItem(STORAGE);
    if (saved) document.documentElement.setAttribute("data-theme", saved);
  } catch (_) {}
  $btn.addEventListener("click", () => {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try { localStorage.setItem(STORAGE, next); } catch (_) {}
  });
})();

// --- Last-verified freshness badge ---
// Reads <span class="badge freshness" data-verified="YYYY-MM-DD">…</span>
(function () {
  document.querySelectorAll(".freshness[data-verified]").forEach((el) => {
    const d = new Date(el.dataset.verified);
    if (isNaN(d)) return;
    const days = Math.floor((Date.now() - d.getTime()) / 86400000);
    el.classList.remove("badge-fresh", "badge-amber", "badge-stale");
    if (days < 90) el.classList.add("badge-fresh");
    else if (days < 180) el.classList.add("badge-amber");
    else el.classList.add("badge-stale");
    el.textContent = `Verified ${days}d ago`;
  });
})();
