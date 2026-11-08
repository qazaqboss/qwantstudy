// 3D-сцены для углублённого курса: матрицы, яма, осциллятор, Штерн–Герлах, квантовая схема,
// спектр света и орбитали водорода. Устроены как сцены атласа: группа, структуры, анимация.
import { THREE, C, glow, makeParts, add, points, gauss, arrow, ring, textSprite } from './scene-kit.js';

const smooth = t => t * t * (3 - 2 * t);
function line(pts, color, opacity = 1) {
  const g = new THREE.BufferGeometry().setFromPoints(pts);
  return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
}
function dynLine(n, color, opacity = 1) {
  const pos = new Float32Array(n * 3);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity }));
  l.frustumCulled = false;
  return { line: l, pos, done: () => { g.attributes.position.needsUpdate = true; } };
}

/* ───────────── Матрица как преобразование пространства ───────────── */
function matrixScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'grid', label: [-2.6, 2.4, 0], name: 'Координатная сетка', system: 'Пространство', color: C.blue, desc: 'Сетка показывает всё пространство сразу. Матрица переводит каждую точку в новую, но прямые линии остаются прямыми, а начало координат остаётся на месте: это линейное преобразование.' },
    { id: 'basisX', label: [1.4, -0.35, 0], name: 'Базисный вектор x', system: 'Базис', color: C.red, desc: 'Первый столбец матрицы — это то, куда переходит базисный вектор x. Зная, куда уходят базисные векторы, мы знаем всё преобразование.' },
    { id: 'basisY', label: [-0.5, 1.5, 0], name: 'Базисный вектор y', system: 'Базис', color: C.green, desc: 'Второй столбец матрицы — новое положение вектора y. В квантовой механике базисные векторы — это состояния ноль и единица.' },
    { id: 'vector', label: [1.6, 1.4, 0], name: 'Вектор состояния', system: 'Вектор', color: C.gold, desc: 'Произвольный вектор раскладывается по базису: v = a·x + b·y. Матрица действует на него, умножаясь на столбец координат.' },
    { id: 'eigen', label: [2.6, -1.6, 0], name: 'Собственные направления', system: 'Спектр', color: C.violet, desc: 'Векторы, которые матрица только растягивает, не поворачивая: A·v = λ·v. Числа λ — собственные значения. В квантовой механике это возможные результаты измерения.' },
    { id: 'matrix', label: [0, 3.35, 0], name: 'Табло матрицы', system: 'Матрица', color: C.cyan, desc: 'Здесь видна текущая матрица 2×2. Сцена по очереди показывает единичную матрицу, сдвиг, поворот, растяжение, матрицы Паули X и Z и вентиль Адамара.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const S = Math.SQRT1_2;
  const MATS = [
    { n: 'Единичная I', m: [1, 0, 0, 1] },
    { n: 'Сдвиг', m: [1, 0.8, 0, 1] },
    { n: 'Поворот 45°', m: [S, -S, S, S] },
    { n: 'Растяжение', m: [1.6, 0, 0, 0.6] },
    { n: 'Паули X', m: [0, 1, 1, 0] },
    { n: 'Паули Z', m: [1, 0, 0, -1] },
    { n: 'Адамар H', m: [S, S, S, -S] }
  ];
  // сетка: базовые точки линий
  const N = 6, segs = [];
  for (let k = -N; k <= N; k++) for (const dir of [0, 1]) {
    for (let s = -N; s < N; s++) {
      const a = dir ? [k * 0.5, s * 0.5] : [s * 0.5, k * 0.5];
      const b = dir ? [k * 0.5, (s + 1) * 0.5] : [(s + 1) * 0.5, k * 0.5];
      segs.push(a, b);
    }
  }
  const gPos = new Float32Array(segs.length * 3);
  const gGeo = new THREE.BufferGeometry(); gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  const grid = new THREE.LineSegments(gGeo, new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0.55 }));
  grid.frustumCulled = false;
  const ghost = new THREE.GridHelper(6, 12, 0x223366, 0x16224a); ghost.rotation.x = Math.PI / 2; ghost.material.transparent = true; ghost.material.opacity = 0.35;
  const gg = new THREE.Group(); gg.add(ghost, grid);
  add(group, P.grid, gg);

  const ax = arrow(C.red, 1, 0.035), ay = arrow(C.green, 1, 0.035), av = arrow(C.gold, 1, 0.04);
  add(group, P.basisX, ax); add(group, P.basisY, ay); add(group, P.vector, av);
  const eig = new THREE.Group();
  const e1 = line([new THREE.Vector3(-4, 0, 0), new THREE.Vector3(4, 0, 0)], C.violet, 0.9);
  const e2 = line([new THREE.Vector3(-4, 0, 0), new THREE.Vector3(4, 0, 0)], C.violet, 0.9);
  eig.add(e1, e2); add(group, P.eigen, eig);
  const board = textSprite(['', ''], { scale: 1.1, font: 'bold 44px JetBrains Mono, monospace' });
  board.position.set(0, 2.75, 0);
  add(group, P.matrix, board);
  P.matrix.explode.set(0, 1, 0); P.eigen.explode.set(0, 0, 1); P.vector.explode.set(0, 0, 0.6);

  const up = new THREE.Vector3(0, 1, 0), tmp = new THREE.Vector3();
  const setArrow = (a, x, y) => {
    const len = Math.hypot(x, y) || 1e-4;
    a.scale.set(1, len, 1);
    a.quaternion.setFromUnitVectors(up, tmp.set(x / len, y / len, 0));
  };
  let lastBoard = '';
  function update(t) {
    const HOLD = 3.2, cyc = t / HOLD, i = Math.floor(cyc) % MATS.length, f = smooth(Math.min(1, (cyc % 1) * 2.2));
    const A = MATS[i].m, B = MATS[(i + 1) % MATS.length].m;
    const prevShown = f < 1 ? MATS[i] : MATS[(i + 1) % MATS.length];
    const m = A.map((a, k) => a + (B[k] - a) * f);
    const [a, b, c, d] = m;
    for (let k = 0; k < segs.length; k++) {
      const [x, y] = segs[k];
      gPos[k * 3] = a * x + b * y; gPos[k * 3 + 1] = c * x + d * y; gPos[k * 3 + 2] = 0;
    }
    gGeo.attributes.position.needsUpdate = true;
    setArrow(ax, a, c); setArrow(ay, b, d);
    const vx = 1.2, vy = 0.8; setArrow(av, a * vx + b * vy, c * vx + d * vy);
    // собственные векторы 2×2
    const tr = a + d, det = a * d - b * c, disc = tr * tr / 4 - det;
    if (disc >= -1e-6) {
      const r = Math.sqrt(Math.max(0, disc));
      [tr / 2 + r, tr / 2 - r].forEach((l, k) => {
        let x = b, y = l - a;
        if (Math.hypot(x, y) < 1e-4) { x = l - d; y = c; }
        if (Math.hypot(x, y) < 1e-4) { x = k ? 0 : 1; y = k ? 1 : 0; }
        const L = Math.hypot(x, y); const ln = k ? e2 : e1;
        ln.visible = true; ln.rotation.z = Math.atan2(y / L, x / L);
      });
    } else { e1.visible = e2.visible = false; }
    const f2 = v => (Math.abs(v) < 0.005 ? 0 : v).toFixed(2).replace('-0.00', '0.00');
    const label = f < 1 && f > 0 ? '→ ' + MATS[(i + 1) % MATS.length].n : prevShown.n;
    const txt = `${label}|[ ${f2(a)}  ${f2(b)} ]|[ ${f2(c)}  ${f2(d)} ]`;
    if (txt !== lastBoard) { lastBoard = txt; board.draw(txt.split('|')); }
  }
  return { group, parts, update };
}

