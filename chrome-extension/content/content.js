// content.js - scrapes AI chat conversations and normalizes them for karshfruitbot exporter

function clean(text) {
	return (text || '').replace(/\s+/g, ' ').trim();
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasAssistantMarkers(el) {
	const testId = (el.getAttribute('data-testid') || '').toLowerCase();
	const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
	const className = String(el.className || '').toLowerCase();
	return (
		testId.includes('assistant') ||
		testId.includes('ai-turn') ||
		testId.includes('claude') ||
		ariaLabel.includes('assistant') ||
		ariaLabel.includes('claude') ||
		className.includes('assistant')
	);
}

function hasUserMarkers(el) {
	const testId = (el.getAttribute('data-testid') || '').toLowerCase();
	const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
	const className = String(el.className || '').toLowerCase();
	return (
		testId.includes('human') ||
		testId.includes('user') ||
		testId.includes('you-turn') ||
		ariaLabel.includes('user') ||
		ariaLabel.includes('you') ||
		className.includes('user')
	);
}

function extractClaudeText(el) {
	const contentNode =
		el.querySelector('[data-testid*="message-content"], [data-testid*="response"], .prose, .markdown, p') || el;
	return clean(contentNode.innerText || el.innerText || '');
}

const HOST_SOURCE_MAP = {
	'chatgpt.com': 'chatgpt',
	'chat.openai.com': 'chatgpt',
	'chat.com': 'chatgpt',

	'claude.ai': 'claude',

	'perplexity.ai': 'perplexity',
	'www.perplexity.ai': 'perplexity',

	'gemini.google.com': 'gemini',
};

// Wait for SPA-rendered content to appear
function waitForContent(selector, timeout = 5000) {
	return new Promise((resolve, reject) => {
		if (document.querySelector(selector)) return resolve();
		const observer = new MutationObserver(() => {
			if (document.querySelector(selector)) {
				observer.disconnect();
				resolve();
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
		setTimeout(() => {
			observer.disconnect();
			reject(new Error('timeout'));
		}, timeout);
	});
}

// ─────────────────────────────
// ChatGPT
// ─────────────────────────────
function extractChatGPT() {
	const turns = document.querySelectorAll('article[class*="group/turn-messages"], [data-message-author-role]');
	const messages = [];
	turns.forEach((turn) => {
		const roleAttr = turn.getAttribute('data-message-author-role');
		const role = roleAttr === 'assistant' ? 'assistant' : roleAttr === 'user' ? 'user' : turn.querySelector('.user-message-bubble-color') ? 'user' : 'assistant';
		const text = clean(turn.innerText);
		if (text) messages.push({ role, text });
	});
	return messages;
}

// ─────────────────────────────
// Claude
// ─────────────────────────────
function extractClaude() {
	const humanTurns = document.querySelectorAll(
		'[' +
			'data-testid="human-turn"], ' +
			'[data-testid*="human-turn"], ' +
			'[data-testid="user-message"], ' +
			'[data-testid*="user-message"]'
	);
	const aiTurns = document.querySelectorAll(
		'[' +
			'data-testid="ai-turn"], ' +
			'[data-testid*="ai-turn"], ' +
			'[data-testid="assistant-message"], ' +
			'[data-testid*="assistant-message"]'
	);
	const allTurns = [
		...Array.from(humanTurns).map((el) => ({ role: 'user', el })),
		...Array.from(aiTurns).map((el) => ({ role: 'assistant', el })),
	].sort((a, b) => {
		const pos = a.el.compareDocumentPosition(b.el);
		return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
	});

	const messages = [];
	allTurns.forEach(({ role, el }) => {
		const text = clean(el.innerText);
		if (text) messages.push({ role, text });
	});

	if (messages.length > 0) return messages;

	// Fallback: direct message nodes seen on some Claude builds
	const directUserMessages = document.querySelectorAll('[data-testid="user-message"], [data-testid*="user-message"]');
	const directAssistantMessages = document.querySelectorAll('[data-testid="assistant-message"], [data-testid*="assistant-message"]');
	const directTurns = [
		...Array.from(directUserMessages).map((el) => ({ role: 'user', el })),
		...Array.from(directAssistantMessages).map((el) => ({ role: 'assistant', el })),
	].sort((a, b) => {
		const pos = a.el.compareDocumentPosition(b.el);
		return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
	});

	directTurns.forEach(({ role, el }) => {
		const text = extractClaudeText(el);
		if (text) messages.push({ role, text });
	});

	if (messages.length > 0 && messages.some((m) => m.role === 'assistant')) return messages;

	// Broad fallback for newer Claude DOMs with changed testids/classes
	const genericCandidates = document.querySelectorAll(
		'[data-testid*="turn"], [data-testid*="message"], [data-testid*="response"], article, section'
	);
	const seen = new Set();
	for (const el of genericCandidates) {
		const text = extractClaudeText(el);
		if (!text || text.length < 2) continue;

		const role = hasAssistantMarkers(el) ? 'assistant' : hasUserMarkers(el) ? 'user' : null;
		if (!role) continue;

		const key = `${role}:${text}`;
		if (seen.has(key)) continue;
		seen.add(key);
		messages.push({ role, text });
	}

	return messages;
}

// ─────────────────────────────
// Gemini
// ─────────────────────────────
function extractGemini() {
	const messages = [];
	const turns = document.querySelectorAll('chat-turn');

	if (turns.length > 0) {
		turns.forEach((turn) => {
			const userEl = turn.querySelector('user-query .query-text, user-query, [data-user-query]');
			const modelEl = turn.querySelector('model-response .markdown, model-response message-content, model-response, [data-model-response]');
			if (userEl) messages.push({ role: 'user', text: clean(userEl.innerText) });
			if (modelEl) messages.push({ role: 'assistant', text: clean(modelEl.innerText) });
		});
		return messages;
	}

	// fallback if custom elements not yet rendered
	const userMsgs = document.querySelectorAll('user-query');
	const modelMsgs = document.querySelectorAll('model-response');
	userMsgs.forEach((el) => messages.push({ role: 'user', text: clean(el.innerText) }));
	modelMsgs.forEach((el) => messages.push({ role: 'assistant', text: clean(el.innerText) }));
	return messages;
}

// ─────────────────────────────
// Perplexity
// ─────────────────────────────
function extractPerplexity() {
	const messages = [];
	const qaBlocks = document.querySelectorAll('[data-testid="qa-block"]');
	if (qaBlocks.length > 0) {
		qaBlocks.forEach((block) => {
			const query = block.querySelector('[data-testid="query"], p.break-words, h1, h2');
			const answer = block.querySelector('[data-testid="answer"], .prose');
			if (query) messages.push({ role: 'user', text: clean(query.innerText) });
			if (answer) messages.push({ role: 'assistant', text: clean(answer.innerText) });
		});
		return messages;
	}

	// Some builds expose query/answer data-testid without qa-block wrapper
	const queries = document.querySelectorAll('[data-testid="query"], [data-testid*="query"]');
	const answers = document.querySelectorAll(
		'[data-testid="answer"], [data-testid*="answer"], [data-testid="final-answer"], [data-testid*="response"]'
	);
	if (queries.length || answers.length) {
		const max = Math.max(queries.length, answers.length);
		for (let i = 0; i < max; i++) {
			const queryText = clean(queries[i]?.innerText || '');
			const answerText = clean(answers[i]?.innerText || '');
			if (queryText) messages.push({ role: 'user', text: queryText });
			if (answerText) messages.push({ role: 'assistant', text: answerText });
		}
		if (messages.length > 0) return messages;
	}

	// Perplexity common utility-class layout fallback
	const utilityBlocks = document.querySelectorAll('div[class*="col-span"][class*="pb-"]');
	for (const block of utilityBlocks) {
		const queryEl = block.querySelector('[data-testid*="query"], p.break-words, h1, h2, h3');
		const answerEl = block.querySelector('[data-testid*="answer"], [data-testid*="response"], .prose');
		const queryText = clean(queryEl?.innerText || '');
		const answerText = clean(answerEl?.innerText || '');
		if (queryText) messages.push({ role: 'user', text: queryText });
		if (answerText) messages.push({ role: 'assistant', text: answerText });
	}
	if (messages.length > 0) return messages;

	// Perplexity can render Q/A in generic containers; infer from local prose + heading
	const possibleBlocks = document.querySelectorAll('main article, main section, main div');
	for (const block of possibleBlocks) {
		const answerEl = block.querySelector('.prose');
		if (!answerEl) continue;
		const answerText = clean(answerEl.innerText);
		if (!answerText) continue;

		const queryEl = block.querySelector('h1, h2, [data-testid="query"], p.break-words');
		const queryText = clean(queryEl?.innerText || '');
		if (queryText) messages.push({ role: 'user', text: queryText });
		messages.push({ role: 'assistant', text: answerText });
	}
	if (messages.length > 0) return messages;

	const proseBlocks = document.querySelectorAll('.prose');
	proseBlocks.forEach((el) => {
		const text = clean(el.innerText);
		if (text) messages.push({ role: 'assistant', text });
	});
	return messages;
}

function identify() {
	const host = location.hostname.toLowerCase();
	const source = HOST_SOURCE_MAP[host];
	if (!source) return null;

	switch (source) {
		case 'chatgpt':
			return { source, extractor: extractChatGPT, waitSelector: '[data-message-author-role], article[class*="group/turn-messages"]' };
		case 'claude':
			return {
				source,
				extractor: extractClaude,
				waitSelector:
					'[data-testid="human-turn"], [data-testid="ai-turn"], [data-testid="user-message"], [data-testid="assistant-message"], div[contenteditable="true"][data-testid], div[contenteditable="true"].ProseMirror',
			};
		case 'perplexity':
			return {
				source,
				extractor: extractPerplexity,
				waitSelector:
					'[data-testid="qa-block"], [data-testid*="query"], [data-testid*="answer"], [data-testid*="response"], main .prose, .prose, div[class*="col-span"][class*="pb-"]',
			};
		case 'gemini':
			return { source, extractor: extractGemini, waitSelector: 'chat-turn, user-query, model-response' };
		default:
			return null;
	}
}

async function scrape() {
	const info = identify();
	if (!info) throw new Error('Unsupported site');
	let waitTimeout = 5000;
	if (info.source === 'perplexity') waitTimeout = 12000;
	if (info.source === 'claude') waitTimeout = 8000;
	try {
		if (info.waitSelector) {
			await waitForContent(info.waitSelector, waitTimeout);
		}
	} catch (e) {
		// proceed; maybe content already present
	}
	let messages = info.extractor();
	if (!messages.length && info.source === 'perplexity') {
		for (let i = 0; i < 4; i++) {
			await sleep(800);
			messages = info.extractor();
			if (messages.length) break;
		}
	}
	if (!messages.length && info.source === 'claude') {
		for (let i = 0; i < 5; i++) {
			await sleep(700);
			messages = info.extractor();
			if (messages.length && messages.some((m) => m.role === 'assistant')) break;
		}
	}
	if (!messages.length) throw new Error('No messages found');
	return {
		source: info.source,
		url: location.href,
		capturedAt: new Date().toISOString(),
		messages,
	};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'SCRAPE_CONVERSATION') {
		scrape()
			.then((conversation) => sendResponse({ ok: true, conversation }))
			.catch((err) => {
				console.error('Scrape failed', err);
				sendResponse({ ok: false, error: err.message });
			});
		return true;
	}
});
