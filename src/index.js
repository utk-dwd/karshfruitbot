// index.js - entrypoint that launches the Telegraf bot in polling mode for karshfruitbot.

const { createBot } = require('./bot');
const { nodeEnv } = require('./config/env');

async function main() {
  const bot = createBot();

  await bot.launch();
  console.log(`karshfruitbot is running in ${nodeEnv} mode (long polling).`);

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal startup error', err);
  process.exit(1);
});