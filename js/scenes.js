// 3D-сцены атласа. Каждая сцена отдаёт группу, список структур (как в анатомическом атласе)
// и функцию анимации. Структура — набор мешей с общим id, направлением «разнесения» и описанием.
import * as THREE from 'three';

const C = {
  cyan: 0x38e8ff, violet: 0x9b6bff, pink: 0xff4fd8, gold: 0xffc857,
  green: 0x4dffb0, red: 0xff5a6b, blue: 0x4f7bff, white: 0xe9f1ff
};

function glow(color, intensity = 0.6, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity,
    roughness: 0.35, metalness: 0.2, transparent: true, opacity: 1, ...opts
  });
}

function makeParts(defs) {
  return defs.map(d => ({ objects: [], explode: new THREE.Vector3(), ...d }));
}

function add(group, part, obj) {
  obj.userData.partId = part.id;
  obj.traverse(o => { o.userData.partId = part.id; });
  part.objects.push(obj);
  group.add(obj);
  return obj;
}

function points(count, fn, color, size = 0.05) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) { fn(v, i); v.toArray(pos, i * 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(g, m);
}

function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

function arrow(color, len = 1.6, radius = 0.04) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len * 0.8, 16), glow(color, 0.9));
  shaft.position.y = len * 0.4;
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, len * 0.2, 20), glow(color, 0.9));
  head.position.y = len * 0.9;
  g.add(shaft, head);
  return g;
}

function ring(r, color, tube = 0.012, op = 0.6) {
  const m = glow(color, 0.8, { opacity: op });
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 160), m);
}

