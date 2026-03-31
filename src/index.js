// index.js - entrypoint that launches the Telegraf bot in polling mode for karshfruitbot.

const { createBot } = require('./bot');
const http = require('http');
const { nodeEnv, extensionApiPort } = require('./config/env');
const { resolveChatIdByBrowserLink } = require('./services/chatLinkRegistry');

let pollingConflictDetected = false;

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(payload));
}

function startExtensionApi(bot) {
  const server = http.createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      return sendJson(res, 204, {});
    }

    const requestUrl = new URL(req.url, `http://127.0.0.1:${extensionApiPort}`);

    if (req.method === 'GET' && requestUrl.pathname === '/api/extension/link-status') {
      const browserSessionId = requestUrl.searchParams.get('browserSessionId') || '';
      const linkedChatId = browserSessionId ? resolveChatIdByBrowserLink(browserSessionId) : '';
      return sendJson(res, 200, {
        ok: true,
        linked: Boolean(linkedChatId),
      });
    }

    if (req.method !== 'POST' || requestUrl.pathname !== '/api/extension/send') {
      return sendJson(res, 404, { ok: false, error: 'Not found' });
    }

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 2_000_000) {
        req.destroy();
      }
    });

    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}');
        const content = typeof body.content === 'string' ? body.content : '';
        const fileName = typeof body.fileName === 'string' ? body.fileName : 'conversation.txt';
        const format = typeof body.format === 'string' ? body.format : 'text';
        const chatIdFromBody = typeof body.chatId === 'string' || typeof body.chatId === 'number'
          ? String(body.chatId).trim()
          : '';
        const browserSessionId = typeof body.browserSessionId === 'string'
          ? body.browserSessionId.trim()
          : '';
        const linkedChatId = browserSessionId ? resolveChatIdByBrowserLink(browserSessionId) : '';
        const chatId = chatIdFromBody || linkedChatId;

        if (!chatId) {
          const conflictHint = pollingConflictDetected
            ? ' Another bot instance is currently consuming updates, so this process may not receive /start linking events.'
            : '';
          return sendJson(res, 400, {
            ok: false,
            error:
              'No linked Telegram chat found for this browser session. Open bot via extension 🤖 button and press Start once to link.' +
              conflictHint,
          });
        }

        if (!content.trim()) {
          return sendJson(res, 400, { ok: false, error: 'Empty content' });
        }

        const mimeType =
          format === 'markdown'
            ? 'text/markdown'
            : format === 'json'
              ? 'application/json'
              : 'text/plain';

        await bot.telegram.sendDocument(
          chatId,
          { source: Buffer.from(content, 'utf-8'), filename: fileName },
          {
            caption: `Export format: ${format}`,
            contentType: mimeType,
          }
        );

        return sendJson(res, 200, { ok: true, deliveredAs: 'document', format });
      } catch (err) {
        console.error('Extension send API error', err);
        return sendJson(res, 500, { ok: false, error: err.message || 'Internal error' });
      }
    });
  });

  server.listen(extensionApiPort, () => {
    console.log(`karshfruitbot extension API listening on http://localhost:${extensionApiPort}/api/extension/send`);
  });

  server.on('error', (err) => {
    console.error(`Extension API failed to bind port ${extensionApiPort}`, err);
  });

  return server;
}

function isPollingConflict(err) {
  return err?.response?.error_code === 409;
}

async function main() {
  const bot = createBot();
  const server = startExtensionApi(bot);
  let pollingActive = false;
  try {
    await bot.launch();
    pollingActive = true;
    console.log(`karshfruitbot is running in ${nodeEnv} mode (long polling).`);
  } catch (err) {
    if (isPollingConflict(err)) {
      pollingConflictDetected = true;
      console.warn(
        'Polling conflict (409): another bot instance is already running getUpdates. ' +
          'Keeping extension API online so exports can still be sent via bot.telegram.'
      );
    } else {
      throw err;
    }
  }

  // Graceful shutdown
  process.once('SIGINT', () => {
    if (pollingActive) bot.stop('SIGINT');
    server.close();
  });
  process.once('SIGTERM', () => {
    if (pollingActive) bot.stop('SIGTERM');
    server.close();
  });
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});