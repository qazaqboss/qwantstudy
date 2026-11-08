// Печатает JSON со всеми фразами сайта для озвучки: [{ key, text, spoken }].
// Запуск: node tools/list-texts.mjs > texts.json
import { readFileSync } from 'node:fs';
import { CONCEPTS, HISTORY, QUIZ, TOUR } from '../js/data.js';
import { sceneText, partText, conceptText, historyText, quizText, spoken, clipKey } from '../js/speech.js';

const src = readFileSync(new URL('../js/scenes.js', import.meta.url), 'utf8');
const parts = [...src.matchAll(/\{ id: '([^']+)',[^\n]*?name: '([^']+)',[^\n]*?desc: '([^']+)' \}/g)].map(m => ({ id: m[1], name: m[2], desc: m[3] }));
const scenes = [...src.matchAll(/\{ id: '([^']+)', name: '([^']+)', sub: '[^']+', camera:/g)].map(m => ({ id: m[1], name: m[2] }));

const texts = [
  ...TOUR.map(s => s.text),
  ...scenes.map(s => sceneText(s, CONCEPTS.find(c => c.scene === s.id))),
  ...CONCEPTS.map(conceptText),
  ...HISTORY.map(historyText),
  ...parts.map(partText),
  ...QUIZ.map(quizText)
];
const seen = new Set();
const out = texts.filter(t => !seen.has(clipKey(t)) && seen.add(clipKey(t))).map(t => ({ key: clipKey(t), text: t, spoken: spoken(t) }));
console.error(`scenes=${scenes.length} parts=${parts.length} clips=${out.length} chars=${out.reduce((a, x) => a + x.spoken.length, 0)}`);
process.stdout.write(JSON.stringify(out, null, 1));