/* ───────────── Частица в потенциальной яме ───────────── */
function boxScene() {
  const group = new THREE.Group();
  const L = 6, x0 = -3;
  const parts = makeParts([
    { id: 'walls', label: [-3.3, 4.6, 0], name: 'Стенки ямы', system: 'Потенциал', color: C.violet, desc: 'Бесконечно высокие стенки: частица не может выйти наружу, поэтому волновая функция на стенках равна нулю.' },
    { id: 'levels', label: [3.6, 0.6, 0], name: 'Уровни энергии', system: 'Энергия', color: C.white, desc: 'Разрешены только энергии Eₙ = n²h²/(8mL²). Уровни расходятся всё сильнее: четвёртый в 16 раз выше первого.' },
    { id: 'waves', label: [-1.5, 3.9, 0], name: 'Волновые функции ψₙ', system: 'Состояния', color: C.cyan, desc: 'Стоячие волны sin(nπx/L): в яму укладывается целое число полуволн. Номер n — квантовое число, у n-й волны n − 1 узлов.' },
    { id: 'density', label: [1.6, 3.9, 0.6], name: 'Плотность вероятности |ψ|²', system: 'Состояния', color: C.pink, desc: 'Квадрат волновой функции показывает, где вероятнее найти частицу. В узлах частицы не бывает никогда.' },
    { id: 'zeroPoint', label: [-3.6, 0.55, 0], name: 'Нулевая энергия', system: 'Энергия', color: C.gold, desc: 'Даже в самом нижнем состоянии энергия не равна нулю. Это прямое следствие принципа неопределённости.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const walls = new THREE.Group();
  [x0 - 0.15, x0 + L + 0.15].forEach(x => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5, 2), glow(C.violet, 0.3, { opacity: 0.35, depthWrite: false })); m.position.set(x, 2.1, 0); walls.add(m); });
  const floor = new THREE.Mesh(new THREE.BoxGeometry(L + 0.6, 0.06, 2), glow(C.violet, 0.2, { opacity: 0.3 })); floor.position.y = -0.4; walls.add(floor);
  add(group, P.walls, walls);
  const E = n => -0.2 + n * n * 0.26;
  const lv = new THREE.Group();
  for (let n = 1; n <= 4; n++) lv.add(line([new THREE.Vector3(x0, E(n), 0), new THREE.Vector3(x0 + L, E(n), 0)], C.white, 0.45));
  add(group, P.levels, lv);
  const zp = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 16), glow(C.gold, 1.4)); zp.position.set(x0 - 0.45, E(1), 0);
  add(group, P.zeroPoint, zp);
  const M = 160, colors = [C.cyan, C.green, C.gold, C.pink];
  const wv = new THREE.Group(), dens = new THREE.Group();
  const waves = [], dlines = [];
  for (let n = 1; n <= 4; n++) {
    const w = dynLine(M, colors[n - 1]); wv.add(w.line); waves.push(w);
    const d = dynLine(M, C.pink, 0.55); d.line.position.z = 0.5; dens.add(d.line); dlines.push(d);
  }
  add(group, P.waves, wv); add(group, P.density, dens);
  P.waves.explode.set(0, 0, 0.6); P.density.explode.set(0, 0, 1.4); P.walls.explode.set(0, 0, -0.8);
  function update(t) {
    for (let n = 1; n <= 4; n++) {
      const w = waves[n - 1], d = dlines[n - 1], ph = Math.cos(t * 0.8 * n * n);
      for (let i = 0; i < M; i++) {
        const u = i / (M - 1), s = Math.sin(n * Math.PI * u);
        w.pos[i * 3] = d.pos[i * 3] = x0 + u * L;
        w.pos[i * 3 + 1] = E(n) + 0.22 * s * ph; w.pos[i * 3 + 2] = 0;
        d.pos[i * 3 + 1] = E(n) + 0.22 * s * s; d.pos[i * 3 + 2] = 0;
      }
      w.done(); d.done();
    }
    zp.position.y = E(1) + Math.sin(t * 3) * 0.03;
  }
  return { group, parts, update };
}

