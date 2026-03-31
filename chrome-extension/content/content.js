// content.js - scrapes AI chat conversations and normalizes them for karshfruitbot exporter

function clean(text) {
	return (text || '').replace(/\s+/g, ' ').trim();
}

function scrapeChatGPT() {
	const nodes = document.querySelectorAll('[data-message-author-role]');
	const messages = Array.from(nodes).map((el) => ({
		role: el.getAttribute('data-message-author-role') === 'assistant' ? 'assistant' : 'user',
		text: clean(el.innerText),
	}));
	return messages.filter((m) => m.text);
}

function scrapeClaude() {
	const nodes = document.querySelectorAll('[data-testid="chatMessage"], [data-testid="message"]');
	const messages = Array.from(nodes).map((el) => {
		const role = el.querySelector('img[alt^="User"]') ? 'user' : 'assistant';
		return { role, text: clean(el.innerText) };
	});
	return messages.filter((m) => m.text);
}

function scrapePerplexity() {
	const nodes = document.querySelectorAll('[data-testid="chat-message"]');
	const messages = Array.from(nodes).map((el) => {
		const role = el.textContent?.includes('Follow-up') ? 'assistant' : 'assistant';
		return { role, text: clean(el.innerText) };
	});
	return messages.filter((m) => m.text);
}

function scrapeGemini() {
	const nodes = document.querySelectorAll('div[role="listitem"]');
	const messages = Array.from(nodes).map((el) => {
		const role = el.innerText?.startsWith('You') ? 'user' : 'assistant';
		return { role, text: clean(el.innerText.replace(/^You\n/, '')) };
	});
	return messages.filter((m) => m.text);
}

function scrapeGrok() {
	const nodes = document.querySelectorAll('article');
	const messages = Array.from(nodes).map((el) => {
		const role = el.querySelector('svg[aria-label="User"]') ? 'user' : 'assistant';
		return { role, text: clean(el.innerText) };
	});
	return messages.filter((m) => m.text);
}

function scrapeDeepSeek() {
	const nodes = document.querySelectorAll('[data-role], .message');
	const messages = Array.from(nodes).map((el) => {
		const role = el.getAttribute('data-role') || 'assistant';
		return { role: role === 'user' ? 'user' : 'assistant', text: clean(el.innerText) };
	});
	return messages.filter((m) => m.text);
}

function identify() {
	const host = location.hostname;
	if (host.includes('chat.openai.com')) return { source: 'chatgpt', scraper: scrapeChatGPT };
	if (host.includes('claude.ai')) return { source: 'claude', scraper: scrapeClaude };
	if (host.includes('perplexity.ai')) return { source: 'perplexity', scraper: scrapePerplexity };
	if (host.includes('gemini.google.com')) return { source: 'gemini', scraper: scrapeGemini };
	if (host.includes('grok.')) return { source: 'grok', scraper: scrapeGrok };
	if (host.includes('deepseek.com')) return { source: 'deepseek', scraper: scrapeDeepSeek };
	return null;
}

function buildConversation(source, messages) {
	return {
		source,
		url: location.href,
		capturedAt: new Date().toISOString(),
		messages,
	};
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message?.type === 'SCRAPE_CONVERSATION') {
		try {
			const info = identify();
			if (!info) throw new Error('Unsupported site');
			const messages = info.scraper();
			if (!messages.length) throw new Error('No messages found');
			const conversation = buildConversation(info.source, messages);
			sendResponse({ ok: true, conversation });
		} catch (err) {
			console.error('Scrape failed', err);
			sendResponse({ ok: false, error: err.message });
		}
		return true;
	}
});
