// Страница курса: годы и уроки, 3D-модель урока, голос, проверка знаний и прогресс.
import { Viewer } from './viewer.js';
import { SCENES } from './scenes.js';
import { STAGES, YEARS, ALL_LESSONS } from './course-data.js';
import { Voice } from './guide.js';
import { lessonText } from './speech.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2400); };

/* ───────── прогресс ───────── */
const store = (() => { try { return JSON.parse(localStorage.getItem('qs-course')) || {}; } catch { return {}; } })();
store.done ||= {};
const save = () => { try { localStorage.setItem('qs-course', JSON.stringify(store)); } catch { /* приватный режим */ } };

/* ───────── меню ───────── */
$('#burger').addEventListener('click', () => { $('#nav').classList.toggle('open'); $('#burger').classList.toggle('open'); });

/* ───────── 3D ───────── */
let viewer;
try { viewer = new Viewer($('#viewport')); }
catch (e) { window.__qsFail?.('Не удалось запустить 3D (WebGL): ' + e.message); }
viewer?.addEventListener('scene', e => { $('#crumb-scene').textContent = e.detail.def.name; $('#crumb-part').textContent = ''; $('#loading').classList.add('hide'); });
viewer?.addEventListener('select', e => { $('#crumb-part').textContent = e.detail ? e.detail.name : ''; });

const toolState = { rotate: 'autoRotate', labels: 'labels', xray: 'xray' };
$('#toolbar').addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b || !viewer) return;
  const a = b.dataset.act;
  if (toolState[a]) { viewer.setState({ [toolState[a]]: !viewer.state[toolState[a]] }); b.classList.toggle('on', viewer.state[toolState[a]]); }
  if (a === 'zoomIn') viewer.zoom(0.75);
  if (a === 'zoomOut') viewer.zoom(1.3);
  if (a === 'reset') { viewer.reset(); $('#explode').value = 0; }
  if (a === 'full') document.fullscreenElement ? document.exitFullscreen() : $('#viewport-wrap').requestFullscreen?.();
});
$('#explode').addEventListener('input', e => viewer?.setState({ explode: +e.target.value }));

/* ───────── годы ───────── */
const yearDone = y => y.lessons.filter(l => store.done[l.id]).length;
function renderStages() {
  $('#stages').innerHTML = STAGES.map(st => `
    <div class="stage">
      <div class="stage-head"><i style="--c:${st.color}"></i><b>${st.name}</b><span>${st.note}</span></div>
      <div class="year-grid">${st.years.map(n => {
        const y = YEARS[n - 1], d = yearDone(y), pct = Math.round(d / y.lessons.length * 100);
        return `<button class="year-card ${cur.year === n ? 'active' : ''} ${pct === 100 ? 'done' : ''}" data-year="${n}" style="--c:${st.color}">
          <span class="yn">${n}</span><span class="yl">год</span>
          <b>${y.title}</b><em>${y.lessons.length} уроков · ${d}/${y.lessons.length}</em>
          <span class="ybar"><i style="width:${pct}%"></i></span></button>`;
      }).join('')}</div>
    </div>`).join('');
}
$('#stages').addEventListener('click', e => {
  const b = e.target.closest('[data-year]'); if (!b) return;
  const y = YEARS[+b.dataset.year - 1];
  openLesson(y.lessons.find(l => !store.done[l.id])?.id || y.lessons[0].id, { scroll: true });
});

/* ───────── уроки ───────── */
const cur = { year: 1, id: null };
function renderLessons() {
  const y = YEARS[cur.year - 1];
  $('#year-label').textContent = `Год ${y.n} из 12`;
  $('#year-title').textContent = y.title;
  $('#year-goal').textContent = y.goal;
  $('#year-bar').style.width = Math.round(yearDone(y) / y.lessons.length * 100) + '%';
  $('#lessons').innerHTML = y.lessons.map((l, i) => `
    <button class="lesson-row ${l.id === cur.id ? 'active' : ''} ${store.done[l.id] ? 'done' : ''}" data-lesson="${l.id}">
      <span class="ln">${store.done[l.id] ? '✓' : i + 1}</span>
      <span class="lt"><b>${l.title}</b><em>${SCENES.find(s => s.id === l.scene)?.name || ''} · ${l.formula}</em></span>
    </button>`).join('');
}
$('#lessons').addEventListener('click', e => { const b = e.target.closest('[data-lesson]'); if (b) openLesson(b.dataset.lesson); });

