// env.js - central place to load and validate environment variables for karshfruitbot.

const dotenv = require('dotenv');
dotenv.config();

const required = ['TELEGRAM_BOT_TOKEN', 'GEMINI_API_KEY'];

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

module.exports = {
  telegramToken: process.env.TELEGRAM_BOT_TOKEN,
  geminiApiKey: process.env.GEMINI_API_KEY,
  telegramDefaultChatId: process.env.TELEGRAM_DEFAULT_CHAT_ID || '',
  extensionApiPort: Number(process.env.EXTENSION_API_PORT || 8787),
  nodeEnv: process.env.NODE_ENV || 'development',
};