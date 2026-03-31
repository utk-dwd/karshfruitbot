// background.js - MV3 service worker for karshfruitbot exporter

const TELEGRAM_API_BASE = 'https://api.telegram.org';

async function getSecrets() {
  const { BOT_TOKEN = '', CHAT_ID = '' } = await chrome.storage.sync.get([
    'BOT_TOKEN',
    'CHAT_ID',
  ]);
  return { BOT_TOKEN, CHAT_ID };
}

async function sendSmallText(botToken, chatId, content) {
  const body = new URLSearchParams({
    chat_id: chatId,
    text: content,
  });

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!res.ok) throw new Error(`sendMessage failed (${res.status})`);
  return res.json();
}

async function sendDocument(botToken, chatId, content, fileName) {
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append(
    'document',
    new Blob([content], { type: 'text/plain' }),
    fileName
  );

  const res = await fetch(`${TELEGRAM_API_BASE}/bot${botToken}/sendDocument`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(`sendDocument failed (${res.status})`);
  return res.json();
}

async function handleSend({ format, content, fileName }) {
  const { BOT_TOKEN, CHAT_ID } = await getSecrets();
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('BOT_TOKEN or CHAT_ID missing in storage');
  }

  const shouldUpload = format === 'markdown' || format === 'json' || content.length > 3500;

  if (shouldUpload) {
    return sendDocument(BOT_TOKEN, CHAT_ID, content, fileName);
  }
  return sendSmallText(BOT_TOKEN, CHAT_ID, content);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'SEND_TO_TELEGRAM') {
    handleSend(message)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        console.error('SendToTelegram error', err);
        sendResponse({ ok: false, error: err.message });
      });
    return true; // keep channel alive
  }
});