// markdownFormatter.js - uses Gemini to clean and convert raw text into Markdown,
// and generates a smart .md filename based on the content for karshfruitbot.

const { getTextModel } = require('../lib/geminiClient');

/**
 * Call Gemini to convert messy text into clean GitHub-flavored Markdown.
 */
async function formatToMarkdown(rawText) {
  const model = getTextModel();

  const prompt = `
You are a strict Markdown formatter.

TASK:
- Take the user content below.
- Infer proper structure: headings, subheadings, bullet/numbered lists, code blocks, quotes.
- Fix spacing, line breaks, and indentation.
- Preserve semantic meaning but clean up formatting.
- Use GitHub-flavored Markdown.
- DO NOT add explanations, comments, or intro/outro text.
- OUTPUT ONLY the final Markdown.

USER CONTENT (raw, may be messy):

${rawText}
`;

  const result = await model.generateContent(prompt);
  const response = result.response;
  return response.text();
}

/**
 * Generate a smart filename based on the content.
 * Strategy:
 * 1. Try to use first Markdown heading from formatted text.
 * 2. Else, use first non-empty line from raw text.
 * 3. Slugify (lowercase, hyphens, strip weird chars).
 * 4. Fallback to timestamp if everything is garbage.
 */
function generateMarkdownFileName(rawText, markdown) {
  const headingMatch = markdown.match(/^#\s+(.+)$/m);
  let base =
    (headingMatch && headingMatch[1]) ||
    (rawText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)[0];

  if (!base) {
    base = 'karshfruit-note';
  }

  base = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'karshfruit-note';

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${base}-${timestamp}.md`;
}

module.exports = {
  formatToMarkdown,
  generateMarkdownFileName,
};