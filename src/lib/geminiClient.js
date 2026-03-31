// geminiClient.js - creates and exports a single Gemini client instance
// used across all services in karshfruitbot.

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { geminiApiKey } = require('../config/env');

const genAI = new GoogleGenerativeAI(geminiApiKey);

/**
 * Get a text model instance.
 * Swap model name here if you want Pro vs Flash later.
 */
function getTextModel() {
  // For cheap and fast formatting use a Flash model.
  return genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
}

module.exports = { getTextModel };