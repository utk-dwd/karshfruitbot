// popup.js - playful UI logic for karshfruitbot exporter

const formatSelect = document.getElementById('format');
const previewEl = document.getElementById('preview');
const statusEl = document.getElementById('status');
const sitePillEl = document.getElementById('site-pill');
const botTokenInput = document.getElementById('botToken');
const chatIdInput = document.getElementById('chatId');
const saveBtn = document.getElementById('saveSettings');
const sendBtn = document.getElementById('sendToTelegram');

let conversation = null;
let activeTabId = null;

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
		BOT_TOKEN: '',
		CHAT_ID: '',
		DEFAULT_FORMAT: 'markdown',
	});
	botTokenInput.value = stored.BOT_TOKEN;
	chatIdInput.value = stored.CHAT_ID;
	formatSelect.value = stored.DEFAULT_FORMAT || 'markdown';
}

async function saveSettings() {
	await chrome.storage.sync.set({
		BOT_TOKEN: botTokenInput.value.trim(),
		CHAT_ID: chatIdInput.value.trim(),
		DEFAULT_FORMAT: formatSelect.value,
	});
	setStatus('Settings saved 🍍', 'ok');
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

	const botToken = botTokenInput.value.trim();
	const chatId = chatIdInput.value.trim();

	if (!botToken || !chatId) {
		setStatus('Set BOT token and chat ID first.', 'warn');
		return;
	}

	const fmt = formatSelect.value;
	const content = formatConversation(conversation, fmt);
	const fileName = deriveFileName(conversation, fmt);

	try {
		setStatus('Sending to Telegram…');
		const result = await chrome.runtime.sendMessage({
			type: 'SEND_TO_TELEGRAM',
			format: fmt,
			content,
			fileName,
		});

		if (result?.ok) {
			setStatus('Sent! Check Telegram 🍓', 'ok');
		} else {
			throw new Error(result?.error || 'Unknown error');
		}
	} catch (err) {
		console.error('Send error', err);
		setStatus(`Send failed: ${err.message}`, 'warn');
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

saveBtn.addEventListener('click', saveSettings);
sendBtn.addEventListener('click', sendToTelegram);
