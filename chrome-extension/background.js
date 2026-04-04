// background.js - MV3 service worker for karshfruitbot exporter

const DEFAULT_EXTENSION_API_URL = 'https://karshfruitbot-production.up.railway.app/api/extension/send';
const FALLBACK_EXTENSION_API_URL = 'https://karshfruitbot-production.up.railway.app/api/extension/send';

function buildLinkStatusUrl(sendUrl, browserSessionId) {
  const base = new URL(sendUrl);
  base.pathname = '/api/extension/link-status';
  base.searchParams.set('browserSessionId', browserSessionId);
  return base.toString();
}

async function getApiUrl() {
  return DEFAULT_EXTENSION_API_URL;
}

async function hasOriginPermission(url) {
  try {
    const u = new URL(url);
    return await chrome.permissions.contains({ origins: [`${u.origin}/*`] });
  } catch (_) {
    return false;
  }
}

async function postToEndpoint(endpoint, payload) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }

  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `Server send failed (${res.status})`);
  }

  return body;
}

async function getLinkStatus(endpoint, browserSessionId) {
  const url = buildLinkStatusUrl(endpoint, browserSessionId);
  const res = await fetch(url, { method: 'GET' });
  let body = null;
  try {
    body = await res.json();
  } catch (_) {
    body = null;
  }
  if (!res.ok || body?.ok === false) {
    throw new Error(body?.error || `Link status check failed (${res.status})`);
  }
  return { linked: Boolean(body?.linked) };
}

async function handleSend({ format, content, fileName, browserSessionId, chatId }) {
  const endpoint = await getApiUrl();
  const normalizedSessionId = String(browserSessionId || '').trim();
  const normalizedChatId = String(chatId || '').trim();

  if (!normalizedSessionId && !normalizedChatId) {
    throw new Error('Missing browser session link. Tap 🤖 and press Start in Telegram once.');
  }

  const payload = {
    format,
    content,
    fileName,
    browserSessionId: normalizedSessionId,
    chatId: normalizedChatId,
  };

  const candidates = [endpoint];
  if (endpoint !== FALLBACK_EXTENSION_API_URL) {
    candidates.push(FALLBACK_EXTENSION_API_URL);
  }

  let lastError = null;

  for (const candidate of candidates) {
    try {
      const hasPermission = await hasOriginPermission(candidate);
      if (!hasPermission) {
        throw new Error(
          `Missing extension permission for ${new URL(candidate).origin}. Reload extension to apply updated manifest host permissions.`
        );
      }

      return await postToEndpoint(candidate, payload);
    } catch (err) {
      lastError = err;
      if (String(err?.message || '').includes('Missing extension permission')) {
        break;
      }
    }
  }

  const message = String(lastError?.message || 'Failed to reach local server');
  if (message.includes('Failed to fetch')) {
    throw new Error(
      `Cannot reach backend API at ${endpoint}. Ensure Railway service is up and extension host permissions are updated, then reload extension.`
    );
  }

  throw lastError;
}

async function handleCheckLink({ browserSessionId }) {
  const endpoint = await getApiUrl();
  const normalizedSessionId = String(browserSessionId || '').trim();
  if (!normalizedSessionId) {
    return { linked: false };
  }

  const candidates = [endpoint];
  if (endpoint !== FALLBACK_EXTENSION_API_URL) {
    candidates.push(FALLBACK_EXTENSION_API_URL);
  }

  let lastError = null;
  for (const candidate of candidates) {
    try {
      const hasPermission = await hasOriginPermission(candidate);
      if (!hasPermission) {
        throw new Error(
          `Missing extension permission for ${new URL(candidate).origin}. Reload extension to apply updated manifest host permissions.`
        );
      }
      return await getLinkStatus(candidate, normalizedSessionId);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error('Unable to check link status');
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SEND_TO_TELEGRAM') {
    handleSend(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => {
        console.error('SendToTelegram error', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep channel alive
  }

  if (message?.type === 'CHECK_LINK_STATUS') {
    handleCheckLink(message)
      .then((result) => sendResponse({ ok: true, ...result }))
      .catch((err) => {
        console.error('CheckLinkStatus error', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }
});