/* ───────────────────────── 1. Атом ───────────────────────── */
function atomScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'nucleus', label: [0, 0.75, 0], name: 'Ядро', system: 'Ядро', color: C.gold, desc: 'Плотный центр атома из нуклонов. Размер ~10⁻¹⁵ м — в 100 000 раз меньше атома, но в нём 99,9% массы.' },
    { id: 'protons', label: [-0.95, 0.35, 0], name: 'Протоны', system: 'Ядро', color: C.red, desc: 'Положительно заряженные нуклоны, состоят из трёх кварков (uud). Их число задаёт химический элемент.' },
    { id: 'neutrons', label: [0.95, -0.15, 0], name: 'Нейтроны', system: 'Ядро', color: C.blue, desc: 'Нейтральные нуклоны (udd). Удерживаются сильным взаимодействием и определяют изотоп.' },
    { id: 'cloud', label: [0, 1.45, 0], name: '1s-орбиталь', system: 'Электронная оболочка', color: C.cyan, desc: 'Сферическое облако вероятности ближайшего к ядру электрона. Точки показывают, где его вероятнее всего обнаружить.' },
    { id: 'porbital', label: [0, 2.5, 0], name: '2p-орбитали', system: 'Электронная оболочка', color: C.violet, desc: 'Три гантелеобразные орбитали вдоль осей x, y, z. Форма — следствие решения уравнения Шрёдингера с l = 1.' },
    { id: 'levels', label: [2.7, 0.15, 0], name: 'Уровни энергии', system: 'Электронная оболочка', color: C.white, desc: 'Модель Бора: разрешены только дискретные энергии Eₙ = −13,6 эВ / n². Между ними электрон «прыгает».' },
    { id: 'electrons', label: [0, 0.25, 1.9], name: 'Электроны', system: 'Электронная оболочка', color: C.green, desc: 'Лёгкие отрицательные частицы со спином ½. Здесь они показаны в классической (боровской) картине.' },
    { id: 'photon', name: 'Фотон', system: 'Излучение', color: C.pink, desc: 'Квант света, испускаемый при переходе электрона вниз: E = hν = E₂ − E₁.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));

  // ядро
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 32), glow(C.gold, 0.25, { opacity: 0.25, depthWrite: false }));
  add(group, P.nucleus, core);
  const nucleons = [];
  for (let i = 0; i < 14; i++) {
    const isP = i % 2 === 0;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 24), glow(isP ? C.red : C.blue, 0.5));
    const dir = new THREE.Vector3(gauss(), gauss(), gauss()).normalize().multiplyScalar(0.18 + Math.random() * 0.12);
    m.position.copy(dir);
    m.userData.home = dir.clone();
    add(group, isP ? P.protons : P.neutrons, m);
    nucleons.push(m);
  }
  P.protons.explode.set(-0.8, 0.4, 0);
  P.neutrons.explode.set(0.8, -0.4, 0);

  // 1s облако
  const cloud = points(2600, v => { const r = -Math.log(Math.random()) * 0.55 + 0.25; v.set(gauss(), gauss(), gauss()).normalize().multiplyScalar(r); }, C.cyan, 0.035);
  add(group, P.cloud, cloud);
  P.cloud.explode.set(0, 1.2, 0);

  // 2p орбитали — гантели
  const pGroup = new THREE.Group();
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  axes.forEach((ax, k) => {
    const pts = points(1400, v => {
      const s = Math.random() < 0.5 ? 1 : -1;
      const t = 0.5 + Math.abs(gauss()) * 1.2;
      const spread = 0.35 * Math.sin(Math.min(t, 2.2) / 2.2 * Math.PI);
      v.set(gauss() * spread, gauss() * spread, gauss() * spread).add(ax.clone().multiplyScalar(s * (0.35 + t)));
    }, [C.violet, C.pink, C.blue][k], 0.03);
    pts.material.opacity = 0.55;
    pGroup.add(pts);
  });
  add(group, P.porbital, pGroup);
  P.porbital.explode.set(0, -1.2, 0);

  // уровни Бора
  const lv = new THREE.Group();
  [1.1, 1.9, 2.7].forEach((r, i) => { const rr = ring(r, C.white, 0.008, 0.35 - i * 0.07); rr.rotation.x = Math.PI / 2; lv.add(rr); });
  add(group, P.levels, lv);

  // электроны
  const electrons = [];
  [[1.1, 0.0, 1.6], [1.9, 1.0, 1.1], [1.9, 2.2, -1.1], [2.7, 0.6, 0.8]].forEach(([r, ph, sp]) => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), glow(C.green, 1.4));
    e.userData = { r, ph, sp };
    add(group, P.electrons, e);
    electrons.push(e);
  });

  // фотон — волнистая линия, бегущая наружу
  const photonGeo = new THREE.BufferGeometry();
  const N = 120; const pp = new Float32Array(N * 3);
  photonGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const photon = new THREE.Line(photonGeo, new THREE.LineBasicMaterial({ color: C.pink, transparent: true }));
  const photonHead = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), glow(C.pink, 1.6));
  const ph = new THREE.Group(); ph.add(photon, photonHead);
  add(group, P.photon, ph);
  P.photon.explode.set(1, 1, 0);

  function update(t) {
    nucleons.forEach((n, i) => n.position.copy(n.userData.home).multiplyScalar(1 + 0.04 * Math.sin(t * 3 + i)));
    electrons.forEach(e => { const { r, ph: p, sp } = e.userData; const a = t * sp + p; e.position.set(Math.cos(a) * r, 0, Math.sin(a) * r); });
    cloud.rotation.y = t * 0.05;
    pGroup.rotation.y = -t * 0.08;
    const cyc = (t * 0.45) % 1;
    const start = 1.9, end = 6.5, head = start + (end - start) * cyc;
    for (let i = 0; i < N; i++) {
      const x = head - i * 0.03;
      const amp = x > start ? 0.12 : 0;
      pp[i * 3] = Math.max(x, start); pp[i * 3 + 1] = 0.6 + Math.sin(x * 14) * amp; pp[i * 3 + 2] = 0.6;
    }
    photonGeo.attributes.position.needsUpdate = true;
    photonHead.position.set(head, 0.6 + Math.sin(head * 14) * 0.12, 0.6);
    photon.material.opacity = photonHead.material.opacity = 1 - cyc * 0.8;
  }
  return { group, parts, update };
}

