// Точка входа: связывает 3D-атлас, контент, голосового гида, голосовые команды и клавиатуру.
import { Viewer } from './viewer.js';
import { SCENES } from './scenes.js';
import { CONCEPTS, HISTORY, QUIZ, TOUR } from './data.js';
import { Voice, Tour, createListener, parseCommand, COMMANDS } from './guide.js';
import { initHero } from './hero.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const hex = n => '#' + n.toString(16).padStart(6, '0');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
}

/* ───────── hero ───────── */
try { initHero($('#hero-canvas'), matchMedia('(pointer: coarse)').matches || innerWidth < 760); } catch (e) { console.warn('WebGL недоступен', e); }
$$('[data-count]').forEach(el => {
  const n = +el.dataset.count; let i = 0;
  const step = () => { i = Math.min(n, i + Math.ceil(n / 30)); el.textContent = i; if (i < n) requestAnimationFrame(step); };
  setTimeout(step, 400);
});

/* ───────── навигация ───────── */
$('#burger').addEventListener('click', () => { $('#nav').classList.toggle('open'); $('#burger').classList.toggle('open'); });
$$('#nav a').forEach(a => a.addEventListener('click', () => { $('#nav').classList.remove('open'); $('#burger').classList.remove('open'); }));
const navObs = new IntersectionObserver(es => es.forEach(e => {
  if (e.isIntersecting) $$('#nav a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
}), { rootMargin: '-45% 0px -50% 0px' });
$$('section[id]').forEach(s => navObs.observe(s));
const revealObs = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); revealObs.unobserve(e.target); } }), { threshold: 0.12 });

/* ───────── голос ───────── */
const voice = new Voice();
const guideEl = $('#guide');
let speakingEl = null;

function say(text, el) {
  tour.stopTour();
  speakingEl?.classList.remove('speaking');
  speakingEl = el || null; el?.classList.add('speaking');
  setSubtitles(text);
  openGuide(true);
  guideEl.classList.add('talking');
  voice.speak(text, {
    onword: highlightWord,
    onend: () => { guideEl.classList.remove('talking'); speakingEl?.classList.remove('speaking'); }
  });
}

function setSubtitles(text) {
  $('#subtitles').innerHTML = text.split(/\s+/).map(w => `<span class="w">${esc(w)}</span>`).join(' ');
}
function highlightWord(i) {
  $$('#subtitles .w').forEach((w, k) => { w.classList.toggle('said', k < i); w.classList.toggle('now', k === i); });
}
function openGuide(open = true) { guideEl.dataset.open = String(open); }

/* ───────── 3D-атлас ───────── */
let viewer;
try { viewer = new Viewer($('#viewport')); window.__qsReady = true; }
catch (e) { console.error(e); window.__qsFail?.('Не удалось запустить 3D (WebGL): ' + e.message + '. Включите аппаратное ускорение или откройте сайт в Chrome/Edge.'); throw e; }
let currentScene = null;

const sceneList = $('#scene-list');
sceneList.innerHTML = SCENES.map((s, i) => `<button class="scene-btn" data-scene="${s.id}"><em>${i + 1}</em><b>${s.name}</b><span>${s.sub}</span></button>`).join('');
sceneList.addEventListener('click', e => { const b = e.target.closest('[data-scene]'); if (b) openScene(b.dataset.scene); });

function openScene(id, partId) {
  if (currentScene?.id !== id) viewer.load(id);
  if (partId) setTimeout(() => viewer.select(partId), currentScene?.id === id ? 0 : 450);
}

viewer.addEventListener('scene', e => {
  currentScene = e.detail;
  $$('.scene-btn').forEach(b => b.classList.toggle('active', b.dataset.scene === currentScene.id));
  $('#crumb-scene').textContent = currentScene.def.name;
  renderParts();
  renderInfo(null);
  $('#loading').classList.add('hide');
});

