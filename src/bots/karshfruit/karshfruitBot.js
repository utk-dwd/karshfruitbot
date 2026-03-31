// karshfruitBot.js - registers the karshfruitbot feature:
// a tray entry ("Markdown Formatter") that asks for content and returns a .md file.

const { Markup } = require('telegraf');
const {
  formatToMarkdown,
  generateMarkdownFileName,
} = require('../../services/markdownFormatter');
const { humanizeText } = require('../../services/humanizer');

// Very simple in-memory state: userId -> mode
const userState = new Map();

/**
 * Wire karshfruitbot behaviour into the main Telegraf bot instance.
 */
function extractStartPayload(ctx) {
  const text = ctx?.message?.text || '';
  const parts = text.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(' ') : '';
}

function registerKarshfruit(bot, deps = {}) {
  const registerBrowserLink = deps.registerBrowserLink || (() => false);

  function mainMenuKeyboard() {
    // Add more buttons in the future when you add new features.
    return Markup.keyboard([
      ['📝 Markdown Formatter'],
      ['🧠 Humanizer (5 Styles)'],
      ['ℹ️ Help'],
    ]).resize();
  }

  function sendChatId(ctx) {
    return ctx.reply(`Your chat ID: ${ctx.chat.id}`);
  }

  // /start for karshfruitbot (main entry for users)
  bot.start((ctx) => {
    userState.delete(ctx.from.id);

    const payload = extractStartPayload(ctx);
    if (payload) {
      const linked = registerBrowserLink(payload, ctx.chat.id);
      if (linked) {
        return ctx.reply(
          '✅ Browser linked successfully. You can return to the extension and send exports now.',
          mainMenuKeyboard()
        );
      }
    }

    return ctx.reply(
      'karshfruitbot online.\n\nChoose a mode from the tray below:\n- /chatid to see your chat ID',
      mainMenuKeyboard()
    );
  });

  // /chatid helper to surface chat ID without checking logs
  bot.command('chatid', (ctx) => sendChatId(ctx));

  // Tray button: Markdown Formatter
  bot.hears('📝 Markdown Formatter', (ctx) => {
    const userId = ctx.from.id;
    userState.set(userId, 'AWAITING_MARKDOWN_INPUT');
    return ctx.reply(
      'Paste the content you want converted to clean Markdown.\n' +
        'Send it as a single message. Large chunks are fine.'
    );
  });

  // Tray button: Help
  bot.hears('ℹ️ Help', (ctx) => {
    userState.delete(ctx.from.id);
    return ctx.reply(
      'karshfruitbot modes:\n' +
        '📝 Markdown Formatter – paste any messy text and get a `.md` file back.\n\n' +
        '🧠 Humanizer (5 Styles) – paste text and get 5 human rewrites + `.txt` file.\n\n' +
        'Use /start anytime to see the tray again.\n' +
        'Need your chat ID? Send /chatid.'
    );
  });

  // Tray button: Humanizer
  bot.hears('🧠 Humanizer (5 Styles)', (ctx) => {
    const userId = ctx.from.id;
    userState.set(userId, 'AWAITING_HUMANIZER_INPUT');
    return ctx.reply(
      'Paste the text you want humanized.\n\n' +
        "I'll rewrite it in 5 different human styles and send them back."
    );
  });

  // Catch generic text and route based on state
  bot.on('text', async (ctx) => {
    console.log('Telegram chat id:', ctx.chat.id);

    const userId = ctx.from.id;
    const mode = userState.get(userId);

    if (!mode) {
      // User typed text without picking a mode first.
      return ctx.reply(
        'Choose a mode first from the tray below.',
        mainMenuKeyboard()
      );
    }

    if (mode === 'AWAITING_MARKDOWN_INPUT') {
      const rawText = ctx.message.text;
      userState.delete(userId);

      await ctx.reply(
        'Formatting your content into Markdown… (this may take a few seconds)'
      );

      try {
        const markdown = await formatToMarkdown(rawText);
        const fileName = generateMarkdownFileName(rawText, markdown);

        const buffer = Buffer.from(markdown, 'utf-8');
        await ctx.replyWithDocument(
          { source: buffer, filename: fileName },
          {
            caption: `Markdown file ready: ${fileName}`,
            reply_markup: mainMenuKeyboard().reply_markup,
          }
        );
      } catch (err) {
        console.error(err);
        await ctx.reply(
          'Error while calling the AI formatter. Try again, or reduce the text size.'
        );
      }
    }

    if (mode === 'AWAITING_HUMANIZER_INPUT') {
      const rawText = ctx.message.text;
      userState.delete(userId);

      if (rawText.length > 4000) {
        return ctx.reply(
          '⚠️ Text is quite long. For best results, paste one section at a time (under 4000 characters).'
        );
      }

      await ctx.reply('Humanizing in 5 styles… give me a moment 🧠');

      try {
        const result = await humanizeText(rawText);

        const MAX_CHUNK = 3800;
        if (result.length <= MAX_CHUNK) {
          await ctx.reply(result, { reply_markup: mainMenuKeyboard().reply_markup });
        } else {
          const styles = result.split(/\*\*Style \d/);
          for (let i = 1; i < styles.length; i++) {
            const chunk = `**Style ${styles[i]}`.trim();
            await ctx.reply(chunk);
            await new Promise((resolve) => setTimeout(resolve, 300));
          }
          await ctx.reply('All 5 styles above. Choose what resonates.', {
            reply_markup: mainMenuKeyboard().reply_markup,
          });
        }

        const buffer = Buffer.from(result, 'utf-8');
        await ctx.replyWithDocument(
          { source: buffer, filename: 'humanized_5styles.txt' },
          { caption: '5 styles as a file for easy copy.' }
        );
      } catch (err) {
        console.error(err);
        await ctx.reply('Something went wrong. Try with a shorter text first.');
      }
    }
  });
}

module.exports = { registerKarshfruit };