# DualSubs

> Real-time dual subtitles for YouTube and Udemy — original language on top, your translation below.

![Chrome Extension](https://img.shields.io/badge/Chrome-Extension-4285F4?logo=googlechrome&logoColor=white)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

DualSubs overlays a translated subtitle directly beneath the original one while a video plays — no tab switching, no copy-pasting, just two lines of text synced to the video in real time.

![DualSubs demo overlay](https://placehold.co/680x120/12121f/667eea?text=Original+subtitle+here%0ATranslation+appears+here)

---

## Features

- **Real-time translation** — subtitles are translated as they appear, with debouncing to avoid flicker
- **Translation cache** — repeated phrases are served instantly without extra API calls
- **Three translation providers** — MyMemory (free, no key), Google Translate, or OpenAI GPT
- **Fully customizable overlay** — font size, colors, opacity, position (top / bottom), line spacing
- **Toggle original subtitles** — hide the original and show only the translation
- **Persistent settings** — everything saved to `chrome.storage.sync`
- **SPA-aware** — re-attaches to the player automatically after YouTube in-page navigation

---

## Supported platforms

| Platform | Status |
|----------|--------|
| YouTube  | ✅ Phase 1 |
| Udemy    | ✅ Phase 1 |
| Netflix  | 🔜 Planned |
| Coursera | 🔜 Planned |
| Any HTML5 player | 🔜 Extensible |

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/Michael13Lu/DualSubs.git
cd DualSubs
npm install
```

### 2. Generate icons

```bash
npm run icons
```

### 3. Build the extension

```bash
npm run build        # production build → dist/
npm run dev          # watch mode for development
```

### 4. Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked** and select the `dist/` folder
4. Go to YouTube, enable captions — the overlay appears automatically

---

## Project structure

```
DualSubs/
├── dist/                        # Built extension (load this in Chrome)
├── src/
│   ├── types/
│   │   └── index.ts             # Shared interfaces & defaults
│   ├── background/
│   │   └── service-worker.ts    # Handles translation API calls
│   ├── content/
│   │   ├── index.ts             # Content script entry point
│   │   ├── adapters/
│   │   │   ├── baseAdapter.ts   # PlatformAdapter interface
│   │   │   ├── youtubeAdapter.ts
│   │   │   └── udemyAdapter.ts
│   │   ├── services/
│   │   │   ├── subtitleService.ts    # Picks the right adapter
│   │   │   ├── translationService.ts # Sends requests to background
│   │   │   └── uiOverlayService.ts   # Creates & updates the DOM overlay
│   │   └── utils/
│   │       ├── debounce.ts
│   │       └── cache.ts
│   └── popup/
│       ├── popup.html
│       ├── popup.css
│       └── popup.ts             # Settings UI logic
├── scripts/
│   └── generate-icons.js        # Generates PNG icons (no extra deps)
├── icons/                       # icon16/48/128.png
├── manifest.json                # MV3 manifest
├── webpack.config.js
├── tsconfig.json
└── package.json
```

---

## Settings

Open the extension popup to configure:

| Setting | Description |
|---------|-------------|
| **Enable** | Toggle the extension on/off without uninstalling |
| **Target language** | Language to translate into (16 languages supported) |
| **Show original** | Display or hide the original subtitle line |
| **Position** | Place overlay at the top or bottom of the viewport |
| **Font size** | 10 – 40 px |
| **Font / BG color** | Full color picker |
| **BG opacity** | 0 (transparent) – 1 (solid) |
| **Line spacing** | Gap between the two subtitle lines |
| **Provider** | MyMemory · Google Translate · OpenAI |
| **API key** | Required for Google / OpenAI providers |

---

## Translation providers

### MyMemory (default — free)
No API key needed. Supports ~50 language pairs. Suitable for most use cases.

### Google Translate
Requires a [Cloud Translation API key](https://cloud.google.com/translate/docs/setup).
Paste your key in the popup → API key field.

### OpenAI GPT
Uses `gpt-4o-mini` for context-aware translation.
Paste your [OpenAI API key](https://platform.openai.com/api-keys) in the popup.

---

## Architecture

```
Video page (content script)
   │
   ├─ PlatformAdapter          watches subtitle DOM via MutationObserver
   │      └─ SubtitleService   selects the right adapter for current URL
   │
   ├─ TranslationService       deduplicates in-flight requests + local cache
   │      └─ chrome.runtime.sendMessage ──► Background service worker
   │                                              └─ fetch() → translation API
   └─ UIOverlayService         renders a position:fixed overlay (z-index max)
```

The **background service worker** handles all outbound fetch calls, which solves CORS restrictions on content scripts. It also maintains an in-memory translation cache for the session.

---

## Adding a new platform

1. Create `src/content/adapters/myPlatformAdapter.ts` implementing `PlatformAdapter`
2. Add it to the `adapters` array in `subtitleService.ts`
3. Add the platform URL to `content_scripts.matches` in `manifest.json`

That's it — the rest of the pipeline (translation, overlay, settings) works unchanged.

---

## License

MIT © 2025 Michael13Lu