/* ───────────── Квантовый гармонический осциллятор ───────────── */
function oscillatorScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'potential', label: [2.9, 3.9, 0], name: 'Параболический потенциал', system: 'Потенциал', color: C.violet, desc: 'U = ½·m·ω²·x². Так ведут себя атомы в молекуле, колебания решётки и даже поле фотонов в резонаторе.' },
    { id: 'levels', label: [-2.6, 0.75, 0], name: 'Эквидистантные уровни', system: 'Энергия', color: C.white, desc: 'Eₙ = ħω(n + ½). В отличие от ямы, уровни идут на равном расстоянии ħω — это и есть кванты колебаний (фононы, фотоны).' },
    { id: 'states', label: [1.7, 2.6, 0.4], name: 'Волновые функции', system: 'Состояния', color: C.cyan, desc: 'Решения — функции Эрмита, умноженные на гауссиан. Основное состояние — гауссов колокол без узлов, у n-го состояния n узлов.' },
    { id: 'ball', label: [0, -0.55, 0.6], name: 'Классический шарик', system: 'Сравнение', color: C.gold, desc: 'Классическая частица чаще бывает у краёв, где она замедляется. Квантовая в основном состоянии — наоборот, в центре.' },
    { id: 'quanta', label: [-1.7, 3.2, 0], name: 'Квант ħω', system: 'Энергия', color: C.pink, desc: 'Переход между соседними уровнями поглощает или испускает ровно один квант энергии ħω.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const k = 0.32, U = x => k * x * x - 0.2;
  const pts = []; for (let i = 0; i <= 120; i++) { const x = -3.4 + i * 6.8 / 120; pts.push(new THREE.Vector3(x, U(x), 0)); }
  const pot = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 160, 0.035, 8), glow(C.violet, 0.8));
  add(group, P.potential, pot);
  const E = n => 0.15 + n * 0.62;
  const lv = new THREE.Group();
  for (let n = 0; n <= 4; n++) { const xt = Math.sqrt((E(n) + 0.2) / k); lv.add(line([new THREE.Vector3(-xt, E(n), 0), new THREE.Vector3(xt, E(n), 0)], C.white, 0.45)); }
  add(group, P.levels, lv);
  const H = [x => 1, x => 2 * x, x => 4 * x * x - 2, x => 8 * x ** 3 - 12 * x, x => 16 * x ** 4 - 48 * x * x + 12];
  const norm = [1, 2, 6, 15, 60];
  const M = 140, st = new THREE.Group(), lines = [];
  const cols = [C.cyan, C.green, C.gold, C.pink, C.blue];
  for (let n = 0; n <= 4; n++) { const l = dynLine(M, cols[n]); st.add(l.line); lines.push(l); }
  add(group, P.states, st);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.14, 20, 20), glow(C.gold, 1));
  add(group, P.ball, ball);
  const q = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), glow(C.pink, 1.6));
  add(group, P.quanta, q);
  P.states.explode.set(0, 0, 0.8); P.ball.explode.set(0, 0, 1); P.quanta.explode.set(-0.6, 0.6, 0);
  function update(t) {
    lines.forEach((l, n) => {
      const ph = Math.cos(t * 1.2 * (n + 0.5));
      for (let i = 0; i < M; i++) {
        const x = -3 + i * 6 / (M - 1), xs = x * 1.15;
        const psi = H[n](xs) * Math.exp(-xs * xs / 2) / norm[n] * 0.32;
        l.pos[i * 3] = x; l.pos[i * 3 + 1] = E(n) + psi * ph; l.pos[i * 3 + 2] = 0;
      }
      l.done();
    });
    const A = 2.2, x = A * Math.sin(t * 1.4);
    ball.position.set(x, U(x) + 0.14, 0);
    const c = (t * 0.35) % 1, n = Math.floor(t * 0.35) % 4;
    q.position.set(-1.7 + c * 0.0, E(n) + c * (E(n + 1) - E(n)), 0);
    q.rotation.y = t * 3;
  }
  return { group, parts, update };
}

