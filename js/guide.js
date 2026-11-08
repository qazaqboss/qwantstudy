import { spoken, clipKey } from './speech.js';
// Голосовой гид: озвучка (Web Speech Synthesis), тур по атласу и голосовые команды (Speech Recognition).

export class Voice {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.voice = null;
    this.rate = 1;
    this.pitch = 1;
    this.muted = false;
    this.voices = [];
    // Естественный голос: заранее озвученные моделью OmniVoice фразы (audio/voice/*.mp3).
    this.clips = {};
    this.natural = localStorageGet('qs-voice') !== 'browser' || !this.synth;
    this.ready = fetch('audio/voice/manifest.json').then(r => r.ok ? r.json() : {}).then(m => { this.clips = m; this.onvoices?.(this.voices); }).catch(() => {});
    if (this.synth) {
      const load = () => {
        this.voices = this.synth.getVoices().filter(v => /^ru/i.test(v.lang));
        if (!this.voices.length) this.voices = this.synth.getVoices();
        const saved = localStorageGet('qs-browser-voice');
        this.voice = this.voices.find(v => v.name === saved)
          || this.voices.find(v => /ru/i.test(v.lang) && /google|milena|irina|svetlana|natural|online/i.test(v.name))
          || this.voices[0] || null;
        this.onvoices?.(this.voices);
      };
      load();
      this.synth.addEventListener?.('voiceschanged', load);
    }
  }
  get supported() { return !!this.synth || Object.keys(this.clips).length > 0; }
  get hasNatural() { return Object.keys(this.clips).length > 0; }
  setVoice(name) {
    if (name === '__natural') { this.natural = true; localStorageSet('qs-voice', 'natural'); return; }
    this.natural = false; localStorageSet('qs-voice', 'browser');
    this.voice = this.voices.find(v => v.name === name) || this.voice; localStorageSet('qs-browser-voice', name);
  }
  clipFor(text) { const k = clipKey(text); return this.natural && this.clips[k] ? `audio/voice/${k}.mp3` : null; }
  preload(text) { const src = text && this.clipFor(text); if (src) { const a = new Audio(); a.preload = 'auto'; a.src = src; } }

  // Озвучивает текст; onword отдаёт индекс текущего слова для подсветки субтитров.
  speak(text, { onend, onword } = {}) {
    this.stop();
    const words = text.split(/\s+/).filter(Boolean);
    if (this.muted) {
      // без звука — имитируем время чтения, чтобы тур шёл дальше
      let i = 0;
      this._timer = setInterval(() => { onword?.(i++); if (i > words.length) { clearInterval(this._timer); onend?.(); } }, 330 / this.rate);
      return;
    }
    const src = this.clipFor(text);
    if (src) return this.playClip(src, text, words, onend, onword);
    this.speakBrowser(text, words, onend, onword);
  }

  playClip(src, text, words, onend, onword) {
    const a = new Audio(src);
    a.playbackRate = this.rate; a.preservesPitch = true;
    this._audio = a;
    // слово по доле прочитанных символов
    const cum = []; let acc = 0; words.forEach(w => { acc += w.length + 1; cum.push(acc); });
    let last = -1;
    const tick = () => {
      if (this._audio !== a) return;
      if (a.duration) {
        const pos = (a.currentTime / a.duration) * acc;
        const idx = cum.findIndex(c => c >= pos);
        if (idx !== last) { last = idx; onword?.(idx); }
      }
      if (!a.paused && !a.ended) this._raf = requestAnimationFrame(tick);
    };
    a.addEventListener('play', () => { cancelAnimationFrame(this._raf); tick(); });
    a.addEventListener('ended', () => { if (this._audio === a) { this._audio = null; onword?.(words.length); onend?.(); } });
    a.addEventListener('error', () => { if (this._audio === a) { this._audio = null; this.speakBrowser(text, words, onend, onword); } });
    a.play().catch(() => { if (this._audio === a) { this._audio = null; this.speakBrowser(text, words, onend, onword); } });
  }

  speakBrowser(text, words, onend, onword) {
    if (!this.synth) { onend?.(); return; }
    const say = spoken(text);
    const u = new SpeechSynthesisUtterance(say);
    u.lang = this.voice?.lang || 'ru-RU';
    if (this.voice) u.voice = this.voice;
    u.rate = this.rate; u.pitch = this.pitch;
    u.onboundary = e => {
      if (e.name && e.name !== 'word') return;
      onword?.(Math.round(e.charIndex / say.length * words.length));
    };
    u.onend = () => { if (this._u === u) onend?.(); };
    this._u = u;
    // Chrome иногда «засыпает» на длинных фразах — подталкиваем
    clearInterval(this._keep);
    this._keep = setInterval(() => { if (this.synth.speaking && !this.synth.paused) { this.synth.pause(); this.synth.resume(); } }, 10000);
    this.synth.speak(u);
  }
  setRate(r) { this.rate = r; if (this._audio) this._audio.playbackRate = r; }
  pause() { if (this._audio) this._audio.pause(); else this.synth?.pause(); }
  resume() { if (this._audio) this._audio.play(); else this.synth?.resume(); }
  get canResume() { return (this._audio && this._audio.paused && !this._audio.ended) || !!(this.synth?.paused && this.synth?.speaking); }
  stop() {
    clearInterval(this._timer); clearInterval(this._keep); cancelAnimationFrame(this._raf);
    if (this._audio) { this._audio.pause(); this._audio = null; }
    this._u = null;
    this.synth?.cancel();
  }
  get speaking() { return !!(this._audio && !this._audio.paused) || !!this.synth?.speaking; }
}

