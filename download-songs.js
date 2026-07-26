// ============================================================
// 1) Install chrome-extension folder once (see SETUP.md)
// 2) Paste this in F12 Console on your workspace → Download ALL
// Scrolls to load more songs · skips duplicates · remembers state
// ============================================================

(function sunoDownloadMain() {
  if (!/suno\.com/i.test(location.href)) {
    alert("Open your Suno workspace page first.");
    return;
  }

  const bootTs = Number(sessionStorage.getItem("suno-bm-last-boot") || 0);
  if (Date.now() - bootTs < 2500 && document.getElementById("suno-bm-panel")) return;
  sessionStorage.setItem("suno-bm-last-boot", String(Date.now()));
  sessionStorage.setItem("suno-bm-loader", "(" + sunoDownloadMain.toString() + ")();");

  document.getElementById("suno-bm-panel")?.remove();

  const CFG = {
    pollMs: 150,
    minSettleMs: 250,
    maxSettleMs: 700,
    cardReadyTimeout: 12000,
    menuOpenTimeout: 12000,
    wavSubmenuTimeout: 12000,
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
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = (ms = CFG.minSettleMs) => sleep(ms + Math.floor(Math.random() * 120));

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
      "Suno WAV Download log",
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
    const scopes = [
      ...document.querySelectorAll("main, [role='main'], header, nav"),
      document.body,
    ];
    for (const scope of scopes) {
      const text = (scope.textContent || "").slice(0, 4000);
      const matches = [...text.matchAll(/(\d[\d,]*)\s*Songs?\b/gi)];
      if (!matches.length) continue;
      const nums = matches.map((m) => parseInt(m[1].replace(/,/g, ""), 10)).filter((n) => n > 0);
      if (nums.length) return Math.max(...nums);
    }
    return null;
  }

  function getListMeta() {
    return {
      name: getListLabel(),
      expectedCount: getListSongCount(),
      wid: new URL(location.href).searchParams.get("wid"),
    };
  }

  function getSavedListMeta() {
    const live = getListMeta();
    try {
      const saved = JSON.parse(sessionStorage.getItem(CFG.listMetaKey) || "{}");
      const name = isBadListName(saved.name) ? live.name : saved.name || live.name;
      return { ...live, ...saved, name };
    } catch (_) {
      return live;
    }
  }

  function saveListMeta() {
    const meta = { ...getListMeta(), savedAt: Date.now() };
    if (isBadListName(meta.name)) {
      const crumb = getBreadcrumbListName();
      meta.name = crumb || (meta.wid ? `Workspace ${meta.wid.slice(0, 8)}…` : "Current song list");
    }
    sessionStorage.setItem(CFG.listMetaKey, JSON.stringify(meta));
    sessionStorage.setItem("suno-bm-list-label", meta.name);
    log("list meta", meta.name, meta.expectedCount ? `${meta.expectedCount} songs` : "count unknown");
    return meta;
  }

  function getSavedListLabel() {
    return getSavedListMeta().name || getListLabel();
  }

  function getCompletedPlaylists() {
    try {
      return JSON.parse(sessionStorage.getItem(CFG.playlistsDoneKey) || "[]");
    } catch (_) {
      return [];
    }
  }

  function markPlaylistComplete(meta, seenCount, savedCount) {
    const entry = {
      name: meta.name,
      expectedCount: meta.expectedCount,
      seenCount,
      savedCount,
      completedAt: new Date().toISOString(),
    };
    const done = getCompletedPlaylists().filter((p) => p.name !== meta.name);
    done.push(entry);
    sessionStorage.setItem(CFG.playlistsDoneKey, JSON.stringify(done));
    log("playlist complete", entry);
    return entry;
  }

  function countSavedInSeen(doneSet, seenSet) {
    let n = 0;
    for (const id of seenSet) {
      if (doneSet.has(id)) n++;
    }
    return n;
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
    if (titled && /More -> WAV/i.test(text)) panelMeta.currentSong = titled[1].trim();
    if (/Hover Download/i.test(text)) panelMeta.currentStep = "⋯ → Download menu";
    else if (/Click WAV/i.test(text)) panelMeta.currentStep = "WAV Audio Pro";
    else if (/Download File modal|Click Download File/i.test(text)) panelMeta.currentStep = "Download File modal";
    else if (/Smart skip/i.test(text)) panelMeta.currentStep = "Smart skip (saved block)";
    else if (/Smart jump/i.test(text)) panelMeta.currentStep = "Smart jump to song";
    else if (/downloading/i.test(text)) panelMeta.currentStep = "Downloading WAV…";
    else if (/Stopped/i.test(text)) panelMeta.currentStep = "Stopped";
    else if (/FINISHED|All done/i.test(text)) panelMeta.currentStep = "Complete";
    else if (/Pass done/i.test(text)) panelMeta.currentStep = "Between passes";
  }

  function defaultPlan() {
    return {
      mode: "all",
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
    return new Set(JSON.parse(sessionStorage.getItem(CFG.doneKey) || "[]"));
  }

  function saveDoneSet(set) {
    sessionStorage.setItem(CFG.doneKey, JSON.stringify([...set]));
  }

  function getStats() {
    return JSON.parse(
      sessionStorage.getItem(CFG.statsKey) ||
        '{"downloaded":0,"skipped":0,"errors":0,"pagesDone":0}'
    );
  }

  function saveStats(stats) {
    sessionStorage.setItem(CFG.statsKey, JSON.stringify(stats));
  }

  function clearAutorun() {
    sessionStorage.removeItem(CFG.autorunKey);
    setPlan(defaultPlan());
  }

  function setAutorun() {
    sessionStorage.setItem(CFG.autorunKey, "1");
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
    const saved = Number(sessionStorage.getItem(CFG.scrollPosKey) || 0);
    const top = clampScrollTop(container, saved);
    container.scrollTop = top;
    sessionStorage.setItem(CFG.scrollPosKey, String(top));
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
    const scrollSaved = Number(sessionStorage.getItem(CFG.scrollPosKey) || 0);
    const running = isRunning();
    if (!running && container && scrollSaved > 0 && left > 0) {
      applySavedScrollPosition(container);
    }
    const scrollTop = container?.scrollTop ?? 0;
    const scrollPct = container ? scrollProgressAt(container, scrollTop) : 0;
    const cov = seen > 0 ? Math.min(100, Math.round((doneTotal / seen) * 100)) : 0;

    if (ui.stateBadge) {
      ui.stateBadge.textContent = running ? "RUNNING" : extra === "FINISHED" ? "DONE" : "READY";
      ui.stateBadge.style.background = running ? "#163" : extra === "FINISHED" ? "#246" : "#333";
      ui.stateBadge.style.color = running ? "#afa" : "#ccc";
    }

    if (ui.pageLine) {
      const meta = getSavedListMeta();
      const countPart = meta.expectedCount ? ` · ${meta.expectedCount} songs in Suno` : "";
      const doneLists = getCompletedPlaylists();
      const doneMark = doneLists.some((p) => p.name === meta.name) ? " · ✓ done before" : "";
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
      const s1 = /Download menu|WAV|File|Downloading/.test(step) ? "#6f6" : "#444";
      const s2 = /WAV|File|Downloading/.test(step) ? "#6f6" : "#444";
      const s3 = /File|Downloading/.test(step) && !/modal/.test(step) ? "#6f6" : /Download File/.test(step) ? "#fc8" : "#444";
      ui.flowDots.innerHTML =
        `<span style="color:${s1}">⋯</span> → <span style="color:${s2}">WAV</span> → <span style="color:${s3}">File</span>`;
    }

    if (ui.etaLine) {
      const sec = estimateSecondsPerSong();
      ui.etaLine.textContent = left
        ? `Est. ${formatEta(left * sec)} left · ~${sec}s typical · waits for UI ready`
        : seen
          ? `List complete for scrolled songs — verify .wav count in Downloads folder`
          : `Click Download ALL · ~${sec}s typical per song (event-driven waits)`;
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
        : "Only downloads songs in the OPEN list — open each playlist separately";
    }

    if (ui.modeLine) {
      ui.modeLine.textContent = running
        ? "Working: batch visible songs → smart skip saved blocks → 2nd pass if needed"
        : "Download ALL = fresh start at top · Resume = continue where you stopped";
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
    return listVisibleMenus().length === 0 && !isWavDownloadModalOpen();
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
    return JSON.parse(sessionStorage.getItem(CFG.failedKey) || "{}");
  }

  function saveFailedMap(map) {
    sessionStorage.setItem(CFG.failedKey, JSON.stringify(map));
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
      if (!id || done.has(id)) return false;
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
      return !id || done.has(id) || shouldSkipFailed(id);
    });
  }

  function listUndoneSeenIds(done, seen) {
    return [...seen].filter((id) => !done.has(id) && !shouldSkipFailed(id));
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
    sessionStorage.setItem(CFG.scrollPosKey, String(container.scrollTop));
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
    return new Set(JSON.parse(sessionStorage.getItem(CFG.seenKey) || "[]"));
  }

  function saveSeenSet(set) {
    sessionStorage.setItem(CFG.seenKey, JSON.stringify([...set]));
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
    sessionStorage.setItem(CFG.scrollPosKey, String(container.scrollTop));
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

    sessionStorage.setItem(CFG.scrollPosKey, String(container.scrollTop));
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
      if (el.closest('[role="dialog"]') && isWavDownloadModalOpen()) continue;
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
    const row = btn.closest('[role="rowgroup"] > *, [role="row"]');
    const stopBubble = (e) => e.stopPropagation();
    btn.addEventListener("click", stopBubble, false);
    btn.addEventListener("mousedown", stopBubble, false);

    try {
      await withPanelPassthrough(async () => {
        const { cx, cy } = pointerCoords(btn);
        const hit = document.elementFromPoint(cx, cy);
        log(label || "isolated click", "at", cx, cy, "hit", hit?.tagName, buttonLabel(hit));
        if (hit && hit !== btn && !btn.contains(hit)) {
          throw new Error(`${label || "button"} obscured by ${buttonLabel(hit)}`);
        }
        btn.click();
      });
    } finally {
      btn.removeEventListener("click", stopBubble, false);
      btn.removeEventListener("mousedown", stopBubble, false);
    }

    pauseAllMedia();
    await sleep(120);
  }

  async function menuPortalClick(el, label) {
    const target = menuItemClickTarget(el);
    pauseAllMedia();
    await withPanelPassthrough(async () => {
      log(label || "menu click", menuItemLabel(target));
      target.click();
    });
    pauseAllMedia();
    await sleep(120);
  }

  async function clickMoreOptions(btn) {
    await isolatedButtonClick(btn, "More options");
    await settle(CFG.minSettleMs);
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
    return [...document.querySelectorAll('[role="menu"]')].filter((m) => {
      if (m.closest("#suno-bm-panel")) return false;
      const r = m.getBoundingClientRect();
      return r.width > 8 && r.height > 8;
    });
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
      return /WAV/i.test(t) && (/MP3/i.test(t) || /Audio/i.test(t)) && !/Remix/i.test(t);
    });
  }

  function isWavMenuItem(el) {
    const blob = menuItemLabel(el);
    if (!blob) return false;
    if (/MP3/i.test(blob)) return false;
    return /WAV/i.test(blob) && (/Audio/i.test(blob) || /Pro/i.test(blob));
  }

  function findWavItem() {
    const roots = getVisibleMenuRoots();
    const searchIn = roots.length ? roots : [document.body];
    for (const scope of searchIn) {
      for (const el of scope.querySelectorAll('[role="menuitem"], [data-radix-collection-item], button')) {
        if (el.closest("#suno-bm-panel")) continue;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        if (isWavMenuItem(el)) return menuItemClickTarget(el);
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

  function isWavDownloadModalOpen() {
    return /Download WAV Audio/i.test(document.body.innerText || "");
  }

  function findWavModal() {
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
        return /Download WAV Audio/i.test(el.textContent || "");
      });
      if (hit) return hit;
    }

    return (
      [...document.querySelectorAll("h1,h2,h3,h4,p,div,span")].find((el) => {
        if (el.closest("#suno-bm-panel")) return false;
        const t = (el.textContent || "").trim();
        if (!/^Download WAV Audio$/i.test(t)) return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
      })?.closest('[role="dialog"], [data-radix-dialog-content], [data-radix-portal] > div') || null
    );
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
    const modal = findWavModal();
    if (modal && !modal.contains(el)) return false;
    return isClickable(el);
  }

  function findDownloadFileButton() {
    if (!isWavDownloadModalOpen()) return null;

    const modal = findWavModal();
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
    const modal = findWavModal();
    if (!modal) throw new Error("WAV modal not found");
    if (!modal.contains(btn)) throw new Error("Download File not inside modal");

    const { cx, cy } = pointerCoords(btn);
    elementPos(btn, label || "Download File");

    await withPanelPassthrough(async () => {
      pauseAllMedia();
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

  async function clickTargetElement(target, label) {
    const el = target.closest("button,a,[role='button']") || target;
    const pos = elementPos(el, label || "click");
    const { cx, cy } = pointerCoords(el);
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
      if (!isWavDownloadModalOpen()) return true;
      await sleep(CFG.pollMs);
    }
    return !isWavDownloadModalOpen();
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
    if (listVisibleMenus().length || isWavDownloadModalOpen()) {
      await closeMenus();
    }
    scrollMoreBtnIntoView(card);
    const more = await waitForCardInteractive(card);
    if (!more) throw new Error("More options not found");

    for (let attempt = 1; attempt <= 3; attempt++) {
      await clickMoreOptions(more);
      log(`More menu attempt ${attempt}`);
      try {
        const dl = await waitFor(findDownloadItem, "Download menu item", CFG.menuOpenTimeout);
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

  async function openDownloadSubmenu(dl) {
    statusMsg("Hover Download → WAV submenu…");
    log("Download target:", menuItemLabel(dl));

    const target = menuItemClickTarget(dl);
    const { cx, cy } = pointerCoords(target);

    for (let round = 0; round < 14; round++) {
      await pointerEnter(target);
      if (findWavItem()) {
        logMenuState("WAV submenu open");
        return;
      }
      if (round === 4) {
        target.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true, keyCode: 39 }));
        await sleep(100);
        target.dispatchEvent(new KeyboardEvent("keyup", { key: "ArrowRight", bubbles: true, keyCode: 39 }));
      }
      if (round === 9) {
        await hoverAt(target, cx - 90, cy);
      }
      await sleep(CFG.pollMs);
    }

    await waitFor(findWavItem, "WAV submenu", CFG.wavSubmenuTimeout);
  }

  async function clickDownloadWavAndConfirm(dl) {
    await openDownloadSubmenu(dl);

    const wav = await waitFor(findWavItem, "WAV Audio", CFG.wavSubmenuTimeout);
    statusMsg("Click WAV Audio…");
    log("WAV target:", menuItemLabel(wav));
    await menuPortalClick(wav, "WAV Audio");
    pauseAllMedia();

    statusMsg("Waiting for Download File modal…");
    const fileBtn = await waitFor(() => {
      pauseAllMedia();
      const btn = findDownloadFileButton();
      return btn && isClickable(btn) ? btn : null;
    }, "Download File ready", CFG.wavModalTimeout);
    statusMsg("Click Download File…");
    log("Download File button:", buttonLabel(fileBtn));
    await clickDownloadFileButton(fileBtn);
    await waitForMenusClosed(CFG.menuOpenTimeout);
    await settle(CFG.maxSettleMs);
  }

  async function closeMenus() {
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(150);
    }
    await waitForMenusClosed(CFG.menuOpenTimeout);
  }

  async function downloadOne(card, globalNum, seenCount) {
    const id = getSongId(card);
    if (!id) throw new Error("song id not found");
    if (getDoneSet().has(id)) {
      log("skip duplicate", id.slice(0, 8));
      return id;
    }

    const title = card.querySelector("a[href*='/song/']")?.textContent?.trim() || id || "?";

    statusMsg(`#${globalNum} (${seenCount} seen): More -> WAV -> Download File | ${title.slice(0, 28)}`);

    startPlayerGuard();
    try {
      const dl = await openMoreMenu(card);
      await clickDownloadWavAndConfirm(dl);
      await closeMenus();
      silencePlayer();
      await settle(CFG.maxSettleMs);
      return id;
    } finally {
      stopPlayerGuard();
    }
  }

  async function processCard(card, done, stats, globalNum, seenCount) {
    const id = getSongId(card);
    if (!id || done.has(id)) return { downloaded: 0, skipped: 1, errors: 0 };

    try {
      const saved = await downloadOne(card, globalNum, seenCount);
      if (saved && !done.has(saved)) {
        done.add(saved);
        saveDoneSet(done);
        stats.downloaded++;
        saveStats(stats);
        return { downloaded: 1, skipped: 0, errors: 0 };
      }
      if (saved) return { downloaded: 0, skipped: 1, errors: 0 };
    } catch (err) {
      statusMsg(`Error ${id.slice(0, 8)}: ${err.message} - retry…`);
      await closeMenus();
      await waitForMenusClosed(CFG.menuOpenTimeout);
      try {
        const retryCard = findCardBySongId(id) || card;
        scrollCardIntoView(retryCard, "center");
        await waitForCardInteractive(retryCard, CFG.cardReadyTimeout);
        const saved = await downloadOne(retryCard, globalNum, seenCount);
        if (saved && !done.has(saved)) {
          done.add(saved);
          saveDoneSet(done);
          stats.downloaded++;
          saveStats(stats);
          return { downloaded: 1, skipped: 0, errors: 0 };
        }
        if (saved) return { downloaded: 0, skipped: 1, errors: 0 };
      } catch (err2) {
        stats.errors++;
        saveStats(stats);
        const fails = bumpFailed(id);
        statusMsg(`Failed ${id.slice(0, 8)} (${fails}x): ${err2.message} — scrolling on`);
        logError(`Failed ${id.slice(0, 8)}`, err2.message);
        return { downloaded: 0, skipped: 0, errors: 1 };
      }
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
        const saved = Number(sessionStorage.getItem(CFG.scrollPosKey) || 0);
        const resume = saved > 0 && countUnseenUndone(done, seen) > 0 && !plan.freshStart;
        if (resume) {
          applySavedScrollPosition(container);
        } else {
          container.scrollTop = 0;
          sessionStorage.setItem(CFG.scrollPosKey, "0");
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
            const left = countUnseenUndone(done, seen);
            const failedLeft = Object.keys(getFailedMap()).filter((id) => seen.has(id) && !done.has(id)).length;
            if (left === 0) {
              log("absolute end — all seen songs done");
              finishAll(`Playlist complete: "${getSavedListMeta().name}" — all ${seen.size} scrolled songs saved.`);
              return { ok: true, downloaded, skipped, errors, hasMore: false, finished: true };
            }
            if (failedLeft === left) {
              log("absolute end — remaining are failed skips only");
              break;
            }
            log(`${left} left — second pass from top`);
            bottomStable = 0;
            container.scrollTop = 0;
            sessionStorage.setItem(CFG.scrollPosKey, "0");
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
    const left = countUnseenUndone(done, seen);
    statusMsg(`Pass done +${downloaded} new · seen ${seen.size} · ${left} left · ${errors} err`);
    if (left === 0 && !window.__sunoBmStop) {
      finishAll(`Playlist complete: "${getSavedListMeta().name}" — all ${seen.size} scrolled songs saved.`);
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
    const complete = left === 0;
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
          ? `Playlist complete: "${listName}"\n\n` +
            expectedLine +
            `Scrolled past: ${seen} songs\n` +
            `Saved (clicks): ${savedInList}\n` +
            `Still missing: ${left}\n` +
            `Errors: ${stats.errors}\n\n` +
            matchLine +
            `Verify your Downloads folder — SAVED = click finished, not file count.`
          : `Not finished — "${listName}"\n\n` +
            expectedLine +
            `Saved in this list: ${savedInList}\n` +
            `Seen: ${seen}\n` +
            `Still need: ${left}\n` +
            `Errors: ${stats.errors}\n\n` +
            `Click Resume to continue, or open the next playlist and run Download ALL again.`)
    );
    refreshPanel(complete ? `FINISHED — ${listName}` : `Stopped — ${left} left in "${listName}"`);
  }

  async function downloadAllLoop() {
    setAutorun();
    setRunning(true);
    window.__sunoBmStop = false;

    while (!window.__sunoBmStop) {
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
      } else if (plan.mode === "all") {
        setPlan(defaultPlan());
      }

      if (hasPagination()) {
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
        setRunning(false);
        return;
      }

      if (result.hasMore) {
        statusMsg(`${countUnseenUndone(getDoneSet(), getSeenSet())} seen songs left — restarting from top…`);
        continue;
      }

      finishAll("All songs downloaded.");
      return;
    }

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
    setPlan({ ...defaultPlan(), stopAfterPage: true, freshStart: true });
    sessionStorage.removeItem(CFG.scrollPosKey);
    downloadAllLoop();
  }

  const panel = document.createElement("div");
  panel.id = "suno-bm-panel";
  panel.style.cssText =
    "position:fixed;top:12px;left:12px;z-index:5000;width:400px;max-height:92vh;overflow:hidden;display:flex;flex-direction:column;background:#0a0a0a;color:#eee;padding:0;border-radius:14px;font:13px/1.45 system-ui,sans-serif;box-shadow:0 12px 48px rgba(0,0,0,.6);border:1px solid #333;pointer-events:none";

  panel.innerHTML = `
    <div id="suno-bm-drag-handle" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px 10px;cursor:move;user-select:none;pointer-events:auto;border-bottom:1px solid #222;background:#111;border-radius:14px 14px 0 0">
      <div>
        <div style="font-weight:700;font-size:14px">⬇ Suno WAV Downloader</div>
        <div style="font-size:10px;color:#666;margin-top:2px">⋯ → WAV Audio Pro → Download File</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span id="suno-bm-state-badge" style="font-size:10px;padding:3px 8px;border-radius:999px;background:#333;color:#ccc;font-weight:600">READY</span>
        <button type="button" id="suno-bm-collapse" style="padding:2px 8px;cursor:pointer;background:#222;border:1px solid #444;border-radius:6px;color:#aaa;font-size:11px;pointer-events:auto">−</button>
      </div>
    </div>
    <div id="suno-bm-body" style="overflow:auto;flex:1 1 auto;min-height:0">
      <div style="padding:10px 14px 0">
        <div id="suno-bm-page-line" style="color:#8cf;font-size:11px;margin-bottom:8px;line-height:1.4"></div>

        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px;text-align:center;font-size:11px">
          <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">SAVED</div><div id="suno-bm-stat-done" style="color:#6f6;font-weight:700;font-size:16px">0</div></div>
          <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">LEFT</div><div id="suno-bm-stat-left" style="color:#fc8;font-weight:700;font-size:16px">0</div></div>
          <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">SEEN</div><div id="suno-bm-stat-seen" style="color:#8cf;font-weight:700;font-size:16px">0</div></div>
          <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">IN VIEW</div><div id="suno-bm-stat-visible" style="color:#ccf;font-weight:700;font-size:16px">0</div></div>
        </div>

        <div style="font-size:10px;color:#666;margin-bottom:2px">Scroll position</div>
        <div style="background:#1a1a1a;border-radius:6px;height:6px;overflow:hidden;margin-bottom:2px;border:1px solid #222">
          <div id="suno-bm-scroll-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#336,#58c);transition:width .3s"></div>
        </div>
        <div id="suno-bm-scroll-bar-text" style="font-size:10px;color:#777;margin-bottom:8px">List scroll: 0%</div>

        <div style="font-size:10px;color:#666;margin-bottom:2px">Download coverage</div>
        <div style="background:#1a1a1a;border-radius:6px;height:10px;overflow:hidden;margin-bottom:2px;border:1px solid #222">
          <div id="suno-bm-bar" style="height:100%;width:0%;background:linear-gradient(90deg,#1a6,#4d4);transition:width .3s"></div>
        </div>
        <div id="suno-bm-bar-text" style="font-size:10px;color:#888;margin-bottom:8px">Saved 0 / 0 seen</div>

        <div id="suno-bm-eta-line" style="color:#9a9;font-size:10px;margin-bottom:4px;line-height:1.4"></div>
        <div id="suno-bm-session-line" style="color:#666;font-size:10px;margin-bottom:6px;line-height:1.4"></div>
        <div id="suno-bm-coverage-line" style="color:#7a7;font-size:10px;margin-bottom:4px;line-height:1.4"></div>
        <div id="suno-bm-mode-line" style="color:#585;font-size:10px;margin-bottom:8px;line-height:1.4"></div>

        <div id="suno-bm-status-line" style="color:#fc8;font-size:11px;min-height:28px;padding:6px 8px;background:#141414;border-radius:8px;border:1px solid #282828;margin-bottom:10px;line-height:1.4"></div>

        <details style="font-size:10px;margin-bottom:10px;pointer-events:auto">
          <summary style="cursor:pointer;color:#888;margin-bottom:6px">Now playing · extra stats · logs</summary>
          <div style="background:#141414;border:1px solid #252525;border-radius:10px;padding:8px 10px;margin-bottom:8px">
            <div style="font-size:10px;color:#666;margin-bottom:4px">NOW PLAYING</div>
            <div id="suno-bm-current-song" style="font-size:13px;font-weight:600;color:#eee;margin-bottom:4px">—</div>
            <div id="suno-bm-current-step" style="font-size:11px;color:#fc8;margin-bottom:6px">Idle</div>
            <div id="suno-bm-flow-dots" style="font-size:11px;color:#666">⋯ → WAV → File</div>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-bottom:8px;text-align:center;font-size:11px">
            <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">ERRORS</div><div id="suno-bm-stat-err" style="color:#f88;font-weight:700;font-size:14px">0</div></div>
            <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">SKIPPED</div><div id="suno-bm-stat-skip" style="color:#aaa;font-weight:700;font-size:14px">0</div></div>
            <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">FAILED</div><div id="suno-bm-stat-failed" style="color:#f96;font-weight:700;font-size:14px">0</div></div>
            <div style="background:#161616;border-radius:8px;padding:5px 3px;border:1px solid #222"><div style="color:#666;font-size:9px">PASSES</div><div id="suno-bm-stat-batch" style="color:#aaa;font-weight:700;font-size:14px">0</div></div>
          </div>
          <div id="suno-bm-log-count" style="font-size:10px;color:#777;margin-bottom:4px">0 log entries</div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:6px">
            <button type="button" id="suno-bm-copy-logs" style="padding:6px;cursor:pointer;background:#1a1a2a;color:#acf;border:1px solid #345;border-radius:7px;font-size:10px;pointer-events:auto">Copy logs</button>
            <button type="button" id="suno-bm-dl-logs" style="padding:6px;cursor:pointer;background:#1a1a2a;color:#acf;border:1px solid #345;border-radius:7px;font-size:10px;pointer-events:auto">Save .txt</button>
            <button type="button" id="suno-bm-clear-logs" style="padding:6px;cursor:pointer;background:#222;color:#aaa;border:1px solid #444;border-radius:7px;font-size:10px;pointer-events:auto">Clear</button>
          </div>
          <pre id="suno-bm-log-preview" style="max-height:100px;overflow:auto;font-size:9px;color:#888;background:#111;padding:6px;border-radius:6px;border:1px solid #222;white-space:pre-wrap;margin:0">(no logs yet)</pre>
        </details>

        <details style="font-size:10px;color:#666;line-height:1.5;margin-bottom:10px;pointer-events:auto">
          <summary style="cursor:pointer;color:#888;margin-bottom:4px">Help & requirements</summary>
          <ul style="margin:4px 0 0;padding-left:16px;color:#777">
            <li>Allow multiple downloads on suno.com in Chrome settings</li>
            <li>~8–15 seconds per song · leave tab open while running</li>
            <li>Smart scroll skips saved blocks · 2nd pass catches misses</li>
            <li>Resume continues from saved scroll position</li>
            <li>Reset clears saved IDs (re-downloads everything)</li>
            <li>Filter console to <code style="color:#8a8">[SunoDL]</code> for live logs</li>
          </ul>
        </details>
      </div>
    </div>
    <div id="suno-bm-actions" style="flex:0 0 auto;padding:10px 14px 12px;border-top:1px solid #222;background:#111;border-radius:0 0 14px 14px;pointer-events:auto">
      <button type="button" id="suno-bm-all" style="width:100%;padding:11px 12px;margin-bottom:6px;cursor:pointer;background:#163;color:#fff;border:1px solid #3a5;border-radius:8px;font-weight:700;font-size:13px">▶ Download ALL — smart scroll full library</button>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:6px">
        <button type="button" id="suno-bm-resume" style="padding:8px;cursor:pointer;background:#1a3a1a;color:#afa;border:1px solid #383;border-radius:8px;font-weight:600">↻ Resume</button>
        <button type="button" id="suno-bm-stop" disabled style="padding:8px;cursor:pointer;background:#3a1a1a;color:#faa;border:1px solid #633;border-radius:8px;font-weight:600">■ Stop</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:5px">
        <button type="button" id="suno-bm-reset" style="padding:7px 4px;cursor:pointer;background:#222;color:#ccc;border:1px solid #444;border-radius:7px;font-size:11px">Reset all</button>
        <button type="button" id="suno-bm-retry" style="padding:7px 4px;cursor:pointer;background:#2a2010;color:#fc8;border:1px solid #643;border-radius:7px;font-size:11px">Retry failed</button>
        <button type="button" id="suno-bm-onepass" style="padding:7px 4px;cursor:pointer;background:#1a1a2a;color:#acf;border:1px solid #345;border-radius:7px;font-size:11px">One pass</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:5px">
        <button type="button" id="suno-bm-test1" style="padding:7px 4px;cursor:pointer;background:#2a2211;color:#eca;border:1px solid #543;border-radius:7px;font-size:11px">Test 1</button>
        <button type="button" id="suno-bm-test1921" style="padding:7px 4px;cursor:pointer;background:#2a2211;color:#eca;border:1px solid #543;border-radius:7px;font-size:11px">Test 2</button>
      </div>
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

  function startDownloadAll(freshStart) {
    if (freshStart) sessionStorage.removeItem(CFG.scrollPosKey);
    setPlan({ ...defaultPlan(), freshStart: !!freshStart });
    downloadAllLoop();
  }

  document.getElementById("suno-bm-test1").onclick = () => testOneSong();
  document.getElementById("suno-bm-test1921").onclick = () => testLastAndFirst();
  document.getElementById("suno-bm-all").onclick = () => startDownloadAll(true);
  document.getElementById("suno-bm-resume").onclick = () => startDownloadAll(false);
  document.getElementById("suno-bm-onepass").onclick = () => startOnePass();
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
    sessionStorage.removeItem(CFG.doneKey);
    sessionStorage.removeItem(CFG.statsKey);
    sessionStorage.removeItem(CFG.seenKey);
    sessionStorage.removeItem(CFG.failedKey);
    sessionStorage.removeItem(CFG.scrollPosKey);
    sessionStorage.removeItem(CFG.logKey);
    sessionStorage.removeItem(CFG.listMetaKey);
    setPlan(defaultPlan());
    saveListMeta();
    refreshPanel("Reset complete");
  };

  window.__sunoDlGetLogs = exportLogsText;
  window.__sunoDlCopyLogs = copyLogs;
  window.__sunoDlGetPlaylistsDone = getCompletedPlaylists;
  appendLog("info", "Suno WAV Downloader ready");

  try {
    if (typeof chrome !== "undefined" && chrome.runtime?.id) {
      sessionStorage.setItem("suno-bm-ext", "1");
    }
  } catch (_) {}

  refreshPanel("Ready");

  if (isAutorun()) {
    statusMsg("Auto-resuming…");
    setTimeout(() => downloadAllLoop(), 2000);
  }
})();