function renderParts(filter = $('#search').value.trim().toLowerCase()) {
  if (!currentScene) return;
  const groups = {};
  currentScene.parts.forEach(p => {
    if (filter && !(p.name + ' ' + p.system + ' ' + p.desc).toLowerCase().includes(filter)) return;
    (groups[p.system] ||= []).push(p);
  });
  const html = Object.entries(groups).map(([sys, ps]) => `<h5>${sys}</h5>` + ps.map(p => `
    <div class="part-row ${viewer.selected === p.id ? 'active' : ''} ${viewer.hidden.has(p.id) ? 'off' : ''}" data-part="${p.id}" style="--c:${hex(p.color)}" tabindex="0">
      <span class="sw"></span><span class="nm">${p.name}</span>
      <button class="eye" data-eye="${p.id}" title="Показать / скрыть">${viewer.hidden.has(p.id)
        ? '<svg viewBox="0 0 24 24"><path d="M2 4.3 3.3 3l17.7 17.7-1.3 1.3-3.2-3.2A11 11 0 0 1 1 12a11.6 11.6 0 0 1 4.2-5.5L2 4.3Zm10 2.2A11 11 0 0 1 23 12a11.7 11.7 0 0 1-3.2 4.4L16 12.6A4 4 0 0 0 11.4 8L9.2 5.9A11 11 0 0 1 12 6.5Z"/></svg>'
        : '<svg viewBox="0 0 24 24"><path d="M12 5c5 0 9.3 3 11 7-1.7 4-6 7-11 7S2.7 16 1 12c1.7-4 6-7 11-7Zm0 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z"/></svg>'}</button>
    </div>`).join('')).join('');
  $('#parts').innerHTML = html || '<p class="muted small">Ничего не найдено. Попробуйте другую модель.</p>';
}

$('#parts').addEventListener('click', e => {
  const eye = e.target.closest('[data-eye]');
  if (eye) { e.stopPropagation(); viewer.toggleHidden(eye.dataset.eye); renderParts(); return; }
  const row = e.target.closest('[data-part]');
  if (row) viewer.select(row.dataset.part);
});
$('#parts').addEventListener('keydown', e => { if (e.key === 'Enter') { const row = e.target.closest('[data-part]'); if (row) viewer.select(row.dataset.part); } });
$('#show-all').addEventListener('click', () => { viewer.showAll(); renderParts(); });

// поиск — по всем моделям (индекс строится один раз)
let partIndex = null;
$('#search').addEventListener('input', e => {
  const q = e.target.value.trim().toLowerCase();
  if (q.length > 2 && currentScene && !currentScene.parts.some(p => (p.name + p.desc).toLowerCase().includes(q))) {
    partIndex ||= SCENES.map(s => ({ s, text: s.build().parts.map(p => p.name + p.desc).join(' ').toLowerCase() }));
    const hit = partIndex.find(x => x.s.id !== currentScene.id && x.text.includes(q))?.s;
    if (hit) { toast(`Найдено в модели «${hit.name}»`); viewer.load(hit.id); return; }
  }
  renderParts(q);
});

viewer.addEventListener('select', e => {
  const p = e.detail;
  renderParts();
  renderInfo(p);
  $('#crumb-part').textContent = p ? p.name : '';
});