/* ─────────────────────── 2. Две щели ─────────────────────── */
function slitScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'source', name: 'Источник электронов', system: 'Установка', color: C.green, desc: 'Электронная пушка испускает частицы по одной — так, чтобы они не мешали друг другу.' },
    { id: 'wave', name: 'Волновая функция', system: 'Квантовое описание', color: C.cyan, desc: 'Волна вероятности ψ распространяется от источника. Её длина λ = h/p зависит от импульса электрона.' },
    { id: 'slits', name: 'Преграда с двумя щелями', system: 'Установка', color: C.violet, desc: 'Две узкие щели на расстоянии d. За ними волна разделяется на две когерентные волны.' },
    { id: 'interfere', name: 'Зона интерференции', system: 'Квантовое описание', color: C.blue, desc: 'Волны из двух щелей складываются: где гребни совпадают — усиление, где гребень встречает впадину — гашение.' },
    { id: 'pattern', name: 'Экран и полосы', system: 'Результат', color: C.pink, desc: 'Попадания электронов собираются в чередующиеся полосы. Это интерференционная картина — подпись волновой природы.' },
    { id: 'detector', name: 'Детектор «какая щель»', system: 'Установка', color: C.gold, desc: 'Если поставить детектор у щелей и узнать путь электрона, интерференция исчезает: измерение разрушает суперпозицию.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));

  const gun = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.36, 1, 32), glow(0x1b2a4a, 0.1, { metalness: 0.8 }));
  body.rotation.z = Math.PI / 2;
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), glow(C.green, 1.5));
  tip.position.x = 0.55;
  gun.add(body, tip); gun.position.x = -4.2;
  add(group, P.source, gun);
  P.source.explode.set(-1, 0, 0);

  // волны до щелей
  const waves = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 6, 64, Math.PI * 0.6), glow(C.cyan, 1, { opacity: 0.6 }));
    w.rotation.y = Math.PI / 2; w.rotation.x = 0; w.rotation.z = -Math.PI * 0.3;
    w.rotation.set(0, 0, -Math.PI * 0.3);
    waves.add(w);
  }
  add(group, P.wave, waves);

  // преграда
  const wall = new THREE.Group();
  const wm = glow(C.violet, 0.25, { metalness: 0.6 });
  const segs = [[1.7, 1.25], [0.5, 0], [1.7, -1.25]];
  segs.forEach(([h, y]) => { const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, h, 2.6), wm); m.position.y = y; wall.add(m); });
  [0.35, -0.35].forEach(y => { const e = ring(0.12, C.violet, 0.01, 0.9); e.rotation.y = Math.PI / 2; e.position.y = y; e.scale.set(0.6, 0.6, 1); wall.add(e); });
  wall.position.x = -1;
  add(group, P.slits, wall);
  P.slits.explode.set(0, 1.4, 0);

  // интерференция — две системы концентрических волн
  const inter = new THREE.Group();
  [0.35, -0.35].forEach(y => {
    for (let i = 0; i < 7; i++) {
      const w = new THREE.Mesh(new THREE.TorusGeometry(1, 0.01, 6, 80, Math.PI * 0.9), glow(C.blue, 1, { opacity: 0.45 }));
      w.rotation.z = -Math.PI * 0.45; w.position.set(-1, y, 0);
      w.userData.k = i; inter.add(w);
    }
  });
  add(group, P.interfere, inter);

  // экран c текстурой интерференции
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 512;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = '#050816'; ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshStandardMaterial({ map: tex, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 1, side: THREE.DoubleSide, transparent: true }));
  screen.rotation.y = -Math.PI / 2; screen.position.x = 3;
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.06, 4.1, 4.1), glow(C.pink, 0.15, { opacity: 0.4 }));
  frame.position.x = 3.05;
  const scr = new THREE.Group(); scr.add(screen, frame);
  add(group, P.pattern, scr);
  P.pattern.explode.set(1.2, 0, 0);

  const det = new THREE.Group();
  const lens = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 12, 32), glow(C.gold, 0.6));
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 16), glow(C.gold, 1.2));
  det.add(lens, eye); det.position.set(-1.2, 1.4, 1.2); lens.rotation.y = 0.6;
  add(group, P.detector, det);
  P.detector.explode.set(0, 1, 1);

  // накопление попаданий
  function hit() {
    let y;
    for (;;) { y = (Math.random() - 0.5) * 2; const I = Math.pow(Math.cos(y * 9), 2) * Math.exp(-y * y * 2.2); if (Math.random() < I) break; }
    const px = 256 + y * 230, py = Math.random() * 512;
    ctx.fillStyle = `hsla(${300 + Math.random() * 40},100%,70%,0.9)`;
    ctx.beginPath(); ctx.arc(px, py, 1.6, 0, Math.PI * 2); ctx.fill();
  }
  let acc = 0;
  function update(t, dt) {
    waves.children.forEach((w, i) => {
      const s = ((t * 0.6 + i / 6) % 1) * 3 + 0.2; w.scale.setScalar(s); w.position.x = -3.7; w.material.opacity = 0.7 * (1 - s / 3.2);
    });
    inter.children.forEach(w => { const s = ((t * 0.5 + w.userData.k / 7) % 1) * 4 + 0.1; w.scale.setScalar(s); w.material.opacity = 0.5 * (1 - s / 4.2); });
    acc += dt * 260;
    while (acc > 1) { hit(); acc--; }
    if (t % 18 < dt) { ctx.fillStyle = '#050816'; ctx.fillRect(0, 0, 512, 512); }
    tex.needsUpdate = true;
    eye.scale.setScalar(1 + Math.sin(t * 4) * 0.15);
  }
  return { group, parts, update };
}

