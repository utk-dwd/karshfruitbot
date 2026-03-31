# karshfruitbot

Developer-focused toolkit with two parts:

- **Telegram bot backend** (Node.js + Telegraf + Gemini) that turns messy pasted text into clean, GitHub‑flavored Markdown and returns it as a `.md` file.
- **Chrome extension** that scrapes AI chat pages (ChatGPT, Claude, Perplexity, Gemini, etc.), normalizes the conversation, lets you preview it in multiple formats, and sends it to Telegram via the same bot.

Everything lives in one repo so you can extend it into a multi‑tool personal automation platform.

## Features

### Telegram Markdown formatter
- Paste raw text into Telegram, get auto‑structured Markdown (# headings, lists, code blocks, quotes).
- Smart `.md` filenames generated from content (slug + timestamp).
- Built on Telegraf; uses Gemini (2.5 Flash) via Google AI Studio.

### Chrome extension: AI Chat Exporter
- Manifest V3 popup + background service worker.
- Scrapes chats from multiple AI sites via a content script and normalizes them into a consistent `Conversation` structure.
- Choose export format: plain text, Markdown, or JSON.
- Preview before send, then dispatch to Telegram using `sendMessage` or `sendDocument`.

### Single deployment, multi‑tool ready
- One Node backend on Railway serving multiple Telegram features.
- Extension talks directly to Telegram HTTP API (no extra backend needed for exports).

## Repository structure

```text
karshfruitbot/
  package.json
  pnpm-lock.yaml
  .gitignore
  .env
  README.md

  src/
    config/
      env.js                  # Environment loading and validation
    lib/
      geminiClient.js         # Shared Gemini API client
    services/
      markdownFormatter.js    # Gemini-based markdown cleaning + filename logic
    bots/
      karshfruit/
        karshfruitBot.js      # Telegram flows: tray, markdown mode, responses
    bot.js                    # Creates Telegraf bot, registers feature modules
    index.js                  # Entrypoint: launches karshfruitbot polling

  chrome-extension/
    manifest.json             # MV3 manifest (permissions, background, popup)
    popup.html                # Extension UI (format selector, preview, send)
    popup.js                  # UI logic, formatting, messaging to background
    background.js             # Service worker: sends exports to Telegram API
    content/
      content.js              # Per-site DOM scrapers, builds Conversation object
    assets/
      icon16.png
      icon48.png
      icon128.png
```

## Prerequisites

- Node.js 18+
- pnpm
- Telegram account and bot token from **@BotFather**
- Google Gemini API key (Google AI Studio; free tier is fine for dev)
- Chromium-based browser (Chrome, Brave, Edge, Comet) for the extension

## 1) Backend: Telegram bot + Gemini

### 1.1 Install dependencies

```bash
pnpm install
```

### 1.2 Configure environment

Create a `.env` in the project root:

```text
TELEGRAM_BOT_TOKEN=YOUR_BOTFATHER_TOKEN
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
NODE_ENV=development
```

### 1.3 Scripts (package.json)

```json
{
  "main": "src/index.js",
  "scripts": {
    "start": "node src/index.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  }
}
```

### 1.4 Run locally

```bash
pnpm start
```

Then in Telegram:

1. Open your bot.
2. Send `/start`.
3. Tap **📝 Markdown Formatter**.
4. Paste messy text as a single message.
5. You should receive a “Formatting…” status, a cleaned Markdown preview, and an attached `.md` file with a smart filename.

## 2) Deployment: Railway (backend)

1. Push the repo to GitHub.
2. In Railway, create a project from this repo.
3. Configure:
   - Build: `pnpm install`
   - Start: `pnpm start`
   - Env vars: `TELEGRAM_BOT_TOKEN`, `GEMINI_API_KEY`, `NODE_ENV=production`
4. Deploy and watch logs for `karshfruitbot is running in production mode (long polling).`
5. Test from Telegram; behavior should match local.

This single Railway service can host additional Telegram tools by registering more feature modules in `src/bot.js`.

## 3) Chrome extension: AI Chat Exporter

### 3.1 Manifest (MV3)
- `manifest_version`: 3
- `name`: "karshfruitbot – AI Chat Exporter"
- `version`: "1.0.0"
- `action`: `default_popup` → `popup.html`
- `background`: service worker → `background.js`
- `permissions`: `activeTab`, `storage`, `scripting`
- `host_permissions`: AI chat hosts (ChatGPT, Claude, Perplexity, Gemini, Grok, DeepSeek)
- `icons`: `assets/icon16.png`, `icon48.png`, `icon128.png`

### 3.2 Content script (scraper)
- Detect `location.hostname`.
- For each supported AI site, use DOM selectors to extract messages, classify roles, and normalize to:

```ts
type Role = 'user' | 'assistant' | 'system';
type Message = { role: Role; text: string; timestamp?: string };

type Conversation = {
  source: 'chatgpt' | 'claude' | 'perplexity' | 'gemini' | 'grok' | 'deepseek';
  url: string;
  capturedAt: string;
  messages: Message[];
};
```

### 3.3 Popup UI and logic
- Show site label + URL.
- Format selector: Text / Markdown / JSON.
- Preview area.
- Inputs: `BOT_TOKEN`, `CHAT_ID`.
- Buttons: Save Settings, Send to Telegram.
- On load: read settings, request `Conversation` from content script, format preview.
- On send: message background worker with `{ type, format, content, fileName }`.

### 3.4 Background service worker
- Listen for `SEND_TO_TELEGRAM` messages.
- Read `BOT_TOKEN` / `CHAT_ID` from `chrome.storage.sync`.
- Small payloads → `sendMessage`; large/markdown/json → `sendDocument` with `FormData` + `Blob`.

### 3.5 Load extension in dev mode
1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. **Load unpacked** → select `chrome-extension/`.
4. Pin the icon. On a supported AI chat page, click it:
   - Preview should load.
   - Configure token + chat id.
   - Send to Telegram and verify delivery.

## 4) Usage scenarios

- **Clean up lecture notes or docs:** paste into karshfruitbot on Telegram → get a clean `.md` for Obsidian/Git.
- **Archive AI chats:** use the Chrome extension → export Markdown/JSON → send to Telegram (and onward to storage).
- **Single backend, many tools:** add more modules in `src/bots/**` behind one token + one Railway deployment.

## 5) How to contribute (10 ideas)

1) Per‑site scrapers: improve/add selectors; make them resilient.
2) Better Markdown shaping: refine prompt, add heuristics for code/tables before Gemini.
3) Session/state handling: swap Map for Telegraf middleware or Redis/File session store.
4) Multi‑feature tray: add new bot features (summarizer, translator, etc.).
5) Configurable filenames: pluggable patterns (date‑first, site‑first, etc.).
6) Extension settings page: multiple chat IDs, per‑site defaults, toggles.
7) Error reporting/telemetry: structured logs, optional Sentry/Logtail, UI banners.
8) Testing/CI: add unit tests, GitHub Actions for lint/tests.
9) TypeScript migration: shared types for Conversation/Telegram payloads.
10) Docs/examples: screenshots, recipes (e.g., “Export Claude → Obsidian”).

## 6) License

Add your preferred license (MIT, Apache-2.0, etc.).