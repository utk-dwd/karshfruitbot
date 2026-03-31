// karshfruitBot.js - registers the karshfruitbot feature:
// a tray entry ("Markdown Formatter") that asks for content and returns a .md file.

const { Markup } = require('telegraf');
const {
  formatToMarkdown,
  generateMarkdownFileName,
} = require('../../services/markdownFormatter');

// Very simple in-memory state: userId -> mode
const userState = new Map();

/**
 * Wire karshfruitbot behaviour into the main Telegraf bot instance.
 */
function registerKarshfruit(bot) {
  function mainMenuKeyboard() {
    // Add more buttons in the future when you add new features.
    return Markup.keyboard([
      ['📝 Markdown Formatter'],
      ['ℹ️ Help'],
    ]).resize();
  }

  // /start for karshfruitbot (main entry for users)
  bot.start((ctx) => {
    userState.delete(ctx.from.id);
    return ctx.reply(
      'karshfruitbot online.\n\nChoose a mode from the tray below:',
      mainMenuKeyboard()
    );
  });

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
        'Use /start anytime to see the tray again.'
    );
  });

  // Catch generic text and route based on state
  bot.on('text', async (ctx) => {
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

        const preview =
          markdown.length > 3500
            ? markdown.slice(0, 3400) +
              '\n\n[...truncated, see attached .md file]'
            : markdown;

        await ctx.reply(preview, {
          reply_markup: mainMenuKeyboard().reply_markup,
        });

        const buffer = Buffer.from(markdown, 'utf-8');
        await ctx.replyWithDocument(
          { source: buffer, filename: fileName },
          { caption: `Here is your Markdown file: ${fileName}` }
        );
      } catch (err) {
        console.error(err);
        await ctx.reply(
          'Error while calling the AI formatter. Try again, or reduce the text size.'
        );
      }
    }
  });
}

module.exports = { registerKarshfruit };