export class Tour extends EventTarget {
  constructor(steps, voice) {
    super();
    this.steps = steps; this.voice = voice;
    this.index = -1; this.playing = false; this.paused = false;
    this.auto = true;
  }
  start(i = 0) { this.playing = true; this.paused = false; this.go(i); }
  go(i) {
    if (i < 0 || i >= this.steps.length) { if (i >= this.steps.length) this.finish(); return; }
    this.index = i;
    const step = this.steps[i];
    this.dispatchEvent(new CustomEvent('step', { detail: { step, index: i, total: this.steps.length } }));
    this.voice.preload(this.steps[i + 1]?.text);
    this.voice.speak(step.text, {
      onword: w => this.dispatchEvent(new CustomEvent('word', { detail: w })),
      onend: () => {
        if (!this.playing || this.paused) return;
        this._next = setTimeout(() => { if (this.playing && !this.paused && this.auto) this.go(this.index + 1); }, 900);
      }
    });
  }
  next() { clearTimeout(this._next); if (!this.playing) this.start(Math.max(0, this.index + 1)); else this.go(this.index + 1); }
  prev() { clearTimeout(this._next); if (!this.playing) this.playing = true; this.paused = false; this.go(Math.max(0, this.index - 1)); }
  toggle() {
    if (!this.playing) return this.start(this.index < 0 || this.index >= this.steps.length - 1 ? 0 : this.index);
    if (this.paused) { this.paused = false; this.voice.canResume ? this.voice.resume() : this.go(this.index); }
    else { this.paused = true; this.voice.pause(); clearTimeout(this._next); }
    this.dispatchEvent(new Event('state'));
  }
  stopTour() { clearTimeout(this._next); this.playing = false; this.paused = false; this.voice.stop(); this.dispatchEvent(new Event('state')); }
  finish() { this.playing = false; this.dispatchEvent(new Event('finish')); this.dispatchEvent(new Event('state')); }
}

// Голосовые команды. Возвращает null, если браузер не поддерживает распознавание.
export function createListener(onCommand, onStatus) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  const rec = new SR();
  rec.lang = 'ru-RU'; rec.continuous = true; rec.interimResults = false;
  let on = false;
  rec.onresult = e => {
    const r = e.results[e.results.length - 1];
    const said = r[0].transcript.trim().toLowerCase();
    onCommand(said);
  };
  rec.onend = () => { if (on) { try { rec.start(); } catch { /* уже запущено */ } } else onStatus?.(false); };
  rec.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { on = false; onStatus?.(false, e.error); } };
  return {
    get active() { return on; },
    start() { on = true; try { rec.start(); } catch { /* уже запущено */ } onStatus?.(true); },
    stop() { on = false; rec.stop(); onStatus?.(false); }
  };
}

export const COMMANDS = [
  { re: /(дальше|далее|следующ|вперёд|вперед|next)/, action: 'next', hint: '«дальше»' },
  { re: /(назад|предыдущ|back)/, action: 'prev', hint: '«назад»' },
  { re: /(стоп|пауза|останов|хватит|молчи|pause)/, action: 'pause', hint: '«пауза»' },
  { re: /(продолж|играй|старт|начни|тур|play)/, action: 'play', hint: '«начни тур»' },
  { re: /(повтор)/, action: 'repeat', hint: '«повтори»' },
  { re: /(разнес|разбер|взрыв|раздели)/, action: 'explode', hint: '«разбери»' },
  { re: /(собер)/, action: 'assemble', hint: '«собери»' },
  { re: /(рентген|прозрач)/, action: 'xray', hint: '«рентген»' },
  { re: /(сброс|центр|исходн)/, action: 'reset', hint: '«сброс»' },
  { re: /(приблиз|ближе|увелич)/, action: 'zoomIn', hint: '«ближе»' },
  { re: /(отдал|дальше от|уменьш)/, action: 'zoomOut', hint: '«уменьши»' },
  { re: /(поверн|вращ|крути)/, action: 'rotate', hint: '«вращай»' },
  { re: /(ядр|кварк|глюон|нуклон|протон|нейтрон)/, action: 'scene:nucleus', hint: '«ядро»' },
  { re: /(атом|орбитал|электрон)/, action: 'scene:atom', hint: '«атом»' },
  { re: /(щел|интерферен|дуализм)/, action: 'scene:slit', hint: '«две щели»' },
  { re: /(кубит|блох|суперпози)/, action: 'scene:bloch', hint: '«кубит»' },
  { re: /(запутан|эпр|спин)/, action: 'scene:entangle', hint: '«запутанность»' },
  { re: /(туннел|барьер)/, action: 'scene:tunnel', hint: '«туннель»' },
  { re: /(компьютер|процессор|криостат|чип)/, action: 'scene:qpu', hint: '«компьютер»' },
  { re: /(истори)/, action: 'goto:history', hint: '«история»' },
  { re: /(понят|теори)/, action: 'goto:concepts', hint: '«понятия»' },
  { re: /(тест|викторин|экзамен)/, action: 'goto:quiz', hint: '«тест»' }
];

export function parseCommand(said) {
  // «дальше от» проверяем раньше «дальше»
  if (/(отдал|дальше от|уменьш)/.test(said)) return 'zoomOut';
  const c = COMMANDS.find(c => c.re.test(said));
  return c ? c.action : null;
}

function localStorageGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function localStorageSet(k, v) { try { localStorage.setItem(k, v); } catch { /* приватный режим */ } }