/* ───────────── Опыт Штерна–Герлаха ───────────── */
function sternScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'oven', label: [-4.6, 1.0, 0], name: 'Печь с серебром', system: 'Установка', color: C.red, desc: 'Нагретое серебро испаряется, и через щель вылетает пучок атомов. У атома серебра один неспаренный электрон, его спин и определяет магнитный момент.' },
    { id: 'beam', label: [-2.6, 0.6, 0], name: 'Пучок атомов', system: 'Атомы', color: C.cyan, desc: 'До магнита спины направлены как угодно. Классически пучок должен был бы размазаться в сплошную полосу.' },
    { id: 'magnet', label: [0, 1.75, 0], name: 'Неоднородный магнит', system: 'Установка', color: C.violet, desc: 'Острый полюс N и плоский S создают неоднородное поле. Сила зависит от проекции магнитного момента на ось поля.' },
    { id: 'up', label: [3.0, 1.45, 0], name: 'Спин вверх', system: 'Результат', color: C.green, desc: 'Половина атомов отклоняется вверх: проекция спина +ħ/2.' },
    { id: 'down', label: [3.0, -1.45, 0], name: 'Спин вниз', system: 'Результат', color: C.pink, desc: 'Другая половина — вниз: проекция −ħ/2. Промежуточных значений нет — спин квантован.' },
    { id: 'screen', label: [4.6, 2.3, 0], name: 'Экран с двумя пятнами', system: 'Результат', color: C.gold, desc: 'В 1922 году Штерн и Герлах увидели на пластинке два пятна вместо полосы — первое прямое наблюдение квантования спина.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const oven = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), glow(0x5a1a22, 0.3, { metalness: 0.6 })); oven.add(body);
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), glow(C.red, 1.6)); hot.position.x = 0.5; oven.add(hot);
  oven.position.x = -4.6; add(group, P.oven, oven); P.oven.explode.set(-1, 0, 0);
  const mag = new THREE.Group();
  const north = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 4), glow(C.red, 0.4, { metalness: 0.5 })); north.rotation.z = Math.PI; north.position.y = 0.85; north.scale.z = 2.2;
  const south = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.3), glow(C.blue, 0.4, { metalness: 0.5 })); south.position.y = -0.85;
  const nTop = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.4, 1.3), glow(C.red, 0.4, { metalness: 0.5 })); nTop.position.y = 1.4;
  mag.add(north, south, nTop); add(group, P.magnet, mag); P.magnet.explode.set(0, 0, -1.4);
  const scr = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.08, 3.6, 2.2), glow(C.gold, 0.12, { opacity: 0.5 })); plate.position.x = 4.6; scr.add(plate);
  const spots = [1.15, -1.15].map(y => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), glow(C.gold, 1.4)); s.position.set(4.55, y, 0); s.scale.set(0.4, 1, 1.6); scr.add(s); return s; });
  add(group, P.screen, scr); P.screen.explode.set(1, 0, 0);
  // атомы
  const mk = (color, n) => { const g = new THREE.Group(); const arr = []; for (let i = 0; i < n; i++) { const a = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 8), glow(color, 1.5)); a.userData.o = i / n; g.add(a); arr.push(a); } return { g, arr }; };
  const beam = mk(C.cyan, 18), up = mk(C.green, 12), down = mk(C.pink, 12);
  add(group, P.beam, beam.g); add(group, P.up, up.g); add(group, P.down, down.g);
  P.up.explode.set(0, 0.6, 0); P.down.explode.set(0, -0.6, 0);
  function update(t) {
    beam.arr.forEach(a => { const u = (t * 0.35 + a.userData.o) % 1; a.position.set(-4 + u * 3, (Math.sin(a.userData.o * 40) * 0.05), Math.cos(a.userData.o * 30) * 0.05); });
    [[up, 1], [down, -1]].forEach(([b, s]) => b.arr.forEach(a => {
      const u = (t * 0.35 + a.userData.o) % 1, x = -1 + u * 5.55;
      const y = x < -1 ? 0 : s * 1.15 * Math.min(1, ((x + 1) / 5.55) ** 1.6) * 1;
      a.position.set(x, y, Math.cos(a.userData.o * 30) * 0.05);
    }));
    spots.forEach((s, i) => { s.material.emissiveIntensity = (1.1 + 0.4 * Math.sin(t * 3 + i)) * (s.material.userData.look ?? 1); });
    hot.scale.setScalar(1 + 0.1 * Math.sin(t * 6));
  }
  return { group, parts, update };
}

