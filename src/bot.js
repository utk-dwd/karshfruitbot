// bot.js - creates the main Telegraf bot instance and registers all feature modules for karshfruitbot.

const { Telegraf } = require('telegraf');
const { telegramToken } = require('./config/env');
const { registerKarshfruit } = require('./bots/karshfruit/karshfruitBot');
const { registerBrowserLink } = require('./services/chatLinkRegistry');

function createBot() {
  const bot = new Telegraf(telegramToken);

  // Register feature modules here.
  registerKarshfruit(bot, { registerBrowserLink });
  // Future: registerOtherFeature(bot);

  // Global error handler
  bot.catch((err, ctx) => {
    console.error(`Bot error for ${ctx.updateType}`, err);
  });

  return bot;
}

module.exports = { createBot };