// popup.js - playful UI logic for karshfruitbot exporter

const formatSelect = document.getElementById('format');
const previewEl = document.getElementById('preview');
const statusEl = document.getElementById('status');
const sitePillEl = document.getElementById('site-pill');
const sendBtn = document.getElementById('sendToTelegram');
const openBotLink = document.getElementById('openBot');
const requestSupportLink = document.getElementById('requestSupport');
const statusLink = document.getElementById('statusLink');
const statusLinkUrl = 'https://github.com/utk-dwd/karshfruitbot/blob/main/docs/ai-sites-status.md';
const supportLinkUrl = 'https://github.com/utk-dwd/karshfruitbot/blob/main/docs/ai-site-requests.md';

let conversation = null;
let activeTabId = null;
let browserSessionId = '';

function generateBrowserSessionId() {
	const rand = (crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`).replace(/[^a-zA-Z0-9_-]/g, '');
	return `kb_${rand}`;
}

async function ensureBrowserSessionId() {
	if (browserSessionId) return browserSessionId;
	const stored = await chrome.storage.sync.get({ BROWSER_SESSION_ID: '' });
	browserSessionId = stored.BROWSER_SESSION_ID || generateBrowserSessionId();
	await chrome.storage.sync.set({ BROWSER_SESSION_ID: browserSessionId });
	return browserSessionId;
}

function getTelegramStartUrl(sessionId) {
	return `https://t.me/karshfruitbot?start=${encodeURIComponent(sessionId)}`;
}

async function openTelegramForSession(sessionId) {
	const url = getTelegramStartUrl(sessionId);
	await chrome.tabs.create({ url });
}

async function checkLinkStatus(sessionId) {
	const result = await chrome.runtime.sendMessage({
		type: 'CHECK_LINK_STATUS',
		browserSessionId: sessionId,
	});
	if (!result?.ok) {
		throw new Error(result?.error || 'Unable to check link status');
	}
	return Boolean(result.linked);
}

async function sendExport({ fmt, content, fileName, sessionId }) {
	const result = await chrome.runtime.sendMessage({
		type: 'SEND_TO_TELEGRAM',
		format: fmt,
		content,
		fileName,
		browserSessionId: sessionId,
	});

	if (!result?.ok) {
		throw new Error(result?.error || 'Unknown error');
	}

	return result;
}

async function waitForLinkAndSend(payload) {
	const maxChecks = 15;
	for (let i = 0; i < maxChecks; i++) {
		await new Promise((resolve) => setTimeout(resolve, 2000));
		const linked = await checkLinkStatus(payload.sessionId);
		if (linked) {
			return sendExport(payload);
		}
	}
	throw new Error('Linking timeout. Press Start in Telegram and try Send again.');
}

function setStatus(message, tone = 'muted') {
	statusEl.textContent = message;
	statusEl.style.color = tone === 'ok' ? '#2b7a44' : tone === 'warn' ? '#b54708' : '#6b6474';
}

function formatConversation(conv, format) {
	if (!conv) return 'No conversation captured.';

	const header = `Source: ${conv.source}\nURL: ${conv.url}\nCaptured: ${conv.capturedAt}\n`;

	if (format === 'json') {
		return JSON.stringify(conv, null, 2);
	}

	if (format === 'markdown') {
		const lines = [
			`# ${conv.source} chat export`,
			`- URL: ${conv.url}`,
			`- Captured: ${conv.capturedAt}`,
			'',
			'---',
			'',
		];
		conv.messages.forEach((m, idx) => {
			lines.push(`## ${idx + 1}. ${m.role.toUpperCase()}`);
			lines.push('');
			lines.push(m.text || '');
			lines.push('');
		});
		return lines.join('\n');
	}

	// plain text
	const body = conv.messages
		.map((m, idx) => `${idx + 1}. [${m.role}]\n${m.text || ''}`)
		.join('\n\n');
	return `${header}\n${body}`;
}

function renderPreview() {
	const fmt = formatSelect.value;
	previewEl.textContent = formatConversation(conversation, fmt);
}

async function loadSettings() {
	const stored = await chrome.storage.sync.get({
		DEFAULT_FORMAT: 'markdown',
	});
	formatSelect.value = stored.DEFAULT_FORMAT || 'markdown';
	await ensureBrowserSessionId();
}

async function getActiveTabId() {
	const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
	return tab?.id;
}

async function requestConversation() {
	activeTabId = await getActiveTabId();
	if (!activeTabId) {
		setStatus('No active tab found. Open an AI chat page.', 'warn');
		return;
	}

	try {
		setStatus('Scraping conversation…');
		const response = await chrome.tabs.sendMessage(activeTabId, {
			type: 'SCRAPE_CONVERSATION',
		});

		if (!response || !response.conversation) {
			throw new Error(response?.error || 'No data returned');
		}

		conversation = response.conversation;
		sitePillEl.textContent = `${conversation.source} • ${new URL(conversation.url).hostname}`;
		renderPreview();
		setStatus('Conversation ready. Choose format & send ✈️', 'ok');
	} catch (err) {
		console.error('Scrape error', err);
		conversation = null;
		sitePillEl.textContent = 'Unable to detect conversation';
		previewEl.textContent = 'No conversation captured. Make sure you are on a supported AI chat page.';
		setStatus('Could not scrape this page. Try refreshing or another tab.', 'warn');
	}
}

function deriveFileName(conv, fmt) {
	const base = conv?.source || 'conversation';
	const ts = new Date().toISOString().replace(/[:.]/g, '-');
	const ext = fmt === 'markdown' ? 'md' : fmt === 'json' ? 'json' : 'txt';
	return `${base}-${ts}.${ext}`;
}

async function sendToTelegram() {
	if (!conversation) {
		setStatus('No conversation to send. Scrape first.', 'warn');
		return;
	}

	const fmt = formatSelect.value;
	const content = formatConversation(conversation, fmt);
	const fileName = deriveFileName(conversation, fmt);
	const sessionId = await ensureBrowserSessionId();

	try {
		let result;
		const linked = await checkLinkStatus(sessionId);
		if (!linked) {
			setStatus('Opening Telegram… press Start to link this browser.', 'warn');
			await openTelegramForSession(sessionId);
			result = await waitForLinkAndSend({ fmt, content, fileName, sessionId });
		} else {
			setStatus('Sending to Telegram…');
			result = await sendExport({ fmt, content, fileName, sessionId });
		}

		if (result?.ok) {
			const deliveryMode = result?.deliveredAs ? ` as ${result.deliveredAs}` : '';
			setStatus(`Sent${deliveryMode}! Check Telegram 🍓`, 'ok');
		}
	} catch (err) {
		console.error('Send error', err);
		const message = String(err?.message || 'Unknown error');
		if (message.toLowerCase().includes('no linked telegram chat')) {
			setStatus('Press Start in Telegram, then click Send again.', 'warn');
		} else {
			setStatus(`Send failed: ${message}`, 'warn');
		}
	}
}

// Event wiring
document.addEventListener('DOMContentLoaded', async () => {
	await loadSettings();
	await requestConversation();
});

formatSelect.addEventListener('change', () => {
	chrome.storage.sync.set({ DEFAULT_FORMAT: formatSelect.value });
	renderPreview();
});

sendBtn.addEventListener('click', sendToTelegram);

// Deep link to the bot for chat ID capture (/start register flow placeholder)
openBotLink.addEventListener('click', (e) => {
	e.preventDefault();
	ensureBrowserSessionId().then((sessionId) => {
		openTelegramForSession(sessionId);
	});
});

// Request site support (opens docs page; could be replaced with a webhook endpoint)
requestSupportLink.addEventListener('click', (e) => {
	e.preventDefault();
	chrome.tabs.create({ url: supportLinkUrl });
});

// Optional: status page for approved/pending hosts
statusLink?.addEventListener('click', (e) => {
	e.preventDefault();
	chrome.tabs.create({ url: statusLinkUrl });
});