function renderInfo(p) {
  const s = currentScene;
  const body = $('#info-body');
  if (!p) {
    const concept = CONCEPTS.filter(c => c.scene === s.id);
    body.innerHTML = `
      <p class="panel-label">Модель ${SCENES.findIndex(x => x.id === s.id) + 1} / ${SCENES.length}</p>
      <h3>${s.def.name}</h3>
      <span class="chip"><i style="--c:var(--cyan)"></i>${s.def.sub}</span>
      <p>${concept[0]?.text || ''}</p>
      ${concept[0] ? `<div class="formula">${concept[0].formula}</div>` : ''}
      <div class="actions">
        <button class="btn primary" data-say-scene><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4Z"/></svg>Объяснить голосом</button>
        <button class="btn ghost" data-explode-toggle>Разобрать</button>
      </div>
      <p class="panel-label" style="margin-top:8px">Структуры модели</p>
      <div class="related">${s.parts.map(x => `<button data-goto="${x.id}"><span class="chip" style="padding:0;border:0;background:none"><i style="--c:${hex(x.color)}"></i></span>${x.name}</button>`).join('')}</div>
      <ul class="hint-list">
        <li>Нажмите на объект в 3D или в списке слева</li>
        <li><kbd>X</kbd> рентген · <kbd>E</kbd> разнести · <kbd>R</kbd> сброс</li>
        <li>Скажите «рентген», «разбери» или «кубит»</li>
      </ul>`;
  } else {
    const idx = s.parts.indexOf(p);
    body.innerHTML = `
      <p class="panel-label">Структура ${idx + 1} / ${s.parts.length}</p>
      <div class="info-hero" style="--c:${hex(p.color)}">${p.name.split(' ')[0].slice(0, 2)}</div>
      <span class="chip"><i style="--c:${hex(p.color)}"></i>${p.system}</span>
      <h3>${p.name}</h3>
      <p>${p.desc}</p>
      <div class="actions">
        <button class="btn primary" data-say-part><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4Z"/></svg>Озвучить</button>
        <button class="btn ghost" data-isolate>Изолировать</button>
        <button class="btn ghost" data-hide>Скрыть</button>
      </div>
      <div class="actions">
        <button class="btn ghost small" data-step="-1">← Предыдущая</button>
        <button class="btn ghost small" data-step="1">Следующая →</button>
        <button class="btn ghost small" data-deselect>Вся модель</button>
      </div>`;
  }
}

$('#info').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  const s = currentScene; const p = viewer.part(viewer.selected);
  if (t.matches('[data-say-scene]')) { const c = CONCEPTS.find(c => c.scene === s.id); say(`${s.def.name}. ${c ? c.text : ''}`); }
  if (t.matches('[data-explode-toggle]')) setExplode(viewer.state.explode > 0.5 ? 0 : 1);
  if (t.dataset.goto) viewer.select(t.dataset.goto);
  if (t.matches('[data-say-part]') && p) say(`${p.name}. ${p.desc.replace(/[⁻¹⁵ψ²]/g, ' ')}`);
  if (t.matches('[data-isolate]') && p) { viewer.isolate(p.id); renderParts(); toast('Изолировано · «Показать все» вернёт остальное'); }
  if (t.matches('[data-hide]') && p) { viewer.toggleHidden(p.id); viewer.select(null, { focus: false }); }
  if (t.dataset.step && p) { const i = s.parts.indexOf(p); viewer.select(s.parts[(i + +t.dataset.step + s.parts.length) % s.parts.length].id); }
  if (t.matches('[data-deselect]')) viewer.reset();
});

/* подсказка при наведении */
const tip = $('#tooltip');
viewer.addEventListener('hover', e => {
  const { part, x, y } = e.detail;
  if (!part) { tip.classList.remove('show'); return; }
  tip.innerHTML = `<b>${part.name}</b><span>${part.system} · клик для подробностей</span>`;
  tip.style.left = x + 'px'; tip.style.top = y + 'px';
  tip.classList.add('show');
});

