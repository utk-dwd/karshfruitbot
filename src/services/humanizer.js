// humanizer.js - rewrites input text into 5 distinct human styles using Gemini.

const { getTextModel } = require('../lib/geminiClient');

async function humanizeText(rawText) {
  const model = getTextModel();

  const prompt = `
You are an expert writing editor. Your task is to rewrite the text below in 5 distinctly different human writing styles.

## WHAT TO REMOVE (AI writing signals to eliminate):
- Em dash overuse (—)
- "Rule of three" phrasing (X, Y, and Z structures everywhere)
- Hedging language: "it's worth noting", "it's important to", "it is crucial"
- Filler openers: "Certainly!", "Absolutely!", "Of course!", "Great question!"
- Formulaic transitions: "In conclusion", "Furthermore", "Moreover", "In summary"
- Passive corporate tone: "leverage", "utilize", "streamline", "robust", "seamless"
- Excessive adjectives: "comprehensive", "innovative", "groundbreaking", "cutting-edge"
- Fake balance: "While X has merits, it's important to consider Y"
- Repetitive sentence structure — vary lengths drastically
- Vague attributions: "studies show", "experts say", "research indicates"

## THE 5 STYLES:

**Style 1 — Casual & Direct**
Short punchy sentences. How a smart person talks to a friend. Contractions everywhere. Real and slightly informal.

**Style 2 — Confident Professional**
Clear, assertive, zero fluff. Sounds like someone who has done this before and doesn't need to justify every sentence. No corporate buzzwords.

**Style 3 — Storytelling / Narrative**
Reframes the content as a small story or scene. Uses specific details, sensory language, and a natural arc. Feels personal even if it isn't.

**Style 4 — Blunt & Minimal**
Strip it down to just what needs to be said. Ultra-short. No explanation. Trust the reader.

**Style 5 — Warm & Conversational**
Reads like a knowledgeable friend giving advice. Empathetic tone. Occasionally uses "you" and "your". Feels like a real person wrote it.

---

For EACH style:
- Start with the style label (e.g. "**Style 1 — Casual & Direct**")
- Rewrite the full text in that style
- Keep the core meaning intact
- Do NOT add explanations or meta-commentary about what you changed

---

## ORIGINAL TEXT:

${rawText}
`;

  const result = await model.generateContent(prompt);
  return result.response.text();
}

module.exports = { humanizeText };