/* ─────────────────────── 3. Сфера Блоха ─────────────────────── */
function blochScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'sphere', label: [-1.6, 1.7, 0], name: 'Сфера Блоха', system: 'Пространство состояний', color: C.blue, desc: 'Геометрическое представление всех чистых состояний одного кубита. Радиус = 1.' },
    { id: 'zero', label: [0.5, 2.25, 0], name: 'Состояние |0⟩', system: 'Базис', color: C.cyan, desc: 'Северный полюс. Классический «ноль»: измерение всегда даст 0.' },
    { id: 'one', label: [0, -2.45, 0], name: 'Состояние |1⟩', system: 'Базис', color: C.pink, desc: 'Южный полюс. Классическая «единица».' },
    { id: 'vector', name: 'Вектор состояния |ψ⟩', system: 'Кубит', color: C.gold, desc: '|ψ⟩ = cos(θ/2)|0⟩ + e^{iφ} sin(θ/2)|1⟩. Угол θ задаёт вероятности, φ — относительную фазу.' },
    { id: 'equator', label: [2.05, 0.2, 0], name: 'Экватор · фаза φ', system: 'Пространство состояний', color: C.violet, desc: 'Равновероятные суперпозиции |+⟩, |−⟩, |+i⟩, |−i⟩. Отличаются только фазой.' },
    { id: 'axis', label: [-2.9, 0.15, 0], name: 'Ось измерения Z', system: 'Измерение', color: C.white, desc: 'Измерение проецирует состояние на ось: вероятность 0 равна cos²(θ/2). После измерения вектор «прыгает» к полюсу.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));
  const R = 2;

  const sph = new THREE.Group();
  sph.add(new THREE.Mesh(new THREE.SphereGeometry(R, 64, 64), glow(C.blue, 0.15, { opacity: 0.12, depthWrite: false, side: THREE.DoubleSide })));
  const wf = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(R, 24, 16)), new THREE.LineBasicMaterial({ color: C.blue, transparent: true, opacity: 0.12 }));
  sph.add(wf);
  [0, Math.PI / 2].forEach(r => { const m = ring(R, C.blue, 0.006, 0.4); m.rotation.y = r; sph.add(m); });
  add(group, P.sphere, sph);

  const zero = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), glow(C.cyan, 1.4)); zero.position.y = R;
  add(group, P.zero, zero); P.zero.explode.set(0, 1, 0);
  const one = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 24), glow(C.pink, 1.4)); one.position.y = -R;
  add(group, P.one, one); P.one.explode.set(0, -1, 0);

  const eq = ring(R, C.violet, 0.02, 0.9); eq.rotation.x = Math.PI / 2;
  const eqG = new THREE.Group(); eqG.add(eq);
  [[R, 0, 0], [-R, 0, 0], [0, 0, R], [0, 0, -R]].forEach(p => { const d = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 16), glow(C.violet, 1.2)); d.position.set(...p); eqG.add(d); });
  add(group, P.equator, eqG);

  const axisG = new THREE.Group();
  const ax = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, R * 2.8, 8), glow(C.white, 0.6, { opacity: 0.6 }));
  axisG.add(ax);
  const axX = ax.clone(); axX.rotation.z = Math.PI / 2; axX.material = glow(C.white, 0.3, { opacity: 0.25 }); axisG.add(axX);
  const axY = ax.clone(); axY.rotation.x = Math.PI / 2; axY.material = axX.material; axisG.add(axY);
  add(group, P.axis, axisG);

  const vec = arrow(C.gold, R, 0.035);
  const trail = points(400, v => v.set(0, 0, 0), C.gold, 0.04);
  const vg = new THREE.Group(); vg.add(vec, trail);
  add(group, P.vector, vg);
  const proj = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 12), glow(C.gold, 1));
  vg.add(proj);
  let ti = 0;
  function update(t) {
    const th = Math.PI * (0.5 + 0.38 * Math.sin(t * 0.37));
    const phi = t * 0.8;
    const dir = new THREE.Vector3(Math.sin(th) * Math.cos(phi), Math.cos(th), Math.sin(th) * Math.sin(phi));
    vec.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    const pa = trail.geometry.attributes.position;
    pa.setXYZ(ti % 400, dir.x * R, dir.y * R, dir.z * R); pa.needsUpdate = true; ti++;
    proj.position.set(0, dir.y * R, 0);
    zero.material.emissiveIntensity = 0.4 + 1.6 * Math.cos(th / 2) ** 2;
    one.material.emissiveIntensity = 0.4 + 1.6 * Math.sin(th / 2) ** 2;
  }
  return { group, parts, update };
}