/* панель инструментов */
function setExplode(v) { $('#explode').value = v; viewer.setState({ explode: v }); }
function toggle(key) { viewer.setState({ [key]: !viewer.state[key] }); syncTools(); }
function syncTools() {
  const st = viewer.state;
  $$('#toolbar [data-act]').forEach(b => {
    const k = { rotate: 'autoRotate', labels: 'labels', xray: 'xray', wire: 'wire' }[b.dataset.act];
    if (k) b.classList.toggle('on', !!st[k]);
  });
}
function act(a) {
  switch (a) {
    case 'rotate': toggle('autoRotate'); break;
    case 'zoomIn': viewer.zoom(0.75); break;
    case 'zoomOut': viewer.zoom(1.3); break;
    case 'reset': viewer.reset(); setExplode(0); break;
    case 'labels': toggle('labels'); break;
    case 'xray': toggle('xray'); toast(viewer.state.xray ? 'Рентген включён' : 'Рентген выключен'); break;
    case 'wire': toggle('wire'); break;
    case 'shot': {
      const a2 = document.createElement('a'); a2.href = viewer.snapshot(); a2.download = `qwantstudy-${currentScene.id}.png`; a2.click(); toast('Снимок сохранён'); break;
    }
    case 'full': {
      const el = $('#viewport-wrap');
      document.fullscreenElement ? document.exitFullscreen() : el.requestFullscreen?.();
      break;
    }
  }
}
$('#toolbar').addEventListener('click', e => { const b = e.target.closest('[data-act]'); if (b) act(b.dataset.act); });
$('#explode').addEventListener('input', e => viewer.setState({ explode: +e.target.value }));
$('#speed').addEventListener('input', e => viewer.setState({ speed: +e.target.value }));
$$('.gizmo [data-orbit]').forEach(b => b.addEventListener('click', () => {
  const d = { up: [0, -0.3], down: [0, 0.3], left: [-0.4, 0], right: [0.4, 0] }[b.dataset.orbit];
  viewer.orbit(...d);
}));

viewer.load('atom', { instant: true });

/* ───────── понятия ───────── */
$('#concept-grid').innerHTML = CONCEPTS.map((c, i) => `
  <article class="concept panel reveal" data-c="${c.id}" style="transition-delay:${(i % 3) * 80}ms">
    <span class="num">0${i + 1}</span>
    <div class="ic">${c.icon}</div>
    <h3>${c.title}</h3>
    <p class="sh">${c.short}</p>
    <div class="more"><div>
      <p>${c.text}</p>
      <div class="row">
        <span class="formula">${c.formula}</span>
        <button class="btn primary" data-listen="${c.id}">▶ Слушать</button>
        <button class="btn ghost" data-show="${c.id}">Показать в 3D</button>
      </div>
    </div></div>
  </article>`).join('');
$('#concept-grid').addEventListener('click', e => {
  const listen = e.target.closest('[data-listen]'), show = e.target.closest('[data-show]');
  if (listen) { e.stopPropagation(); const c = CONCEPTS.find(x => x.id === listen.dataset.listen); return say(`${c.title}. ${c.text}`, listen.closest('.concept')); }
  if (show) { e.stopPropagation(); const c = CONCEPTS.find(x => x.id === show.dataset.show); $('#atlas').scrollIntoView(); return openScene(c.scene, c.part); }
  const card = e.target.closest('.concept'); if (card) card.classList.toggle('open');
});

/* ───────── история ───────── */
const ERAS = [['Все', 0, 3000], ['1900–1925 · Старая теория', 1900, 1924], ['1925–1950 · Квантовая механика', 1925, 1950], ['1950–2000 · Проверки', 1951, 2000], ['XXI век · Технологии', 2001, 3000]];
$('#era-bar').innerHTML = ERAS.map((e, i) => `<button data-era="${i}" class="${i ? '' : 'active'}">${e[0]}</button>`).join('');
$('#timeline').innerHTML = HISTORY.map((h, i) => `
  <article class="event panel reveal" data-year="${h.year}" data-i="${i}">
    <button class="icon-btn play" data-hist="${i}" title="Слушать">▶</button>
    <div class="yr">${h.year}</div>
    <div class="who">${h.name}</div>
    <h3>${h.title}</h3>
    <p>${h.text}</p>
  </article>`).join('');
$('#era-bar').addEventListener('click', e => {
  const b = e.target.closest('[data-era]'); if (!b) return;
  $$('#era-bar button').forEach(x => x.classList.toggle('active', x === b));
  const [, a, z] = ERAS[+b.dataset.era];
  $$('.event').forEach(ev => { const y = +ev.dataset.year; ev.classList.toggle('hidden', y < a || y > z); });
});
$('#timeline').addEventListener('click', e => {
  const b = e.target.closest('[data-hist]'); if (!b) return;
  const h = HISTORY[+b.dataset.hist];
  say(`${h.year} год. ${h.name}. ${h.title}. ${h.text}`, b.closest('.event'));
});

