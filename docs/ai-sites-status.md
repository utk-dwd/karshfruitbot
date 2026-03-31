# AI site support status

This page lists the hosts currently allowed by the extension and mapped to scrapers. If a site you need isn’t listed, use the “Request site support” link in the popup and reload the extension after approval.

_Last updated: 2026-04-01_

## Allowed hosts (manifest `host_permissions` / `content_scripts.matches`)

- https://chatgpt.com/*
- https://chat.openai.com/*
- https://chat.com/*
- https://claude.ai/*
- https://www.perplexity.ai/*
- https://perplexity.ai/*
- https://gemini.google.com/*

## Host → source mapping (content/content.js)

- chatgpt.com → chatgpt
- chat.openai.com → chatgpt
- chat.com → chatgpt
- claude.ai → claude
- www.perplexity.ai → perplexity
- perplexity.ai → perplexity
- gemini.google.com → gemini

## How to use this page

- If your site is missing, click “Request site support” in the popup and submit the URL.
- After a host is approved and added to the manifest, **reload the extension** (or reinstall) so Chrome applies new permissions.
- Scraping will work only when both the host is allowed **and** a scraper exists for that source.