/* ───────────── Квантовая схема ───────────── */
function circuitScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'wires', label: [-4.2, 1.7, 0], name: 'Линии кубитов', system: 'Схема', color: C.blue, desc: 'Каждая линия — один кубит, время идёт слева направо. Все кубиты начинают в состоянии ноль.' },
    { id: 'hadamard', label: [-2, 1.85, 0], name: 'Вентиль Адамара H', system: 'Вентили', color: C.cyan, desc: 'Превращает ноль в равную суперпозицию нуля и единицы. Матрица H = (1/√2)·[[1, 1], [1, −1]].' },
    { id: 'cnot', label: [0.2, 1.85, 0], name: 'CNOT', system: 'Вентили', color: C.violet, desc: 'Контролируемое НЕ: переворачивает второй кубит, только если первый равен единице. После H и CNOT получается запутанное состояние Белла.' },
    { id: 'pauli', label: [0.2, -1.7, 0], name: 'Вентиль X', system: 'Вентили', color: C.red, desc: 'Квантовое НЕ: меняет местами ноль и единицу. Это матрица Паули X.' },
    { id: 'measure', label: [3.2, 1.85, 0], name: 'Измерение', system: 'Считывание', color: C.gold, desc: 'В конце схемы кубиты измеряют, получая классические нули и единицы. Схему повторяют тысячи раз, чтобы собрать статистику.' },
    { id: 'pulses', label: [-3.2, -1.7, 0], name: 'Амплитуды', system: 'Состояние', color: C.green, desc: 'Светящиеся импульсы показывают поток квантовой информации. После CNOT импульсы первых двух кубитов движутся согласованно — это запутанность.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const Y = [1.1, 0, -1.1];
  const wires = new THREE.Group();
  Y.forEach((y, i) => {
    wires.add(line([new THREE.Vector3(-4, y, 0), new THREE.Vector3(4, y, 0)], C.blue, 0.8));
    const k = textSprite(`|0⟩`, { w: 192, h: 128, scale: 0.5, bg: null, color: '#8fb8ff', font: 'bold 64px JetBrains Mono, monospace' });
    k.position.set(-4.45, y, 0); wires.add(k);
  });
  add(group, P.wires, wires);
  const gate = (txt, color, x, y) => {
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.3), glow(color, 0.12, { opacity: 0.75 }));
    const lab = textSprite(txt, { w: 128, h: 128, scale: 0.45, bg: null, color: '#ffffff', font: 'bold 80px JetBrains Mono, monospace' });
    lab.position.z = 0.17; g.add(box, lab); g.position.set(x, y, 0); return g;
  };
  add(group, P.hadamard, gate('H', C.cyan, -2, Y[0]));
  add(group, P.pauli, gate('X', C.red, 0.2, Y[2]));
  const cn = new THREE.Group();
  const dot = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), glow(C.violet, 1.2)); dot.position.set(0.2, Y[0], 0);
  const tgt = ring(0.24, C.violet, 0.035, 1); tgt.position.set(0.2, Y[1], 0);
  const vl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, Y[0] - Y[1] + 0.24, 8), glow(C.violet, 1)); vl.position.set(0.2, (Y[0] + Y[1]) / 2 - 0.12, 0);
  const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.48, 8), glow(C.violet, 1)); hl.rotation.z = Math.PI / 2; hl.position.set(0.2, Y[1], 0);
  cn.add(dot, tgt, vl, hl); add(group, P.cnot, cn);
  const meas = new THREE.Group();
  Y.forEach(y => {
    const m = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.6, 0.3), glow(C.gold, 0.1, { opacity: 0.75 }));
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.025, 8, 24, Math.PI), glow(C.gold, 1.2)); arc.position.set(0, -0.08, 0.16);
    const needle = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.3, 6), glow(C.gold, 1.2)); needle.position.set(0.06, 0.02, 0.16); needle.rotation.z = -0.6;
    m.add(box, arc, needle); m.userData.needle = needle; m.position.set(3.2, y, 0); meas.add(m);
  });
  add(group, P.measure, meas);
  const pl = new THREE.Group(), pulses = [];
  Y.forEach((y, w) => { for (let k = 0; k < 3; k++) { const p = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 12), glow(C.green, 2)); p.userData = { w, o: k / 3 }; pl.add(p); pulses.push(p); } });
  add(group, P.pulses, pl);
  P.hadamard.explode.set(0, 0, 1); P.cnot.explode.set(0, 0, 1.4); P.pauli.explode.set(0, 0, 1); P.measure.explode.set(1, 0, 0.6);
  function update(t) {
    pulses.forEach(p => {
      const u = (t * 0.22 + p.userData.o) % 1, x = -4 + u * 7.2;
      p.position.set(x, Y[p.userData.w], 0.02);
      const sup = p.userData.w === 0 ? x > -2 : p.userData.w === 1 ? x > 0.2 : false;
      p.scale.setScalar(sup ? 0.8 + 0.4 * Math.abs(Math.sin(t * 6 + p.userData.o * 9)) : 1);
      p.material.color.setHex(sup ? C.cyan : C.green); p.material.emissive.setHex(sup ? C.cyan : C.green);
    });
    meas.children.forEach((m, i) => { m.userData.needle.rotation.z = -0.6 + Math.sin(t * 2 + i) * 0.5; });
  }
  return { group, parts, update };
}