function renderProgress() {
  const d = ALL_LESSONS.filter(l => store.done[l.id]).length, n = ALL_LESSONS.length, pct = Math.round(d / n * 100);
  $('#st-done').textContent = d; $('#st-total').textContent = n; $('#ring-pct').textContent = pct + '%';
  const c = 2 * Math.PI * 52; $('#ring-bar').style.strokeDasharray = `${c * pct / 100} ${c}`;
  $('#continue span').textContent = d ? 'Продолжить обучение' : 'Начать обучение';
}

function openLesson(id, { scroll = false, autoplay = false } = {}) {
  const l = ALL_LESSONS.find(x => x.id === id); if (!l) return;
  voice.stop(); setPlaying(false);
  cur.year = l.year; cur.id = id; store.last = id; save();
  history.replaceState(null, '', '#' + id);
  renderStages(); renderLessons(); renderLesson(l);
  if (viewer) {
    const same = viewer.current?.id === l.scene;
    viewer.load(l.scene);
    setTimeout(() => { viewer.reset(); if (l.part) viewer.select(l.part, { focus: false }); }, same ? 0 : 600);
  }
  if (scroll) $('#work').scrollIntoView({ behavior: 'smooth' });
  if (autoplay) play();
}

function renderLesson(l) {
  const y = YEARS[l.year - 1], idx = y.lessons.indexOf(y.lessons.find(x => x.id === l.id));
  const stage = STAGES.find(s => s.years.includes(l.year));
  const scene = SCENES.find(s => s.id === l.scene);
  $('#lesson').innerHTML = `
    <div class="lesson-head">
      <span class="chip"><i style="--c:${stage.color}"></i>Год ${l.year} · урок ${idx + 1} из ${y.lessons.length}</span>
      ${store.done[l.id] ? '<span class="chip ok">✓ пройден</span>' : ''}
    </div>
    <h2 class="lesson-title">${l.title}</h2>
    <div class="formula">${esc(l.formula)}</div>
    <p class="lesson-text" id="lesson-text">${l.text.split(/\s+/).map(w => `<span class="w">${esc(w)}</span>`).join(' ')}</p>
    <div class="actions">
      <button class="btn primary" id="play"><svg class="i-play" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg><svg class="i-pause" viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg><span>Слушать урок</span></button>
      <button class="btn ghost small" id="to-atlas" title="Открыть модель в атласе">3D: ${scene?.name || ''}</button>
    </div>
    <h4 class="sub">Главное</h4>
    <ul class="points">${l.points.map(p => `<li>${esc(p)}</li>`).join('')}</ul>
    <h4 class="sub">Проверь себя</h4>
    <div class="lq">
      <p class="lq-q">${esc(l.q.q)}</p>
      <div class="opts">${l.q.a.map((a, k) => `<button class="opt" data-a="${k}"><span>${'АБВГ'[k]}</span>${esc(a)}</button>`).join('')}</div>
      <p class="why" id="why" hidden></p>
    </div>
    <div class="lesson-nav">
      <button class="btn ghost small" id="prev">← Назад</button>
      <button class="btn ghost small" id="next">Дальше →</button>
    </div>`;
}

function step(d) {
  const i = ALL_LESSONS.findIndex(l => l.id === cur.id);
  const n = ALL_LESSONS[i + d]; if (n) openLesson(n.id);
}