$$('.reveal').forEach(el => revealObs.observe(el));

/* ───────── тест ───────── */
const quiz = { i: 0, score: 0, answered: false };
function renderQuiz() {
  const box = $('#quiz-box');
  if (quiz.i >= QUIZ.length) {
    const pct = Math.round(quiz.score / QUIZ.length * 100);
    const verdict = pct === 100 ? 'Квантовый гений! 🏆' : pct >= 70 ? 'Отличный результат!' : pct >= 40 ? 'Неплохо, но атлас ждёт вас.' : 'Пройдите тур с гидом и попробуйте снова.';
    box.innerHTML = `<div class="result"><p class="panel-label">Результат</p><div class="score grad">${quiz.score} / ${QUIZ.length}</div><h3>${verdict}</h3><button class="btn primary" data-restart>Пройти ещё раз</button></div>`;
    return;
  }
  const q = QUIZ[quiz.i];
  box.innerHTML = `
    <div class="q-top"><span class="panel-label">Вопрос ${quiz.i + 1} / ${QUIZ.length}</span><div class="q-bar"><i style="width:${quiz.i / QUIZ.length * 100}%"></i></div><span class="panel-label">★ ${quiz.score}</span></div>
    <h3>${q.q}</h3>
    <div class="opts">${q.a.map((a, k) => `<button class="opt" data-opt="${k}"><span>${'ABCD'[k]}</span>${a}</button>`).join('')}</div>
    <div id="why"></div>
    <div class="q-foot"><button class="btn ghost small" data-readq>🔊 Прочитать вопрос</button></div>`;
  quiz.answered = false;
}
function answer(k) {
  if (quiz.answered || quiz.i >= QUIZ.length) return;
  quiz.answered = true;
  const q = QUIZ[quiz.i]; const ok = k === q.correct;
  if (ok) quiz.score++;
  $$('.opt').forEach((b, j) => { b.disabled = true; if (j === q.correct) b.classList.add('good'); else if (j === k) b.classList.add('bad'); });
  $('#why').innerHTML = `<p class="why">${ok ? '✅ Верно!' : '❌ Не совсем.'} ${q.why}</p>`;
  $('.q-foot').innerHTML = `<button class="btn primary" data-nextq>${quiz.i < QUIZ.length - 1 ? 'Следующий вопрос →' : 'Узнать результат'}</button>`;
}
$('#quiz-box').addEventListener('click', e => {
  const o = e.target.closest('[data-opt]'); if (o) return answer(+o.dataset.opt);
  if (e.target.closest('[data-nextq]')) { quiz.i++; renderQuiz(); }
  if (e.target.closest('[data-restart]')) { Object.assign(quiz, { i: 0, score: 0 }); renderQuiz(); }
  if (e.target.closest('[data-readq]')) { const q = QUIZ[quiz.i]; say(`${q.q} ${q.a.map((a, k) => `Вариант ${k + 1}: ${a}.`).join(' ')}`); }
});
renderQuiz();

/* ───────── тур ───────── */
const tour = new Tour(TOUR, voice);
$('#guide-progress').innerHTML = TOUR.map((s, i) => `<button data-gstep="${i}" title="${s.title}"></button>`).join('');
$('#guide-progress').addEventListener('click', e => { const b = e.target.closest('[data-gstep]'); if (b) { speakingEl?.classList.remove('speaking'); tour.start(+b.dataset.gstep); } });