/* ───────────── Спектр света ───────────── */
function spectrumScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'lamp', label: [-4.8, 1.0, 0], name: 'Источник белого света', system: 'Свет', color: C.white, desc: 'Белый свет — смесь всех цветов, то есть электромагнитных волн с длиной от 380 до 750 нанометров.' },
    { id: 'beam', label: [-2.6, 0.8, 0], name: 'Белый луч', system: 'Свет', color: C.white, desc: 'Свет распространяется со скоростью около 300 000 километров в секунду. Это поток фотонов разных энергий.' },
    { id: 'prism', label: [0, 1.85, 0], name: 'Стеклянная призма', system: 'Оптика', color: C.cyan, desc: 'Стекло преломляет короткие волны сильнее длинных, поэтому фиолетовый отклоняется больше красного. Так Ньютон в 1666 году разложил свет в спектр.' },
    { id: 'rainbow', label: [3.4, 2.2, 0], name: 'Непрерывный спектр', system: 'Спектр', color: C.pink, desc: 'Радуга из всех цветов: красный, оранжевый, жёлтый, зелёный, голубой, синий, фиолетовый. Каждому цвету соответствует своя частота и энергия фотона.' },
    { id: 'lines', label: [4.8, -2.0, 0], name: 'Линии водорода', system: 'Спектр', color: C.green, desc: 'Нагретый водород светит не радугой, а отдельными линиями: 656, 486, 434 и 410 нанометров. Это фотоны, рождённые переходами электрона между уровнями.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const lamp = new THREE.Group();
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 24), glow(C.white, 1.6)); lamp.add(bulb);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.6, 24, 24), glow(C.white, 0.6, { opacity: 0.15, depthWrite: false })); lamp.add(halo);
  lamp.position.x = -4.8; add(group, P.lamp, lamp); P.lamp.explode.set(-1, 0, 0);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 12), glow(C.white, 1.2, { opacity: 0.8 }));
  beam.rotation.z = Math.PI / 2; beam.position.set(-2.55, 0, 0);
  add(group, P.beam, beam);
  const shape = new THREE.Shape(); shape.moveTo(-0.9, -0.8); shape.lineTo(0.9, -0.8); shape.lineTo(0, 1.0); shape.closePath();
  const prism = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: false }), new THREE.MeshPhysicalMaterial({ color: 0x9fe8ff, transmission: 0.6, roughness: 0.05, metalness: 0, transparent: true, opacity: 0.45, emissive: C.cyan, emissiveIntensity: 0.15 }));
  prism.position.z = -0.6;
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(prism.geometry), new THREE.LineBasicMaterial({ color: C.cyan })); edges.position.copy(prism.position);
  const pg = new THREE.Group(); pg.add(prism, edges); add(group, P.prism, pg); P.prism.explode.set(0, 0, 1.2);
  const rb = new THREE.Group(), rays = [];
  const cols = [0xff3040, 0xff8a1f, 0xffe23a, 0x37e86a, 0x2fd4ff, 0x3f5bff, 0x9b46ff];
  cols.forEach((c, i) => {
    const ang = -0.18 - i * 0.07;
    const r = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 4.4, 8), glow(c, 1.4, { opacity: 0.85 }));
    r.rotation.z = Math.PI / 2 + ang; r.position.set(0.25 + Math.cos(ang) * 2.2, Math.sin(ang) * 2.2 + 0.15, 0);
    rb.add(r); rays.push(r);
  });
  add(group, P.rainbow, rb);
  const ln = new THREE.Group();
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), new THREE.MeshBasicMaterial({ color: 0x05070f, transparent: true, opacity: 0.9 }));
  strip.position.set(3, -2.5, 0); ln.add(strip);
  [[656, 0xff3040], [486, 0x2fd4ff], [434, 0x3f5bff], [410, 0x9b46ff]].forEach(([nm, c]) => {
    const x = 3 + ((nm - 380) / 370 - 0.5) * 3.8;
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.55, 0.02), glow(c, 2)); bar.position.set(x, -2.5, 0.02); ln.add(bar);
  });
  add(group, P.lines, ln); P.lines.explode.set(0.6, -0.8, 0); P.rainbow.explode.set(1, 0.3, 0);
  function update(t) {
    bulb.scale.setScalar(1 + 0.05 * Math.sin(t * 5));
    rays.forEach((r, i) => { r.material.opacity = 0.65 + 0.25 * Math.sin(t * 2 + i * 0.6); });
  }
  return { group, parts, update };
}

