// ============================================================
// Paste in F12 Console on your OPEN PLAYLIST / song list page
// ▶ Download This Playlist — scrolls list, downloads every song as MP3, stops when done
// Shows green click ring + cursor on each automated click
// ============================================================

(function sunoDownloadMain() {
  const LOADER_VERSION = 13;

  if (!/suno\.com/i.test(location.href)) {
    alert("Open your Suno workspace page first.");
    return;
  }

  try {
    const ver = Number(sessionStorage.getItem("suno-bm-loader-ver") || 0);
    if (ver < LOADER_VERSION) {
      sessionStorage.removeItem("suno-bm-loader");
      sessionStorage.removeItem("suno-bm-autorun");
      sessionStorage.setItem("suno-bm-loader-ver", String(LOADER_VERSION));
    }
  } catch (_) {}

  const bootTs = Number(sessionStorage.getItem("suno-bm-last-boot") || 0);
  if (Date.now() - bootTs < 2500 && document.getElementById("suno-bm-panel")) return;
  sessionStorage.setItem("suno-bm-last-boot", String(Date.now()));

  document.getElementById("suno-bm-panel")?.remove();

  const CFG = {
    pollMs: 150,
    minSettleMs: 250,
    maxSettleMs: 700,
    cardReadyTimeout: 12000,
    menuOpenTimeout: 12000,
    wavSubmenuTimeout: 12000,
    hoverStepMs: 150,
    wavModalTimeout: 20000,
    modalCloseTimeout: 15000,
    scrollSettleTimeout: 2500,
    scrollLoadTimeout: 10000,
    scrollStep: 130,
    smartSkipRows: 6,
    smartSkipPageRatio: 0.72,
    scrollLoadRetries: 3,
    bottomStableNeeded: 6,
    seenKey: "suno-bm-seen",
    failedKey: "suno-bm-failed",
    scrollPosKey: "suno-bm-scroll",
    maxFailsPerSong: 2,
    menuWaitTimeout: 15000,
    pageLoadWait: 35000,
    doneKey: "suno-bm-done",
    statsKey: "suno-bm-stats",
    planKey: "suno-bm-plan",
    autorunKey: "suno-bm-autorun",
    logKey: "suno-bm-logs",
    listMetaKey: "suno-bm-list-meta",
    playlistsDoneKey: "suno-bm-playlists-done",
    maxLogEntries: 800,
    panelUiKey: "suno-bm-panel-ui",
    playlistsStoreKey: "suno-bm-playlists-v1",
    activePlaylistKey: "suno-bm-active-pl",
    downloadFormat: "MP3",
    clipMode: "one-title", // one-title avoids Windows (1)(2) duplicates from same title
  };

  function getDelayPanelUi() {
    try {
      return JSON.parse(sessionStorage.getItem(CFG.panelUiKey) || "{}");
    } catch (_) {
      return {};
    }
  }

  function saveDelayPanelUi(patch) {
    try {
      sessionStorage.setItem(CFG.panelUiKey, JSON.stringify({ ...getDelayPanelUi(), ...patch }));
    } catch (_) {}
  }

  function applyDelaysFromPanel() {
    const num = (id, fallback) => Number(document.getElementById(id)?.value ?? fallback);
    CFG.menuOpenTimeout = Math.max(3000, num("suno-bm-delay-menu", 12) * 1000);
    CFG.wavSubmenuTimeout = Math.max(3000, num("suno-bm-delay-wav", 12) * 1000);
    CFG.hoverStepMs = Math.max(50, num("suno-bm-delay-hover-step", 0.15) * 1000);
    CFG.wavModalTimeout = Math.max(5000, num("suno-bm-delay-modal", 20) * 1000);
    CFG.minSettleMs = Math.max(100, num("suno-bm-delay-settle", 0.25) * 1000);
    CFG.maxSettleMs = Math.max(CFG.minSettleMs + 100, num("suno-bm-delay-settle-max", 0.7) * 1000);
    const fmt = document.getElementById("suno-bm-format")?.value;
    if (fmt && /^(MP3|WAV|M4A)$/i.test(fmt)) CFG.downloadFormat = fmt.toUpperCase();
    const clip = document.getElementById("suno-bm-clip-mode")?.value;
    if (clip === "both" || clip === "one-title") CFG.clipMode = clip;
  }

  function restoreDelayPanelUi() {
    const ui = getDelayPanelUi();
    const set = (id, key) => {
      const el = document.getElementById(id);
      if (el && ui[key] != null) el.value = ui[key];
    };
    set("suno-bm-delay-menu", "menu");
    set("suno-bm-delay-wav", "wav");
    set("suno-bm-delay-hover-step", "hoverStep");
    set("suno-bm-delay-modal", "modal");
    set("suno-bm-delay-settle", "settle");
    set("suno-bm-delay-settle-max", "settleMax");
    const fmt = document.getElementById("suno-bm-format");
    if (fmt && ui.format) fmt.value = ui.format;
    const clip = document.getElementById("suno-bm-clip-mode");
    if (clip && ui.clipMode) clip.value = ui.clipMode;
    const delays = document.getElementById("suno-bm-delays");
    const wavSection = document.getElementById("suno-bm-delay-wav-section");
    if (delays && ui.delaysOpen != null) delays.open = !!ui.delaysOpen;
    if (wavSection && ui.wavOpen != null) wavSection.open = !!ui.wavOpen;
    applyDelaysFromPanel();
  }

  function bindDelayPanelUi() {
    const fields = [
      ["suno-bm-delay-menu", "menu"],
      ["suno-bm-delay-wav", "wav"],
      ["suno-bm-delay-hover-step", "hoverStep"],
      ["suno-bm-delay-modal", "modal"],
      ["suno-bm-delay-settle", "settle"],
      ["suno-bm-delay-settle-max", "settleMax"],
    ];
    fields.forEach(([id, key]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("change", () => {
        saveDelayPanelUi({ [key]: el.value });
        applyDelaysFromPanel();
      });
    });
    document.getElementById("suno-bm-format")?.addEventListener("change", (e) => {
      saveDelayPanelUi({ format: e.target.value });
      applyDelaysFromPanel();
    });
    document.getElementById("suno-bm-clip-mode")?.addEventListener("change", (e) => {
      saveDelayPanelUi({ clipMode: e.target.value });
      applyDelaysFromPanel();
    });
    document.getElementById("suno-bm-delays")?.addEventListener("toggle", (e) => {
      saveDelayPanelUi({ delaysOpen: e.target.open });
    });
    document.getElementById("suno-bm-delay-wav-section")?.addEventListener("toggle", (e) => {
      saveDelayPanelUi({ wavOpen: e.target.open });
    });
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = (ms = CFG.minSettleMs) => sleep(ms + Math.floor(Math.random() * 120));

  function isTabVisible() {
    return document.visibilityState === "visible" && !document.hidden;
  }

  async function waitIfTabHidden() {
    if (isTabVisible()) return;
    statusMsg("Paused — switch back to this Suno tab to continue downloads");
    log("tab hidden — waiting for focus (Chrome throttles background tabs)");
    while (!window.__sunoBmStop && !isTabVisible()) {
      await sleep(500);
    }
    if (window.__sunoBmStop) return;
    statusMsg("Tab focused again — resuming…");
    await settle(CFG.maxSettleMs);
  }

  function getLogs() {
    return JSON.parse(sessionStorage.getItem(CFG.logKey) || "[]");
  }

  function saveLogs(entries) {
    sessionStorage.setItem(CFG.logKey, JSON.stringify(entries.slice(-CFG.maxLogEntries)));
  }

  function appendLog(level, ...parts) {
    const msg = parts
      .map((p) => {
        if (p == null) return "";
        if (typeof p === "object") {
          try {
            return JSON.stringify(p);
          } catch (_) {
            return String(p);
          }
        }
        return String(p);
      })
      .filter(Boolean)
      .join(" ");
    const entries = getLogs();
    entries.push({ t: new Date().toISOString(), level, msg });
    saveLogs(entries);
    return msg;
  }

  function exportLogsText() {
    const logs = getLogs();
    const stats = getStats();
    const header = [
      "Suno MP3 Download log",
      `Exported: ${new Date().toISOString()}`,
      `URL: ${location.href}`,
      `Saved: ${getDoneSet().size} · Seen: ${getSeenSet().size} · Errors: ${stats.errors}`,
      "---",
    ].join("\n");
    const body = logs.map((e) => `${e.t} [${e.level}] ${e.msg}`).join("\n");
    return header + "\n" + body;
  }

  async function copyLogs() {
    const text = exportLogsText();
    await navigator.clipboard.writeText(text);
    statusMsg(`Copied ${getLogs().length} log lines`);
  }

  function downloadLogFile() {
    const blob = new Blob([exportLogsText()], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `suno-dl-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    statusMsg(`Saved log file (${getLogs().length} lines)`);
  }

  function clearLogs() {
    sessionStorage.removeItem(CFG.logKey);
    refreshPanel("Logs cleared");
  }

  function log(...a) {
    const msg = appendLog("info", ...a);
    console.log("[SunoDL]", msg);
  }

  function logError(...a) {
    const msg = appendLog("error", ...a);
    console.error("[SunoDL]", msg);
  }

  function elementPos(el, label) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const pos = {
      label: label || buttonLabel(el) || menuItemLabel(el) || el.tagName,
      x: Math.round(r.left),
      y: Math.round(r.top),
      w: Math.round(r.width),
      h: Math.round(r.height),
      cx: Math.round(r.left + r.width / 2),
      cy: Math.round(r.top + r.height / 2),
    };
    appendLog("pos", JSON.stringify(pos));
    return pos;
  }

  let fakeCursorEl = null;

  function ensureClickStyles() {
    if (document.getElementById("suno-bm-click-styles")) return;
    const s = document.createElement("style");
    s.id = "suno-bm-click-styles";
    s.textContent = `@keyframes suno-bm-click-ring{0%{transform:translate(-50%,-50%) scale(.35);opacity:1}100%{transform:translate(-50%,-50%) scale(1.7);opacity:0}}`;
    document.body.appendChild(s);
  }

  function ensureFakeCursor() {
    ensureClickStyles();
    if (fakeCursorEl) return fakeCursorEl;
    fakeCursorEl = document.createElement("div");
    fakeCursorEl.id = "suno-bm-fake-cursor";
    fakeCursorEl.style.cssText =
      "position:fixed;z-index:2147483646;width:12px;height:12px;border:2px solid #fff;border-radius:50%;background:#22c55e;box-shadow:0 0 0 4px rgba(34,197,94,.45);pointer-events:none;transform:translate(-50%,-50%);transition:left .1s ease,top .1s ease;opacity:0";
    document.body.appendChild(fakeCursorEl);
    return fakeCursorEl;
  }

  function showClickFeedback(cx, cy, label) {
    const x = Math.round(cx);
    const y = Math.round(cy);
    const cursor = ensureFakeCursor();
    cursor.style.left = `${x}px`;
    cursor.style.top = `${y}px`;
    cursor.style.opacity = "1";
    const ring = document.createElement("div");
    ring.style.cssText = `position:fixed;left:${x}px;top:${y}px;width:34px;height:34px;border:3px solid #22c55e;border-radius:50%;pointer-events:none;z-index:2147483647;animation:suno-bm-click-ring .55s ease-out forwards;box-shadow:0 0 14px rgba(34,197,94,.6)`;
    document.body.appendChild(ring);
    setTimeout(() => ring.remove(), 650);
    if (label) log("click", label, "at", x, y);
  }

  let stopBtn;
  let ui = {};
  let panelMeta = { currentSong: "—", currentStep: "Idle" };

  const IGNORE_LIST_NAMES = /^(auto|create|library|home|search|notifications|labs|earn credits|hooks|profile)$/i;

  function isBadListName(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 50 || t.length < 2) return true;
    if (IGNORE_LIST_NAMES.test(t)) return true;
    if (/notification/i.test(t)) return true;
    if (/here yet/i.test(t)) return true;
    if (/^no /i.test(t)) return true;
    if (/^earn /i.test(t)) return true;
    return false;
  }

  function getBreadcrumbListName() {
    for (const el of document.querySelectorAll("a, span, div, h1, h2, p, nav *")) {
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!/Workspaces?\s*[>›]/i.test(t) || t.length > 80) continue;
      const parts = t.split(/[>›]/).map((s) => s.trim()).filter(Boolean);
      const last = parts[parts.length - 1];
      if (last && !/^Workspaces?$/i.test(last) && !isBadListName(last)) {
        return last.slice(0, 40);
      }
    }

    let afterWorkspace = false;
    for (const el of document.querySelectorAll("nav a, nav span, header a, header span, a, span")) {
      const r = el.getBoundingClientRect();
      if (r.top > 200 || r.width < 10) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t || t.length > 40) continue;
      if (/^Workspaces?$/i.test(t)) {
        afterWorkspace = true;
        continue;
      }
      if (afterWorkspace && !isBadListName(t)) {
        return t.slice(0, 40);
      }
    }

    for (const el of document.querySelectorAll("h1, h2, span, a")) {
      const r = el.getBoundingClientRect();
      if (r.top > 180 || r.left < 300 || r.width < 20) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (/^My Workspace$/i.test(t)) return t;
    }

    return null;
  }

  function getHeaderListName() {
    for (const el of document.querySelectorAll("h1, h2, h3, span, div, a")) {
      const r = el.getBoundingClientRect();
      if (r.top > 220 || r.width < 20 || r.height < 8) continue;
      if (r.left < 280) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (isBadListName(t)) continue;
      if (/\d+\s*Songs?\b/i.test(t)) continue;
      if (/Workspaces?\s*[>›]/i.test(t)) continue;
      if (el.querySelector("button, [role='menu'], [role='rowgroup']")) continue;
      if (/^My Workspace$/i.test(t) || /workspace/i.test(t) || /\s/.test(t)) {
        return t.slice(0, 40);
      }
    }
    return null;
  }

  function getListLabel() {
    const crumb = getBreadcrumbListName();
    if (crumb) return crumb;

    const header = getHeaderListName();
    if (header) return header;

    const selected = document.querySelector(
      '[aria-selected="true"] [class*="title"], [aria-current="true"], [data-selected="true"]'
    );
    if (selected?.textContent?.trim()) {
      const t = selected.textContent.trim().slice(0, 40);
      if (!isBadListName(t)) return t;
    }

    const wid = new URL(location.href).searchParams.get("wid");
    return wid ? `Workspace ${wid.slice(0, 8)}…` : "Current song list";
  }

  function getListSongCount() {
    const label = getListLabel();
    let best = null;
    let bestScore = Infinity;

    for (const el of document.querySelectorAll("h1,h2,h3,h4,span,div,p,a,button")) {
      const r = el.getBoundingClientRect();
      if (r.top > 420 || r.width < 16 || r.height < 8) continue;
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (t.length > 120 || t.length < 3) continue;
      const m = t.match(/(\d[\d,]*)\s*Songs?\b/i);
      if (!m) continue;
      const n = parseInt(m[1].replace(/,/g, ""), 10);
      if (!n || n <= 0) continue;
      let score = r.top * 2 + r.left * 0.05 + t.length;
      if (label && new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(t)) score -= 800;
      if (label && t.toLowerCase().includes(label.toLowerCase().slice(0, 12))) score -= 400;
      if (score < bestScore) {
        bestScore = score;
        best = n;
      }
    }
    return best;
  }

  function getListMeta() {
    return {
      name: getListLabel(),
      expectedCount: getListSongCount(),
      wid: new URL(location.href).searchParams.get("wid"),
    };
  }

  function getPlaylistKey() {
    const url = new URL(location.href);
    const raw = [
      url.pathname,
      url.searchParams.get("wid") || "",
      url.searchParams.get("page") || "",
      url.searchParams.get("pl") || "",
      url.searchParams.get("playlist") || "",
    ].join("|");
    let h = 0;
    for (let i = 0; i < raw.length; i++) h = ((h << 5) - h + raw.charCodeAt(i)) | 0;
    return `pl_${(h >>> 0).toString(36)}`;
  }

  function getPlaylistUrlSignature() {
    const url = new URL(location.href);
    return [url.pathname, url.searchParams.get("wid") || "", url.searchParams.get("page") || ""].join("|");
  }

  function getStorageKey() {
    return lockedPlaylistKey || sessionStorage.getItem(CFG.activePlaylistKey) || getPlaylistKey();
  }

  function getPlaylistStore() {
    try {
      return JSON.parse(localStorage.getItem(CFG.playlistsStoreKey) || "{}");
    } catch (_) {
      return {};
    }
  }

  function savePlaylistStore(store) {
    try {
      localStorage.setItem(CFG.playlistsStoreKey, JSON.stringify(store));
    } catch (err) {
      logError("localStorage save failed", err.message);
    }
  }

  function defaultPlaylistRecord(meta) {
    return {
      meta: meta || getListMeta(),
      done: [],
      doneTitles: [],
      seen: [],
      failed: {},
      stats: { downloaded: 0, skipped: 0, errors: 0, pagesDone: 0 },
      scroll: 0,
      complete: false,
      completedAt: null,
      updatedAt: Date.now(),
    };
  }

  function getPlaylistRecord(key = getStorageKey()) {
    const store = getPlaylistStore();
    if (!store[key]) {
      store[key] = defaultPlaylistRecord(getListMeta());
      savePlaylistStore(store);
    }
    return store[key];
  }

  function updatePlaylistRecord(key, patch) {
    const store = getPlaylistStore();
    const prev = store[key] || defaultPlaylistRecord(getListMeta());
    store[key] = {
      ...prev,
      ...patch,
      meta: { ...prev.meta, ...(patch.meta || {}) },
      updatedAt: Date.now(),
    };
    savePlaylistStore(store);
    return store[key];
  }

  function resetPlaylistRecord(key = getStorageKey()) {
    const store = getPlaylistStore();
    delete store[key];
    savePlaylistStore(store);
  }

  function isPlaylistMarkedDone(key = getStorageKey()) {
    return !!getPlaylistRecord(key).complete;
  }

  function reconcilePlaylistRecords() {
    const url = new URL(location.href);
    const wid = url.searchParams.get("wid");
    if (!wid) return;
    const store = getPlaylistStore();
    const currentKey = getPlaylistKey();
    let merged = { ...getPlaylistRecord(currentKey) };
    let changed = false;
    for (const [key, rec] of Object.entries(store)) {
      if (key === currentKey || rec.meta?.wid !== wid) continue;
      merged.done = [...new Set([...(merged.done || []), ...(rec.done || [])])];
      merged.seen = [...new Set([...(merged.seen || []), ...(rec.seen || [])])];
      merged.failed = { ...(rec.failed || {}), ...(merged.failed || {}) };
      merged.complete = !!(merged.complete || rec.complete);
      if (rec.completedAt && !merged.completedAt) merged.completedAt = rec.completedAt;
      delete store[key];
      changed = true;
    }
    if (changed) {
      store[currentKey] = merged;
      savePlaylistStore(store);
      log("merged old playlist memory for workspace", wid.slice(0, 8));
    }
  }

  function migrateLegacySessionStorage() {
    const key = getStorageKey();
    const rec = getPlaylistRecord(key);
    if (rec.done.length || rec.seen.length) return;

    const done = sessionStorage.getItem(CFG.doneKey);
    if (!done) return;

    try {
      updatePlaylistRecord(key, {
        done: JSON.parse(done),
        seen: JSON.parse(sessionStorage.getItem(CFG.seenKey) || "[]"),
        failed: JSON.parse(sessionStorage.getItem(CFG.failedKey) || "{}"),
        stats: JSON.parse(
          sessionStorage.getItem(CFG.statsKey) || '{"downloaded":0,"skipped":0,"errors":0,"pagesDone":0}'
        ),
        scroll: Number(sessionStorage.getItem(CFG.scrollPosKey) || 0),
        meta: JSON.parse(sessionStorage.getItem(CFG.listMetaKey) || "null") || getListMeta(),
      });
      log("migrated session data → playlist", key);
    } catch (_) {}
  }

  function getScrollPos(key = getStorageKey()) {
    return Number(getPlaylistRecord(key).scroll || 0);
  }

  function saveScrollPos(top, key = getStorageKey()) {
    updatePlaylistRecord(key, { scroll: top });
  }

  function getSavedListMeta() {
    const live = getListMeta();
    try {
      const saved = getPlaylistRecord(getStorageKey()).meta || {};
      const name = isBadListName(saved.name) ? live.name : saved.name || live.name;
      let expectedCount = saved.expectedCount || live.expectedCount;
      if (saved.expectedCount && live.expectedCount && live.expectedCount > saved.expectedCount * 2) {
        expectedCount = saved.expectedCount;
      }
      return { ...live, ...saved, name, expectedCount };
    } catch (_) {
      return live;
    }
  }

  function saveListMeta() {
    const live = getListMeta();
    const prev = getPlaylistRecord(getStorageKey()).meta || {};
    let expectedCount = live.expectedCount;
    if (prev.expectedCount && expectedCount && expectedCount > prev.expectedCount * 2) {
      expectedCount = prev.expectedCount;
    }
    const meta = { ...live, expectedCount, savedAt: Date.now() };
    if (isBadListName(meta.name)) {
      const crumb = getBreadcrumbListName();
      meta.name = crumb || (meta.wid ? `Workspace ${meta.wid.slice(0, 8)}…` : "Current song list");
    }
    updatePlaylistRecord(getStorageKey(), { meta });
    sessionStorage.setItem(CFG.listMetaKey, JSON.stringify(meta));
    sessionStorage.setItem("suno-bm-list-label", meta.name);
    log("list meta", meta.name, meta.expectedCount ? `${meta.expectedCount} songs` : "count unknown");
    return meta;
  }

  function getSavedListLabel() {
    return getSavedListMeta().name || getListLabel();
  }

  function getCompletedPlaylists() {
    return Object.values(getPlaylistStore())
      .filter((rec) => rec.complete)
      .map((rec) => ({
        name: rec.meta?.name,
        expectedCount: rec.meta?.expectedCount,
        seenCount: rec.seen?.length || 0,
        savedCount: rec.done?.length || 0,
        completedAt: rec.completedAt,
      }))
      .filter((p) => p.name);
  }

  function markPlaylistComplete(meta, seenCount, savedCount) {
    const entry = {
      name: meta.name,
      expectedCount: meta.expectedCount,
      seenCount,
      savedCount,
      completedAt: new Date().toISOString(),
    };
    updatePlaylistRecord(getStorageKey(), {
      complete: true,
      completedAt: entry.completedAt,
      meta,
    });
    log("playlist complete", entry);
    return entry;
  }

  function playlistDoneMessage(name) {
    return (
      `✓ Playlist finished: "${name}"\n\n` +
      `All songs in THIS playlist are saved — nothing will download twice.\n\n` +
      `STOPPED. The script does not move on to another playlist.\n` +
      `Move MP3 files into this playlist's folder now.\n\n` +
      `To download a different playlist: open it yourself in Suno, paste the script, click Download.\n\n` +
      `To run this same playlist again: click Reset playlist first.`
    );
  }

  let lockedPlaylistKey = null;
  let lockedUrlSignature = null;

  function lockPlaylistForRun() {
    lockedPlaylistKey = getPlaylistKey();
    lockedUrlSignature = getPlaylistUrlSignature();
    sessionStorage.setItem(CFG.activePlaylistKey, lockedPlaylistKey);
  }

  function assertSamePlaylist() {
    if (lockedUrlSignature && getPlaylistUrlSignature() !== lockedUrlSignature) {
      window.__sunoBmStop = true;
      clearAutorun();
      setRunning(false);
      lockedPlaylistKey = null;
      lockedUrlSignature = null;
      alert(
        `Stopped — you left this playlist page.\n\n` +
          `Open the same playlist again and click Resume.`
      );
      refreshPanel("Stopped — left playlist page");
      return false;
    }
    return true;
  }

  function getTargetSongCount(meta, seenSet) {
    if (!meta.expectedCount) return null;
    if (seenSet.size >= 3 && meta.expectedCount > Math.max(seenSet.size * 4, 200)) {
      return null;
    }
    return meta.expectedCount;
  }

  function canFinishPlaylist(meta, doneSet, seenSet) {
    if (!isPlaylistFullyComplete(meta, doneSet, seenSet)) return false;
    const target = getTargetSongCount(meta, seenSet);
    if (target && seenSet.size < target) return false;
    return true;
  }

  function blockIfPlaylistDone() {
    const key = getStorageKey();
    const meta = getSavedListMeta();
    const rec = getPlaylistRecord(key);
    if (!rec.complete) return false;

    const doneSet = new Set(rec.done || []);
    const seenSet = new Set(rec.seen || []);
    if (!canFinishPlaylist(meta, doneSet, seenSet)) {
      updatePlaylistRecord(key, { complete: false, completedAt: null });
      log("cleared stale DONE flag — playlist not actually complete");
      return false;
    }

    alert(playlistDoneMessage(meta.name));
    refreshPanel("DONE — move files to folder");
    return true;
  }

  function countSavedInSeen(doneSet, seenSet) {
    let n = 0;
    for (const id of seenSet) {
      if (doneSet.has(id)) n++;
    }
    return n;
  }

  function isPlaylistFullyComplete(meta, doneSet, seenSet) {
    const left = countUnseenUndone(doneSet, seenSet);
    if (left > 0) return false;
    const saved = countSavedInSeen(doneSet, seenSet);
    const target = getTargetSongCount(meta, seenSet);
    if (target) {
      return saved >= target && seenSet.size >= target;
    }
    return seenSet.size > 0 && saved === seenSet.size;
  }

  function playlistProgressLine(meta, doneSet, seenSet) {
    const saved = countSavedInSeen(doneSet, seenSet);
    const seen = seenSet.size;
    const target = getTargetSongCount(meta, seenSet) || meta.expectedCount;
    if (target) {
      return `${saved}/${target} saved · ${seen} seen in list`;
    }
    return `${saved}/${seen} saved in this list`;
  }

  function estimateSecondsPerSong() {
    return 12;
  }

  function formatEta(seconds) {
    if (!seconds || seconds < 60) return `<1 min`;
    const m = Math.ceil(seconds / 60);
    if (m < 60) return `~${m} min`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm ? `~${h}h ${rm}m` : `~${h}h`;
  }

  function countFailedPending() {
    const done = getDoneSet();
    const seen = getSeenSet();
    return Object.keys(getFailedMap()).filter((id) => seen.has(id) && !done.has(id)).length;
  }

  function parseStatusMeta(text) {
    if (!text) return;
    const dl = text.match(/· ([^·\n]+?) · downloading/i);
    if (dl) panelMeta.currentSong = dl[1].trim();
    const titled = text.match(/\| ([^|]+)$/);
    if (titled && /More -> (WAV|MP3)/i.test(text)) panelMeta.currentSong = titled[1].trim();
    if (/Hover Download/i.test(text)) panelMeta.currentStep = "⋯ → Download menu";
    else if (/Click (WAV|MP3)/i.test(text)) panelMeta.currentStep = "MP3 Audio";
    else if (/Download File modal|Click Download File/i.test(text)) panelMeta.currentStep = "Download File modal";
    else if (/Smart skip/i.test(text)) panelMeta.currentStep = "Smart skip (saved block)";
    else if (/Smart jump/i.test(text)) panelMeta.currentStep = "Smart jump to song";
    else if (/downloading/i.test(text)) panelMeta.currentStep = "Downloading MP3…";
    else if (/Stopped/i.test(text)) panelMeta.currentStep = "Stopped";
    else if (/FINISHED|All done/i.test(text)) panelMeta.currentStep = "Complete";
    else if (/Pass done/i.test(text)) panelMeta.currentStep = "Between passes";
  }

  function defaultPlan() {
    return {
      mode: "playlist",
      startIndex: 0,
      endIndex: null,
      onlyCount: null,
      stopAfterPage: false,
      nextPlan: null,
      targetIds: null,
      freshStart: false,
    };
  }

  function getPlan() {
    return { ...defaultPlan(), ...JSON.parse(sessionStorage.getItem(CFG.planKey) || "{}") };
  }

  function setPlan(plan) {
    sessionStorage.setItem(CFG.planKey, JSON.stringify(plan));
  }

  function getDoneSet() {
    return new Set(getPlaylistRecord().done || []);
  }

  function saveDoneSet(set) {
    updatePlaylistRecord(getStorageKey(), { done: [...set] });
  }

  function normalizeSongTitle(title) {
    return String(title || "")
      .replace(/\s+/g, " ")
      .replace(/\s*V\d+\s*$/i, "")
      .trim()
      .toLowerCase();
  }

  function getSongTitle(card) {
    return card?.querySelector("a[href*='/song/']")?.textContent?.trim() || "";
  }

  function getDoneTitles() {
    return new Set(getPlaylistRecord().doneTitles || []);
  }

  function saveDoneTitles(set) {
    updatePlaylistRecord(getStorageKey(), { doneTitles: [...set] });
  }

  function isTitleAlreadyDownloaded(title) {
    const key = normalizeSongTitle(title);
    if (!key) return false;
    return getDoneTitles().has(key);
  }

  function shouldSkipSong(id, title, done = getDoneSet()) {
    if (!id) return true;
    if (done.has(id) || getDoneSet().has(id)) return true;
    if (CFG.clipMode === "one-title" && isTitleAlreadyDownloaded(title)) return true;
    if (unlockedSongIds.has(id)) return true;
    return false;
  }

  function markSongDownloaded(id, title, done = getDoneSet()) {
    if (!id) return done;
    if (!done.has(id)) done.add(id);
    saveDoneSet(done);
    const key = normalizeSongTitle(title);
    if (key) {
      const titles = getDoneTitles();
      titles.add(key);
      saveDoneTitles(titles);
    }
    unlockedSongIds.add(id);
    return done;
  }

  const unlockedSongIds = new Set();

  function getStats() {
    return {
      downloaded: 0,
      skipped: 0,
      errors: 0,
      pagesDone: 0,
      ...getPlaylistRecord().stats,
    };
  }

  function saveStats(stats) {
    updatePlaylistRecord(getStorageKey(), { stats });
  }

  function clearAutorun() {
    sessionStorage.removeItem(CFG.autorunKey);
    setPlan(defaultPlan());
  }

  function setAutorun() {
    sessionStorage.setItem(CFG.autorunKey, "1");
    sessionStorage.setItem(CFG.activePlaylistKey, getPlaylistKey());
  }

  function isAutorunForCurrentPlaylist() {
    return isAutorun() && sessionStorage.getItem(CFG.activePlaylistKey) === getPlaylistKey();
  }

  function isAutorun() {
    return sessionStorage.getItem(CFG.autorunKey) === "1";
  }

  function isScrollLibraryMode() {
    return !!findScrollContainer();
  }

  function isRunning() {
    return !!window.__sunoBmRunning && !window.__sunoBmStop;
  }

  function setRunning(running) {
    window.__sunoBmRunning = !!running;
    if (stopBtn) stopBtn.disabled = !running;
  }

  function clampScrollTop(container, top) {
    if (!container) return 0;
    const max = Math.max(0, container.scrollHeight - container.clientHeight);
    return Math.min(max, Math.max(0, top));
  }

  function applySavedScrollPosition(container) {
    if (!container) return 0;
    const saved = getScrollPos();
    const top = clampScrollTop(container, saved);
    container.scrollTop = top;
    saveScrollPos(top);
    return top;
  }

  function scrollProgressAt(container, scrollTop) {
    if (!container) return 0;
    const max = Math.max(1, container.scrollHeight - container.clientHeight);
    return Math.min(100, Math.round((scrollTop / max) * 100));
  }

  function refreshPanel(extra) {
    const cards = getCards().length;
    const stats = getStats();
    const doneSet = getDoneSet();
    const doneTotal = doneSet.size;
    const seenSet = getSeenSet();
    const seen = seenSet.size;
    const left = countUnseenUndone(doneSet, seenSet);
    const failedPending = countFailedPending();
    const visibleUndone = countVisibleUndone(doneSet);
    const ext = sessionStorage.getItem("suno-bm-ext") === "1";
    const scrollMode = isScrollLibraryMode();
    const container = findScrollContainer();
    const scrollSaved = getScrollPos();
    const playlistDone = isPlaylistMarkedDone();
    const running = isRunning();
    if (!running && container && scrollSaved > 0 && left > 0) {
      applySavedScrollPosition(container);
    }
    const scrollTop = container?.scrollTop ?? 0;
    const scrollPct = container ? scrollProgressAt(container, scrollTop) : 0;
    const cov = seen > 0 ? Math.min(100, Math.round((doneTotal / seen) * 100)) : 0;

    if (ui.stateBadge) {
      ui.stateBadge.textContent = running ? "RUNNING" : playlistDone || extra === "FINISHED" ? "DONE" : "READY";
      ui.stateBadge.style.background = running ? "#163" : playlistDone || extra === "FINISHED" ? "#14532d" : "#333";
      ui.stateBadge.style.color = running ? "#afa" : playlistDone || extra === "FINISHED" ? "#bbf7d0" : "#ccc";
    }

    if (ui.pageLine) {
      const meta = getSavedListMeta();
      const countPart = meta.expectedCount ? ` · ${meta.expectedCount} songs in Suno` : "";
      const doneMark = playlistDone ? " · ✓ DONE (won't re-download)" : "";
      ui.pageLine.textContent = scrollMode
        ? `List: ${meta.name}${countPart} · ${cards} visible · ${seen} tracked · scroll ${scrollPct}%${doneMark}`
        : `Page ${getPage()} · ${cards} visible · ${seen} seen`;
    }

    if (ui.statDone) ui.statDone.textContent = String(doneTotal);
    if (ui.statLeft) ui.statLeft.textContent = String(left);
    if (ui.statSeen) ui.statSeen.textContent = String(seen);
    if (ui.statVisible) ui.statVisible.textContent = String(visibleUndone);
    if (ui.statErr) ui.statErr.textContent = String(stats.errors);
    if (ui.statSkip) ui.statSkip.textContent = String(stats.skipped);
    if (ui.statFailed) ui.statFailed.textContent = String(failedPending);
    if (ui.statBatch) ui.statBatch.textContent = String(stats.pagesDone);

    if (ui.currentSong) ui.currentSong.textContent = panelMeta.currentSong.slice(0, 36);
    if (ui.currentStep) ui.currentStep.textContent = panelMeta.currentStep;

    if (ui.flowDots) {
      const step = panelMeta.currentStep;
      const s1 = /Download menu|WAV|MP3|File|Downloading/.test(step) ? "#6f6" : "#444";
      const s2 = /WAV|MP3|File|Downloading/.test(step) ? "#6f6" : "#444";
      const s3 = /File|Downloading/.test(step) && !/modal/.test(step) ? "#6f6" : /Download File/.test(step) ? "#fc8" : "#444";
      ui.flowDots.innerHTML =
        `<span style="color:${s1}">⋯</span> → <span style="color:${s2}">MP3</span> → <span style="color:${s3}">File</span>`;
    }

    if (ui.etaLine) {
      const sec = estimateSecondsPerSong();
      ui.etaLine.textContent = left
        ? `Est. ${formatEta(left * sec)} left · ~${sec}s typical · waits for UI ready`
        : seen
          ? `Playlist progress — verify .mp3 files in Downloads folder`
          : `Open a playlist · click Download This Playlist`;
    }

    if (ui.sessionLine) {
      ui.sessionLine.textContent =
        `Scroll ${scrollPct}% · saved pos ${scrollSaved}px · passes ${stats.pagesDone}` +
        (ext ? " · extension" : "") +
        (running ? " · do not close tab" : left > 0 ? " · click Resume for remaining songs" : "");
    }

    if (ui.coverageLine) {
      const doneLists = getCompletedPlaylists();
      const doneNote = doneLists.length ? ` · ${doneLists.length} playlist(s) marked complete` : "";
      ui.coverageLine.textContent = seen
        ? `SAVED = click finished (not file count) · ${cov}% of ${seen} seen${doneNote}`
        : "One open playlist only — scrolls all songs, skips saved, stops when complete";
    }

    if (ui.modeLine) {
      ui.modeLine.textContent = running
        ? "Working: batch visible songs → smart skip saved blocks → 2nd pass if needed"
        : playlistDone
          ? "Finished — move MP3s to folder · script stopped (won't open another playlist)"
          : "Keep this Suno tab focused — background tabs pause downloads";
    }

    const allBtn = document.getElementById("suno-bm-all");
    const resumeBtn = document.getElementById("suno-bm-resume");
    if (allBtn) {
      allBtn.disabled = !!playlistDone && !running;
      allBtn.style.opacity = playlistDone && !running ? "0.45" : "1";
      allBtn.title = playlistDone ? "Playlist done — Reset (this playlist) to run again" : "";
    }
    if (resumeBtn) {
      resumeBtn.disabled = !!playlistDone && !running;
      resumeBtn.style.opacity = playlistDone && !running ? "0.45" : "1";
    }

    if (ui.statusLine) ui.statusLine.textContent = extra || (running ? "Running…" : "Ready");

    if (ui.scrollBar) ui.scrollBar.style.width = scrollPct + "%";
    if (ui.scrollBarText) ui.scrollBarText.textContent = `List scroll: ${scrollPct}%`;

    if (ui.bar) ui.bar.style.width = (seen ? cov : 0) + "%";
    if (ui.barText) {
      ui.barText.textContent = seen
        ? `Saved ${doneTotal} / ${seen} seen (${cov}%)`
        : "Download progress: 0 / 0";
    }

    if (ui.logCount) {
      const n = getLogs().length;
      ui.logCount.textContent = `${n} log entries · positions from getBoundingClientRect()`;
    }
    if (ui.logPreview) {
      const recent = getLogs()
        .slice(-12)
        .map((e) => `${e.t.slice(11, 19)} ${e.msg}`)
        .join("\n");
      ui.logPreview.textContent = recent || "(no logs yet)";
    }
  }

  function statusMsg(t) {
    parseStatusMeta(t);
    refreshPanel(t);
    log(t);
  }

  async function waitFor(getEl, label, timeout = CFG.menuWaitTimeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = getEl();
      if (el) return el;
      await sleep(CFG.pollMs);
    }
    throw new Error("Timeout: " + label);
  }

  function uiIsIdle() {
    return listVisibleMenus().length === 0 && !isDownloadModalOpen();
  }

  async function waitForMenusClosed(timeout = CFG.menuOpenTimeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (uiIsIdle()) {
        await settle(CFG.minSettleMs);
        return true;
      }
      await sleep(CFG.pollMs);
    }
    return uiIsIdle();
  }

  async function waitForCardInteractive(card, timeout = CFG.cardReadyTimeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!isMoreBtnVisible(card)) scrollMoreBtnIntoView(card);
      const more = findMoreBtn(card);
      if (more) {
        const r = more.getBoundingClientRect();
        if (r.width > 2 && r.height > 2 && isMoreBtnVisible(card)) {
          await settle(CFG.minSettleMs);
          return more;
        }
      }
      await sleep(CFG.pollMs);
    }
    return null;
  }

  async function waitForScrollIdle(container, timeout = CFG.scrollSettleTimeout) {
    if (!container) return;
    const start = Date.now();
    let lastTop = container.scrollTop;
    let stable = 0;
    while (Date.now() - start < timeout) {
      await sleep(CFG.pollMs);
      if (Math.abs(container.scrollTop - lastTop) < 2) {
        stable++;
        if (stable >= 2) return;
      } else {
        stable = 0;
        lastTop = container.scrollTop;
      }
    }
  }

  async function waitForScrollGrowth(container, beforeCount, beforeHeight, timeout = CFG.scrollLoadTimeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const nowCount = getSongCards().length;
      const nowHeight = container?.scrollHeight ?? 0;
      if (nowCount > beforeCount || nowHeight > beforeHeight + 6) {
        await settle(CFG.minSettleMs);
        return true;
      }
      await sleep(CFG.pollMs);
    }
    return false;
  }

  async function waitForSongs() {
    statusMsg("Waiting for songs to load…");
    const start = Date.now();
    while (Date.now() - start < CFG.pageLoadWait) {
      if (getCards().length > 0) return getCards().length;
      await sleep(500);
    }
    return 0;
  }

  function getCards() {
    return getSongCards();
  }

  function getSongCards() {
    const rg = document.querySelector('[role="rowgroup"]');
    if (!rg) return [];
    return [...rg.children].filter((c) => getSongId(c));
  }

  function findCardBySongId(id) {
    if (!id) return null;
    const link = document.querySelector(`a[href*="/song/${id}"]`);
    if (!link) return null;
    return link.closest('[role="rowgroup"] > *') || link.closest('[role="row"]') || null;
  }

  function isInScrollerViewport(card) {
    const container = findScrollContainer();
    if (!container || !card) return true;
    const cr = card.getBoundingClientRect();
    const sr = container.getBoundingClientRect();
    const margin = 36;
    return cr.bottom > sr.top + margin && cr.top < sr.bottom - margin;
  }

  function getFailedMap() {
    return { ...getPlaylistRecord().failed };
  }

  function saveFailedMap(map) {
    updatePlaylistRecord(getStorageKey(), { failed: map });
  }

  function bumpFailed(id) {
    const map = getFailedMap();
    map[id] = (map[id] || 0) + 1;
    saveFailedMap(map);
    return map[id];
  }

  function shouldSkipFailed(id) {
    return (getFailedMap()[id] || 0) >= CFG.maxFailsPerSong;
  }

  function scrollProgress(container) {
    if (!container) return 0;
    const max = Math.max(1, container.scrollHeight - container.clientHeight);
    return Math.min(100, Math.round((container.scrollTop / max) * 100));
  }

  function getUndoneCardsInViewport(done, includeFailed = false) {
    return getSongCards().filter((c) => {
      const id = getSongId(c);
      const title = getSongTitle(c);
      if (!id || shouldSkipSong(id, title, done)) return false;
      if (!includeFailed && shouldSkipFailed(id)) return false;
      return isInScrollerViewport(c);
    });
  }

  function menuItemText(el) {
    return (el.textContent || "").replace(/\s+/g, " ").trim();
  }

  function menuItemLabel(el) {
    const direct = menuItemText(el);
    if (direct) return direct;
    return (el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim();
  }

  function menuItemClickTarget(el) {
    return el.closest('[role="menuitem"]') || el.closest("[data-radix-collection-item]") || el;
  }

  function isDownloadMenuItem(el) {
    const label = menuItemLabel(el);
    if (!label) return false;
    if (/^Download$/i.test(label)) return true;
    return /^Download\b/i.test(label) && !/MP3|WAV|File|Video|Stem|MIDI/i.test(label);
  }

  function findMainMenu() {
    const menus = listVisibleMenus();
    return (
      menus.find((m) => {
        const t = m.textContent || "";
        return /Remix|Edit|Publish|Share/i.test(t) && /Download/i.test(t);
      }) ||
      menus[0] ||
      null
    );
  }

  function getRowStep() {
    const cards = getSongCards();
    if (cards.length >= 2) {
      const gap = cards[1].getBoundingClientRect().top - cards[0].getBoundingClientRect().top;
      if (gap > 40 && gap < 220) return Math.round(gap);
    }
    if (cards[0]?.offsetHeight > 40) return cards[0].offsetHeight;
    return CFG.scrollStep;
  }

  function countVisibleUndone(done) {
    return getUndoneCardsInViewport(done, false).length;
  }

  function allVisibleRowsDone(done) {
    const visible = getSongCards().filter((c) => isInScrollerViewport(c));
    if (!visible.length) return false;
    return visible.every((c) => {
      const id = getSongId(c);
      const title = getSongTitle(c);
      return !id || shouldSkipSong(id, title, done) || shouldSkipFailed(id);
    });
  }

  function listUndoneSeenIds(done, seen) {
    return [...seen].filter((id) => {
      if (shouldSkipFailed(id)) return false;
      if (done.has(id)) return false;
      const card = findCardBySongId(id);
      const title = card ? getSongTitle(card) : "";
      if (CFG.clipMode === "one-title" && title && isTitleAlreadyDownloaded(title)) return false;
      return true;
    });
  }

  function huntUndoneCard(done, seen) {
    for (const id of listUndoneSeenIds(done, seen)) {
      const card = findCardBySongId(id);
      if (card) return card;
    }
    return null;
  }

  async function scrollDownBy(container, delta) {
    if (!container || delta <= 0) return;
    const before = container.scrollTop;
    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + delta);
    if (container.scrollTop === before) {
      container.scrollTop = container.scrollHeight;
    }
    saveScrollPos(container.scrollTop);
    await waitForScrollIdle(container);
  }

  async function smartScrollDown(container, done, seen) {
    const rowStep = getRowStep();
    const left = countUnseenUndone(done, seen);
    const finishing = left > 0 && left <= 40;

    const hunted = huntUndoneCard(done, seen);
    if (hunted && !isInScrollerViewport(hunted)) {
      const title = hunted.querySelector("a[href*='/song/']")?.textContent?.trim() || getSongId(hunted)?.slice(0, 8);
      statusMsg(`Smart jump → ${(title || "?").slice(0, 24)}`);
      scrollCardIntoView(hunted, "center");
      await waitForCardInteractive(hunted, CFG.cardReadyTimeout);
      registerVisibleSongs(seen);
      return "jump";
    }

    if (allVisibleRowsDone(done)) {
      if (finishing) {
        statusMsg(`Finishing ${left} left · row-by-row · scroll ${scrollProgress(container)}%`);
        await scrollDownOneStep(container, rowStep);
      } else {
        const pageJump = Math.max(
          rowStep * CFG.smartSkipRows,
          Math.round(container.clientHeight * CFG.smartSkipPageRatio)
        );
        statusMsg(`Smart skip saved block · +${pageJump}px · scroll ${scrollProgress(container)}%`);
        await scrollDownBy(container, pageJump);
      }
      registerVisibleSongs(seen);
      return finishing ? "finish-row" : "skip";
    }

    statusMsg(`Next row · scroll ${scrollProgress(container)}% · seen ${seen.size}`);
    await scrollDownOneStep(container, rowStep);
    registerVisibleSongs(seen);
    return "row";
  }

  function pickNextCard(done, seen = getSeenSet()) {
    const hunted = huntUndoneCard(done, seen);
    if (hunted && isInScrollerViewport(hunted) && !shouldSkipFailed(getSongId(hunted))) {
      return hunted;
    }

    const candidates = getUndoneCardsInViewport(done, false);
    if (!candidates.length) return null;
    candidates.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    return candidates[0];
  }

  function bottomStableNeededFor(done, seen) {
    const left = countUnseenUndone(done, seen);
    return left > 0 && left <= 40 ? 2 : CFG.bottomStableNeeded;
  }

  function getSeenSet() {
    return new Set(getPlaylistRecord().seen || []);
  }

  function saveSeenSet(set) {
    updatePlaylistRecord(getStorageKey(), { seen: [...set] });
  }

  function registerVisibleSongs(seen) {
    for (const c of getSongCards()) {
      const id = getSongId(c);
      if (id) seen.add(id);
    }
    saveSeenSet(seen);
    return seen;
  }

  function countUnseenUndone(done, seen) {
    let n = 0;
    for (const id of seen) {
      if (!done.has(id)) n++;
    }
    return n;
  }

  function isAtScrollBottom(container, slack = 12) {
    if (!container) return true;
    return container.scrollTop + container.clientHeight >= container.scrollHeight - slack;
  }

  async function scrollDownOneStep(container, step) {
    if (!container) return;
    const delta = step || getRowStep();
    const before = container.scrollTop;
    container.scrollTop = Math.min(container.scrollHeight, container.scrollTop + delta);
    if (container.scrollTop === before) {
      container.scrollTop = container.scrollHeight;
    }
    saveScrollPos(container.scrollTop);
    await waitForScrollIdle(container);
  }

  async function scrollToAbsoluteEnd(container) {
    if (!container) return false;
    let lastHeight = container.scrollHeight;
    let stable = 0;

    while (stable < CFG.bottomStableNeeded) {
      const beforeCount = getSongCards().length;
      container.scrollTop = container.scrollHeight;
      await waitForScrollGrowth(container, beforeCount, lastHeight, CFG.scrollLoadTimeout);

      if (container.scrollHeight <= lastHeight + 4) {
        stable++;
      } else {
        stable = 0;
        lastHeight = container.scrollHeight;
      }
    }
    return true;
  }

  function findScrollContainer() {
    const known = document.querySelector(".clip-browser-list-scroller");
    if (known) return known;

    const rg = document.querySelector('[role="rowgroup"]');
    if (!rg) return null;
    let el = rg.parentElement;
    while (el && el !== document.body) {
      const st = getComputedStyle(el);
      const oy = st.overflowY;
      if ((oy === "auto" || oy === "scroll") && el.scrollHeight > el.clientHeight + 20) {
        return el;
      }
      el = el.parentElement;
    }
    return null;
  }

  function scrollMoreBtnIntoView(card) {
    if (!card) return;
    const container = findScrollContainer();
    if (!container) return;

    const target = findMoreBtn(card) || card;
    const cr = target.getBoundingClientRect();
    const sr = container.getBoundingClientRect();
    const margin = 40;

    if (cr.top < sr.top + margin) {
      container.scrollTop += cr.top - sr.top - margin;
    } else if (cr.bottom > sr.bottom - margin) {
      container.scrollTop += cr.bottom - sr.bottom + margin;
    }

    saveScrollPos(container.scrollTop);
  }

  function scrollCardIntoView(card, block = "nearest") {
    if (block === "center") {
      scrollMoreBtnIntoView(card);
      return;
    }
    scrollMoreBtnIntoView(card);
  }

  function isMoreBtnVisible(card) {
    const more = findMoreBtn(card);
    if (!more) return isInScrollerViewport(card);
    const r = more.getBoundingClientRect();
    const container = findScrollContainer();
    if (!container) return r.width > 2 && r.height > 2;
    const sr = container.getBoundingClientRect();
    const margin = 36;
    return r.width > 2 && r.height > 2 && r.bottom > sr.top + margin && r.top < sr.bottom - margin;
  }

  let playerGuardTimer = null;
  let playerGuardUnblock = null;

  function pauseAllMedia() {
    document.querySelectorAll("audio, video").forEach((el) => {
      try {
        el.pause();
      } catch (_) {}
    });
  }

  function startPlayerGuard(durationMs = 25000) {
    stopPlayerGuard();
    window.__sunoBmPlayerGuard = true;
    pauseAllMedia();

    const blockPlayer = (e) => {
      if (!window.__sunoBmPlayerGuard) return;
      const t = e.target;
      if (!t || t.closest("#suno-bm-panel")) return;
      if (t.closest('[role="dialog"], [data-radix-dialog-content]')) return;
      if (isInPlayerBar(t) || t.closest('[class*="player" i], [data-testid*="player" i]')) {
        e.preventDefault();
        e.stopPropagation();
        pauseAllMedia();
      }
    };
    document.addEventListener("click", blockPlayer, true);
    document.addEventListener("mousedown", blockPlayer, true);
    playerGuardUnblock = () => {
      document.removeEventListener("click", blockPlayer, true);
      document.removeEventListener("mousedown", blockPlayer, true);
    };

    playerGuardTimer = setInterval(pauseAllMedia, 350);
    setTimeout(stopPlayerGuard, durationMs);
  }

  function stopPlayerGuard() {
    window.__sunoBmPlayerGuard = false;
    if (playerGuardTimer) {
      clearInterval(playerGuardTimer);
      playerGuardTimer = null;
    }
    if (playerGuardUnblock) {
      playerGuardUnblock();
      playerGuardUnblock = null;
    }
    pauseAllMedia();
  }

  function silencePlayer() {
    pauseAllMedia();

    for (const el of document.querySelectorAll("button, [role='button']")) {
      if (el.closest("#suno-bm-panel")) continue;
      if (el.closest('[role="dialog"]') && isDownloadModalOpen()) continue;
      if (isInPlayerBar(el)) {
        const label = buttonLabel(el);
        const aria = el.getAttribute("aria-label") || "";
        if (/^Pause$/i.test(label) || /pause/i.test(aria)) {
          if (isClickable(el)) {
            el.click();
            log("player paused");
            break;
          }
        }
      }
    }

    const active = document.activeElement;
    if (active && active !== document.body && !active.closest("#suno-bm-panel")) {
      active.blur?.();
    }
  }

  async function isolatedButtonClick(btn, label) {
    if (!btn) return;
    pauseAllMedia();
    try {
      await withPanelPassthrough(async () => {
        await clickTargetElement(btn, label || "button");
      });
    } finally {
      pauseAllMedia();
    }
    await sleep(220);
  }

  async function clickMoreOptions(btn) {
    await isolatedButtonClick(btn, "More options");
    if (menuLooksOpen()) return;
    btn.focus?.();
    await withPanelPassthrough(async () => {
      btn.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", bubbles: true }));
      btn.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter", code: "Enter", bubbles: true }));
    });
    await sleep(180);
    if (menuLooksOpen()) return;
    await withPanelPassthrough(async () => {
      await clickTargetElement(btn, "More options retry");
    });
    await settle(CFG.minSettleMs + 150);
  }
  async function menuPortalClick(el, label) {
    const target = menuItemClickTarget(el);
    pauseAllMedia();
    await withPanelPassthrough(async () => {
      await clickTargetElement(target, label || "menu");
      log(label || "menu click", menuItemLabel(target));
    });
    pauseAllMedia();
    await sleep(120);
  }

  function visibleSongIds() {
    return new Set(getCards().map(getSongId).filter(Boolean));
  }

  async function scrollToLoadMore() {
    const before = visibleSongIds();
    const beforeCount = before.size;
    const container = findScrollContainer();
    const beforeHeight = container?.scrollHeight ?? 0;
    statusMsg(`Scrolling list… (${beforeCount} songs in DOM)`);

    if (container) {
      const step = Math.max(400, container.clientHeight * 0.85);
      container.scrollBy({ top: step, behavior: "instant" });
      await waitForScrollGrowth(container, beforeCount, beforeHeight);
      container.scrollTop = container.scrollHeight;
      await waitForScrollGrowth(container, beforeCount, beforeHeight);
    } else {
      const container = findScrollContainer();
      if (container) container.scrollTop = container.scrollHeight;
      await waitForScrollGrowth(container, beforeCount, beforeHeight);
    }

    const after = visibleSongIds();
    const grew = after.size > before.size;
    log("scroll:", before.size, "→", after.size, grew ? "(new songs)" : "(no new songs)");
    return grew;
  }

  async function scrollUntilNewSongs() {
    for (let attempt = 1; attempt <= CFG.scrollLoadRetries; attempt++) {
      if (await scrollToLoadMore()) return true;
      statusMsg(`No new songs yet — retry scroll ${attempt}/${CFG.scrollLoadRetries}…`);
      await settle(CFG.maxSettleMs);
    }
    return false;
  }

  async function prepForDownload() {
    await waitForSongs();
  }

  function hasPagination() {
    return !!findNextPageControl(getPage() + 1);
  }


  function getSongId(card) {
    return card.querySelector("a[href*='/song/']")?.getAttribute("href")?.split("/").pop() || null;
  }

  function getPage() {
    return Number(new URL(location.href).searchParams.get("page") || "1");
  }

  function cardIdsFingerprint() {
    return getCards()
      .map(getSongId)
      .filter(Boolean)
      .join("|");
  }

  function findNextPageControl(nextPage) {
    const want = String(nextPage);
    const all = [...document.querySelectorAll('a[href*="page="], button, [role="button"]')];

    let hit = all.find((el) => {
      const href = el.getAttribute("href") || "";
      return href.includes(`page=${nextPage}`) || (el.textContent || "").trim() === want;
    });
    if (hit) return hit;

    hit = all.find((el) => {
      const blob = ((el.textContent || "") + " " + (el.getAttribute("aria-label") || "")).toLowerCase();
      return /\bnext\b|next page|chevron.*right|arrow.*right|forward/.test(blob);
    });
    return hit || null;
  }

  async function waitForPageReady(pageNum) {
    statusMsg(`Waiting for page ${pageNum} to load…`);
    const start = Date.now();
    while (Date.now() - start < CFG.pageLoadWait) {
      if (getPage() === pageNum && getCards().length > 0) return true;
      await sleep(500);
    }
    return getCards().length > 0;
  }

  async function goToNextPage(nextPage) {
    setAutorun();
    await closeMenus();
    statusMsg(`Going to page ${nextPage}…`);

    const ctrl = findNextPageControl(nextPage);
    if (ctrl) {
      ctrl.scrollIntoView({ block: "center" });
      await sleep(600);
      ctrl.click();
      if (await waitForPageReady(nextPage)) {
        statusMsg(`Page ${nextPage} ready`);
        return "soft";
      }
    }

    statusMsg(`Loading page ${nextPage} (full reload)…`);
    await sleep(800);
    const u = new URL(location.href);
    u.searchParams.set("page", String(nextPage));
    location.assign(u.toString());
    return "hard";
  }

  function visibleMenus() {
    return [...document.querySelectorAll('[role="menu"], [data-radix-menu-content]')].filter((m) => {
      const r = m.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    });
  }

  function menuItems() {
    const menus = visibleMenus();
    const scope = menus.length ? menus[menus.length - 1] : document;
    return [...scope.querySelectorAll('[role="menuitem"], [role="menuitemradio"], button, [role="button"]')];
  }

  function getVisibleMenuRoots() {
    return [...document.querySelectorAll('[role="menu"], [data-radix-popper-content-wrapper], [data-radix-menu-content]')].filter(
      (el) => {
        if (el.closest("#suno-bm-panel")) return false;
        const r = el.getBoundingClientRect();
        return r.width > 8 && r.height > 8;
      }
    );
  }

  function listVisibleMenus() {
    return getVisibleMenuRoots();
  }

  function menuLooksOpen() {
    return !!findDownloadItem() || listVisibleMenus().length > 0;
  }

  function findDownloadItem() {
    const scan = (root) => {
      if (!root) return null;
      const items = [...root.querySelectorAll('[role="menuitem"], [data-radix-collection-item], button')];
      for (const el of items) {
        if (el.closest("#suno-bm-panel")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (isDownloadMenuItem(el)) return menuItemClickTarget(el);
      }
      return null;
    };

    const main = findMainMenu();
    const inMain = scan(main);
    if (inMain) return inMain;

    for (const el of menuItems()) {
      if (el.closest("#suno-bm-panel")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (isDownloadMenuItem(el)) return menuItemClickTarget(el);
    }

    for (const el of document.querySelectorAll('[role="menuitem"], [data-radix-collection-item]')) {
      if (el.closest("#suno-bm-panel")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      if (isDownloadMenuItem(el)) return menuItemClickTarget(el);
    }
    return null;
  }

  function findDownloadSubmenu() {
    const roots = getVisibleMenuRoots();
    return roots.find((m) => {
      const t = m.textContent || "";
      return (/MP3/i.test(t) || /WAV/i.test(t)) && /Audio/i.test(t) && !/Remix/i.test(t);
    });
  }

  function isMp3MenuItem(el) {
    const blob = menuItemLabel(el);
    if (!blob) return false;
    if (/WAV/i.test(blob)) return false;
    if (/Stem|Video|MIDI|Video/i.test(blob)) return false;
    return /MP3/i.test(blob) && (/Audio/i.test(blob) || /Pro/i.test(blob) || /^MP3\b/i.test(blob));
  }

  function findMp3Item() {
    const roots = getVisibleMenuRoots();
    const searchIn = roots.length ? roots : [document.body];
    for (const scope of searchIn) {
      for (const el of scope.querySelectorAll('[role="menuitem"], [data-radix-collection-item], button')) {
        if (el.closest("#suno-bm-panel")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (isMp3MenuItem(el)) return menuItemClickTarget(el);
      }
    }
    return null;
  }

  function logMenuState(label) {
    const menus = listVisibleMenus();
    log(
      label,
      menus.map((m, i) => ({
        i,
        items: [...m.querySelectorAll('[role="menuitem"]')].map((el) => menuItemText(el)).filter(Boolean),
      }))
    );
  }

  function buttonLabel(el) {
    return ((el.textContent || "") + " " + (el.getAttribute("aria-label") || "")).replace(/\s+/g, " ").trim();
  }

  function isDownloadFormatModalOpen() {
    const text = document.body.innerText || "";
    return (
      /Unlock\s*&\s*Download/i.test(text) ||
      (/\bM4A\b/i.test(text) && /\bMP3\b/i.test(text) && /\bWAV\b/i.test(text) && /\bDownload\b/i.test(text))
    );
  }

  function isDownloadModalOpen() {
    if (isDownloadFormatModalOpen()) return true;
    return /Download (MP3|WAV) Audio/i.test(document.body.innerText || "");
  }

  function findDownloadFormatModal() {
    const selectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[data-radix-dialog-content]',
      '[data-state="open"]',
    ];
    for (const sel of selectors) {
      const hit = [...document.querySelectorAll(sel)].find((el) => {
        if (el.closest("#suno-bm-panel")) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 120 || r.height < 120) return false;
        const t = el.textContent || "";
        return (
          /Unlock\s*&\s*Download/i.test(t) ||
          (/\bM4A\b/i.test(t) && /\bMP3\b/i.test(t) && /\bWAV\b/i.test(t))
        );
      });
      if (hit) return hit;
    }
    return null;
  }

  function findDownloadModal() {
    const format = findDownloadFormatModal();
    if (format) return format;
    const selectors = [
      '[role="dialog"]',
      '[role="alertdialog"]',
      '[data-radix-dialog-content]',
      '[data-state="open"]',
    ];
    for (const sel of selectors) {
      const hit = [...document.querySelectorAll(sel)].find((el) => {
        if (el.closest("#suno-bm-panel")) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 80 || r.height < 60) return false;
        return /Download (MP3|WAV) Audio/i.test(el.textContent || "");
      });
      if (hit) return hit;
    }
    return null;
  }

  function isDownloadFileLabel(text) {
    const t = (text || "").replace(/\s+/g, " ").trim();
    if (!t || t.length > 40) return false;
    return /\bDownload\s*File\b/i.test(t);
  }

  function isClickable(el) {
    if (!el) return false;
    if (el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return false;
    const st = getComputedStyle(el);
    return st.visibility !== "hidden" && st.display !== "none" && st.pointerEvents !== "none";
  }

  function isInPlayerBar(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.top > window.innerHeight - 140 && r.width > 0;
  }

  function isDownloadFileButton(el) {
    if (!el || el.closest("#suno-bm-panel") || el.closest('[role="rowgroup"]')) return false;
    if (isInPlayerBar(el)) return false;
    if (!isDownloadFileLabel(buttonLabel(el))) return false;
    const modal = findDownloadModal();
    if (modal && !modal.contains(el)) return false;
    return isClickable(el);
  }

  function findDownloadFileButton() {
    if (!isDownloadModalOpen()) return null;

    const modal = findDownloadModal();
    if (!modal) return null;

    const candidates = [];

    for (const el of modal.querySelectorAll("button, a, [role='button']")) {
      if (!isDownloadFileButton(el)) continue;
      const r = el.getBoundingClientRect();
      candidates.push({ el, area: r.width * r.height });
    }

    if (!candidates.length) return null;

    candidates.sort((a, b) => b.area - a.area);
    const best = candidates[0];
    elementPos(best.el, "Download File");
    return best.el;
  }

  async function withPanelPassthrough(fn) {
    const panel = document.getElementById("suno-bm-panel");
    const actions = document.getElementById("suno-bm-actions");
    const prevPanel = panel?.style.pointerEvents;
    const prevActions = actions?.style.pointerEvents;
    if (panel) panel.style.pointerEvents = "none";
    if (actions) actions.style.pointerEvents = "none";
    try {
      return await fn();
    } finally {
      if (panel) panel.style.pointerEvents = prevPanel || "none";
      if (actions) actions.style.pointerEvents = prevActions || "auto";
    }
  }

  async function clickModalButtonOnce(btn, label) {
    const modal = findDownloadModal();
    if (!modal) throw new Error("Download modal not found");
    if (!modal.contains(btn)) throw new Error("Download File not inside modal");

    const { cx, cy } = pointerCoords(btn);
    elementPos(btn, label || "Download File");

    await withPanelPassthrough(async () => {
      pauseAllMedia();
      showClickFeedback(cx, cy, label || "Download File");
      const hit = document.elementFromPoint(cx, cy);
      const hitBtn = hit?.closest("button,a,[role='button']");
      if (hitBtn && hitBtn !== btn && !btn.contains(hitBtn)) {
        log("click blocked — point hits", buttonLabel(hitBtn), "not Download File");
        throw new Error("Download File click point wrong target");
      }
      log("single click Download File at", cx, cy);
      btn.click();
    });

    await sleep(250);
    pauseAllMedia();
    silencePlayer();
  }

  async function clickOnce(target, label) {
    const el = target.closest("button,a,[role='button'],label,[role='radio'],[role='option']") || target;
    const { cx, cy } = pointerCoords(el);
    showClickFeedback(cx, cy, label || "click");
    log("clickOnce", label, "at", Math.round(cx), Math.round(cy));
    // ONE activation only — dual click/event sequences can double-download
    el.focus?.({ preventScroll: true });
    el.click?.();
    await sleep(180);
  }

  async function clickTargetElement(target, label) {
    const el = target.closest("button,a,[role='button']") || target;
    const pos = elementPos(el, label || "click");
    const { cx, cy } = pointerCoords(el);
    showClickFeedback(cx, cy, label || "click");
    log("clickTarget", label, "at", pos?.cx, pos?.cy, "tag", el.tagName);

    const base = {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      clientX: cx,
      clientY: cy,
      button: 0,
      buttons: 1,
      detail: 1,
    };
    const peBase = { ...base, pointerId: 1, pointerType: "mouse", isPrimary: true };

    el.dispatchEvent(new PointerEvent("pointerover", peBase));
    el.dispatchEvent(new MouseEvent("mouseover", base));
    el.dispatchEvent(new PointerEvent("pointerdown", { ...peBase, buttons: 1 }));
    el.dispatchEvent(new MouseEvent("mousedown", base));
    el.dispatchEvent(new PointerEvent("pointerup", { ...peBase, buttons: 0 }));
    el.dispatchEvent(new MouseEvent("mouseup", base));
    el.dispatchEvent(new MouseEvent("click", base));
    el.click?.();

    await sleep(150);
  }

  function findMoreBtn(card) {
    const exact = card.querySelector('button[aria-label="More options"]');
    if (exact) return exact;

    const byLabel = card.querySelector(
      'button[aria-label*="More" i], button[aria-label*="action" i], [aria-label*="More" i][role="button"]'
    );
    if (byLabel) return byLabel;

    const remix = [...card.querySelectorAll("button")].find((b) =>
      /remix/i.test((b.textContent || "") + (b.getAttribute("aria-label") || ""))
    );
    if (remix) {
      let sib = remix.nextElementSibling;
      while (sib) {
        if (sib.tagName === "BUTTON" || sib.getAttribute("role") === "button") return sib;
        sib = sib.nextElementSibling;
      }
    }

    const buttons = [...card.querySelectorAll("button")];
    const candidates = buttons.filter((b) => {
      const label = ((b.textContent || "") + " " + (b.getAttribute("aria-label") || "")).toLowerCase();
      return !/remix|play|thumb|like|dislike|pin|share|publish|edit|create|clip/.test(label);
    });
    return candidates[candidates.length - 1] || buttons[buttons.length - 1] || null;
  }

  function pointerCoords(el) {
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  async function pointerEnter(el) {
    const target = menuItemClickTarget(el);
    const { cx, cy } = pointerCoords(target);
    const opts = { bubbles: true, cancelable: true, clientX: cx, clientY: cy, view: window };
    target.dispatchEvent(new PointerEvent("pointermove", opts));
    target.dispatchEvent(new MouseEvent("mousemove", opts));
    target.dispatchEvent(new PointerEvent("pointerover", opts));
    target.dispatchEvent(new MouseEvent("mouseover", opts));
    await sleep(180);
  }

  async function hoverAt(el, x, y) {
    const target = menuItemClickTarget(el);
    const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y, view: window };
    target.dispatchEvent(new PointerEvent("pointermove", opts));
    target.dispatchEvent(new MouseEvent("mousemove", opts));
    target.dispatchEvent(new PointerEvent("pointerover", opts));
    target.dispatchEvent(new MouseEvent("mouseover", opts));
    await sleep(120);
  }

  async function pointerClick(el, opts = {}) {
    const scroll = opts.scroll !== false;
    const target = menuItemClickTarget(el);
    if (
      scroll &&
      !opts.noScroll &&
      !target.closest("[data-radix-portal], [role='dialog'], [data-radix-dialog-content], [role='rowgroup']")
    ) {
      target.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      await sleep(80);
    }
    const { cx, cy } = pointerCoords(target);
    if (!opts.noFocus) target.focus?.({ preventScroll: true });
    target.dispatchEvent(new PointerEvent("pointerover", { bubbles: true, clientX: cx, clientY: cy }));
    target.dispatchEvent(new MouseEvent("mouseover", { bubbles: true, clientX: cx, clientY: cy }));
    target.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    target.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    target.dispatchEvent(new PointerEvent("pointerup", { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    target.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, clientX: cx, clientY: cy, button: 0 }));
    target.click?.();
    await sleep(120);
  }

  async function waitForModalClose(timeout = CFG.modalCloseTimeout) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (!isDownloadModalOpen()) return true;
      await sleep(CFG.pollMs);
    }
    return !isDownloadModalOpen();
  }

  async function clickDownloadFileButton(el) {
    for (let attempt = 1; attempt <= 4; attempt++) {
      const btn = findDownloadFileButton() || el;
      if (!btn || !isClickable(btn)) {
        statusMsg(`Download File not ready yet (${attempt}/4)…`);
        await sleep(500);
        continue;
      }

      statusMsg(`Click Download File (try ${attempt}/4)…`);
      log("Download File button:", buttonLabel(btn), "disabled:", btn.disabled);

      try {
        await clickModalButtonOnce(btn, "Download File click");
      } catch (err) {
        log("Download File click error:", err.message);
        await sleep(400);
        continue;
      }

      await sleep(300);
      const closed = await waitForModalClose(CFG.modalCloseTimeout);
      if (closed) {
        log("Download File accepted — modal closed");
        return;
      }

      log("Download File click did not close modal — retry");
      await sleep(400);
    }

    throw new Error("Download File click did not close modal");
  }

  async function openMoreMenu(card) {
    if (listVisibleMenus().length || isDownloadModalOpen()) {
      await closeMenus();
    }
    scrollMoreBtnIntoView(card);
    const more = await waitForCardInteractive(card);
    if (!more) throw new Error("More options not found");

    for (let attempt = 1; attempt <= 3; attempt++) {
      await clickMoreOptions(more);
      log(`More menu attempt ${attempt}`);
      try {
        const dl = await waitFor(() => findDownloadItem(), "Download menu item", CFG.menuOpenTimeout);
        logMenuState("Menu open");
        return dl;
      } catch (_) {
        if (listVisibleMenus().length) {
          await closeMenus();
        }
        if (attempt < 3) await settle(CFG.maxSettleMs);
      }
    }
    logMenuState("Menu failed");
    throw new Error("menu after More options");
  }

  function getSelectedFormat() {
    return String(CFG.downloadFormat || "MP3").toUpperCase();
  }

  function isFormatOptionRow(el, format = getSelectedFormat()) {
    const blob = ((el.textContent || "") + " " + (el.getAttribute("aria-label") || "")).replace(/\s+/g, " ").trim();
    if (!blob || blob.length > 48) return false;
    if (/Unlock|Manage|Stem|MIDI|MP4|video/i.test(blob)) return false;
    const fmt = format.toUpperCase();
    const others = ["MP3", "WAV", "M4A"].filter((f) => f !== fmt);
    if (others.some((o) => new RegExp("^" + o + "$", "i").test(blob) || new RegExp("^" + o + "\\b", "i").test(blob))) {
      return false;
    }
    return new RegExp("^" + fmt + "$", "i").test(blob) || new RegExp("^" + fmt + "\\b", "i").test(blob);
  }

  function findFormatOptionInModal(modal, format = getSelectedFormat()) {
    const scope = modal || findDownloadFormatModal();
    if (!scope) return null;
    const candidates = [
      ...scope.querySelectorAll(
        '[role="radio"], [role="option"], [role="menuitemradio"], button, [role="button"], label, div, span'
      ),
    ];
    let best = null;
    for (const el of candidates) {
      if (el.closest("#suno-bm-panel")) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 20 || r.height < 12) continue;
      if (!isFormatOptionRow(el, format)) continue;
      const clickable =
        el.closest('[role="radio"], [role="option"], button, [role="button"], label') || el;
      if (!best || (el.textContent || "").trim().length < (best.textContent || "").trim().length) {
        best = clickable;
      }
    }
    return best;
  }

  function findMp3OptionInModal(modal) {
    return findFormatOptionInModal(modal, "MP3");
  }

  function findUnlockDownloadButton(modal) {
    const scope = modal || findDownloadFormatModal();
    if (!scope) return null;
    const buttons = [...scope.querySelectorAll("button, a, [role='button']")];
    return (
      buttons.find((el) => /Unlock\s*&\s*Download/i.test(buttonLabel(el)) && isClickable(el)) ||
      buttons.find((el) => /^\s*Download\s*$/i.test(buttonLabel(el)) && isClickable(el)) ||
      null
    );
  }

  async function openDownloadFormatModal(dl) {
    statusMsg("Click Download → format modal…");
    log("Download target:", menuItemLabel(dl));
    const target = menuItemClickTarget(dl);

    for (let attempt = 1; attempt <= 4; attempt++) {
      const already = findDownloadFormatModal();
      if (already) {
        log("Download modal already open");
        return already;
      }
      await menuPortalClick(target, attempt === 1 ? "Download" : "Download retry");
      try {
        const modal = await waitFor(() => findDownloadFormatModal(), "Download format modal", 6000);
        log("Download modal open");
        return modal;
      } catch (_) {
        log("Download modal not open yet, attempt", attempt);
        await settle(CFG.maxSettleMs);
      }
    }
    throw new Error("Download format modal");
  }

  async function selectFormatInModal(modal, format = getSelectedFormat()) {
    statusMsg(`Select ${format}…`);
    let scope = modal || findDownloadFormatModal();
    let opt = findFormatOptionInModal(scope, format);
    if (!opt) {
      opt = await waitFor(() => findFormatOptionInModal(findDownloadFormatModal(), format), format + " option", 8000);
      scope = findDownloadFormatModal() || scope;
    }
    log("Format option:", format, (opt.textContent || "").trim());
    await clickOnce(opt, format);
    await sleep(300);
  }

  async function selectMp3InModal(modal) {
    return selectFormatInModal(modal, "MP3");
  }

  async function watchDownloadSignal(timeoutMs = 10000) {
    return await new Promise((resolve) => {
      let done = false;
      const finish = (reason) => {
        if (done) return;
        done = true;
        try { obs && obs.disconnect(); } catch (_) {}
        clearTimeout(timer);
        resolve(reason);
      };
      let obs = null;
      try {
        obs = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            const n = e.name || "";
            if (/\.(mp3|wav|m4a)(\?|$)/i.test(n) || /cdn.*suno|audiopipe|download/i.test(n)) {
              finish("network");
              return;
            }
          }
        });
        obs.observe({ entryTypes: ["resource"] });
      } catch (_) {}
      const timer = setTimeout(() => finish("timeout"), timeoutMs);
    });
  }

  async function clickUnlockAndDownload(modal, songId, title) {
    if (songId && (unlockedSongIds.has(songId) || getDoneSet().has(songId))) {
      log("skip Unlock — already tracked", songId.slice(0, 8));
      return true;
    }
    // Lock BEFORE click so any re-entry cannot download again
    if (songId) {
      unlockedSongIds.add(songId);
      markSongDownloaded(songId, title);
      log("pre-locked song (no re-download)", (title || "").slice(0, 32), songId.slice(0, 8));
    }
    statusMsg("Click Unlock & Download…");
    const btn =
      findUnlockDownloadButton(modal) ||
      (await waitFor(() => findUnlockDownloadButton(findDownloadFormatModal()), "Unlock & Download", 8000));
    log("Confirm button:", buttonLabel(btn));
    const watch = watchDownloadSignal(Math.min(12000, CFG.wavModalTimeout));
    await clickOnce(btn, "Unlock & Download");

    const startTs = Date.now();
    let closed = false;
    while (Date.now() - startTs < CFG.wavModalTimeout) {
      pauseAllMedia();
      if (!findDownloadFormatModal()) {
        closed = true;
        break;
      }
      await sleep(CFG.pollMs);
    }
    const signal = await watch;
    log("download signal:", signal, closed ? "modal-closed" : "modal-open");
    if (!closed && findDownloadFormatModal()) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(250);
    }
    await settle(CFG.maxSettleMs);
    return true;
  }

  async function openDownloadSubmenu(dl) {
    // Kept for compatibility — new UI opens a format modal instead of a hover submenu.
    await openDownloadFormatModal(dl);
  }

  async function clickDownloadMp3AndConfirm(dl, songId, title) {
    if (songId && (getDoneSet().has(songId) || unlockedSongIds.has(songId))) {
      log("already tracked — skip download UI", songId.slice(0, 8));
      return true;
    }
    const modal = await openDownloadFormatModal(dl);
    pauseAllMedia();
    await selectFormatInModal(modal || findDownloadFormatModal(), getSelectedFormat());
    pauseAllMedia();
    const started = await clickUnlockAndDownload(findDownloadFormatModal() || modal, songId, title);
    try {
      await waitForMenusClosed(CFG.menuOpenTimeout);
    } catch (_) {
      log("menu cleanup after download ignored");
    }
    await settle(CFG.maxSettleMs);
    return !!started;
  }

  async function closeMenus() {
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(150);
    }
    await waitForMenusClosed(CFG.menuOpenTimeout);
  }

  async function downloadOne(card, globalNum, seenCount) {
    await waitIfTabHidden();
    if (window.__sunoBmStop) return null;
    const id = getSongId(card);
    if (!id) throw new Error("song id not found");
    const title = getSongTitle(card) || id;
    if (shouldSkipSong(id, title)) {
      log("skip already tracked", title.slice(0, 32), id.slice(0, 8));
      markSongDownloaded(id, title);
      return id;
    }

    // Claim this song immediately so parallel/retry paths cannot start a second download
    unlockedSongIds.add(id);
    markSongDownloaded(id, title);

    log("download song", title.slice(0, 40), id.slice(0, 8), getSelectedFormat(), CFG.clipMode);

    statusMsg(`#${globalNum} · ${playlistProgressLine(getSavedListMeta(), getDoneSet(), getSeenSet())} · ${title.slice(0, 22)}`);

    startPlayerGuard();
    let downloadStarted = false;
    try {
      const dl = await openMoreMenu(card);
      downloadStarted = await clickDownloadMp3AndConfirm(dl, id, title);
      if (downloadStarted) markSongDownloaded(id, title);
      try {
        await closeMenus();
      } catch (_) {
        log("closeMenus after download ignored");
      }
      silencePlayer();
      await settle(CFG.maxSettleMs);
      return id;
    } catch (err) {
      if (downloadStarted || unlockedSongIds.has(id) || getDoneSet().has(id)) {
        log("download already started — no retry", id.slice(0, 8), err.message);
        markSongDownloaded(id, title);
        try { await closeMenus(); } catch (_) {}
        return id;
      }
      throw err;
    } finally {
      stopPlayerGuard();
    }
  }

  async function processCard(card, done, stats, globalNum, seenCount) {
    await waitIfTabHidden();
    if (window.__sunoBmStop) return { downloaded: 0, skipped: 0, errors: 0 };
    const id = getSongId(card);
    const title = getSongTitle(card) || id || "";
    if (!id) return { downloaded: 0, skipped: 1, errors: 0 };

    if (shouldSkipSong(id, title, done)) {
      if (!done.has(id)) markSongDownloaded(id, title, done);
      log("skip tracked/same-title", title.slice(0, 32), id.slice(0, 8));
      stats.skipped++;
      saveStats(stats);
      return { downloaded: 0, skipped: 1, errors: 0 };
    }

    try {
      const saved = await downloadOne(card, globalNum, seenCount);
      if (saved) {
        markSongDownloaded(saved, title, done);
        stats.downloaded++;
        saveStats(stats);
        return { downloaded: 1, skipped: 0, errors: 0 };
      }
    } catch (err) {
      // Never retry Unlock flow — retries caused Windows (1)(2)(3) duplicates
      if (unlockedSongIds.has(id) || getDoneSet().has(id)) {
        markSongDownloaded(id, title, done);
        log("error after lock — counted done, no retry", id.slice(0, 8), err.message);
        return { downloaded: 1, skipped: 0, errors: 0 };
      }
      stats.errors++;
      saveStats(stats);
      const fails = bumpFailed(id);
      statusMsg(`Failed ${id.slice(0, 8)} (${fails}x): ${err.message} — scrolling on`);
      logError(`Failed ${id.slice(0, 8)}`, err.message);
      try { await closeMenus(); } catch (_) {}
      return { downloaded: 0, skipped: 0, errors: 1 };
    }
    return { downloaded: 0, skipped: 0, errors: 0 };
  }

  async function runScrollDownload(planOverride) {
    const plan = { ...getPlan(), ...planOverride };
    await prepForDownload();

    const done = getDoneSet();
    const seen = getSeenSet();
    const stats = getStats();
    let downloaded = 0;
    let skipped = 0;
    let errors = 0;
    let processed = 0;
    let globalNum = done.size;

    const container = findScrollContainer();
    if (!getSongCards().length && !container) {
      return { ok: false, downloaded: 0, skipped: 0, errors: 0, hasMore: false };
    }

    window.__sunoBmStop = false;

    registerVisibleSongs(seen);
    saveListMeta();
    statusMsg(`Slow scroll start · ${seen.size} seen · ${countUnseenUndone(done, seen)} left`);

    if (plan.onlyCount != null && plan.targetIds) {
      for (const id of plan.targetIds) {
        if (window.__sunoBmStop || (plan.onlyCount != null && processed >= plan.onlyCount)) break;
        if (done.has(id)) {
          skipped++;
          processed++;
          continue;
        }
        const card = findCardBySongId(id);
        if (!card) {
          errors++;
          log("card not found for", id);
          continue;
        }
        scrollCardIntoView(card, "center");
        await waitForCardInteractive(card, CFG.cardReadyTimeout);
        registerVisibleSongs(seen);
        globalNum++;
        const r = await processCard(card, done, stats, globalNum, seen.size);
        downloaded += r.downloaded;
        skipped += r.skipped;
        errors += r.errors;
        processed++;
      }
    } else {
      if (container) {
        const saved = getScrollPos();
        const resume = saved > 0 && countUnseenUndone(done, seen) > 0 && !plan.freshStart;
        if (resume) {
          applySavedScrollPosition(container);
        } else {
          container.scrollTop = 0;
          saveScrollPos(0);
        }
        await waitForScrollIdle(container);
        registerVisibleSongs(seen);
        if (resume) {
          statusMsg(
            `Resuming at ${scrollProgress(container)}% · ${seen.size} seen · ${countUnseenUndone(done, seen)} left`
          );
        }
      }

      let lastScrollHeight = container?.scrollHeight || 0;
      let bottomStable = 0;
      const stableNeeded = bottomStableNeededFor(done, seen);

      while (!window.__sunoBmStop) {
        if (plan.onlyCount != null && processed >= plan.onlyCount) break;

        registerVisibleSongs(seen);
        const pct = scrollProgress(container);

        let card = pickNextCard(done, seen);
        while (card && !window.__sunoBmStop) {
          if (plan.onlyCount != null && processed >= plan.onlyCount) break;

          const title =
            card.querySelector("a[href*='/song/']")?.textContent?.trim() ||
            getSongId(card)?.slice(0, 8) ||
            "?";
          globalNum++;
          statusMsg(`#${globalNum} at ${pct}% · ${title.slice(0, 24)} · downloading…`);
          const r = await processCard(card, done, stats, globalNum, seen.size);
          downloaded += r.downloaded;
          skipped += r.skipped;
          errors += r.errors;
          processed++;
          await closeMenus();
          registerVisibleSongs(seen);
          card = pickNextCard(done, seen);
        }

        if (plan.onlyCount != null && processed >= plan.onlyCount) break;

        if (!container) break;

        const atBottom = isAtScrollBottom(container, 20);

        if (atBottom) {
          const beforeCount = getSongCards().length;
          container.scrollTop = container.scrollHeight;
          await waitForScrollGrowth(container, beforeCount, lastScrollHeight, CFG.scrollLoadTimeout);
          registerVisibleSongs(seen);

          if (container.scrollHeight <= lastScrollHeight + 4) {
            bottomStable++;
          } else {
            bottomStable = 0;
            lastScrollHeight = container.scrollHeight;
          }

          statusMsg(
            `Bottom ${scrollProgress(container)}% · seen ${seen.size} · stable ${bottomStable}/${stableNeeded}`
          );

          if (bottomStable >= stableNeeded) {
            const meta = getSavedListMeta();
            const left = countUnseenUndone(done, seen);
            const failedLeft = Object.keys(getFailedMap()).filter((id) => seen.has(id) && !done.has(id)).length;

            if (isPlaylistFullyComplete(meta, done, seen)) {
              log("playlist complete — all songs saved", playlistProgressLine(meta, done, seen));
              finishAll(
                `Playlist complete: "${meta.name}" — ${playlistProgressLine(meta, done, seen)}.`
              );
              return { ok: true, downloaded, skipped, errors, hasMore: false, finished: true };
            }

            const target = getTargetSongCount(meta, seen);
            if (target && seen.size < target) {
              log("list still loading — seen", seen.size, "of", target);
              bottomStable = 0;
              await scrollToLoadMore();
              registerVisibleSongs(seen);
              continue;
            }

            if (left === 0 && (!target || seen.size >= target)) {
              log("absolute end — all songs in list saved");
              finishAll(`Playlist complete: "${getSavedListMeta().name}" — ${playlistProgressLine(meta, done, seen)}.`);
              return { ok: true, downloaded, skipped, errors, hasMore: false, finished: true };
            }
            if (failedLeft === left) {
              log("absolute end — remaining are failed skips only");
              break;
            }
            log(`${left} left — second pass from top`);
            bottomStable = 0;
            container.scrollTop = 0;
            saveScrollPos(0);
            await sleep(1000);
          }
        } else {
          bottomStable = 0;
          await smartScrollDown(container, done, seen);
        }
      }
    }

    stats.pagesDone++;
    saveStats(stats);

    registerVisibleSongs(seen);
    const meta = getSavedListMeta();
    const left = countUnseenUndone(done, seen);
    statusMsg(`Pass done +${downloaded} new · ${playlistProgressLine(meta, done, seen)} · ${errors} err`);
    if (!window.__sunoBmStop && canFinishPlaylist(meta, done, seen)) {
      finishAll(`Playlist complete: "${meta.name}" — ${playlistProgressLine(meta, done, seen)}.`);
      return { ok: true, downloaded, skipped, errors, hasMore: false, finished: true };
    }
    const target = getTargetSongCount(meta, seen);
    if (left === 0 && target && seen.size < target) {
      log("pass done but list incomplete — seen", seen.size, "of", target);
      return { ok: true, downloaded, skipped, errors, hasMore: true };
    }
    if (left === 0 && !target && seen.size > 0 && !window.__sunoBmStop) {
      finishAll(`Playlist complete: "${meta.name}" — all ${seen.size} songs saved.`);
      return { ok: true, downloaded, skipped, errors, hasMore: false, finished: true };
    }
    return { ok: true, downloaded, skipped, errors, hasMore: left > 0 };
  }

  function finishAll(msg) {
    clearAutorun();
    setRunning(false);
    const doneSet = getDoneSet();
    const seenSet = getSeenSet();
    const total = doneSet.size;
    const seen = seenSet.size;
    const left = countUnseenUndone(doneSet, seenSet);
    const savedInList = countSavedInSeen(doneSet, seenSet);
    const stats = getStats();
    const meta = getSavedListMeta();
    const listName = meta.name;
    const complete = canFinishPlaylist(meta, doneSet, seenSet);
    let entry = null;

    if (complete) {
      entry = markPlaylistComplete(meta, seen, savedInList);
    }

    const expectedLine = meta.expectedCount
      ? `Suno list size: ${meta.expectedCount} songs\n`
      : "";
    const matchLine =
      meta.expectedCount && complete
        ? seen >= meta.expectedCount
          ? "✓ Scrolled count matches Suno list size.\n\n"
          : `⚠ Only scrolled past ${seen} of ${meta.expectedCount} — open list fully or Resume.\n\n`
        : "";

    alert(
      msg ||
        (complete
          ? `${playlistDoneMessage(listName)}\n\n${expectedLine}Saved (clicks): ${savedInList}\nSeen: ${seen}\nErrors: ${stats.errors}\n\n${matchLine}Verify MP3 files landed in your Downloads folder.`
          : `Not finished — "${listName}"\n\n` +
            expectedLine +
            `Saved in this list: ${savedInList}\n` +
            `Seen: ${seen}\n` +
            `Still need: ${left}\n` +
            `Errors: ${stats.errors}\n\n` +
            `Click Resume to continue this playlist.`)
    );
    refreshPanel(complete ? `FINISHED — ${listName}` : `Stopped — ${left} left in "${listName}"`);
  }

  async function downloadAllLoop() {
    lockPlaylistForRun();
    setAutorun();
    setRunning(true);
    window.__sunoBmStop = false;

    while (!window.__sunoBmStop) {
      await waitIfTabHidden();
      if (window.__sunoBmStop) break;
      if (!assertSamePlaylist()) return;
      refreshPanel();

      if (!getSongCards().length) {
        const n = await waitForSongs();
        if (!n) {
          finishAll();
          return;
        }
      }

      const plan = getPlan();
      const result = await runScrollDownload(plan);

      if (window.__sunoBmStop) {
        clearAutorun();
        setRunning(false);
        statusMsg("Stopped — click Resume to continue");
        refreshPanel("Stopped — click Resume to continue");
        return;
      }

      if (plan.stopAfterPage) {
        finishAll("Test batch complete.");
        return;
      }

      if (plan.nextPlan) {
        setPlan({ ...defaultPlan(), ...plan.nextPlan });
      } else if (plan.mode === "playlist") {
        setPlan(defaultPlan());
      }

      if (plan.mode !== "playlist" && hasPagination()) {
        statusMsg(`Paginated UI — going to page ${getPage() + 1}…`);
        const next = getPage() + 1;
        const nav = await goToNextPage(next);
        if (nav === "hard") {
          setRunning(false);
          return;
        }
        await waitForPageReady(next);
        await prepForDownload();
        await settle(CFG.maxSettleMs);
        continue;
      }

      if (result.finished) {
        lockedPlaylistKey = null;
        lockedUrlSignature = null;
        setRunning(false);
        return;
      }

      if (result.hasMore) {
        statusMsg(`${countUnseenUndone(getDoneSet(), getSeenSet())} left in this playlist — continuing…`);
        continue;
      }

      if (canFinishPlaylist(getSavedListMeta(), getDoneSet(), getSeenSet())) {
        finishAll("This playlist is fully downloaded.");
      } else {
        statusMsg("Pass done — still songs left in this playlist");
        continue;
      }
      lockedPlaylistKey = null;
      lockedUrlSignature = null;
      return;
    }

    lockedPlaylistKey = null;
    lockedUrlSignature = null;
    setRunning(false);
  }

  async function testOneSong() {
    window.__sunoBmStop = false;
    const card = pickNextCard(getDoneSet()) || getSongCards()[0];
    if (!card) {
      alert("No song row found.");
      return;
    }
    scrollCardIntoView(card, "center");
    registerVisibleSongs(getSeenSet());
    setPlan({ mode: "test", onlyCount: 1, stopAfterPage: true, targetIds: null });
    statusMsg("TEST 1 song — watch the menus");
    const done = getDoneSet();
    const stats = getStats();
    setRunning(true);
    await processCard(card, done, stats, done.size + 1, getSeenSet().size);
    setRunning(false);
    statusMsg("Test 1 done — check console for menu logs");
  }

  async function testLastAndFirst() {
    window.__sunoBmStop = false;
    const all = getSongCards();
    if (all.length < 2) {
      alert("Need at least 2 songs in the list.");
      return;
    }

    const lastTwo = all.slice(-2).map(getSongId).filter(Boolean);
    const container = findScrollContainer();
    if (container && lastTwo.length) {
      const lastCard = findCardBySongId(lastTwo[lastTwo.length - 1]);
      if (lastCard) {
        scrollCardIntoView(lastCard, "end");
        await sleep(800);
      }
    }

    setAutorun();
    setPlan({
      mode: "test",
      onlyCount: 2,
      targetIds: lastTwo,
      stopAfterPage: true,
      nextPlan: null,
    });
    statusMsg(`TEST: last 2 songs by ID`);
    await downloadAllLoop();
  }

  function retryFailedSongs() {
    const done = getDoneSet();
    const seen = getSeenSet();
    const map = getFailedMap();
    let cleared = 0;
    for (const id of Object.keys(map)) {
      if (seen.has(id) && !done.has(id)) {
        delete map[id];
        cleared++;
      }
    }
    saveFailedMap(map);
    statusMsg(cleared ? `Retry enabled for ${cleared} failed song(s)` : "No failed songs to retry");
  }

  function startOnePass() {
    if (blockIfPlaylistDone()) return;
    setPlan({ ...defaultPlan(), stopAfterPage: true, freshStart: true });
    saveScrollPos(0);
    downloadAllLoop();
  }

  const panel = document.createElement("div");
  panel.id = "suno-bm-panel";
  panel.style.cssText =
    "position:fixed;top:10px;left:10px;z-index:5000;width:292px;max-height:90vh;overflow:hidden;display:flex;flex-direction:column;background:#071009;color:#eafff0;padding:0;border-radius:12px;font:11px/1.35 system-ui,sans-serif;box-shadow:0 10px 36px rgba(0,0,0,.65);border:2px solid #22c55e;pointer-events:none";

  panel.innerHTML = `
    <div id="suno-bm-drag-handle" style="display:flex;align-items:center;justify-content:space-between;padding:7px 9px;cursor:move;user-select:none;pointer-events:auto;border-bottom:1px solid #166534;background:linear-gradient(135deg,#0f2a18,#071009);border-radius:10px 10px 0 0">
      <div>
        <div style="font-weight:800;font-size:12px;color:#4ade80;letter-spacing:.04em">⬇ SUNO DOWNLOADER</div>
        <div style="font-size:9px;color:#86efac;margin-top:1px">playlist · format picker · no re-download</div>
      </div>
      <div style="display:flex;gap:4px;align-items:center">
        <span id="suno-bm-state-badge" style="font-size:9px;padding:2px 7px;border-radius:999px;background:#14532d;color:#bbf7d0;font-weight:700">READY</span>
        <button type="button" id="suno-bm-collapse" style="padding:1px 7px;cursor:pointer;background:#14532d;border:1px solid #22c55e;border-radius:5px;color:#bbf7d0;font-size:11px;pointer-events:auto">−</button>
      </div>
    </div>
    <div id="suno-bm-body" style="overflow:auto;flex:1 1 auto;min-height:0">
      <div style="padding:7px 9px 0">
        <div id="suno-bm-page-line" style="color:#86efac;font-size:10px;margin-bottom:5px;line-height:1.35;font-weight:600"></div>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:5px;text-align:center;font-size:10px">
          <div style="background:#0f1f14;border-radius:6px;padding:4px 2px;border:1px solid #166534"><div style="color:#6ee7a0;font-size:8px">SAVED</div><div id="suno-bm-stat-done" style="color:#4ade80;font-weight:800;font-size:15px">0</div></div>
          <div style="background:#1f1408;border-radius:6px;padding:4px 2px;border:1px solid #854d0e"><div style="color:#fcd34d;font-size:8px">LEFT</div><div id="suno-bm-stat-left" style="color:#fbbf24;font-weight:800;font-size:15px">0</div></div>
          <div style="background:#0a1628;border-radius:6px;padding:4px 2px;border:1px solid #1d4ed8"><div style="color:#93c5fd;font-size:8px">SEEN</div><div id="suno-bm-stat-seen" style="color:#60a5fa;font-weight:800;font-size:15px">0</div></div>
        </div>

        <div style="background:#0f1f14;border-radius:6px;height:8px;overflow:hidden;margin-bottom:2px;border:1px solid #166534">
          <div id="suno-bm-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#15803d,#4ade80);transition:width .3s"></div>
        </div>
        <div id="suno-bm-bar-text" style="font-size:9px;color:#86efac;margin-bottom:4px">Saved 0 / 0</div>

        <div style="display:flex;gap:4px;align-items:center;margin-bottom:4px">
          <div style="flex:1;background:#0a1628;border-radius:5px;height:5px;overflow:hidden;border:1px solid #1e3a8a">
            <div id="suno-bm-scroll-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#1d4ed8,#60a5fa);transition:width .3s"></div>
          </div>
          <span id="suno-bm-scroll-bar-text" style="font-size:8px;color:#93c5fd;white-space:nowrap">0%</span>
        </div>

        <div id="suno-bm-status-line" style="color:#fde68a;font-size:10px;min-height:24px;padding:5px 7px;background:#1a1208;border-radius:6px;border:1px solid #854d0e;margin-bottom:5px;line-height:1.35;font-weight:600"></div>
        <div id="suno-bm-flow-dots" style="font-size:9px;color:#4ade80;margin-bottom:4px;font-weight:600">⋯ → Download → MP3</div>
        <div id="suno-bm-eta-line" style="color:#9ca3af;font-size:9px;margin-bottom:2px;line-height:1.3"></div>
        <div id="suno-bm-coverage-line" style="color:#6ee7a0;font-size:9px;margin-bottom:2px;line-height:1.3"></div>
        <div id="suno-bm-mode-line" style="color:#64748b;font-size:8px;margin-bottom:5px;line-height:1.3"></div>

        <details style="font-size:9px;margin-bottom:5px;pointer-events:auto">
          <summary style="cursor:pointer;color:#86efac;margin-bottom:4px">More stats · logs · help</summary>
          <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:3px;margin-bottom:5px;text-align:center">
            <div style="background:#1f1010;border-radius:5px;padding:3px;border:1px solid #7f1d1d"><div style="color:#fca5a5;font-size:8px">ERR</div><div id="suno-bm-stat-err" style="color:#f87171;font-weight:700;font-size:12px">0</div></div>
            <div style="background:#141414;border-radius:5px;padding:3px;border:1px solid #333"><div style="color:#aaa;font-size:8px">SKIP</div><div id="suno-bm-stat-skip" style="color:#ccc;font-weight:700;font-size:12px">0</div></div>
            <div style="background:#1f1408;border-radius:5px;padding:3px;border:1px solid #854d0e"><div style="color:#fcd34d;font-size:8px">FAIL</div><div id="suno-bm-stat-failed" style="color:#fbbf24;font-weight:700;font-size:12px">0</div></div>
          </div>
          <div style="font-size:9px;color:#666;margin-bottom:2px">NOW: <span id="suno-bm-current-song" style="color:#eee">—</span> · <span id="suno-bm-current-step" style="color:#fcd34d">Idle</span></div>
          <div id="suno-bm-session-line" style="color:#666;font-size:8px;margin-bottom:4px"></div>
          <span id="suno-bm-stat-visible" style="display:none">0</span>
          <span id="suno-bm-stat-batch" style="display:none">0</span>
          <div id="suno-bm-log-count" style="font-size:8px;color:#777;margin-bottom:3px">0 logs</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px;margin-bottom:4px">
            <button type="button" id="suno-bm-copy-logs" style="padding:4px;cursor:pointer;background:#0f172a;color:#93c5fd;border:1px solid #1d4ed8;border-radius:5px;font-size:9px;pointer-events:auto">Copy</button>
            <button type="button" id="suno-bm-dl-logs" style="padding:4px;cursor:pointer;background:#0f172a;color:#93c5fd;border:1px solid #1d4ed8;border-radius:5px;font-size:9px;pointer-events:auto">Save</button>
            <button type="button" id="suno-bm-clear-logs" style="padding:4px;cursor:pointer;background:#222;color:#aaa;border:1px solid #444;border-radius:5px;font-size:9px;pointer-events:auto">Clear</button>
          </div>
          <pre id="suno-bm-log-preview" style="max-height:70px;overflow:auto;font-size:8px;color:#888;background:#0a0a0a;padding:4px;border-radius:5px;border:1px solid #222;white-space:pre-wrap;margin:0">(no logs)</pre>
        </details>
      </div>
    </div>
    <div id="suno-bm-actions" style="flex:0 0 auto;padding:7px 9px 9px;border-top:1px solid #166534;background:#0a1a10;border-radius:0 0 10px 10px;pointer-events:auto">
      <button type="button" id="suno-bm-all" style="width:100%;padding:9px 10px;margin-bottom:5px;cursor:pointer;background:#15803d;color:#fff;border:1px solid #4ade80;border-radius:7px;font-weight:800;font-size:12px">▶ Download This Playlist</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:4px">
        <button type="button" id="suno-bm-resume" style="padding:7px;cursor:pointer;background:#14532d;color:#bbf7d0;border:1px solid #22c55e;border-radius:6px;font-weight:700;font-size:10px">↻ Resume</button>
        <button type="button" id="suno-bm-stop" disabled style="padding:7px;cursor:pointer;background:#450a0a;color:#fca5a5;border:1px solid #ef4444;border-radius:6px;font-weight:700;font-size:10px">■ Stop</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:4px;pointer-events:auto">
        <label style="font-size:9px;color:#bbf7d0;font-weight:600">Format
          <select id="suno-bm-format" style="display:block;width:100%;margin-top:2px;padding:4px;border-radius:4px;border:1px solid #166534;background:#051008;color:#ecfdf5;box-sizing:border-box">
            <option value="MP3" selected>MP3</option>
            <option value="WAV">WAV</option>
            <option value="M4A">M4A</option>
          </select>
        </label>
        <label style="font-size:9px;color:#bbf7d0;font-weight:600">Same title
          <select id="suno-bm-clip-mode" title="Suno often has 2 clips with the same title" style="display:block;width:100%;margin-top:2px;padding:4px;border-radius:4px;border:1px solid #166534;background:#051008;color:#ecfdf5;box-sizing:border-box">
            <option value="both">Both clips</option>
            <option value="one-title" selected>One per title</option>
          </select>
        </label>
      </div>
      <details id="suno-bm-delays" style="pointer-events:auto;margin-bottom:4px">
        <summary style="cursor:pointer;color:#86efac;font-size:9px;margin-bottom:4px;font-weight:600">Wait times (seconds)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:9px;color:#bbf7d0;margin-bottom:4px">
          <label title="Max wait for Download item after ⋯">① Menu<input id="suno-bm-delay-menu" type="number" min="3" max="30" step="1" value="12" style="padding:3px;border-radius:4px;border:1px solid #166534;background:#051008;color:#ecfdf5;width:100%;box-sizing:border-box;margin-top:2px"></label>
          <label title="Short pause after each action">Settle<input id="suno-bm-delay-settle" type="number" min="0.1" max="2" step="0.1" value="0.25" style="padding:3px;border-radius:4px;border:1px solid #166534;background:#051008;color:#ecfdf5;width:100%;box-sizing:border-box;margin-top:2px"></label>
          <label title="Longer pause on retries">Settle+ <input id="suno-bm-delay-settle-max" type="number" min="0.2" max="3" step="0.1" value="0.7" style="padding:3px;border-radius:4px;border:1px solid #166534;background:#051008;color:#ecfdf5;width:100%;box-sizing:border-box;margin-top:2px"></label>
          <label title="Max wait for Download File modal">Modal<input id="suno-bm-delay-modal" type="number" min="5" max="45" step="1" value="20" style="padding:3px;border-radius:4px;border:1px solid #166534;background:#051008;color:#ecfdf5;width:100%;box-sizing:border-box;margin-top:2px"></label>
        </div>
        <details id="suno-bm-delay-wav-section" style="margin-top:2px">
          <summary style="cursor:pointer;color:#fde68a;font-size:9px;font-weight:600">② Format modal (Download → MP3)</summary>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;font-size:9px;color:#fde68a;margin-top:4px">
            <label title="Max wait for MP3 submenu to appear">MP3 wait<input id="suno-bm-delay-wav" type="number" min="3" max="30" step="1" value="12" style="padding:3px;border-radius:4px;border:1px solid #854d0e;background:#1a1208;color:#fef3c7;width:100%;box-sizing:border-box;margin-top:2px"></label>
            <label title="Pause between hover attempts">Hover<input id="suno-bm-delay-hover-step" type="number" min="0.05" max="1" step="0.05" value="0.15" style="padding:3px;border-radius:4px;border:1px solid #854d0e;background:#1a1208;color:#fef3c7;width:100%;box-sizing:border-box;margin-top:2px"></label>
          </div>
        </details>
      </details>
      <details style="pointer-events:auto">
        <summary style="cursor:pointer;color:#86efac;font-size:9px;margin-bottom:4px">Tests · reset · retry</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px;margin-bottom:3px">
          <button type="button" id="suno-bm-test1" style="padding:6px;cursor:pointer;background:#422006;color:#fde68a;border:1px solid #ca8a04;border-radius:5px;font-size:9px">Test 1</button>
          <button type="button" id="suno-bm-test1921" style="padding:6px;cursor:pointer;background:#422006;color:#fde68a;border:1px solid #ca8a04;border-radius:5px;font-size:9px">Test 2</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:3px">
          <button type="button" id="suno-bm-reset" style="padding:5px;cursor:pointer;background:#222;color:#ccc;border:1px solid #444;border-radius:5px;font-size:9px">Reset playlist</button>
          <button type="button" id="suno-bm-retry" style="padding:5px;cursor:pointer;background:#422006;color:#fde68a;border:1px solid #854d0e;border-radius:5px;font-size:9px">Retry</button>
          <button type="button" id="suno-bm-onepass" style="padding:5px;cursor:pointer;background:#0f172a;color:#93c5fd;border:1px solid #1d4ed8;border-radius:5px;font-size:9px">1 pass</button>
        </div>
      </details>
    </div>
  `;
  document.body.appendChild(panel);

  (function makeDraggable(box, handle) {
    let drag = false;
    let sx, sy, sl, st;
    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      drag = true;
      const rect = box.getBoundingClientRect();
      box.style.bottom = "auto";
      box.style.right = "auto";
      box.style.left = rect.left + "px";
      box.style.top = rect.top + "px";
      sx = e.clientX;
      sy = e.clientY;
      sl = rect.left;
      st = rect.top;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      box.style.left = sl + e.clientX - sx + "px";
      box.style.top = st + e.clientY - sy + "px";
    });
    window.addEventListener("mouseup", () => {
      drag = false;
    });
  })(panel, document.getElementById("suno-bm-drag-handle"));

  ui = {
    stateBadge: document.getElementById("suno-bm-state-badge"),
    pageLine: document.getElementById("suno-bm-page-line"),
    currentSong: document.getElementById("suno-bm-current-song"),
    currentStep: document.getElementById("suno-bm-current-step"),
    flowDots: document.getElementById("suno-bm-flow-dots"),
    statDone: document.getElementById("suno-bm-stat-done"),
    statLeft: document.getElementById("suno-bm-stat-left"),
    statSeen: document.getElementById("suno-bm-stat-seen"),
    statVisible: document.getElementById("suno-bm-stat-visible"),
    statErr: document.getElementById("suno-bm-stat-err"),
    statSkip: document.getElementById("suno-bm-stat-skip"),
    statFailed: document.getElementById("suno-bm-stat-failed"),
    statBatch: document.getElementById("suno-bm-stat-batch"),
    etaLine: document.getElementById("suno-bm-eta-line"),
    sessionLine: document.getElementById("suno-bm-session-line"),
    coverageLine: document.getElementById("suno-bm-coverage-line"),
    modeLine: document.getElementById("suno-bm-mode-line"),
    statusLine: document.getElementById("suno-bm-status-line"),
    scrollBar: document.getElementById("suno-bm-scroll-bar"),
    scrollBarText: document.getElementById("suno-bm-scroll-bar-text"),
    bar: document.getElementById("suno-bm-bar"),
    barText: document.getElementById("suno-bm-bar-text"),
    logCount: document.getElementById("suno-bm-log-count"),
    logPreview: document.getElementById("suno-bm-log-preview"),
    body: document.getElementById("suno-bm-body"),
    actions: document.getElementById("suno-bm-actions"),
    collapseBtn: document.getElementById("suno-bm-collapse"),
  };
  stopBtn = document.getElementById("suno-bm-stop");

  let panelCollapsed = false;
  ui.collapseBtn.onclick = (e) => {
    e.stopPropagation();
    panelCollapsed = !panelCollapsed;
    ui.body.style.display = panelCollapsed ? "none" : "block";
    if (ui.actions) ui.actions.style.display = panelCollapsed ? "none" : "block";
    ui.collapseBtn.textContent = panelCollapsed ? "+" : "−";
  };

  function startDownloadPlaylist(freshStart) {
    applyDelaysFromPanel();
    saveListMeta();
    if (blockIfPlaylistDone()) return;
    if (freshStart) saveScrollPos(0);
    setPlan({ ...defaultPlan(), mode: "playlist", freshStart: !!freshStart });
    statusMsg(`Starting this playlist only: "${getListLabel()}"…`);
    downloadAllLoop();
  }

  restoreDelayPanelUi();
  bindDelayPanelUi();

  document.getElementById("suno-bm-test1").onclick = () => {
    applyDelaysFromPanel();
    testOneSong();
  };
  document.getElementById("suno-bm-test1921").onclick = () => {
    applyDelaysFromPanel();
    testLastAndFirst();
  };
  document.getElementById("suno-bm-all").onclick = () => startDownloadPlaylist(true);
  document.getElementById("suno-bm-resume").onclick = () => startDownloadPlaylist(false);
  document.getElementById("suno-bm-onepass").onclick = () => {
    applyDelaysFromPanel();
    startOnePass();
  };
  document.getElementById("suno-bm-retry").onclick = () => retryFailedSongs();
  document.getElementById("suno-bm-copy-logs").onclick = () => copyLogs().catch((e) => alert("Copy failed: " + e.message));
  document.getElementById("suno-bm-dl-logs").onclick = () => downloadLogFile();
  document.getElementById("suno-bm-clear-logs").onclick = () => clearLogs();
  stopBtn.onclick = () => {
    window.__sunoBmStop = true;
    clearAutorun();
    statusMsg("Stopping…");
  };
  document.getElementById("suno-bm-reset").onclick = () => {
    const name = getListLabel();
    if (!confirm(`Reset "${name}"?\n\nClears saved progress for this playlist so it can download again.\nOther playlists stay marked done.`)) return;
    resetPlaylistRecord();
    sessionStorage.removeItem(CFG.logKey);
    setPlan(defaultPlan());
    saveListMeta();
    refreshPanel("Reset — this playlist only");
  };

  window.__sunoDlGetLogs = exportLogsText;
  window.__sunoDlCopyLogs = copyLogs;
  window.__sunoDlGetPlaylistsDone = getCompletedPlaylists;
  appendLog("info", "Suno MP3 Downloader ready");

  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      sessionStorage.setItem("suno-bm-ext", "1");
    }
  } catch (_) {}

  migrateLegacySessionStorage();
  reconcilePlaylistRecords();
  saveListMeta();
  refreshPanel("Ready");

  try {
    sessionStorage.setItem("suno-bm-loader", "(" + sunoDownloadMain.toString() + ")();");
    sessionStorage.setItem("suno-bm-loader-ver", String(LOADER_VERSION));
  } catch (_) {}

  if (isAutorunForCurrentPlaylist()) {
    if (blockIfPlaylistDone()) {
      clearAutorun();
    } else {
      statusMsg("Auto-resuming this playlist…");
      setTimeout(() => downloadAllLoop(), 2000);
    }
  } else if (isAutorun()) {
    clearAutorun();
  }
})();
