// ============================================================
// SUNO SONG CREATION AUTOMATION (separate from WAV downloader)
// 1) Open https://suno.com/create
// 2) Paste ALL of this in F12 Console
// 3) Paste or Upload your collection → click Load songs
// 4) Test 1 → Start batch
// Formats: 1. "Title" + Style: ...  OR  ## 1. "Title" + **Style:** ...
// ============================================================
/**
 * Suno Song Creation Automation — bookmarklet / console source.
 * Open https://suno.com/create (Custom/Advanced create view)
 * Build: node build-create-bookmarklet.js
 */
(function sunoCreateAutomation() {
  if (!/suno\.com/i.test(location.href)) {
    alert("Open Suno create page first (suno.com/create).");
    return;
  }

  try {
    const oldPanel = document.getElementById("suno-create-panel");
    if (oldPanel) {
      const rect = oldPanel.getBoundingClientRect();
      const body = oldPanel.querySelector("#suno-create-panel-body");
      const sections = {};
      oldPanel.querySelectorAll("details[data-suno-section]").forEach((d) => {
        sections[d.dataset.sunoSection] = d.open;
      });
      sessionStorage.setItem(
        "suno-create-panel-ui",
        JSON.stringify({
          ...(JSON.parse(sessionStorage.getItem("suno-create-panel-ui") || "null") || {}),
          left: rect.left,
          top: rect.top,
          collapsed: body?.hidden === true,
          sections,
          importText: oldPanel.querySelector("#suno-create-import")?.value || "",
          timings: {
            step: oldPanel.querySelector("#suno-create-step-delay")?.value,
            wand: oldPanel.querySelector("#suno-create-wand-delay")?.value,
            create: oldPanel.querySelector("#suno-create-create-delay")?.value,
            clear: oldPanel.querySelector("#suno-create-clear-delay")?.value,
            useWand: (() => {
              const btn = oldPanel.querySelector("#suno-create-wand-toggle");
              if (btn) return btn.getAttribute("aria-pressed") !== "false";
              const cb = oldPanel.querySelector("#suno-create-use-wand");
              if (cb) return cb.checked;
              return true;
            })(),
          },
        })
      );
    }
  } catch (_) {}
  document.getElementById("suno-create-panel")?.remove();

  // ---- Default songs (paste-create-console.js gets full list from build) ----
  const DEFAULT_SONGS = [];

  function stripMarkdownInline(s) {
    return (s || "")
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\*([^*]+)\*/g, "$1")
      .replace(/^\*+\s*/, "")
      .replace(/\s*\*+$/, "")
      .replace(/\s*#{1,6}\s*$/g, "")
      .trim();
  }

  function normalizeQuotes(text) {
    return String(text || "")
      .replace(/\u201C/g, '"')
      .replace(/\u201D/g, '"')
      .replace(/\u2018/g, "'")
      .replace(/\u2019/g, "'");
  }

  const SONG_HEADER_INNER_RE = /(?:#{1,3}\s*)?\d+\.\s+"[^"\n]+"/;
  const SONG_HEADER_LINE_RE = /(?:^|\n)\s*((?:#{1,3}\s*)?\d+\.\s+"[^"\n]+")/g;
  const NEXT_SONG_IN_TEXT_RE = /(?:^|\n)\s*(?:#{1,3}\s*)?\d+\.\s+"[^"\n]+"/;
  const SECTION_TAG_INNER_RE =
    /\[(?:Intro|Verse\s*\d+|Chorus|Bridge|Outro|Pre-Chorus|Hook|Post-Chorus|Interlude|Drop|Breakdown)[^\]]*\]/i;

  function headerContentStart(matchText, baseIndex) {
    const inner = matchText.match(SONG_HEADER_INNER_RE);
    if (!inner) return baseIndex;
    return baseIndex + matchText.indexOf(inner[0]);
  }

  function normalizeCollectionInput(text) {
    let t = normalizeQuotes(text).replace(/\r\n/g, "\n").trim();
    t = t.replace(/([^\n#])((?:#{1,3}\s*)?\d+\.\s+"[^"\n]+")/g, "$1\n\n$2");
    t = t.replace(/([^\n])(\[(?:Intro|Verse\s*\d+|Chorus|Bridge|Outro|Pre-Chorus|Hook)[^\]]*\])/gi, "$1\n\n$2");
    t = t.replace(/\n{3,}/g, "\n\n");
    return t.trim();
  }

  function stripLyricsTail(text) {
    return String(text || "")
      .replace(/[ \t]+(?:#{1,3}\s*)?\d+\.\s+"[^"\n]+"[\s\S]*$/g, "")
      .replace(/(?:^|\n)\s*(?:#{1,3}\s*)?\d+\.\s+"[^"\n]+"[\s\S]*$/g, "")
      .replace(/\n\s*#{1,6}\s*$/g, "")
      .replace(/\s*#{1,6}\s*$/g, "")
      .replace(/\n\s*\*{1,2}\s*$/g, "")
      .trim();
  }

  function normalizeLyricsText(lyrics) {
    let text = normalizeQuotes(lyrics).replace(/\r\n/g, "\n").trim();
    const cut = text.search(NEXT_SONG_IN_TEXT_RE);
    if (cut >= 0) text = text.slice(0, cut).trim();
    text = text.replace(/([^\n])(\[(?:Intro|Verse\s*\d+|Chorus|Bridge|Outro|Pre-Chorus|Hook)[^\]]*\])/gi, "$1\n\n$2");
    text = text.replace(/\n{3,}/g, "\n\n");
    return stripLyricsTail(text);
  }

  function trimAtSecondIntro(lyrics) {
    const introRe = /\[Intro\]/gi;
    const first = introRe.exec(lyrics);
    if (!first) return lyrics;
    introRe.lastIndex = first.index + first[0].length;
    const second = introRe.exec(lyrics);
    if (!second) return lyrics;
    return lyrics.slice(0, second.index).trim();
  }

  function extractStyle(rest) {
    const styleMatch = rest.match(
      /(?:\*{0,2})Style(?:\s+of\s+music)?(?:\*{0,2})?\s*:?\s*([^\n]+(?:\n(?!\s*\[|\s*(?:#{1,3}\s*)?\d+\.)[^\n]+)*)/i
    );
    if (!styleMatch) {
      const lineMatch = rest.match(/(?:\*{0,2})Style(?:\*{0,2})?\s*:?\s*([^\n]+)/i);
      return lineMatch ? stripMarkdownInline(lineMatch[1]) : "";
    }
    return stripMarkdownInline(styleMatch[1].replace(/\n+/g, " ").trim());
  }

  function extractLyrics(rest) {
    const introIdx = rest.search(/\[Intro\]/i);
    const sectionIdx = rest.search(SECTION_TAG_INNER_RE);
    const idx = introIdx >= 0 ? introIdx : sectionIdx;
    if (idx < 0) return "";
    return trimAtSecondIntro(normalizeLyricsText(rest.slice(idx)));
  }

  function findSongBlocks(text) {
    const normalized = normalizeCollectionInput(text);
    const headers = [];
    let m;
    SONG_HEADER_LINE_RE.lastIndex = 0;
    while ((m = SONG_HEADER_LINE_RE.exec(normalized)) !== null) {
      const inner = m[1].match(/"([^"]+)"/);
      headers.push({
        start: headerContentStart(m[0], m.index),
        title: inner ? inner[1].trim() : "",
      });
    }
    if (!headers.length) return [];

    return headers.map((h, i) => {
      const sliceStart = h.start;
      const sliceEnd = i + 1 < headers.length ? headers[i + 1].start : normalized.length;
      const chunk = normalized.slice(sliceStart, sliceEnd).trim();
      const titleMatch = chunk.match(/^(?:#{1,3}\s*)?\d+\.\s+"([^"]+)"/);
      const rest = titleMatch ? chunk.slice(titleMatch[0].length).trim() : chunk;
      return { title: h.title, rest };
    });
  }

  function cleanSongEntry(s) {
    return {
      title: String(s.title || "").trim(),
      style: stripMarkdownInline(s.style),
      lyrics: trimAtSecondIntro(normalizeLyricsText(s.lyrics)),
      personalize: s.personalize !== false,
    };
  }

  function parseSongCollection(text) {
    const blocks = findSongBlocks(text);
    const songs = [];

    for (const block of blocks) {
      const style = extractStyle(block.rest);
      const lyrics = extractLyrics(block.rest);
      if (!style || !lyrics) continue;
      songs.push(cleanSongEntry({ title: block.title, style, lyrics, personalize: true }));
    }

    return songs;
  }

  function validateSongs(list) {
    if (!Array.isArray(list) || !list.length) throw new Error("Need a non-empty song list");
    for (const s of list) {
      if (!s.lyrics || !s.style || !s.title) {
        throw new Error(`Song "${s.title || "?"}" needs title, style, and lyrics`);
      }
      if (NEXT_SONG_IN_TEXT_RE.test(s.lyrics)) {
        throw new Error(`Song "${s.title}" lyrics contain another song header — re-paste full collection`);
      }
    }
  }

  function importSongsRaw(raw) {
    const text = raw.trim();
    if (!text) throw new Error("Paste JSON or collection text first");

    if (text.startsWith("[") || text.startsWith("{")) {
      try {
        const parsed = JSON.parse(text).map(cleanSongEntry);
        validateSongs(parsed);
        return parsed;
      } catch (err) {
        if (!(err instanceof SyntaxError)) throw err;
      }
    }

    const parsed = parseSongCollection(text);
    if (!parsed.length) {
      throw new Error(
        'No songs found. Paste full collection with numbered titles:\n' +
          '• 1. "Title" or ## 1. "Title"\n' +
          '• Style: or **Style:** line\n' +
          '• [Intro] ... lyrics ...'
      );
    }
    validateSongs(parsed);
    return parsed;
  }

  const CFG = {
    songsKey: "suno-create-songs",
    progressKey: "suno-create-progress",
    logKey: "suno-create-logs",
    autorunKey: "suno-create-autorun",
    batchOptsKey: "suno-create-batch-opts",
    selectedKey: "suno-create-selected",
    buttonMapKey: "suno-create-button-map",
    panelUiKey: "suno-create-panel-ui",
    delayAfterWandMs: 2000,
    delayAfterCreateMs: 1000,
    delayAfterClearMs: 4000,
    stepDelayMs: 300,
    useMagicWand: true,
    pageReadyTimeoutMs: 20000,
    settleMs: 200,
    stepTimeoutMs: 15000,
    createReadyTimeoutMs: 45000,
    scrollStepPx: 280,
    scrollStepsMax: 22,
    maxLogEntries: 400,
    sunoLyricsMax: 1400,
    sunoLyricsHardMax: 1500,
  };

  const sleep = async (ms) => {
    const chunk = 40;
    let elapsed = 0;
    while (elapsed < ms) {
      if (stopFlag || skipFlag) return;
      const wait = Math.min(chunk, ms - elapsed);
      await new Promise((r) => setTimeout(r, wait));
      elapsed += wait;
    }
  };
  const settle = () => sleep(CFG.settleMs + Math.floor(Math.random() * 150));
  const stopped = () => stopFlag;

  let running = false;
  let stopFlag = false;
  let skipFlag = false;

  function lyricsLenStatus(len) {
    if (len > CFG.sunoLyricsHardMax) return "block";
    if (len > CFG.sunoLyricsMax) return "warn";
    return "ok";
  }

  function shouldAbortSong() {
    return stopFlag || skipFlag;
  }

  function restoreLogsToPanel() {
    const el = document.getElementById("suno-create-log");
    if (!el) return;
    try {
      const entries = JSON.parse(sessionStorage.getItem(CFG.logKey) || "[]");
      el.textContent = entries.map((e) => e.msg).join("\n");
      el.scrollTop = el.scrollHeight;
    } catch (_) {}
  }

  function bindActionButton(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) {
      console.error("[SunoCreate] Missing button:", id);
      return;
    }
    btn.onclick = () => {
      try {
        handler();
      } catch (err) {
        running = false;
        stopFlag = false;
        disableButtons(false);
        setStatus("Error: " + err.message);
        log("ERROR", err.message);
        alert(err.message || String(err));
      }
    };
  }

  function bindRunButton(id, opts) {
    bindActionButton(id, () => {
      setStatus("Starting…");
      log(id, "clicked");
      void runBatch(opts).catch((err) => {
        const wasStop = err?.message === "Stopped";
        running = false;
        stopFlag = false;
        disableButtons(false);
        if (wasStop) return;
        setStatus("Error: " + err.message);
        log("ERROR", err.message);
      });
    });
  }

  async function stepPause(label, ms) {
    if (label) log("pause:", label);
    await sleep(ms ?? CFG.stepDelayMs);
    return !shouldAbortSong();
  }

  function isMagicWandEnabled() {
    const btn = document.getElementById("suno-create-wand-toggle");
    if (btn) return btn.getAttribute("aria-pressed") !== "false";
    return CFG.useMagicWand !== false;
  }

  function setMagicWandEnabled(on) {
    CFG.useMagicWand = !!on;
    const btn = document.getElementById("suno-create-wand-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = on ? "✨ Magic wand ON (all songs)" : "✨ Magic wand OFF (skip all)";
      btn.style.background = on ? "#4c1d95" : "#292524";
      btn.style.borderColor = on ? "#a78bfa" : "#57534e";
      btn.style.color = on ? "#ede9fe" : "#a8a29e";
      btn.title = on
        ? "ON — clicks ✨ wand after style for every song. Click to skip wand for all."
        : "OFF — skips ✨ wand for every song. Click to enable wand for all.";
    }
    syncWandControls();
  }

  function syncWandControls() {
    const on = isMagicWandEnabled();
    const delay = document.getElementById("suno-create-wand-delay");
    if (delay) {
      delay.disabled = !on;
      delay.style.opacity = on ? "1" : "0.45";
    }
  }

  function readTimingFromPanel() {
    CFG.stepDelayMs = Math.max(200, Number(document.getElementById("suno-create-step-delay")?.value || 0.3) * 1000);
    CFG.useMagicWand = isMagicWandEnabled();
    CFG.delayAfterWandMs = Math.max(
      1500,
      Number(document.getElementById("suno-create-wand-delay")?.value || 2) * 1000
    );
    CFG.delayAfterCreateMs = Math.max(
      500,
      Number(document.getElementById("suno-create-create-delay")?.value || 1) * 1000
    );
    CFG.delayAfterClearMs = Math.max(1500, Number(document.getElementById("suno-create-clear-delay")?.value || 4) * 1000);
  }

  function getButtonMap() {
    try {
      return JSON.parse(sessionStorage.getItem(CFG.buttonMapKey) || "{}");
    } catch (_) {
      return {};
    }
  }

  function findHxcButtonByContent(re) {
    for (const span of document.querySelectorAll(".hxc-btn-content")) {
      if (span.closest("#suno-create-panel")) continue;
      const t = norm(span.textContent);
      if (!re.test(t)) continue;
      const btn = resolveClickTarget(span);
      if (btn && isVisible(btn)) return btn;
    }
    return null;
  }

  async function withPanelPassthrough(fn) {
    const panel = document.getElementById("suno-create-panel");
    const prev = panel?.style.pointerEvents;
    if (panel) panel.style.pointerEvents = "none";
    try {
      return await fn();
    } finally {
      if (panel) panel.style.pointerEvents = prev || "";
    }
  }

  function pointerCoords(el) {
    const r = el.getBoundingClientRect();
    return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
  }

  function findByRecord(key) {
    const rec = getButtonMap()[key];
    if (!rec) return null;

    if (rec.testId) {
      const byTest = document.querySelector(`[data-testid="${rec.testId}"]`);
      if (byTest && !byTest.closest("#suno-create-panel")) return byTest;
    }

    if (rec.ariaLabel) {
      const byAria = [...document.querySelectorAll("button, [role='button'], .hxc-btn-base, a[role='button']")].find(
        (el) => !el.closest("#suno-create-panel") && el.getAttribute("aria-label") === rec.ariaLabel
      );
      if (byAria) return byAria;

      const fuzzy = [...document.querySelectorAll("button, [role='button'], .hxc-btn-base, a[role='button']")].find(
        (el) => {
          if (el.closest("#suno-create-panel")) return false;
          const aria = el.getAttribute("aria-label") || "";
          return aria.includes(rec.ariaLabel) || rec.ariaLabel.includes(aria);
        }
      );
      if (fuzzy) return fuzzy;
    }

    if (rec.text) {
      const byText = [...document.querySelectorAll("button, [role='button'], .hxc-btn-base, a[role='button']")].find((el) => {
        if (el.closest("#suno-create-panel")) return false;
        return buttonLabel(el) === rec.text || norm(el.textContent) === rec.text;
      });
      if (byText) return byText;
    }

    if (rec.rect?.cx != null && rec.rect?.cy != null) {
      const hit = document.elementFromPoint(rec.rect.cx, rec.rect.cy);
      const byPoint = hit?.closest?.("button, [role='button'], .hxc-btn-base, a[role='button']");
      if (byPoint && !byPoint.closest("#suno-create-panel")) return byPoint;
    }

    const candidates = [...document.querySelectorAll("button, [role='button'], .hxc-btn-base, a[role='button']")].filter(
      (el) => !el.closest("#suno-create-panel")
    );
    let best = null;
    let bestScore = Infinity;
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      const score =
        Math.abs(r.x - rec.rect.x) + Math.abs(r.y - rec.rect.y) + Math.abs(r.width - rec.rect.w) + Math.abs(r.height - rec.rect.h);
      if (score < bestScore) {
        bestScore = score;
        best = el;
      }
    }
    return bestScore < 200 ? best : null;
  }

  function countOverLyricsLimit(songs) {
    let warn = 0;
    let block = 0;
    for (const s of songs) {
      const st = lyricsLenStatus((s.lyrics || "").length);
      if (st === "warn") warn++;
      if (st === "block") block++;
    }
    const parts = [];
    if (warn) parts.push(`${warn} over 1400 (orange — pass with warn)`);
    if (block) parts.push(`${block} over 1500 (red — will stop)`);
    return parts.length ? ` · ${parts.join(" · ")}` : " — expand Preview to verify lyrics";
  }

  function refreshPanelAfterImport(count, sourceLabel) {
    log("Loaded", count, "song(s) from", sourceLabel);
    if (count > 0) {
      getSongs().forEach((s, i) => {
        log(`  ${i + 1}. ${s.title} — lyrics ${s.lyrics.length} chars, starts: ${s.lyrics.slice(0, 50).replace(/\n/g, " ")}…`);
      });
      setStatus(`${count} song(s) loaded${countOverLyricsLimit(getSongs())}`);
    } else if (sourceLabel === "clear") {
      setStatus("Song list cleared");
    } else {
      setStatus("0 songs loaded");
    }
    capturePanelUi();
    document.getElementById("suno-create-panel")?.remove();
    renderPanel();
  }

  function loadSongsFromText(raw, sourceLabel = "paste") {
    const parsed = importSongsRaw(raw);
    saveSongs(parsed);
    saveProgress(0);
    refreshPanelAfterImport(parsed.length, sourceLabel);
    return parsed;
  }

  function loadSongsFromFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadSongsFromText(String(reader.result || ""), file.name);
      } catch (err) {
        log("Upload failed:", err.message);
        setStatus("Upload failed — check format");
        alert("Upload failed:\n\n" + err.message);
      }
    };
    reader.onerror = () => alert("Could not read file.");
    reader.readAsText(file);
  }

  function ensureDefaultSongsLoaded() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CFG.songsKey) || "null");
      if (Array.isArray(saved) && saved.length) return saved.length;
    } catch (_) {}
    if (DEFAULT_SONGS.length) {
      saveSongs(DEFAULT_SONGS);
      log("Loaded", DEFAULT_SONGS.length, "built-in song(s) from script");
      return DEFAULT_SONGS.length;
    }
    return 0;
  }

  function log(...parts) {
    const msg = parts.map((p) => (typeof p === "object" ? JSON.stringify(p) : String(p))).join(" ");
    console.log("[SunoCreate]", msg);
    const entries = JSON.parse(sessionStorage.getItem(CFG.logKey) || "[]");
    entries.push({ t: new Date().toISOString(), msg });
    sessionStorage.setItem(CFG.logKey, JSON.stringify(entries.slice(-CFG.maxLogEntries)));
    const el = document.getElementById("suno-create-log");
    if (el) {
      el.textContent = (el.textContent ? el.textContent + "\n" : "") + msg;
      el.scrollTop = el.scrollHeight;
    }
  }

  function norm(s) {
    return (s || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isVisible(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2 && r.bottom > 0 && r.top < window.innerHeight;
  }

  function isClickable(el) {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 2 && r.height > 2;
  }

  function isButtonDisabled(btn) {
    if (!btn) return true;
    if (btn.disabled) return true;
    if (btn.getAttribute("aria-disabled") === "true") return true;
    const st = getComputedStyle(btn);
    if (st.pointerEvents === "none" || st.visibility === "hidden" || st.display === "none") return true;
    if (Number(st.opacity) < 0.15) return true;
    return false;
  }

  function getMainCreateScope() {
    return document.getElementById("main-container") || getCreatePanelRoot();
  }

  function resolveClickTarget(el) {
    return el?.closest?.("button, [role='button'], a[role='button'], .hxc-btn-base") || el;
  }

  function logWandCreateDebug(styleEl) {
    const styleRect = styleEl?.getBoundingClientRect?.();
    const icons = [...document.querySelectorAll(".hxc-btn-base, button, [role='button']")]
      .filter((btn) => {
        if (btn.closest("#suno-create-panel") || !btn.querySelector("svg")) return false;
        const r = btn.getBoundingClientRect();
        if (!styleRect) return true;
        return r.top >= styleRect.top - 20 && r.top <= styleRect.bottom + 160;
      })
      .slice(0, 8)
      .map((btn) => {
        const r = btn.getBoundingClientRect();
        return {
          text: buttonLabel(btn).slice(0, 30) || "(icon)",
          x: Math.round(r.x),
          y: Math.round(r.y),
          w: Math.round(r.width),
        };
      });
    const creates = [...document.querySelectorAll(".hxc-btn-content, button, .hxc-btn-base")]
      .filter((el) => !el.closest("#suno-create-panel") && /\bcreate\b/i.test(norm(el.textContent)))
      .slice(0, 6)
      .map((el) => {
        const btn = resolveClickTarget(el);
        const r = btn.getBoundingClientRect();
        return { text: norm(el.textContent).slice(0, 20), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) };
      });
    log("DEBUG icons near style:", icons);
    log("DEBUG create candidates:", creates);
  }

  function setTextareaValue(target, text) {
    target.focus();
    target.click();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    if (setter) setter.call(target, text);
    else target.value = text;
    target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: text }));
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function setInputValue(target, text) {
    target.focus();
    target.click();
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (setter) setter.call(target, text);
    else target.value = text;
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function buttonLabel(el) {
    return norm((el.textContent || "") + " " + (el.getAttribute("aria-label") || ""));
  }

  function allClickables() {
    return [...document.querySelectorAll('button, [role="button"], [role="tab"], a[role="tab"], a')].filter(
      (el) => !el.closest("#suno-create-panel")
    );
  }

  function allPageButtons() {
    return allClickables().filter((el) => el.matches('button, [role="button"], a[role="button"]'));
  }

  function elementText(el) {
    return norm(el.textContent || el.getAttribute("aria-label") || "");
  }

  function findAdvancedTab() {
    for (const el of document.querySelectorAll('[role="tab"], [role="tablist"] button, [role="tablist"] a')) {
      if (el.closest("#suno-create-panel")) continue;
      if (/^advanced$/i.test(elementText(el))) return el;
    }

    for (const el of allClickables()) {
      if (el.closest("#suno-create-panel")) continue;
      const t = elementText(el);
      if (/^advanced$/i.test(t) && t.length < 24) return el;
    }

    return (
      document.querySelector('[aria-label="Advanced"][role="tab"], [aria-label="Advanced"], [data-testid*="advanced" i]') ||
      null
    );
  }

  function getAdvancedTab() {
    return findAdvancedTab();
  }

  function logTabCandidates() {
    const tabs = [...document.querySelectorAll('[role="tab"], [role="tablist"] *')].slice(0, 12).map((el) => ({
      tag: el.tagName,
      role: el.getAttribute("role"),
      text: elementText(el).slice(0, 40),
    }));
    log("Tab candidates:", tabs);
  }

  function findLyricsFieldGlobal() {
    for (const h of document.querySelectorAll("div, span, label, h2, h3, p")) {
      if (h.closest("#suno-create-panel")) continue;
      if (!/^lyrics$/i.test(norm(h.textContent))) continue;
      let root = h.parentElement;
      for (let i = 0; i < 8 && root; i++) {
        const field = root.querySelector('[contenteditable="true"], textarea, .ProseMirror');
        if (field && !field.closest("#suno-create-panel")) {
          return getLyricsEditor(field) || field;
        }
        root = root.parentElement;
      }
    }

    for (const el of document.querySelectorAll('[contenteditable="true"], textarea')) {
      if (el.closest("#suno-create-panel") || el.closest('[role="dialog"]')) continue;
      const parts = [
        el.placeholder,
        el.getAttribute("data-placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("name"),
      ]
        .filter(Boolean)
        .join(" ");
      if (/start writing lyrics|write lyrics|lyrics/i.test(parts)) return el;
    }

    return null;
  }

  function getCreatePanelRoot() {
    const lyrics = findLyricsFieldGlobal();
    if (lyrics) {
      let el = lyrics.parentElement;
      for (let i = 0; i < 18 && el && el !== document.body; i++) {
        const r = el.getBoundingClientRect();
        const hasCreate = [...el.querySelectorAll("button, [role='button'], .hxc-btn-base")].some((b) => {
          const content = b.querySelector(".hxc-btn-content");
          const label = norm(content?.textContent || buttonLabel(b));
          return /\bcreate\b/i.test(label) && b.getBoundingClientRect().width > 80;
        });
        if (hasCreate && r.width > 280 && r.width < window.innerWidth * 0.7) return el;
        el = el.parentElement;
      }
    }

    const adv = findAdvancedTab();
    if (adv) {
      let el = adv.closest("main") || adv.parentElement;
      for (let i = 0; i < 16 && el && el !== document.body; i++) {
        const r = el.getBoundingClientRect();
        if (r.width > 280 && r.width < window.innerWidth * 0.7) return el;
        el = el.parentElement;
      }
    }

    return document.body;
  }

  function isFieldUsable(el) {
    if (!el || !isVisible(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.height < 16) return false;
    const pad = 50;
    return r.top >= pad && r.bottom <= window.innerHeight - pad;
  }

  function getCreateScrollRoots() {
    const anchor = findLyricsFieldGlobal() || findLyricsField() || getCreatePanelRoot();
    const roots = [];
    let el = anchor?.parentElement;
    while (el && el !== document.body) {
      const st = getComputedStyle(el);
      if (/(auto|scroll)/.test(st.overflowY) && el.scrollHeight > el.clientHeight + 20) roots.push(el);
      el = el.parentElement;
    }
    return roots;
  }

  function getCreateScrollRoot() {
    return getCreateScrollRoots()[0] || null;
  }

  async function scrollCreatePanel(delta) {
    const roots = getCreateScrollRoots();
    if (roots.length) {
      for (const root of roots.slice(0, 2)) {
        root.scrollBy({ top: delta, behavior: "smooth" });
      }
    } else {
      window.scrollBy({ top: delta, behavior: "smooth" });
    }
    await sleep(500);
  }

  async function scrollPastBlock(el) {
    if (!el) return;
    const root = getCreateScrollRoot();
    const r = el.getBoundingClientRect();
    if (root) {
      const rootRect = root.getBoundingClientRect();
      const delta = r.bottom - rootRect.top - root.clientHeight * 0.35;
      if (delta > 0) {
        root.scrollBy({ top: delta, behavior: "smooth" });
        await sleep(550);
      }
    } else {
      await scrollCreatePanel(Math.max(CFG.scrollStepPx, r.height * 0.4));
    }
  }

  function scopedEditableFields() {
    const root = getCreatePanelRoot();
    return [...root.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable='true']")].filter(
      (el) => !el.closest("#suno-create-panel") && !el.closest('[role="dialog"]')
    );
  }

  function findEditableFields() {
    const scoped = scopedEditableFields();
    return scoped.length
      ? scoped
      : [...document.querySelectorAll("textarea, input[type='text'], input:not([type]), [contenteditable='true']")].filter(
          (el) => !el.closest("#suno-create-panel") && !el.closest('[role="dialog"]')
        );
  }

  function findButtons() {
    const root = getCreatePanelRoot();
    const scoped = [...root.querySelectorAll("button, [role='button'], .hxc-btn-base")].filter(
      (el) => !el.closest("#suno-create-panel")
    );
    return scoped.length ? scoped : allPageButtons();
  }

  function findButton(matchFn) {
    for (const el of findButtons()) {
      if (!isClickable(el)) continue;
      if (matchFn(el, buttonLabel(el))) return el;
    }
    return null;
  }

  function findByText(pattern, opts = {}) {
    const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, opts.exact ? "" : "i");
    return findButton((_, label) => {
      if (opts.exact) return re.test(label) && label.length < (opts.maxLen || 40);
      return re.test(label);
    });
  }

  function findFieldByHints(hints) {
    const patterns = hints.map((h) => (h instanceof RegExp ? h : new RegExp(h, "i")));

    for (const el of findEditableFields()) {
      const parts = [
        el.placeholder,
        el.getAttribute("data-placeholder"),
        el.getAttribute("aria-label"),
        el.getAttribute("name"),
        el.id,
        el.closest("label")?.textContent,
        el.previousElementSibling?.textContent,
      ]
        .filter(Boolean)
        .join(" ");
      if (patterns.some((p) => p.test(parts))) return el;
    }

    for (const labelEl of getCreatePanelRoot().querySelectorAll("label, span, p, h2, h3, div")) {
      if (labelEl.closest("#suno-create-panel")) continue;
      const t = norm(labelEl.textContent);
      if (!t || t.length > 60) continue;
      if (!patterns.some((p) => p.test(t))) continue;
      const root = labelEl.closest("section, form, div") || labelEl.parentElement;
      const field = root?.querySelector("textarea, input[type='text'], input:not([type]), [contenteditable='true']");
      if (field && !field.closest("#suno-create-panel")) return field;
    }

    return null;
  }

  function scrollToElement(el, block = "center") {
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block, inline: "nearest" });
  }

  async function revealField(findFn, label, maxSteps = CFG.scrollStepsMax) {
    for (let i = 0; i < maxSteps; i++) {
      const hit = findFn();
      if (hit && isFieldUsable(hit)) {
        scrollToElement(hit, "center");
        await settle();
        if (isFieldUsable(hit)) {
          log(`found ${label} after ${i} scroll(s)`);
          return hit;
        }
      }
      if (i === 0 || i % 3 === 0) log(`scrolling for ${label}… ${i + 1}/${maxSteps}`);
      await scrollCreatePanel(CFG.scrollStepPx);
    }

    const hit = findFn();
    if (hit) {
      scrollToElement(hit, "center");
      await settle();
      log(`found ${label} (may be partially off-screen)`);
      return hit;
    }
    throw new Error(`Could not scroll to ${label}`);
  }

  async function scrollUntil(findFn, label, maxSteps = CFG.scrollStepsMax) {
    return revealField(findFn, label, maxSteps);
  }

  async function waitFor(findFn, label, timeout = CFG.stepTimeoutMs) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (shouldAbortSong()) return null;
      const el = findFn();
      if (el) return el;
      await sleep(120);
    }
    throw new Error(`Timeout: ${label}`);
  }

  async function scrollToBottomOfCreateForm() {
    const roots = getCreateScrollRoots();
    for (const root of roots) {
      root.scrollTo({ top: root.scrollHeight, behavior: "smooth" });
    }
    const main = document.getElementById("main-container");
    if (main) main.scrollTo?.({ top: main.scrollHeight, behavior: "smooth" });
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" });
    await sleep(250);
  }

  async function clickButton(el, label, opts = {}) {
    if (!el) throw new Error(`Missing button: ${label}`);
    const target = resolveClickTarget(el);
    scrollToElement(target, label === "Create" ? "end" : "center");
    if (opts.fast) await sleep(40);
    else await settle();

    const { cx, cy } = pointerCoords(target);
    log("click", label, buttonLabel(target) || "(icon)", "at", Math.round(cx), Math.round(cy));

    await withPanelPassthrough(async () => {
      let clickEl = target;
      const hit = document.elementFromPoint(cx, cy);
      const hitBtn = hit?.closest?.("button, [role='button'], .hxc-btn-base");
      if (hitBtn && (target === hitBtn || target.contains(hitBtn) || hitBtn.contains(target))) {
        clickEl = hitBtn;
      } else if (hitBtn && hitBtn !== target) {
        log("click point hits", buttonLabel(hitBtn), "- using target anyway");
      }

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

      clickEl.dispatchEvent(new PointerEvent("pointerover", peBase));
      clickEl.dispatchEvent(new MouseEvent("mouseover", base));
      clickEl.dispatchEvent(new PointerEvent("pointerdown", { ...peBase, buttons: 1 }));
      clickEl.dispatchEvent(new MouseEvent("mousedown", base));
      clickEl.dispatchEvent(new PointerEvent("pointerup", { ...peBase, buttons: 0 }));
      clickEl.dispatchEvent(new MouseEvent("mouseup", base));
      clickEl.dispatchEvent(new MouseEvent("click", base));
    });

    await settle();
  }

  function resolveEditableTarget(el) {
    if (!el) return el;
    if (el.classList?.contains("ProseMirror")) return el;
    const pm = el.querySelector?.(".ProseMirror");
    if (pm) return pm;
    if (el.isContentEditable) return el;
    const inner = el.querySelector('[contenteditable="true"]');
    return inner || el;
  }

  function getLyricsEditor(el) {
    if (!el) return null;
    if (el.classList?.contains("ProseMirror")) return el;
    const pm = el.querySelector?.(".ProseMirror");
    if (pm) return pm;
    return resolveEditableTarget(el);
  }

  function collectLyricsEditables(el) {
    const nodes = new Set();
    if (!el) return [];
    let box = el;
    for (let i = 0; i < 12 && box; i++) {
      box.querySelectorAll(".ProseMirror").forEach((n) => {
        if (!n.closest("#suno-create-panel")) nodes.add(n);
      });
      if (nodes.size) break;
      box = box.parentElement;
    }
    const direct = getLyricsEditor(el);
    if (direct) nodes.add(direct);
    return [...nodes];
  }

  function dispatchKey(el, key, mods = {}) {
    const base = { key, bubbles: true, cancelable: true, ...mods };
    el.dispatchEvent(new KeyboardEvent("keydown", base));
    el.dispatchEvent(new KeyboardEvent("keyup", base));
  }

  async function hardWipeNode(target) {
    if (!target) return;
    target.focus();
    target.click?.();
    await sleep(100);

    if (target.tagName === "TEXTAREA") {
      setTextareaValue(target, "");
      return;
    }
    if (target.tagName === "INPUT") {
      setInputValue(target, "");
      return;
    }

    dispatchKey(target, "a", { ctrlKey: true, metaKey: true });
    await sleep(40);
    dispatchKey(target, "Backspace");
    dispatchKey(target, "Delete");
    await sleep(40);

    try {
      const range = document.createRange();
      range.selectNodeContents(target);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}

    target.textContent = "";
    target.innerHTML = "<p><br></p>";
    target.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "deleteContent" }));
    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function lyricsPasteOk(got, text) {
    const min = Math.min(60, text.length * 0.2);
    if (got.length < min) return false;
    const start = got.trim().slice(0, 20);
    const expect = text.trim().slice(0, 20);
    return start === expect || /^\[(?:Intro|Verse)/i.test(got.trim());
  }

  async function pasteLinesIntoProseMirror(target, text, fast) {
    target.focus();
    target.click?.();
    if (!fast) await sleep(100);

    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}
    if (!fast) await sleep(60);

    const lines = text.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (shouldAbortSong()) return false;
      if (i > 0) dispatchKey(target, "Enter");
      const line = lines[i];
      if (line.length) document.execCommand("insertText", false, line);
    }

    target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  async function pasteViaClipboard(target, text) {
    target.focus();
    target.click?.();

    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}

    try {
      const dt = new DataTransfer();
      dt.setData("text/plain", text);
      target.dispatchEvent(
        new ClipboardEvent("paste", { bubbles: true, cancelable: true, clipboardData: dt })
      );
      target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste" }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    } catch (_) {
      return false;
    }
  }

  async function pasteLyricsIntoProseMirror(target, text) {
    const t0 = Date.now();
    target.focus();
    target.click?.();
    await sleep(40);

    try {
      document.execCommand("selectAll", false, null);
      document.execCommand("delete", false, null);
    } catch (_) {}

    await pasteViaClipboard(target, text);
    await sleep(100);
    let got = getFieldText(target);
    if (lyricsPasteOk(got, text)) {
      log("Lyrics paste (fast) in", Date.now() - t0, "ms");
      return got;
    }

    await pasteLinesIntoProseMirror(target, text, true);
    await sleep(80);
    got = getFieldText(target);
    log("Lyrics paste (lines) in", Date.now() - t0, "ms");
    return got;
  }

  async function pasteTextIntoEditor(target, text) {
    if (target.classList?.contains("ProseMirror") || target.isContentEditable) {
      return pasteLyricsIntoProseMirror(target, text);
    }

    target.focus();
    target.click?.();
    await sleep(50);

    if (target.tagName === "TEXTAREA") {
      setTextareaValue(target, text);
      return getFieldText(target);
    }
    if (target.tagName === "INPUT") {
      setInputValue(target, text);
      return getFieldText(target);
    }

    try {
      document.execCommand("insertText", false, text);
    } catch (_) {}
    target.dispatchEvent(new Event("change", { bubbles: true }));
    return getFieldText(target);
  }

  function lyricsHtmlFromText(text) {
    return text
      .split("\n")
      .map((line) => (line ? `<p>${line.replace(/</g, "&lt;")}</p>` : "<p><br></p>"))
      .join("");
  }

  function getFieldText(el) {
    const target = resolveEditableTarget(el);
    if (!target) return "";
    if (target.isContentEditable) return (target.innerText || target.textContent || "").trim();
    return (target.value || "").trim();
  }

  function setFieldValue(el, value, label) {
    if (!el) throw new Error(`Missing field: ${label}`);
    const target = resolveEditableTarget(el);
    const text = String(value ?? "");
    target.focus();
    target.click?.();

    if (target.isContentEditable) {
      if (!text.length) {
        target.innerHTML = "<p><br></p>";
        try {
          document.execCommand("selectAll", false, null);
          document.execCommand("delete", false, null);
        } catch (_) {}
        target.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "deleteContentBackward" }));
        target.dispatchEvent(new Event("change", { bubbles: true }));
        return;
      }

      target.focus();
      target.click?.();
      try {
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
      } catch (_) {}
      target.innerHTML = text
        .split("\n")
        .map((line) => (line ? `<p>${line.replace(/</g, "&lt;")}</p>` : "<p><br></p>"))
        .join("");
      target.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertFromPaste" }));
      target.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    const proto = target.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (target.tagName === "TEXTAREA") {
      setTextareaValue(target, text);
      return;
    }
    if (setter) setter.call(target, text);
    else target.value = text;
    target.dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertFromPaste" }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  async function pasteStyleField(el, value) {
    const text = stripMarkdownInline(String(value ?? ""));
    let field = findStyleFieldDirect() || el;
    scrollToElement(field, "center");
    await sleep(120);
    field.focus();
    field.click();
    await sleep(80);

    log("Style target placeholder:", (field.placeholder || "").slice(0, 60), "visible:", isElementVisibleOnScreen(field));

    setFieldValue(field, text, "Style");
    await sleep(80);
    let got = getFieldText(field);

    if (got.length < text.length * 0.25) {
      log("retry style paste…");
      setFieldValue(field, text, "Style");
      got = getFieldText(field);
    }

    log("pasted Style", `(${text.length} chars)`);
    if (got.length < Math.min(20, text.length * 0.2)) {
      throw new Error("Style paste failed — Styles box still empty (wrong field?)");
    }
    return field;
  }

  async function pasteField(el, value, label) {
    scrollToElement(el, "center");
    await settle();
    const text = String(value ?? "");
    const target = resolveEditableTarget(el);

    if (target.isContentEditable && getFieldText(el).length > text.length * 1.2) {
      target.innerHTML = "<p><br></p>";
      await sleep(100);
    }

    setFieldValue(el, value, label);
    let got = getFieldText(el);

    if (got.length < text.length * 0.25) {
      log(`retry paste ${label}…`);
      await sleep(300);
      setFieldValue(el, value, label);
      got = getFieldText(el);
    }

    target.dispatchEvent(new Event("blur", { bubbles: true }));
    await sleep(150);
    target.focus();

    log("pasted", label, `(${text.length} chars)`, "field len:", got.length);
    if (got.length < Math.min(20, text.length * 0.2)) {
      throw new Error(`${label} paste failed — field still empty`);
    }
    await settle();
  }

  function isAdvancedModeActive() {
    if (findLyricsFieldGlobal()) return true;
    if (findLyricsField()) return true;

    const tab = findAdvancedTab();
    if (tab?.getAttribute("aria-selected") === "true") return true;
    if (tab?.getAttribute("data-state") === "active") return true;
    if (tab?.getAttribute("aria-current") === "page") return true;
    if (tab?.getAttribute("data-selected") === "true") return true;
    if (tab?.classList.contains("active") || tab?.classList.contains("selected")) return true;

    return false;
  }

  async function clickAdvanced() {
    if (isAdvancedModeActive()) {
      log("Advanced mode already active");
      return;
    }

    const tab = findAdvancedTab();
    if (!tab) {
      logTabCandidates();
      try {
        await waitFor(() => findLyricsFieldGlobal() || findLyricsField(), "Lyrics field", 6000);
        log("Lyrics field found without Advanced tab click");
        return;
      } catch (_) {
        throw new Error('Advanced tab not found. Open suno.com/create, click "Advanced" once, then retry.');
      }
    }

    await clickButton(tab, "Advanced tab");
    await waitFor(() => (isAdvancedModeActive() ? true : null), "Advanced form visible", 12000);
  }

  function findLyricsField() {
    const global = findLyricsFieldGlobal();
    if (global) return global;

    for (const el of findEditableFields()) {
      const parts = [
        el.placeholder,
        el.getAttribute("data-placeholder"),
        el.getAttribute("aria-label"),
        el.textContent,
      ]
        .filter(Boolean)
        .join(" ");
      if (/start writing lyrics|^lyrics$/i.test(parts)) return el;
    }
    return findFieldByHints([/start writing lyrics/i, /^lyrics$/i, /song lyrics/i]);
  }

  function isElementVisibleOnScreen(el) {
    if (!el || !isVisible(el)) return false;
    const r = el.getBoundingClientRect();
    if (r.width < 80 || r.height < 24) return false;
    const cx = r.left + r.width / 2;
    const cy = r.top + Math.min(r.height / 2, 40);
    const hit = document.elementFromPoint(cx, cy);
    return hit === el || el.contains(hit) || hit?.closest("textarea") === el;
  }

  function findStyleFieldDirect() {
    const lyrics = findLyricsFieldGlobal() || findLyricsField();

    for (const h of document.querySelectorAll("div, span, label, h2, h3, p")) {
      if (h.closest("#suno-create-panel")) continue;
      if (!/^styles$/i.test(norm(h.textContent))) continue;
      let root = h.parentElement;
      for (let i = 0; i < 12 && root; i++) {
        const tas = [...root.querySelectorAll("textarea")].filter(
          (t) => !t.closest("#suno-create-panel") && isElementVisibleOnScreen(t)
        );
        if (tas.length) return tas[0];
        root = root.parentElement;
      }
    }

    const candidates = [...document.querySelectorAll("textarea")].filter((el) => {
      if (el.closest("#suno-create-panel") || el === lyrics) return false;
      if (!isElementVisibleOnScreen(el)) return false;
      const r = el.getBoundingClientRect();
      return r.width > 120 && r.height > 36;
    });

    if (lyrics) {
      const lyBottom = lyrics.getBoundingClientRect().bottom;
      const below = candidates
        .filter((c) => c.getBoundingClientRect().top >= lyBottom - 40)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      if (below[0]) return below[0];
    }

    return candidates[0] || null;
  }

  function findTitleFieldDirect() {
    for (const h of document.querySelectorAll("div, span, label, h2, h3, p")) {
      if (h.closest("#suno-create-panel")) continue;
      if (!/song title/i.test(norm(h.textContent))) continue;
      let root = h.parentElement;
      for (let i = 0; i < 10 && root; i++) {
        const input = [...root.querySelectorAll('input[type="text"], input:not([type])')].find(
          (el) => !el.closest("#suno-create-panel") && isElementVisibleOnScreen(el)
        );
        if (input) return input;
        root = root.parentElement;
      }
    }

    return [...document.querySelectorAll('input[type="text"], input:not([type])')].find((el) => {
      if (el.closest("#suno-create-panel") || el.closest('[role="dialog"]')) return false;
      if (!isElementVisibleOnScreen(el)) return false;
      const parts = [el.placeholder, el.getAttribute("aria-label"), el.name].filter(Boolean).join(" ");
      return /title/i.test(parts);
    });
  }

  async function getStyleField(lyricsEl) {
    const direct = findStyleFieldDirect();
    if (direct) {
      scrollToElement(direct, "center");
      await settle();
      return direct;
    }
    return revealField(styleFieldFinder(lyricsEl), "Style field");
  }

  async function getTitleField() {
    const direct = findTitleFieldDirect();
    if (direct) {
      scrollToElement(direct, "center");
      await settle();
      return direct;
    }
    return revealField(titleFieldFinder(), "Title field");
  }

  async function forceClearField(el, label) {
    if (!el) {
      log("WARN: could not find field to clear:", label);
      return;
    }
    scrollToElement(resolveEditableTarget(el), "center");
    await sleep(200);
    log("Wipe", label, "…");
    if (/lyrics/i.test(label)) {
      for (const node of collectLyricsEditables(el)) await hardWipeNode(node);
    } else {
      await hardWipeNode(resolveEditableTarget(el));
    }
    await sleep(200);
    log("Wiped", label);
  }

  async function clearFieldEl(el) {
    if (!el) return false;
    return forceClearField(el, "field");
  }

  async function clearCreateForm(opts = {}) {
    const quick = opts.quick === true;
    log(quick ? "Clearing Suno form (lyrics, style, title)…" : "Clearing Suno form for next song…");
    for (let i = 0; i < 2; i++) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      await sleep(150);
    }

    await clickAdvanced();
    await sleep(400);

    await forceClearField(findLyricsFieldGlobal() || findLyricsField(), "Lyrics");
    await forceClearField(findStyleFieldDirect() || findStyleFieldGlobal(), "Style");
    await forceClearField(findTitleFieldDirect() || (await getTitleField().catch(() => null)), "Title");
    log("Suno form wiped");

    const root = getCreateScrollRoot();
    if (root) root.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });

    if (quick) {
      await sleep(500);
    } else {
      log(`Waiting ${CFG.delayAfterClearMs / 1000}s after clear…`);
      await sleep(CFG.delayAfterClearMs);
    }
  }

  function findStyleFieldGlobal() {
    const direct = findStyleFieldDirect();
    if (direct) return direct;

    const lyrics = findLyricsFieldGlobal() || findLyricsField();

    for (const el of document.querySelectorAll('textarea, [contenteditable="true"], [role="textbox"]')) {
      if (el.closest("#suno-create-panel") || el === lyrics) continue;
      const ph = [el.placeholder, el.getAttribute("data-placeholder"), el.getAttribute("aria-label"), el.name]
        .filter(Boolean)
        .join(" ");
      if (/style|genre|mood|sound|music description|describe/i.test(ph)) return el;
    }

    for (const h of document.querySelectorAll("div, span, label, h2, h3, p")) {
      if (h.closest("#suno-create-panel")) continue;
      const t = norm(h.textContent);
      if (!/^styles?$/i.test(t) && !/^style of music$/i.test(t)) continue;
      let root = h.parentElement;
      for (let i = 0; i < 10 && root; i++) {
        const fields = [...root.querySelectorAll('[contenteditable="true"], textarea, input[type="text"]')].filter(
          (f) => !f.closest("#suno-create-panel") && f !== lyrics
        );
        if (fields.length) return fields[0];
        root = root.parentElement;
      }
    }

    const all = [...document.querySelectorAll('[contenteditable="true"], textarea')].filter(
      (el) => !el.closest("#suno-create-panel") && !el.closest('[role="dialog"]')
    );

    if (lyrics) {
      const lyRect = lyrics.getBoundingClientRect();
      const colCenter = lyRect.left + lyRect.width / 2;
      const below = all
        .filter((el) => {
          if (el === lyrics) return false;
          const r = el.getBoundingClientRect();
          return r.top > lyRect.bottom - 30 && Math.abs(r.left + r.width / 2 - colCenter) < 220 && r.height > 24;
        })
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      if (below[0]) return below[0];
    }

    return all.length > 1 ? all[1] : null;
  }

  function findWandByAria() {
    const exact =
      document.querySelector('button[aria-label="Personalize style prompt to match your taste"]') ||
      document.querySelector('button[aria-label*="Personalize style prompt" i]');
    if (exact && !exact.closest("#suno-create-panel") && isVisible(exact)) {
      log("Magic wand via aria-label Personalize style");
      return exact;
    }

    const hit = [...document.querySelectorAll("button, .hxc-btn-base, [role='button']")].find((el) => {
      if (el.closest("#suno-create-panel")) return false;
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return /personalize style|enhance|magic|style augment|my taste|wand|sparkle|boost style/i.test(aria);
    });
    if (hit) {
      log("Magic wand via aria-label");
      return hit;
    }
    return null;
  }

  function findCreateByAria() {
    const direct =
      document.querySelector('button[aria-label="Create song"], button[aria-label="Create Song"]') ||
      document.querySelector('button[aria-label*="Create song" i]');
    if (direct && !direct.closest("#suno-create-panel") && isVisible(direct)) {
      return direct;
    }

    const fuzzy = [...document.querySelectorAll("button, .hxc-btn-base, [role='button']")].find((el) => {
      if (el.closest("#suno-create-panel")) return false;
      const aria = el.getAttribute("aria-label") || "";
      return /create song/i.test(aria) && isVisible(el);
    });
    if (fuzzy) {
      log("Create via aria-label (fuzzy)");
      return fuzzy;
    }
    return null;
  }

  function findWandLeftIconRow(styleEl) {
    if (!styleEl) return null;
    const styleRect = styleEl.getBoundingClientRect();
    const candidates = [...document.querySelectorAll(".hxc-btn-base, button, [role='button']")]
      .filter((btn) => {
        if (btn.closest("#suno-create-panel")) return false;
        if (!btn.querySelector("svg")) return false;
        const r = btn.getBoundingClientRect();
        if (r.width < 16 || r.width > 68 || r.height < 16 || r.height > 68) return false;
        if (r.top < styleRect.bottom - 20 || r.top > styleRect.bottom + 100) return false;
        if (r.left < styleRect.left - 30 || r.left > styleRect.left + 130) return false;
        return true;
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    if (candidates[0]) {
      log("Magic wand = left icon under Styles");
      return candidates[0];
    }
    return null;
  }

  function findWandBySvg(styleEl) {
    if (!styleEl) return null;
    const styleRect = styleEl.getBoundingClientRect();
    const candidates = [];

    for (const svg of document.querySelectorAll("svg.h-5.w-5.scale-75, svg.scale-75")) {
      const btn = svg.closest("button, [role='button'], .hxc-btn-base, [tabindex='0']");
      if (!btn || btn.closest("#suno-create-panel")) continue;
      const label = buttonLabel(btn);
      if (/refresh|shuffle|saved styles|no saved|remix|create|advanced|simple|sounds/i.test(label)) continue;
      const r = btn.getBoundingClientRect();
      if (r.top < styleRect.bottom - 40 || r.top > styleRect.bottom + 150) continue;
      if (r.left < styleRect.left - 50 || r.left > styleRect.right + 180) continue;
      candidates.push(btn);
    }

    candidates.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
    if (candidates[0]) {
      log("Magic wand via svg.scale-75");
      return candidates[0];
    }
    return null;
  }

  function findStyleMagicWand(styleEl) {
    const byAria = findWandByAria();
    if (byAria) return byAria;

    const recorded = findByRecord("magicWand");
    if (recorded && isVisible(recorded)) {
      log("Using saved wand map");
      return recorded;
    }

    const styleBox = findStyleFieldDirect() || styleEl;
    const byRow = findWandLeftIconRow(styleBox);
    if (byRow) return byRow;

    const bySvg = findWandBySvg(styleBox);
    if (bySvg) return bySvg;

    if (!styleBox) return null;
    const styleRect = styleBox.getBoundingClientRect();
    const rowTop = styleRect.bottom;

    const toolbar = [...document.querySelectorAll("button, [role='button'], .hxc-btn-base, [tabindex='0']")]
      .filter((btn) => {
        if (btn.closest("#suno-create-panel")) return false;
        const hasIcon = btn.querySelector("svg, img");
        if (!hasIcon) return false;
        const label = buttonLabel(btn);
        if (/saved styles|no saved|shuffle|refresh|create|remix|audio|voice|advanced|simple|sounds|more options|exclude|include/i.test(label)) {
          return false;
        }
        const r = btn.getBoundingClientRect();
        return (
          r.width >= 20 &&
          r.width <= 72 &&
          r.height >= 20 &&
          r.height <= 72 &&
          r.top >= styleRect.top + 8 &&
          r.top <= rowTop + 120 &&
          r.left >= styleRect.left - 30 &&
          r.left <= styleRect.right + 120
        );
      })
      .sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);

    if (toolbar[0]) {
      log("Magic wand candidate:", buttonLabel(toolbar[0]) || "(icon-only)");
      return toolbar[0];
    }
    return null;
  }

  async function clearEditableField(target) {
    target.focus();
    target.click?.();
    await sleep(150);
    if (target.isContentEditable) {
      target.innerHTML = "<p><br></p>";
      try {
        document.execCommand("selectAll", false, null);
        document.execCommand("delete", false, null);
      } catch (_) {}
    } else {
      setTextareaValue(target, "");
    }
    await sleep(200);
  }

  async function pasteLyricsField(el, value) {
    let text = normalizeLyricsText(String(value ?? ""));
    const nodes = collectLyricsEditables(el);
    const target = nodes[0] || getLyricsEditor(el);
    scrollToElement(target, "center");
    await sleep(120);
    if (shouldAbortSong()) return;

    for (const node of nodes) {
      await hardWipeNode(node);
      if (shouldAbortSong()) return;
    }
    await sleep(80);

    let got = await pasteTextIntoEditor(target, text);

    const lines = text.split("\n").filter((l) => l.trim()).length;
    log("pasted Lyrics —", got.length, "chars in field,", lines, "lines sent");
    const limitStatus = lyricsLenStatus(text.length);
    if (limitStatus === "block") {
      log(
        "ERROR: Lyrics",
        text.length,
        "chars — over hard limit",
        CFG.sunoLyricsHardMax,
        ". Stopping batch."
      );
      throw new Error(
        `Lyrics ${text.length} chars — over ${CFG.sunoLyricsHardMax} limit. Shorten lyrics and retry.`
      );
    }
    if (limitStatus === "warn") {
      log(
        "WARN: Lyrics",
        text.length,
        "chars — over",
        CFG.sunoLyricsMax,
        "but within",
        CFG.sunoLyricsHardMax,
        "— continuing anyway"
      );
    }
    if (got.length < Math.min(40, text.length * 0.15)) {
      throw new Error("Lyrics paste failed — field still empty");
    }
    if (!/^\[Intro\]/i.test(got.trim()) && !/^\[Verse/i.test(got.trim())) {
      log("WARN: field starts with:", got.slice(0, 40).replace(/\n/g, " "));
    }
    await stepPause("after lyrics", 400);
  }

  async function pasteTitleField(el, value) {
    const text = String(value ?? "").trim();
    const field = el || findTitleFieldDirect() || (await getTitleField());
    scrollToElement(field, "center");
    await sleep(50);
    setFieldValue(field, text, "Title");
    await sleep(80);
    const got = getFieldText(field);
    log("pasted Title:", text);
    if (!got.length) throw new Error("Title paste failed — field still empty");
    return field;
  }

  function findStyleField() {
    const lyrics = findLyricsFieldGlobal() || findLyricsField();
    const global = findStyleFieldGlobal();
    if (global && global !== lyrics) return global;

    const byLabel = findFieldByHints([/^styles$/i, /style of music/i, /^style$/i, /styles of music/i]);
    if (byLabel && byLabel !== lyrics) return byLabel;

    const fields = findEditableFields().filter((f) => f !== lyrics);
    if (lyrics) {
      const lyTop = lyrics.getBoundingClientRect().top;
      const below = fields
        .filter((f) => f.getBoundingClientRect().top > lyTop + 40)
        .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
      if (below[0]) return below[0];
    }
    return fields[0] || null;
  }

  function findTitleField() {
    return findTitleFieldDirect() || findFieldByHints([/song title/i, /^title$/i, /optional/i]);
  }

  function styleFieldFinder(lyricsEl) {
    return () => {
      const s = findStyleFieldGlobal() || findStyleField();
      if (!s || s === lyricsEl) return null;
      return s;
    };
  }

  function titleFieldFinder() {
    return () => findTitleFieldDirect() || findTitleField();
  }

  function findPersonalizeButton(styleEl) {
    const wand = findStyleMagicWand(styleEl);
    if (wand) return wand;

    const style = styleEl || findStyleField();
    if (style) {
      const styleRect = style.getBoundingClientRect();
      const near = findButtons()
        .filter((btn) => {
          if (!isClickable(btn)) return false;
          const label = buttonLabel(btn);
          const aria = btn.getAttribute("aria-label") || "";
          if (/personalize|style augment|my taste|magic|generate style|wand/i.test(label + " " + aria)) return true;
          const r = btn.getBoundingClientRect();
          const iconOnly = btn.querySelector("svg") && label.length < 24;
          return iconOnly && r.top >= styleRect.top - 12 && r.top <= styleRect.bottom + 100 && r.left <= styleRect.right + 140;
        })
        .sort((a, b) => {
          const ar = a.getBoundingClientRect();
          const br = b.getBoundingClientRect();
          return ar.width * ar.height - br.width * br.height;
        });
      if (near[0]) return near[0];
    }
    return findByText(/personalize/i) || findByText(/my taste/i);
  }

  async function clickPersonalizeIfPresent(styleEl) {
    if (!styleEl) return;
    let btn = findPersonalizeButton(styleEl);
    if (!btn) {
      scrollToElement(styleEl, "center");
      btn = findPersonalizeButton(styleEl);
    }
    if (!btn) {
      await scrollCreatePanel(120);
      btn = findPersonalizeButton(styleEl);
    }
    if (!btn) {
      logWandCreateDebug(styleEl);
      log("Style magic wand not found — open Advanced tab and check Styles area");
      return;
    }
    await clickButton(btn, "Magic wand", { fast: true });
    log(`Waiting ${CFG.delayAfterWandMs / 1000}s after magic wand…`);
    await sleep(CFG.delayAfterWandMs);
  }

  function findCreateInMainBar() {
    const scope = getMainCreateScope();
    const scopeRect = scope.getBoundingClientRect();
    const minTop = scopeRect.top + scopeRect.height * 0.45;

    const candidates = [];
    for (const span of scope.querySelectorAll(".hxc-btn-content")) {
      if (span.closest("#suno-create-panel")) continue;
      const t = norm(span.textContent);
      if (!/\bcreate\b/i.test(t) || t.length > 20) continue;
      const btn = resolveClickTarget(span);
      if (!btn || !isVisible(btn)) continue;
      const r = btn.getBoundingClientRect();
      if (r.top < minTop || r.width < 80) continue;
      candidates.push(btn);
    }

    if (candidates.length) {
      log("Create via main bar hxc-btn");
      return candidates.sort(
        (a, b) =>
          b.getBoundingClientRect().top - a.getBoundingClientRect().top ||
          b.getBoundingClientRect().width - a.getBoundingClientRect().width
      )[0];
    }
    return null;
  }

  function findCreateButton() {
    const byAria = findCreateByAria();
    if (byAria) return byAria;

    const recorded = findByRecord("create");
    if (recorded && isVisible(recorded)) {
      log("Using saved Create map");
      return recorded;
    }

    const mainBar = findCreateInMainBar();
    if (mainBar) return mainBar;

    const hxcCreate = findHxcButtonByContent(/^create$/i);
    if (hxcCreate) {
      log("Create via hxc-btn-content");
      return hxcCreate;
    }

    const matchCreate = (el) => {
      if (el.closest("#suno-create-panel")) return false;
      if (el.matches("a[href='/create'], a[href*='/create']")) return false;
      const content = el.querySelector(".hxc-btn-content");
      const label = norm(content?.textContent || buttonLabel(el));
      if (!/\bcreate\b/i.test(label) || label.length > 20) return false;
      const r = el.getBoundingClientRect();
      return r.width > 70 && r.height > 16 && isVisible(el);
    };

    const root = getMainCreateScope();
    const inRoot = [...root.querySelectorAll("button, [role='button'], .hxc-btn-base, a[role='button']")].filter(matchCreate);
    if (inRoot.length) {
      return inRoot.sort(
        (a, b) =>
          b.getBoundingClientRect().top - a.getBoundingClientRect().top ||
          b.getBoundingClientRect().width - a.getBoundingClientRect().width
      )[0];
    }

    const page = [...document.querySelectorAll("button, [role='button'], .hxc-btn-base, a[role='button']")].filter(matchCreate);
    if (page.length) {
      return page.sort(
        (a, b) =>
          b.getBoundingClientRect().top - a.getBoundingClientRect().top ||
          b.getBoundingClientRect().width - a.getBoundingClientRect().width
      )[0];
    }

    return null;
  }

  async function clickCreateWhenReady() {
    if (shouldAbortSong()) return;
    await scrollToBottomOfCreateForm();
    if (shouldAbortSong()) return;

    const btn0 = await waitFor(findCreateButton, "Create button visible", 12000);
    if (shouldAbortSong() || !btn0) return;
    scrollToElement(btn0, "end");
    await sleep(150);
    if (shouldAbortSong()) return;
    log("Create button found");

    let btn = findCreateButton();
    for (let i = 0; i < 15; i++) {
      if (shouldAbortSong()) return;
      btn = findCreateButton();
      if (btn && !isButtonDisabled(btn)) {
        log("Create button ready");
        break;
      }
      if (i === 0 || i % 5 === 0) log("Waiting for Create to enable…", i + 1);
      await sleep(150);
    }

    if (shouldAbortSong()) return;
    btn = findCreateButton();
    if (!btn) {
      logWandCreateDebug(findStyleFieldDirect());
      throw new Error("Create button not found — scroll down on create page");
    }

    if (isButtonDisabled(btn)) {
      log("Create still looks disabled — clicking anyway");
    }

    scrollToElement(btn, "end");
    await sleep(80);
    if (shouldAbortSong()) return;
    log("Clicking Create…");
    await clickButton(btn, "Create", { fast: true });
    log(`Waiting ${CFG.delayAfterCreateMs / 1000}s after Create…`);
    await sleep(CFG.delayAfterCreateMs);
  }

  async function createOneSong(song, index, total) {
    if (shouldAbortSong()) return;
    const title = song.title || `Song ${index + 1}`;
    setStatus(`Song ${index + 1}/${total}: ${title.slice(0, 40)}`);
    log(`--- Song ${index + 1}/${total}: ${title} ---`);

    await clickAdvanced();
    if (shouldAbortSong()) return;
    await stepPause("after Advanced", 300);

    const lyricsEl = await waitFor(findLyricsField, "Lyrics field");
    if (shouldAbortSong() || !lyricsEl) return;
    await pasteLyricsField(lyricsEl, song.lyrics);
    if (shouldAbortSong()) return;

    await scrollPastBlock(lyricsEl);
    await stepPause("before style", 200);
    if (shouldAbortSong()) return;

    const styleEl = await getStyleField(lyricsEl);
    if (shouldAbortSong()) return;
    await forceClearField(styleEl, "Style");
    const styleBox = await pasteStyleField(styleEl, song.style);
    if (shouldAbortSong()) return;
    log("Style in box:", stripMarkdownInline(getFieldText(styleBox)).slice(0, 80) + "…");

    if (song.personalize !== false && CFG.useMagicWand) {
      await clickPersonalizeIfPresent(styleBox);
    } else if (!CFG.useMagicWand) {
      log("Magic wand skipped (disabled in panel)");
    }
    if (shouldAbortSong()) return;

    const titleEl = await getTitleField();
    if (shouldAbortSong()) return;
    await forceClearField(titleEl, "Title");
    await pasteTitleField(titleEl, song.title);
    if (shouldAbortSong()) return;

    await clickCreateWhenReady();
  }

  function getSongs() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CFG.songsKey) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (_) {}
    return DEFAULT_SONGS;
  }

  function saveSongs(list) {
    sessionStorage.setItem(CFG.songsKey, JSON.stringify(list));
    saveSelected(list.map((_, i) => i));
  }

  function saveSelected(indices) {
    sessionStorage.setItem(CFG.selectedKey, JSON.stringify(indices));
  }

  function getSelectedIndices() {
    try {
      const saved = JSON.parse(sessionStorage.getItem(CFG.selectedKey) || "null");
      if (Array.isArray(saved) && saved.length) return saved;
    } catch (_) {}
    return getSongs().map((_, i) => i);
  }

  function readSelectedFromPanel() {
    const boxes = [...document.querySelectorAll(".suno-create-pick")];
    if (!boxes.length) return getSelectedIndices();
    return boxes.filter((b) => b.checked).map((b) => Number(b.dataset.idx));
  }

  function getBatchSongs() {
    const all = getSongs();
    const indices = readSelectedFromPanel();
    saveSelected(indices);
    return indices.map((i) => all[i]).filter(Boolean);
  }

  function renderSongChecklist(songs) {
    const selected = new Set(getSelectedIndices());
    return songs
      .map((s, i) => {
        const title = escapeHtml(s.title || "Untitled");
        const lyricsLen = (s.lyrics || "").length;
        const limitStatus = lyricsLenStatus(lyricsLen);
        const lenStyle =
          limitStatus === "block"
            ? "color:#f87171;font-weight:600"
            : limitStatus === "warn"
              ? "color:#fb923c;font-weight:600"
              : "color:#64748b";
        const lenNote =
          limitStatus === "block"
            ? " — over 1500, will stop"
            : limitStatus === "warn"
              ? " — over 1400, pass with warn"
              : "";
        const styleText = s.style || "";
        const lyricsText = s.lyrics || "";
        const stylePreview = escapeHtml(styleText.slice(0, 160));
        const lyricsPreview = escapeHtml(lyricsText.slice(0, 600));
        return `<div style="margin:4px 0;padding-bottom:4px;border-bottom:1px solid #1e293b">
      <label style="display:flex;gap:6px;align-items:flex-start;font-size:11px;cursor:pointer">
        <input type="checkbox" class="suno-create-pick" data-idx="${i}" ${selected.has(i) ? "checked" : ""} style="margin-top:1px">
        <span><b>${i + 1}.</b> ${title} <span style="${lenStyle}">(${lyricsLen} chars${lenNote})</span></span>
      </label>
      <details style="margin:3px 0 0 20px">
        <summary style="cursor:pointer;color:#93c5fd;font-size:10px">Preview lyrics &amp; style</summary>
        <div style="margin-top:4px;font-size:9px;color:#94a3b8"><span style="color:#cbd5e1">Style:</span> ${stylePreview}${styleText.length > 160 ? "…" : ""}</div>
        <pre style="margin-top:4px;padding:4px;background:#0f172a;border-radius:4px;font-size:9px;line-height:1.35;color:#e2e8f0;white-space:pre-wrap;max-height:100px;overflow:auto">${lyricsPreview}${lyricsText.length > 600 ? "\n…" : ""}</pre>
      </details>
    </div>`;
      })
      .join("");
  }

  function getProgress() {
    return Number(sessionStorage.getItem(CFG.progressKey) || 0);
  }

  function saveProgress(n) {
    sessionStorage.setItem(CFG.progressKey, String(n));
  }

  function resolveBatchSongs(allSongs) {
    return allSongs;
  }

  function batchSummary(allSongs) {
    const n = allSongs.length;
    if (!n) return "No songs selected — check boxes below";
    return `Will generate ${n} selected song${n === 1 ? "" : "s"}`;
  }

  function setStatus(msg) {
    const el = document.getElementById("suno-create-status");
    if (el) el.textContent = msg;
  }

  function getPanelUi() {
    try {
      return JSON.parse(sessionStorage.getItem(CFG.panelUiKey) || "null") || {};
    } catch (_) {
      return {};
    }
  }

  function savePanelUi(partial) {
    sessionStorage.setItem(CFG.panelUiKey, JSON.stringify({ ...getPanelUi(), ...partial }));
  }

  function capturePanelUi() {
    const panel = document.getElementById("suno-create-panel");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    const body = panel.querySelector("#suno-create-panel-body");
    const sections = {};
    panel.querySelectorAll("details[data-suno-section]").forEach((d) => {
      sections[d.dataset.sunoSection] = d.open;
    });
    savePanelUi({
      left: rect.left,
      top: rect.top,
      collapsed: body?.hidden === true,
      sections,
      importText: document.getElementById("suno-create-import")?.value || "",
      timings: {
        step: document.getElementById("suno-create-step-delay")?.value,
        wand: document.getElementById("suno-create-wand-delay")?.value,
        create: document.getElementById("suno-create-create-delay")?.value,
        clear: document.getElementById("suno-create-clear-delay")?.value,
        useWand: isMagicWandEnabled(),
      },
    });
  }

  function applyPanelPosition(panel) {
    const ui = getPanelUi();
    if (typeof ui.left !== "number" || typeof ui.top !== "number") return;
    const maxLeft = Math.max(0, window.innerWidth - 100);
    const maxTop = Math.max(0, window.innerHeight - 48);
    panel.style.left = `${Math.min(Math.max(0, ui.left), maxLeft)}px`;
    panel.style.top = `${Math.min(Math.max(0, ui.top), maxTop)}px`;
    panel.style.right = "auto";
    panel.style.bottom = "auto";
  }

  function applyPanelCollapsed(panel) {
    const body = panel.querySelector("#suno-create-panel-body");
    const btn = panel.querySelector("#suno-create-collapse-btn");
    if (!body || !btn) return;
    const collapsed = !!getPanelUi().collapsed;
    body.hidden = collapsed;
    btn.textContent = collapsed ? "+" : "−";
    btn.title = collapsed ? "Expand panel" : "Collapse panel";
    panel.style.width = collapsed ? "auto" : "300px";
    panel.style.minWidth = collapsed ? "168px" : "";
    panel.style.maxHeight = collapsed ? "none" : "88vh";
    panel.style.overflow = collapsed ? "visible" : "auto";
  }

  function restorePanelSections(panel) {
    const sections = getPanelUi().sections || {};
    panel.querySelectorAll("details[data-suno-section]").forEach((d) => {
      const key = d.dataset.sunoSection;
      if (key in sections) d.open = !!sections[key];
    });
  }

  function restorePanelFields(panel) {
    const ui = getPanelUi();
    const importEl = panel.querySelector("#suno-create-import");
    if (importEl && ui.importText) importEl.value = ui.importText;
    const t = ui.timings || {};
    if (t.step) panel.querySelector("#suno-create-step-delay").value = t.step;
    if (t.wand) panel.querySelector("#suno-create-wand-delay").value = t.wand;
    if (t.create) panel.querySelector("#suno-create-create-delay").value = t.create;
    if (t.clear) panel.querySelector("#suno-create-clear-delay").value = t.clear;
    setMagicWandEnabled(t.useWand !== false);
  }

  function bindPanelSectionPersistence(panel) {
    panel.querySelectorAll("details[data-suno-section]").forEach((d) => {
      d.addEventListener("toggle", () => {
        const sections = {};
        panel.querySelectorAll("details[data-suno-section]").forEach((el) => {
          sections[el.dataset.sunoSection] = el.open;
        });
        savePanelUi({ sections });
      });
    });
    panel.querySelector("#suno-create-import")?.addEventListener("input", () => {
      savePanelUi({ importText: panel.querySelector("#suno-create-import")?.value || "" });
    });
    panel.querySelectorAll("#suno-create-step-delay, #suno-create-wand-delay, #suno-create-create-delay, #suno-create-clear-delay").forEach((el) => {
      el.addEventListener("change", () => capturePanelUi());
    });
    panel.querySelector("#suno-create-wand-toggle")?.addEventListener("click", () => {
      setMagicWandEnabled(!isMagicWandEnabled());
      capturePanelUi();
    });
  }

  function makePanelDraggable(panel) {
    const handle = panel.querySelector("[data-suno-drag-handle]");
    if (!handle) return;

    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originLeft = 0;
    let originTop = 0;

    const onMove = (clientX, clientY) => {
      const maxLeft = Math.max(0, window.innerWidth - panel.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - 48);
      const left = Math.min(Math.max(0, originLeft + clientX - startX), maxLeft);
      const top = Math.min(Math.max(0, originTop + clientY - startY), maxTop);
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
    };

    const endDrag = () => {
      if (!dragging) return;
      dragging = false;
      handle.style.cursor = "grab";
      const rect = panel.getBoundingClientRect();
      savePanelUi({ left: rect.left, top: rect.top });
    };

    handle.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest("#suno-create-collapse-btn, button, input, textarea, select, summary, a, details")) return;
      dragging = true;
      const rect = panel.getBoundingClientRect();
      originLeft = rect.left;
      originTop = rect.top;
      startX = e.clientX;
      startY = e.clientY;
      panel.style.right = "auto";
      panel.style.bottom = "auto";
      panel.style.left = `${originLeft}px`;
      panel.style.top = `${originTop}px`;
      handle.style.cursor = "grabbing";
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      onMove(e.clientX, e.clientY);
    });

    window.addEventListener("mouseup", endDrag);

    handle.addEventListener(
      "touchstart",
      (e) => {
        if (e.target.closest("#suno-create-collapse-btn, button, input, textarea, select, summary, a, details")) return;
        const t = e.touches[0];
        if (!t) return;
        dragging = true;
        const rect = panel.getBoundingClientRect();
        originLeft = rect.left;
        originTop = rect.top;
        startX = t.clientX;
        startY = t.clientY;
        panel.style.left = `${originLeft}px`;
        panel.style.top = `${originTop}px`;
      },
      { passive: true }
    );

    window.addEventListener(
      "touchmove",
      (e) => {
        if (!dragging) return;
        const t = e.touches[0];
        if (!t) return;
        onMove(t.clientX, t.clientY);
      },
      { passive: true }
    );

    window.addEventListener("touchend", endDrag);
  }

  function renderPanel() {
    const panel = document.createElement("div");
    panel.id = "suno-create-panel";
    panel.style.cssText =
      "position:fixed;top:10px;left:10px;z-index:999999;width:300px;max-height:88vh;overflow:auto;background:#0a0e14;color:#e7ecf3;padding:10px;border-radius:10px;font:11px/1.35 system-ui,sans-serif;box-shadow:0 8px 32px rgba(0,0,0,.55);border:2px solid #5b6ee1";

    const songs = getSongs();
    const progress = getProgress();
    const btn = (bg, border, color = "#eee") =>
      `padding:5px 8px;cursor:pointer;border-radius:6px;border:1px solid ${border};background:${bg};color:${color};font-size:11px`;

    panel.innerHTML = `
      <div data-suno-drag-handle style="cursor:grab;user-select:none;margin-bottom:6px;padding-bottom:6px;border-bottom:1px solid #5b6ee1">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
          <div>
            <div style="font-weight:700;font-size:13px;color:#c4b5fd">Suno Creator</div>
            <div style="color:#8b949e;font-size:10px">drag header · Lyrics → Style → ✨ → Title → Create</div>
          </div>
          <button type="button" id="suno-create-collapse-btn" title="Collapse panel" style="padding:2px 8px;cursor:pointer;border-radius:6px;border:1px solid #5b6ee1;background:#151b3d;color:#c4b5fd;font-size:14px;line-height:1">−</button>
        </div>
      </div>
      <div id="suno-create-panel-body">
      <div id="suno-create-status" style="margin-bottom:4px;color:#fcd34d;font-size:11px;font-weight:600">${songs.length} song(s) loaded · resume #${progress + 1}</div>
      <div id="suno-create-batch-note" style="margin-bottom:6px;color:#7dd3fc;font-size:10px">${batchSummary(getBatchSongs())}</div>

      <details data-suno-section="load" open style="margin-bottom:6px;padding:7px;border:1px solid #22c55e;border-radius:8px;background:#0a1a10">
        <summary style="cursor:pointer;color:#86efac;font-size:10px;font-weight:600;list-style:none;display:flex;align-items:center;gap:4px">① Load your collection</summary>
        <div style="color:#6ee7a0;font-size:9px;margin:4px 0">Format A: 1. "Title" + Style: ... · Format B: ## 1. "Title" + **Style:** ...</div>
        <textarea id="suno-create-import" placeholder='Paste full collection here…' style="width:100%;height:76px;padding:6px;border-radius:6px;border:1px solid #166534;background:#051008;color:#ecfdf5;box-sizing:border-box;font:10px/1.3 monospace;resize:vertical"></textarea>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px;align-items:center">
          <button type="button" id="suno-create-import-btn" style="${btn("#15803d", "#22c55e", "#fff")};font-weight:600">Load songs</button>
          <label style="${btn("#0f172a", "#38bdf8", "#bae6fd")};display:inline-flex;align-items:center;gap:4px;margin:0;font-weight:600">
            Upload .txt<input type="file" id="suno-create-file" accept=".txt,.json,text/plain,application/json" style="display:none">
          </label>
          <button type="button" id="suno-create-clear-songs" style="${btn("#1c1917", "#78716c", "#d6d3d1")}">Clear list</button>
        </div>
      </details>

      <details data-suno-section="songs" open style="margin-bottom:5px;padding:5px;border:1px solid #3b82f6;border-radius:8px;background:#0a1220">
        <summary style="cursor:pointer;color:#93c5fd;font-size:11px;font-weight:600">② Songs (${songs.length})</summary>
        <div style="display:flex;gap:4px;margin:5px 0">
          <button type="button" id="suno-create-all" style="${btn("#1e3a5f", "#3b82f6")}">All</button>
          <button type="button" id="suno-create-none" style="${btn("#1e3a5f", "#3b82f6")}">None</button>
        </div>
        <div id="suno-create-checklist" style="max-height:180px;overflow:auto;border:1px solid #1d4ed8;border-radius:6px;padding:4px;background:#060d18">${songs.length ? renderSongChecklist(songs) : '<div style="color:#64748b;font-size:10px;padding:4px">No songs yet — paste above and click Load songs</div>'}</div>
      </details>

      <details data-suno-section="run" open style="margin-bottom:5px;padding:5px;border:1px solid #f59e0b;border-radius:8px;background:#1a1208">
        <summary style="cursor:pointer;color:#fcd34d;font-size:10px;font-weight:600">③ Run</summary>
        <button type="button" id="suno-create-wand-toggle" aria-pressed="true" title="ON — clicks ✨ wand after style for every song" style="${btn("#4c1d95", "#a78bfa", "#ede9fe")};width:100%;margin-top:5px;font-weight:700">✨ Magic wand ON (all songs)</button>
        <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:5px">
          <button type="button" id="suno-create-test" style="${btn("#15803d", "#22c55e", "#fff")};font-weight:600">Test 1</button>
          <button type="button" id="suno-create-start" style="${btn("#1d4ed8", "#3b82f6", "#fff")};font-weight:700">Start</button>
          <button type="button" id="suno-create-resume" style="${btn("#0e4f6e", "#0891b2", "#cffafe")}">Resume</button>
          <button type="button" id="suno-create-stop" style="${btn("#7f1d1d", "#ef4444", "#fee2e2")}">Stop</button>
          <button type="button" id="suno-create-skip" style="${btn("#78350f", "#f59e0b", "#fef3c7")}">Skip song</button>
          <button type="button" id="suno-create-reset" style="${btn("#292524", "#57534e", "#e7e5e4")}">Reset form</button>
          <button type="button" id="suno-create-close" style="${btn("#292524", "#57534e", "#e7e5e4")}">Close</button>
        </div>
      </details>

      <details data-suno-section="timings" style="margin-bottom:5px">
        <summary style="cursor:pointer;color:#a78bfa;font-size:10px">Timings (sec)</summary>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-top:5px;font-size:10px;color:#c4b5fd">
          <label>Step<input id="suno-create-step-delay" type="number" min="0.2" max="5" step="0.1" value="0.3" style="padding:4px;border-radius:5px;border:1px solid #6d28d9;background:#110820;color:#eee;width:100%"></label>
          <label>Wand<input id="suno-create-wand-delay" type="number" min="1.5" max="10" step="0.5" value="2" style="padding:4px;border-radius:5px;border:1px solid #6d28d9;background:#110820;color:#eee;width:100%"></label>
          <label>Create<input id="suno-create-create-delay" type="number" min="0.5" max="15" step="0.5" value="1" style="padding:4px;border-radius:5px;border:1px solid #6d28d9;background:#110820;color:#eee;width:100%"></label>
          <label>Clear<input id="suno-create-clear-delay" type="number" min="1" max="15" step="0.5" value="4" style="padding:4px;border-radius:5px;border:1px solid #6d28d9;background:#110820;color:#eee;width:100%"></label>
        </div>
      </details>

      <details data-suno-section="logs">
        <summary style="cursor:pointer;color:#94a3b8;font-size:10px">Logs</summary>
        <pre id="suno-create-log" style="white-space:pre-wrap;max-height:90px;overflow:auto;background:#0f172a;padding:6px;border-radius:6px;font:10px/1.3 monospace;margin:4px 0 0;color:#cbd5e1;border:1px solid #334155"></pre>
      </details>
      </div>
    `;

    document.body.appendChild(panel);
    applyPanelPosition(panel);
    applyPanelCollapsed(panel);
    restorePanelSections(panel);
    restorePanelFields(panel);
    makePanelDraggable(panel);
    bindPanelSectionPersistence(panel);

    document.getElementById("suno-create-collapse-btn").onclick = (e) => {
      e.stopPropagation();
      const collapsed = !getPanelUi().collapsed;
      savePanelUi({ collapsed });
      applyPanelCollapsed(panel);
    };

    document.getElementById("suno-create-import-btn").onclick = () => {
      try {
        const raw = document.getElementById("suno-create-import").value;
        loadSongsFromText(raw, "paste");
      } catch (err) {
        alert(
          "Load failed:\n\n" +
            err.message +
            '\n\nSupported formats:\n' +
            '• 1. "Title" + Style: ... + [Intro]...\n' +
            '• ## 1. "Title" + **Style:** ... + [Intro]...'
        );
      }
    };

    document.getElementById("suno-create-file")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (file) loadSongsFromFile(file);
      e.target.value = "";
    });

    document.getElementById("suno-create-clear-songs")?.addEventListener("click", () => {
      sessionStorage.removeItem(CFG.songsKey);
      sessionStorage.removeItem(CFG.selectedKey);
      saveProgress(0);
      refreshPanelAfterImport(0, "clear");
    });

    document.getElementById("suno-create-all")?.addEventListener("click", () => {
      document.querySelectorAll(".suno-create-pick").forEach((b) => {
        b.checked = true;
      });
      document.getElementById("suno-create-batch-note").textContent = batchSummary(getBatchSongs());
    });

    document.getElementById("suno-create-none")?.addEventListener("click", () => {
      document.querySelectorAll(".suno-create-pick").forEach((b) => {
        b.checked = false;
      });
      document.getElementById("suno-create-batch-note").textContent = batchSummary(getBatchSongs());
    });

    document.getElementById("suno-create-checklist")?.addEventListener("change", () => {
      saveSelected(readSelectedFromPanel());
      document.getElementById("suno-create-batch-note").textContent = batchSummary(getBatchSongs());
    });

    document.getElementById("suno-create-stop").onclick = () => {
      stopFlag = true;
      running = false;
      disableButtons(false);
      setStatus("Stopped");
      log("Stopped by user");
    };

    document.getElementById("suno-create-skip").onclick = () => {
      if (!running) {
        setStatus("Not running — nothing to skip");
        return;
      }
      skipFlag = true;
      setStatus("Skipping current song…");
      log("Skip requested — moving to next song after current step");
    };

    document.getElementById("suno-create-reset").onclick = () => {
      if (!confirm("Clear Suno lyrics/style/title and reset progress to song #1?")) return;
      saveProgress(0);
      setStatus("Clearing Suno form…");
      void clearCreateForm({ quick: true })
        .then(() => {
          const lyrics = getFieldText(findLyricsFieldGlobal() || findLyricsField());
          const style = getFieldText(findStyleFieldDirect() || findStyleFieldGlobal());
          const title = getFieldText(findTitleFieldDirect());
          if (lyrics.length > 3 || style.length > 3 || title.length > 0) {
            setStatus("Reset done · some fields may remain — refresh page if needed");
            log("WARN: after reset, lyrics", lyrics.length, "style", style.length, "title", title.length);
          } else {
            setStatus("Reset done · Suno form empty · progress at #1");
            log("Reset complete — form empty, progress #1");
          }
        })
        .catch((err) => {
          setStatus("Reset error: " + err.message);
          log("ERROR", err.message);
        });
    };

    document.getElementById("suno-create-close").onclick = () => {
      capturePanelUi();
      panel.remove();
    };

    bindRunButton("suno-create-test", { testOne: true });
    bindRunButton("suno-create-start", { resume: false });
    bindRunButton("suno-create-resume", { resume: true });

    running = false;
    stopFlag = false;
    disableButtons(false);
    restoreLogsToPanel();
  }

  async function runBatch(opts = {}) {
    if (running) {
      setStatus("Already running — click Stop first");
      alert("Already running.");
      return;
    }

    readTimingFromPanel();

    let songs = getBatchSongs();
    if (!songs.length) {
      if (!getSongs().length) {
        setStatus("Load songs first");
        alert("No songs loaded yet.\n\nPaste your collection → click Load songs (green), then Test 1.");
      } else {
        setStatus("Select at least one song");
        alert("No songs selected. Check at least one song in the list.");
      }
      return;
    }

    songs = resolveBatchSongs(songs);
    if (!songs.length) {
      setStatus("No songs to run");
      alert("No songs to run.");
      return;
    }

    let startIdx = opts.resume ? getProgress() : 0;
    if (opts.testOne) {
      songs = songs.slice(startIdx, startIdx + 1);
      startIdx = 0;
      log("Test 1:", songs[0]?.title || "song");
      setStatus(`Test 1: ${songs[0]?.title?.slice(0, 36) || "song"}…`);
    } else {
      log("Batch plan:", songs.length, "song(s)");
      setStatus(`Running ${songs[0].title?.slice(0, 36) || "song"}…`);
      if (!opts.resume) {
        saveProgress(0);
        startIdx = 0;
      }
    }

    if (opts.resume && startIdx > 0) {
      log("Resuming from song #" + (startIdx + 1));
    }

    stopFlag = false;
    skipFlag = false;
    running = true;
    disableButtons(true);

    try {
      for (let i = startIdx; i < songs.length; i++) {
        if (stopFlag) break;
        skipFlag = false;
        await createOneSong(songs[i], i, songs.length);
        saveProgress(i + 1);

        if (skipFlag) {
          log("Skipped song #" + (i + 1) + ":", songs[i]?.title || "song");
          setStatus(`Skipped #${i + 1} · next song…`);
          skipFlag = false;
          if (i >= songs.length - 1 || opts.testOne) {
            setStatus(`Done · ${songs.length} song${songs.length === 1 ? "" : "s"} processed`);
            log("Batch complete");
            break;
          }
          await stepPause("before next song");
          continue;
        }

        if (stopFlag) {
          setStatus(`Stopped at song #${i + 1}`);
          log("Stopped by user");
          break;
        }

        if (i >= songs.length - 1 || opts.testOne) {
          setStatus(`Done · ${songs.length} song${songs.length === 1 ? "" : "s"} submitted`);
          log("Batch complete");
          break;
        }

        await stepPause("before next song");
      }
    } catch (err) {
      if (stopFlag) {
        setStatus("Stopped");
        log("Stopped by user");
      } else {
        setStatus("Error: " + err.message);
        log("ERROR", err.message);
      }
    } finally {
      running = false;
      disableButtons(false);
    }
  }

  function disableButtons(disabled) {
    document.getElementById("suno-create-panel")?.querySelectorAll("button").forEach((b) => {
      if (b.id === "suno-create-stop" || b.id === "suno-create-skip" || b.id === "suno-create-close") return;
      b.disabled = disabled;
    });
  }

  running = false;
  stopFlag = false;
  skipFlag = false;
  ensureDefaultSongsLoaded();
  renderPanel();
  log("Panel ready on", location.href);
  log("Loaded", getSongs().length, "song(s) · clears form between songs (no refresh)");

  window.__sunoCreateGetLogs = () => JSON.parse(sessionStorage.getItem(CFG.logKey) || "[]");
  window.__sunoCreateGetSongs = getSongs;
  window.__sunoCreateRunTest = () => runBatch({ testOne: true });
  window.__sunoCreateSetSongs = (arr) => {
    validateSongs(arr);
    saveSongs(arr);
    log("Songs updated:", arr.length);
  };
  window.__sunoCreateParseCollection = parseSongCollection;
  window.__sunoCreateImportRaw = (raw) => {
    const parsed = importSongsRaw(raw);
    saveSongs(parsed);
    saveProgress(0);
    return parsed;
  };
})();