tour.addEventListener('step', e => {
  const { step, index, total } = e.detail;
  guideEl.classList.add('talking');
  $('#guide-title').textContent = step.title;
  $('#guide-count').textContent = `${index + 1} / ${total}`;
  setSubtitles(step.text);
  $$('#guide-progress button').forEach((b, i) => { b.classList.toggle('done', i < index); b.classList.toggle('cur', i === index); });
  const atlas = $('#atlas').getBoundingClientRect();
  if (atlas.top > innerHeight * 0.5 || atlas.bottom < innerHeight * 0.4) $('#atlas').scrollIntoView({ behavior: 'smooth' });
  if (currentScene?.id !== step.scene) viewer.load(step.scene);
  setTimeout(() => step.part ? viewer.select(step.part) : viewer.reset(), currentScene?.id === step.scene ? 50 : 600);
  syncGuide();
});
tour.addEventListener('word', e => highlightWord(e.detail));
tour.addEventListener('state', syncGuide);
tour.addEventListener('finish', () => { guideEl.classList.remove('talking'); toast('Тур завершён 🎉'); });

function syncGuide() {
  guideEl.classList.toggle('playing', tour.playing && !tour.paused);
  if (!tour.playing || tour.paused) guideEl.classList.remove('talking');
}
function startTour() { openGuide(true); speakingEl?.classList.remove('speaking'); if (!voice.supported) toast('Озвучка недоступна в этом браузере — показываю субтитры'); tour.start(0); }

$('#tour-hero').addEventListener('click', startTour);
$('#tour-top').addEventListener('click', startTour);
$('#guide-orb').addEventListener('click', () => openGuide(guideEl.dataset.open !== 'true'));
$('#guide-close').addEventListener('click', () => openGuide(false));
$('#g-play').addEventListener('click', () => tour.toggle());
$('#g-next').addEventListener('click', () => tour.next());
$('#g-prev').addEventListener('click', () => tour.prev());
$('#g-stop').addEventListener('click', () => { tour.stopTour(); voice.stop(); guideEl.classList.remove('talking'); });
$('#g-mute').addEventListener('click', () => {
  voice.muted = !voice.muted; guideEl.classList.toggle('muted', voice.muted);
  if (voice.muted) voice.synth?.cancel();
  toast(voice.muted ? 'Гид без звука, только субтитры' : 'Звук гида включён');
});
$('#voice-rate').addEventListener('input', e => { voice.rate = +e.target.value; $('#rate-out').textContent = voice.rate.toFixed(1) + '×'; });
$('#auto-advance').addEventListener('change', e => { tour.auto = e.target.checked; });

function fillVoices(list) {
  const sel = $('#voice-select');
  sel.innerHTML = list.length ? list.map(v => `<option value="${esc(v.name)}" ${v === voice.voice ? 'selected' : ''}>${esc(v.name)} (${v.lang})</option>`).join('') : '<option>Системный голос</option>';
}
voice.onvoices = fillVoices; fillVoices(voice.voices);
$('#voice-select').addEventListener('change', e => voice.setVoice(e.target.value));

/* ───────── голосовые команды ───────── */
$('#voice-cmds').innerHTML = COMMANDS.map(c => `<span>${c.hint}</span>`).join('') + '<span>«первый»…«четвёртый» в тесте</span>';
const listener = createListener(handleSpeech, (on, err) => {
  $('#g-mic').classList.toggle('on', on); $('#mic-top').classList.toggle('on', on);
  if (err) toast('Нет доступа к микрофону');
});
if (!listener) $('#sr-note').textContent = 'Ваш браузер не поддерживает распознавание речи. Откройте сайт в Chrome или Edge, чтобы управлять голосом.';

function toggleMic() {
  if (!listener) return toast('Распознавание речи не поддерживается в этом браузере');
  if (listener.active) { listener.stop(); toast('Микрофон выключен'); }
  else { listener.start(); openGuide(true); toast('Слушаю… скажите «дальше», «атом», «рентген»'); }
}
$('#g-mic').addEventListener('click', toggleMic);
$('#mic-top').addEventListener('click', toggleMic);

