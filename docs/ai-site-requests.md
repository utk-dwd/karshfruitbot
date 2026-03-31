# Dynamic site support and token UX notes

This doc captures how to safely extend the extension’s allowlist/scraper support and what’s realistic for automating Telegram token/chat ID handling.

## 1) Pragmatic flow for new AI sites

Chrome won’t accept wildcards outside its match rules, and adding domains without scrapers is pointless. A disciplined flow:

1) **User reports a page** (URL) when scraping fails.
2) **Backend or maintainer** reviews the URL, adds:
   - The host to `manifest.json` (`host_permissions` + `content_scripts[*].matches`).
   - A `HOST_SOURCE_MAP` entry in `content/content.js` plus a scraper for that host.
3) **Release** a new extension build (or reload unpacked) and retry.

### Dynamic registry (future-friendly)

- Keep `manifest.json` broad enough for likely AI domains.
- Host a `site-registry.json` (or similar) on your backend/GitHub Pages. It should map hostnames → source labels → selector configs.
- On popup open (or background start), the extension fetches the registry and chooses selectors at runtime.
- If a user hits an unsupported host, offer a “Request site support” action that POSTs the URL/hostname to your backend. After you add it to the registry, users just reload the extension; no code repack needed as long as the domain was already in `manifest.json`.

### Surface status for users

- Render a Markdown status page (e.g., published via GitHub Pages) that lists:
  - Approved hosts (aligned with manifest allowlist)
  - Pending requests
  - Last updated timestamp
- Link to that page from the popup (“Request site support” / “Status”).
- Remind users: after a host is approved, reload the extension to pick up manifest changes if the domain was newly added.

### What we can automate (future work)

- Add a “Request site support” button in the popup that POSTs the current tab URL to a small webhook/backend. That backend can:
  - Queue requests (e.g., in a sheet/DB).
  - Optionally render a dynamic Markdown page listing pending/approved hosts and the current manifest matches.
- Expose that Markdown page via GitHub Pages (or similar) so users can see when a host is approved.
- Ship a “Reload extension” hint after approval; Chrome MV3 still requires reloading to pick up manifest changes.

### What is **not** feasible client‑side

- Dynamically changing `manifest.json` or matches at runtime. MV3 requires a reload for new host permissions.
- Auto-scraping unknown hosts without selectors—domains alone do nothing.

## 2) Minimizing BOT_TOKEN / CHAT_ID friction

Current model is local-only: you paste BOT_TOKEN + CHAT_ID once; the extension caches them in `chrome.storage.sync`.

### Safer, smoother alternatives (future work)

- **Backend-owned token**: The extension never sees the bot token. It calls your backend with the export; the backend (with the token) forwards to Telegram. Users would still need a way to link their chat ID—see below.
- **Chat ID handoff via deep link**: Add a “Open bot” button that opens `https://t.me/<your_bot>?start=register`. The bot can capture `ctx.chat.id` on `/start` and store it server-side keyed to a short code the extension can fetch. This avoids manual chat ID entry after first run.

### What is **not** advisable

- Shipping a bot token in the extension bundle.
- Auto-filling user-specific chat IDs without an explicit handshake—Telegram doesn’t expose that to arbitrary web pages.

## 3) Minimal viable additions (if you decide to implement)

- Popup: add “Request site support” button → POST current tab URL to a simple webhook; show a success toast.
- Backend: store requests; generate/update a Markdown page (e.g., `docs/ai-sites.md`) listing approved hosts and matching manifest entries.
- Bot UX: add `/chatid` (already present) plus a deep-link button in the popup to open the bot; optionally implement a `/register` flow to capture chat IDs server-side.

### Reload reminder

- Chrome MV3 requires reloading the extension to apply new manifest allowlist entries. When you approve a new host, tell users to reload (or ship a new packed build) before scraping again.

Until then, keep the allowlist tight and only add domains when you add selectors.