$('#lesson').addEventListener('click', e => {
  const t = e.target.closest('button'); if (!t) return;
  if (t.id === 'play') return playing ? (voice.pause(), setPlaying(false), paused = true) : (paused && voice.canResume ? (voice.resume(), setPlaying(true), paused = false) : play());
  if (t.id === 'prev') return step(-1);
  if (t.id === 'next') return step(1);
  if (t.id === 'to-atlas') { const l = ALL_LESSONS.find(x => x.id === cur.id); location.href = `index.html#atlas`; sessionStorage.setItem('qs-open-scene', JSON.stringify({ scene: l.scene, part: l.part })); return; }
  if (t.dataset.a !== undefined) return answer(+t.dataset.a);
});

function answer(k) {
  const l = ALL_LESSONS.find(x => x.id === cur.id);
  const ok = k === l.q.correct;
  $$('.lq .opt').forEach((b, j) => { b.disabled = true; if (j === l.q.correct) b.classList.add('good'); else if (j === k) b.classList.add('bad'); });
  const why = $('#why'); why.hidden = false; why.textContent = (ok ? '✅ Верно! ' : '❌ Не совсем. ') + l.q.why;
  if (ok && !store.done[l.id]) {
    store.done[l.id] = true; save(); renderStages(); renderLessons(); renderProgress();
    const y = YEARS[l.year - 1];
    toast(yearDone(y) === y.lessons.length ? `🎓 Год ${l.year} пройден!` : 'Урок пройден ✓');
  }
  if (!ok) setTimeout(() => { $$('.lq .opt').forEach(b => { b.disabled = false; b.classList.remove('bad', 'good'); }); }, 2200);
}

/* ───────── голос ───────── */
const voice = new Voice();
let playing = false, paused = false, lecture = false;
function setPlaying(v) { playing = v; $('#lesson')?.classList.toggle('playing', v); }
function highlight(i) { $$('#lesson-text .w').forEach((w, k) => { w.classList.toggle('said', k < i); w.classList.toggle('now', k === i); }); }
function play() {
  const l = ALL_LESSONS.find(x => x.id === cur.id);
  paused = false; setPlaying(true);
  // заголовок + текст: индекс слова смещаем на длину заголовка
  const off = l.title.split(/\s+/).length;
  voice.speak(lessonText(l), {
    onword: i => highlight(i - off),
    onend: () => {
      setPlaying(false); highlight(1e9);
      if (lecture) setTimeout(() => { if (!lecture) return; const i = ALL_LESSONS.findIndex(x => x.id === cur.id); const n = ALL_LESSONS[i + 1]; n ? openLesson(n.id, { autoplay: true }) : (lecture = false, toast('Лекция окончена 🎓')); }, 1400);
    }
  });
  const next = ALL_LESSONS[ALL_LESSONS.findIndex(x => x.id === cur.id) + 1];
  if (next) voice.preload(lessonText(next));
}
voice.onsilent = () => toast('Для этого урока нет озвучки, а голос браузера недоступен — читайте текст');

function startLecture() {
  lecture = !lecture;
  $('#lecture-top span').textContent = lecture ? 'Остановить' : 'Лекция подряд';
  if (!lecture) { voice.stop(); setPlaying(false); return; }
  toast('Лекция: уроки идут подряд с голосом');
  openLesson(cur.id, { scroll: true, autoplay: true });
}
$('#lecture').addEventListener('click', startLecture);
$('#lecture-top').addEventListener('click', startLecture);
$('#continue').addEventListener('click', () => openLesson(ALL_LESSONS.find(l => !store.done[l.id])?.id || ALL_LESSONS[0].id, { scroll: true }));

document.addEventListener('keydown', e => {
  if (e.target.matches('input, select, textarea') || e.metaKey || e.ctrlKey) return;
  if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === ' ') { e.preventDefault(); $('#play')?.click(); }
});

/* ───────── старт ───────── */
const startId = location.hash.slice(1);
openLesson(ALL_LESSONS.some(l => l.id === startId) ? startId : store.last || ALL_LESSONS[0].id);
renderProgress();