/* ───────────── Орбитали атома водорода ───────────── */
function orbitalsScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 's1', label: [-4.2, 1.6, 0], name: '1s (n=1, l=0)', system: 'Орбитали', color: C.cyan, desc: 'Основное состояние водорода. Шар без узлов, самый вероятный радиус — боровский, 0,053 нанометра.' },
    { id: 's2', label: [-1.4, 2.3, 0], name: '2s (n=2, l=0)', system: 'Орбитали', color: C.green, desc: 'Тоже шар, но с одной сферической узловой поверхностью внутри: облако состоит из ядра и внешней оболочки.' },
    { id: 'p2', label: [1.4, 2.6, 0], name: '2p (l=1, m=0)', system: 'Орбитали', color: C.violet, desc: 'Гантель из двух лепестков с узловой плоскостью посередине. Квантовое число l = 1 даёт три такие орбитали: px, py, pz.' },
    { id: 'd3', label: [4.2, 2.6, 0], name: '3d z² (l=2)', system: 'Орбитали', color: C.pink, desc: 'Гантель с кольцом вокруг пояса. d-орбитали определяют свойства переходных металлов: цвет, магнетизм и катализ.' },
    { id: 'nuclei', label: [0, -1.65, 0], name: 'Ядра-протоны', system: 'Ядро', color: C.gold, desc: 'В центре каждой орбитали — протон. Форма облака задаётся тремя квантовыми числами: главным n, орбитальным l и магнитным m.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const X = [-4.2, -1.4, 1.4, 4.2];
  // выборка точек по |ψ|² методом отбора
  const sample = (n, rMax, dens, color, cx) => {
    const pts = points(n, v => {
      for (let k = 0; k < 400; k++) { v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).multiplyScalar(rMax); if (Math.random() < dens(v)) break; }
    }, color, 0.035);
    pts.material.opacity = 0.75;
    const g = new THREE.Group(); g.position.x = cx; g.add(pts); return g;
  };
  add(group, P.s1, sample(2200, 1.2, v => Math.exp(-2 * v.length() / 0.35), C.cyan, X[0]));
  add(group, P.s2, sample(2600, 1.3, v => { const r = v.length() / 0.22; return 0.25 * (2 - r) ** 2 * Math.exp(-r); }, C.green, X[1]));
  add(group, P.p2, sample(2600, 1.3, v => { const r = v.length() / 0.25; return 0.6 * (v.y / 0.25) ** 2 * Math.exp(-r); }, C.violet, X[2]));
  add(group, P.d3, sample(3000, 1.3, v => { const r = v.length() / 0.2; const c = r ? v.y / v.length() : 0; return 0.012 * r ** 4 * (3 * c * c - 1) ** 2 * Math.exp(-2 * r / 3); }, C.pink, X[3]));
  const nuc = new THREE.Group();
  X.forEach(x => { const m = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 12), glow(C.gold, 1.6)); m.position.x = x; nuc.add(m); });
  add(group, P.nuclei, nuc);
  P.s1.explode.set(-0.8, 0, 0); P.s2.explode.set(-0.3, 0.4, 0); P.p2.explode.set(0.3, 0.4, 0); P.d3.explode.set(0.8, 0, 0); P.nuclei.explode.set(0, -1, 0);
  function update(t) {
    [P.s1, P.s2, P.p2, P.d3].forEach((p, i) => { p.objects[0].children[0].rotation.y = t * (0.15 + i * 0.03); });
  }
  return { group, parts, update };
}