/* ─────────────────────── 4. Запутанность ─────────────────────── */
function entangleScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'pairSource', label: [0, -0.7, 0], name: 'Источник пар', system: 'Установка', color: C.gold, desc: 'Нелинейный кристалл (SPDC) превращает один фотон накачки в пару запутанных фотонов.' },
    { id: 'particleA', name: 'Частица A', system: 'Запутанная пара', color: C.cyan, desc: 'Первая частица пары. Отдельно у неё нет определённого состояния — только у пары целиком.' },
    { id: 'particleB', name: 'Частица B', system: 'Запутанная пара', color: C.pink, desc: 'Вторая частица. Её результат всегда скоррелирован с результатом A.' },
    { id: 'spinA', label: [-2.4, 1.55, 0], name: 'Спин A', system: 'Запутанная пара', color: C.cyan, desc: 'До измерения спин «вращается» во всех направлениях сразу — это суперпозиция.' },
    { id: 'spinB', label: [2.4, 1.55, 0], name: 'Спин B', system: 'Запутанная пара', color: C.pink, desc: 'Спин B всегда противоположен спину A при измерении вдоль одной оси (синглетное состояние).' },
    { id: 'link', label: [0, 0.75, 0], name: 'Квантовая связь', system: 'Корреляция', color: C.violet, desc: 'Не сигнал и не нить — общая волновая функция. Передать информацию быстрее света через неё нельзя.' },
    { id: 'detectors', label: [4.4, 1.15, 0], name: 'Детекторы Алисы и Боба', system: 'Установка', color: C.white, desc: 'Измеряют спин вдоль выбранных осей. Статистика совпадений нарушает неравенство Белла.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));

  const src = new THREE.Mesh(new THREE.OctahedronGeometry(0.35), glow(C.gold, 0.8, { flatShading: true }));
  add(group, P.pairSource, src); P.pairSource.explode.set(0, -1.2, 0);

  const mkP = (color) => { const g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 32), glow(color, 0.9))); const halo = new THREE.Mesh(new THREE.SphereGeometry(0.55, 32, 32), glow(color, 0.4, { opacity: 0.15, depthWrite: false })); g.add(halo); return g; };
  const A = mkP(C.cyan), B = mkP(C.pink);
  add(group, P.particleA, A); add(group, P.particleB, B);
  P.particleA.explode.set(-0.6, 0.5, 0); P.particleB.explode.set(0.6, 0.5, 0);

  const sA = arrow(C.cyan, 0.9, 0.03), sB = arrow(C.pink, 0.9, 0.03);
  add(group, P.spinA, sA); add(group, P.spinB, sB);
  P.spinA.explode.set(-0.4, 1, 0); P.spinB.explode.set(0.4, 1, 0);

  // спираль связи
  const N = 400; const lp = new Float32Array(N * 3);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
  const link = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: C.violet, transparent: true, opacity: 0.85 }));
  const lg2 = lg.clone(); const link2 = new THREE.Line(lg2, new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.5 }));
  const lgrp = new THREE.Group(); lgrp.add(link, link2);
  add(group, P.link, lgrp); P.link.explode.set(0, 0.8, 0);

  const dets = new THREE.Group();
  [-4.4, 4.4].forEach(x => {
    const d = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.06, 12, 6), glow(C.white, 0.35, { metalness: 0.7 }));
    frame.rotation.y = Math.PI / 2;
    const magN = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), glow(C.red, 0.5)); magN.position.y = 0.45;
    const magS = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.6), glow(C.blue, 0.5)); magS.position.y = -0.45;
    d.add(frame, magN, magS); d.position.x = x; dets.add(d);
  });
  add(group, P.detectors, dets);

  function update(t) {
    const sep = 1.6 + 1.6 * (0.5 + 0.5 * Math.sin(t * 0.35));
    A.position.set(-sep, 0, 0); B.position.set(sep, 0, 0);
    sA.position.copy(A.position).add(new THREE.Vector3(0, 0.35, 0));
    sB.position.copy(B.position).add(new THREE.Vector3(0, 0.35, 0));
    // спины согласованно вращаются в противофазе
    const d = new THREE.Vector3(Math.sin(t * 1.3), Math.cos(t * 0.9), Math.cos(t * 1.3) * 0.6).normalize();
    sA.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d);
    sB.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().negate());
    sA.position.sub(new THREE.Vector3(0, 0.35, 0)); sB.position.sub(new THREE.Vector3(0, 0.35, 0));
    for (let i = 0; i < N; i++) {
      const u = i / (N - 1); const x = -sep + u * sep * 2;
      const env = Math.sin(u * Math.PI) * 0.35;
      lp[i * 3] = x; lp[i * 3 + 1] = Math.sin(u * 22 - t * 4) * env; lp[i * 3 + 2] = Math.cos(u * 22 - t * 4) * env;
    }
    lg.attributes.position.needsUpdate = true;
    const l2 = lg2.attributes.position.array;
    for (let i = 0; i < N; i++) { l2[i * 3] = lp[i * 3]; l2[i * 3 + 1] = -lp[i * 3 + 1]; l2[i * 3 + 2] = -lp[i * 3 + 2]; }
    lg2.attributes.position.needsUpdate = true;
    src.rotation.y = t; src.rotation.x = t * 0.6;
    src.scale.setScalar(1 + 0.1 * Math.sin(t * 5));
  }
  return { group, parts, update };
}

