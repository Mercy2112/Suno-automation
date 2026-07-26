# Suno Automation

Two browser console scripts for Suno — no install, no build step.

## 1. Create songs — `create-song.js`

Batch-create songs on Suno from a pasted collection.

1. Open [suno.com/create](https://suno.com/create)
2. F12 → **Console**
3. Paste all of `create-song.js` → Enter
4. Paste your song collection in the panel → **Load songs**
5. **Test 1** → **Start**

**Collection format:** `1. "Title"` + `Style: ...` + `[Intro]...`  
(or markdown: `## 1. "Title"` + `**Style:** ...`)

**Panel options:** magic wand on/off, skip song, lyrics warn up to 1500 chars.

---

## 2. Download songs — `download-songs.js`

Auto-download MP3s from your Suno workspace across pages.

1. Open your Suno workspace (`?page=1`)
2. F12 → **Console**
3. Paste all of `download-songs.js` → Enter
4. Click **Download ALL** on the panel

Allow multiple downloads for `suno.com` in Chrome when prompted.

---

## Files

| File | Use |
|------|-----|
| `create-song.js` | Paste on **Create** page |
| `download-songs.js` | Paste on **Workspace** page |

Copy the entire file each time — do not paste partial snippets.