export const COURSE_SCENES = [
  { id: 'spectrum', name: 'Спектр', sub: 'Призма и линии', camera: [0.5, 2.2, 10], build: spectrumScene, intro: 'Белый свет проходит через призму и раскладывается в радугу. А нагретый водород светит отдельными линиями — отпечатками квантовых уровней.' },
  { id: 'box', name: 'Яма', sub: 'Частица в ящике', camera: [0, 2.4, 12.5], build: boxScene, intro: 'Частица заперта между стенками. В яму укладываются только стоячие волны, поэтому энергия квантуется.' },
  { id: 'oscillator', name: 'Осциллятор', sub: 'Кванты колебаний', camera: [0, 2.2, 12], build: oscillatorScene, intro: 'Квантовый гармонический осциллятор: частица в параболической яме. Уровни идут на равном расстоянии — кванты энергии ħω.' },
  { id: 'orbitals', name: 'Орбитали', sub: 'Атом водорода', camera: [0, 1.6, 14], build: orbitalsScene, intro: 'Облака вероятности электрона в атоме водорода: 1s, 2s, 2p и 3d. Их форма задаётся квантовыми числами n, l и m.' },
  { id: 'stern', name: 'Штерн–Герлах', sub: 'Квантование спина', camera: [0.5, 2.4, 9.5], build: sternScene, intro: 'Пучок атомов серебра проходит через неоднородный магнит и расщепляется ровно на два пятна. Спин квантован.' },
  { id: 'matrix', name: 'Матрица', sub: 'Линейная алгебра', camera: [0.5, 0.6, 10.5], build: matrixScene, intro: 'Матрица — это преобразование пространства. Смотрите, как сетка и базисные векторы меняются под действием сдвига, поворота, матриц Паули и вентиля Адамара.' },
  { id: 'circuit', name: 'Схема', sub: 'Квантовые вентили', camera: [0, 1.2, 9.5], build: circuitScene, intro: 'Квантовая схема из трёх кубитов: вентиль Адамара, CNOT, вентиль X и измерение. Так записывают квантовые алгоритмы.' }
];