/* ─────────────────────── 5. Туннелирование ─────────────────────── */
function tunnelScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'packet', label: [-3, 1.3, 0], name: 'Волновой пакет', system: 'Частица', color: C.cyan, desc: 'Частица описывается локализованной волной. Высота поверхности — плотность вероятности |ψ|².' },
    { id: 'barrier', label: [0.6, 1.1, 1.7], name: 'Потенциальный барьер', system: 'Препятствие', color: C.violet, desc: 'Область, где энергия частицы меньше потенциала U. Классически — непреодолимая стена.' },
    { id: 'decay', name: 'Затухание внутри', system: 'Препятствие', color: C.blue, desc: 'Внутри барьера ψ ~ e^(−κx). Чем толще и выше барьер, тем меньше вероятность пройти.' },
    { id: 'transmitted', name: 'Прошедшая волна', system: 'Результат', color: C.green, desc: 'Часть волны появляется за барьером. Это и есть туннелирование: T ≈ e^(−2κd).' },
    { id: 'reflected', name: 'Отражённая волна', system: 'Результат', color: C.pink, desc: 'Большая часть волны отражается назад. Сумма вероятностей R + T = 1.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));

  // поверхность |ψ|² — плоскость с вершинами
  const W = 10, D = 3, SX = 220, SZ = 30;
  const geo = new THREE.PlaneGeometry(W, D, SX, SZ); geo.rotateX(-Math.PI / 2);
  const colors = new Float32Array(geo.attributes.position.count * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const surf = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0x112244, emissiveIntensity: 0.6, roughness: 0.3, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }));
  const wire = new THREE.LineSegments(new THREE.WireframeGeometry(geo), new THREE.LineBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.08 }));
  const wave = new THREE.Group(); wave.add(surf);
  add(group, P.packet, wave);

  const bar = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.6, D + 0.2), glow(C.violet, 0.35, { opacity: 0.35, depthWrite: false }));
  bar.position.y = 0.8;
  const barEdge = new THREE.LineSegments(new THREE.EdgesGeometry(bar.geometry), new THREE.LineBasicMaterial({ color: C.violet }));
  barEdge.position.copy(bar.position);
  const bg = new THREE.Group(); bg.add(bar, barEdge);
  add(group, P.barrier, bg); P.barrier.explode.set(0, 1.5, 0);

  const mkMark = (color, x) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 16), glow(color, 1.2)); m.position.set(x, 2.1, -D / 2 - 0.3); m.rotation.z = Math.PI; return m; };
  const decayM = mkMark(C.blue, 0); add(group, P.decay, decayM);
  const trM = mkMark(C.green, 3); add(group, P.transmitted, trM);
  const rfM = mkMark(C.pink, -3); add(group, P.reflected, rfM);
  group.add(wire);

  const pos = geo.attributes.position;
  const col = new THREE.Color();
  function update(t) {
    const cyc = (t * 0.18) % 1; const x0 = -4.5 + cyc * 9;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const k = 6;
      let amp;
      if (x0 < 0) {
        amp = Math.exp(-((x - x0) ** 2) * 1.4) * (0.5 + 0.5 * Math.cos(k * (x - x0) * 2 - t * 4));
        if (x > -0.25) amp *= Math.exp(-(x + 0.25) * 4);
      } else {
        const r = Math.exp(-((x + x0) ** 2) * 1.4) * 0.75 * (0.5 + 0.5 * Math.cos(k * (x + x0) * 2 + t * 4));
        const tr = Math.exp(-((x - x0) ** 2) * 1.4) * 0.3 * (0.5 + 0.5 * Math.cos(k * (x - x0) * 2 - t * 4));
        amp = (x < -0.25 ? r : 0) + (x > 0.25 ? tr : 0);
        if (Math.abs(x) <= 0.25) amp = 0.25 * Math.exp(-(x + 0.25) * 4) * Math.exp(-((x0 - 0.5) ** 2) * 2);
      }
      amp *= Math.exp(-(z * z) * 0.9);
      pos.setY(i, amp * 1.6);
      col.setHSL(0.52 - amp * 0.35, 1, 0.25 + amp * 0.45);
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true; geo.computeVertexNormals();
    [decayM, trM, rfM].forEach((m, i) => { m.position.y = 2.1 + Math.sin(t * 3 + i) * 0.1; });
  }
  return { group, parts, update };
}

