// chatLinkRegistry.js - maps extension/browser link IDs to Telegram chat IDs in-memory.

const browserLinkToChatId = new Map();

function normalizeLinkId(value) {
  const input = String(value || '').trim();
  if (!input) return '';
  if (!/^[a-zA-Z0-9_-]{6,128}$/.test(input)) return '';
  return input;
}

function registerBrowserLink(linkId, chatId) {
  const normalizedLinkId = normalizeLinkId(linkId);
  const normalizedChatId = String(chatId || '').trim();
  if (!normalizedLinkId || !normalizedChatId) return false;
  browserLinkToChatId.set(normalizedLinkId, normalizedChatId);
  return true;
}

function resolveChatIdByBrowserLink(linkId) {
  const normalizedLinkId = normalizeLinkId(linkId);
  if (!normalizedLinkId) return '';
  return browserLinkToChatId.get(normalizedLinkId) || '';
}

module.exports = {
  registerBrowserLink,
  resolveChatIdByBrowserLink,
};
