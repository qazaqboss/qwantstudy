// Общие помощники для 3D-сцен атласа. Каждая сцена отдаёт группу, список структур (как в анатомическом атласе)
// и функцию анимации. Структура — набор мешей с общим id, направлением «разнесения» и описанием.
import * as THREE from 'three';
export { THREE };

export const C = {
  cyan: 0x38e8ff, violet: 0x9b6bff, pink: 0xff4fd8, gold: 0xffc857,
  green: 0x4dffb0, red: 0xff5a6b, blue: 0x4f7bff, white: 0xe9f1ff
};

export function glow(color, intensity = 0.6, opts = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: intensity,
    roughness: 0.35, metalness: 0.2, transparent: true, opacity: 1, ...opts
  });
}

export function makeParts(defs) {
  return defs.map(d => ({ objects: [], explode: new THREE.Vector3(), ...d }));
}

export function add(group, part, obj) {
  obj.userData.partId = part.id;
  obj.traverse(o => { o.userData.partId = part.id; });
  part.objects.push(obj);
  group.add(obj);
  return obj;
}

export function points(count, fn, color, size = 0.05) {
  const pos = new Float32Array(count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) { fn(v, i); v.toArray(pos, i * 3); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const m = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending });
  return new THREE.Points(g, m);
}

export function gauss() { return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5; }

export function arrow(color, len = 1.6, radius = 0.04) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len * 0.8, 16), glow(color, 0.9));
  shaft.position.y = len * 0.4;
  const head = new THREE.Mesh(new THREE.ConeGeometry(radius * 3, len * 0.2, 20), glow(color, 0.9));
  head.position.y = len * 0.9;
  g.add(shaft, head);
  return g;
}

export function ring(r, color, tube = 0.012, op = 0.6) {
  const m = glow(color, 0.8, { opacity: op });
  return new THREE.Mesh(new THREE.TorusGeometry(r, tube, 8, 160), m);
}


// Текст на холсте как 3D-спрайт (буквы вентилей, матрицы). Возвращает спрайт с методом draw(lines).
export function textSprite(lines, { w = 512, h = 256, scale = 1, color = '#e9f1ff', bg = 'rgba(6,10,28,0.78)', border = '#38e8ff', font = 'bold 54px JetBrains Mono, monospace' } = {}) {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(scale * w / h, scale, 1);
  sp.draw = (ls) => {
    ctx.clearRect(0, 0, w, h);
    if (bg) { ctx.fillStyle = bg; ctx.strokeStyle = border; ctx.lineWidth = 6; ctx.beginPath(); ctx.roundRect(4, 4, w - 8, h - 8, 28); ctx.fill(); ctx.stroke(); }
    ctx.fillStyle = color; ctx.font = font; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ls.forEach((l, k) => ctx.fillText(l, w / 2, h / 2 + (k - (ls.length - 1) / 2) * (h / (ls.length + 0.6))));
    tex.needsUpdate = true;
  };
  sp.draw(Array.isArray(lines) ? lines : [lines]);
  return sp;
}