/* ─────────────────── 6. Квантовый компьютер ─────────────────── */
function qpuScene() {
  const group = new THREE.Group();
  const parts = makeParts([
    { id: 'cryostat', label: [1.9, 3.3, 0], name: 'Криостат растворения', system: 'Охлаждение', color: C.gold, desc: '«Люстра» из позолоченных плит. Сверху вниз: 50 K → 4 K → 800 мК → 100 мК → 10 мК.' },
    { id: 'cables', label: [0, 3.75, 0], name: 'Микроволновые линии', system: 'Управление', color: C.cyan, desc: 'Коаксиальные кабели передают импульсы 4–8 ГГц, которыми выполняют квантовые вентили.' },
    { id: 'shield', label: [-1.1, -0.6, 0], name: 'Магнитный экран', system: 'Охлаждение', color: C.blue, desc: 'Защищает кубиты от внешних полей и теплового излучения — главных источников декогеренции.' },
    { id: 'chip', label: [0.75, -1.3, 0.6], name: 'Квантовый процессор', system: 'Вычисления', color: C.violet, desc: 'Сапфировый или кремниевый чип с джозефсоновскими переходами из алюминия.' },
    { id: 'qubits', label: [0.55, -1.0, 0], name: 'Кубиты', system: 'Вычисления', color: C.green, desc: 'Трансмоны — сверхпроводящие «искусственные атомы». Время когерентности — десятки–сотни микросекунд.' },
    { id: 'couplers', label: [-1.15, -1.5, 0], name: 'Связи между кубитами', system: 'Вычисления', color: C.pink, desc: 'Перестраиваемые элементы, которые включают взаимодействие соседних кубитов для двухкубитных вентилей и запутывания.' }
  ]);
  const P = Object.fromEntries(parts.map(p => [p.id, p]));

  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 1, roughness: 0.25, emissive: 0x3a2400, emissiveIntensity: 0.4, transparent: true });
  const cry = new THREE.Group();
  const plates = [[1.7, 3.2], [1.5, 2.2], [1.3, 1.3], [1.1, 0.5], [0.9, -0.25]];
  plates.forEach(([r, y]) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.1, 64), gold); m.position.y = y; cry.add(m); });
  for (let i = 0; i < plates.length - 1; i++) {
    const [r1, y1] = plates[i], [r2, y2] = plates[i + 1];
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2 + Math.PI / 4; const rr = Math.min(r1, r2) * 0.8;
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, y1 - y2, 8), gold);
      rod.position.set(Math.cos(a) * rr, (y1 + y2) / 2, Math.sin(a) * rr); cry.add(rod);
    }
  }
  add(group, P.cryostat, cry);

  const cab = new THREE.Group();
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2; const r0 = 0.55;
    const pts = [];
    for (let j = 0; j <= 20; j++) {
      const u = j / 20; const y = 3.3 - u * 4.0;
      const r = r0 * (1 - u * 0.6) + 0.12 * Math.sin(u * 9 + k);
      pts.push(new THREE.Vector3(Math.cos(a + u * 1.5) * r, y, Math.sin(a + u * 1.5) * r));
    }
    const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.018, 6), glow(C.cyan, 0.7));
    cab.add(tube);
  }
  add(group, P.cables, cab); P.cables.explode.set(1.4, 0, 0);

  const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.1, 48, 1, true), glow(C.blue, 0.3, { opacity: 0.22, side: THREE.DoubleSide, depthWrite: false }));
  shield.position.y = -0.95;
  add(group, P.shield, shield); P.shield.explode.set(-1.6, 0, 0);

  const chipG = new THREE.Group();
  const chip = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.9), new THREE.MeshStandardMaterial({ color: 0x23194a, metalness: 0.5, roughness: 0.2, emissive: C.violet, emissiveIntensity: 0.2, transparent: true }));
  chipG.add(chip); chipG.position.y = -1.3;
  add(group, P.chip, chipG); P.chip.explode.set(0, -1.6, 0);

  const qG = new THREE.Group(); const cG = new THREE.Group();
  const qubits = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const q = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.04, 16), glow(C.green, 1));
    q.position.set(-0.3 + i * 0.2, 0.04, -0.3 + j * 0.2); qG.add(q); qubits.push(q);
    if (i < 3) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.015, 0.02), glow(C.pink, 0.8)); c.position.set(-0.2 + i * 0.2, 0.04, -0.3 + j * 0.2); cG.add(c); }
    if (j < 3) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.14), glow(C.pink, 0.8)); c.position.set(-0.3 + i * 0.2, 0.04, -0.2 + j * 0.2); cG.add(c); }
  }
  qG.position.y = cG.position.y = -1.3;
  add(group, P.qubits, qG); add(group, P.couplers, cG);
  P.qubits.explode.set(0, -2.2, 0.4); P.couplers.explode.set(0, -2.2, -0.4);

  group.position.y = 0.2;
  function update(t) {
    qubits.forEach((q, i) => { q.material.emissiveIntensity = 0.5 + 1.2 * (0.5 + 0.5 * Math.sin(t * 3 + i * 1.7)); });
    cG.children.forEach((c, i) => { c.material.emissiveIntensity = 0.3 + 1.2 * Math.max(0, Math.sin(t * 2 - i * 0.6)); });
    cab.children.forEach((c, i) => { c.material.emissiveIntensity = 0.4 + 0.8 * Math.max(0, Math.sin(t * 4 - i)); });
  }
  return { group, parts, update };
}

export const SCENES = [
  { id: 'atom', name: 'Атом', sub: 'Орбитали и кванты', camera: [6, 4, 9], build: atomScene },
  { id: 'slit', name: 'Две щели', sub: 'Дуализм', camera: [3, 5, 12], build: slitScene },
  { id: 'bloch', name: 'Кубит', sub: 'Сфера Блоха', camera: [5.6, 3.4, 7], build: blochScene },
  { id: 'entangle', name: 'Запутанность', sub: 'Пара ЭПР', camera: [0, 3.4, 12], build: entangleScene },
  { id: 'tunnel', name: 'Туннель', sub: 'Сквозь барьер', camera: [2.5, 6, 9.5], build: tunnelScene },
  { id: 'qpu', name: 'Компьютер', sub: 'Криостат и чип', camera: [6, 3, 8.5], build: qpuScene }
];