function handleSpeech(said) {
  $('#heard').textContent = `🎙 «${said}»`;
  // ответы в тесте
  const quizVisible = $('#quiz').getBoundingClientRect().top < innerHeight * 0.6 && $('#quiz').getBoundingClientRect().bottom > 0;
  const ord = [/перв|^а$|^a$/, /втор|^б$|^b$/, /трет|^в$|^c$/, /четв|^г$|^d$/].findIndex(r => r.test(said));
  if (quizVisible && ord >= 0) return answer(ord);
  if (quizVisible && /следующ|дальше/.test(said) && quiz.answered) { quiz.i++; return renderQuiz(); }
  const cmd = parseCommand(said);
  if (!cmd) return toast(`Не понял: «${said}»`);
  runCommand(cmd);
}

function runCommand(cmd) {
  const [kind, arg] = cmd.split(':');
  const map = {
    next: () => tour.next(), prev: () => tour.prev(),
    pause: () => { if (tour.playing && !tour.paused) tour.toggle(); else voice.stop(); guideEl.classList.remove('talking'); },
    play: () => tour.playing ? (tour.paused && tour.toggle()) : startTour(),
    repeat: () => tour.index >= 0 && tour.go(tour.index),
    explode: () => setExplode(1), assemble: () => setExplode(0),
    xray: () => act('xray'), reset: () => act('reset'),
    zoomIn: () => act('zoomIn'), zoomOut: () => act('zoomOut'),
    rotate: () => { viewer.setState({ autoRotate: true }); syncTools(); },
    scene: () => { $('#atlas').scrollIntoView({ behavior: 'smooth' }); openScene(arg); },
    goto: () => $('#' + arg).scrollIntoView({ behavior: 'smooth' })
  };
  map[kind]?.();
  toast('✓ ' + ({ next: 'Дальше', prev: 'Назад', pause: 'Пауза', play: 'Поехали', repeat: 'Повторяю', explode: 'Разбираю модель', assemble: 'Собираю', xray: 'Рентген', reset: 'Сброс', zoomIn: 'Ближе', zoomOut: 'Дальше', rotate: 'Вращаю', scene: SCENES.find(s => s.id === arg)?.name, goto: 'Переход' }[kind] || cmd));
}

/* ───────── клавиатура ───────── */
document.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key.toLowerCase();
  const inAtlas = () => { const r = $('#atlas').getBoundingClientRect(); return r.top < innerHeight * 0.7 && r.bottom > innerHeight * 0.3; };
  if (k === ' ') { e.preventDefault(); tour.playing ? tour.toggle() : startTour(); }
  else if (e.key === 'ArrowRight') { tour.playing ? tour.next() : inAtlas() && viewer.orbit(0.3, 0); }
  else if (e.key === 'ArrowLeft') { tour.playing ? tour.prev() : inAtlas() && viewer.orbit(-0.3, 0); }
  else if (e.key === 'ArrowUp' && inAtlas()) { e.preventDefault(); viewer.orbit(0, -0.2); }
  else if (e.key === 'ArrowDown' && inAtlas()) { e.preventDefault(); viewer.orbit(0, 0.2); }
  else if (/^[1-6]$/.test(k)) openScene(SCENES[+k - 1].id);
  else if (k === 'x' || k === 'ч') act('xray');
  else if (k === 'w' || k === 'ц') act('wire');
  else if (k === 'l' || k === 'д') act('labels');
  else if (k === 'a' || k === 'ф') act('rotate');
  else if (k === 'r' || k === 'к') act('reset');
  else if (k === 'f' || k === 'а') act('full');
  else if (k === 'p' || k === 'з') act('shot');
  else if (k === 'e' || k === 'у') setExplode(viewer.state.explode > 0.5 ? 0 : 1);
  else if (k === 'm' || k === 'ь') toggleMic();
  else if (k === '+' || k === '=') act('zoomIn');
  else if (k === '-') act('zoomOut');
  else if (e.key === 'Escape') { viewer.select(null, { focus: false }); openGuide(false); }
});
