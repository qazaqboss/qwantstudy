// 3D-просмотрщик атласа: рендер, свет, свечение, выбор структур, разнесение, «рентген», подписи.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { SCENES } from './scenes.js';

const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export class Viewer extends EventTarget {
  constructor(container) {
    super();
    this.container = container;
    this.state = { explode: 0, xray: false, wire: false, labels: true, autoRotate: true, speed: 1 };
    this.selected = null;
    this.hidden = new Set();

    const r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(r.domElement);

    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    container.appendChild(this.labelRenderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x040713, 0.035);
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.05, 200);
    this.camera.position.set(5, 3, 7);

    this.controls = new OrbitControls(this.camera, r.domElement);
    Object.assign(this.controls, { enableDamping: true, dampingFactor: 0.07, minDistance: 1.5, maxDistance: 25, autoRotate: true, autoRotateSpeed: 0.6 });

    this.scene.add(new THREE.HemisphereLight(0x8fb8ff, 0x1a0b2e, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.6); key.position.set(5, 8, 6); this.scene.add(key);
    const rim = new THREE.PointLight(0x9b6bff, 30, 30); rim.position.set(-6, 2, -5); this.scene.add(rim);
    this.addBackdrop();

    this.composer = new EffectComposer(r);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.85, 0.6, 0.15);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 0.08;
    this.raycaster.params.Line.threshold = 0.06;
    this.pointer = new THREE.Vector2();
    this.bindPointer();

    this.clock = new THREE.Clock();
    this.time = 0;
    this.tween = null;
    this.current = null;

    new ResizeObserver(() => this.resize()).observe(container);
    this.resize();
    this.loop = this.loop.bind(this);
    this.visible = true;
    new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }).observe(container);
    requestAnimationFrame(this.loop);
  }

  addBackdrop() {
    const n = 1500; const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(30 + Math.random() * 40);
      v.toArray(pos, i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(g, new THREE.PointsMaterial({ color: 0x9fc4ff, size: 0.12, transparent: true, opacity: 0.7, fog: false }));
    this.scene.add(this.stars);
    const grid = new THREE.PolarGridHelper(9, 12, 10, 96, 0x223366, 0x15203f);
    grid.position.y = -2.6; grid.material.transparent = true; grid.material.opacity = 0.35;
    this.scene.add(grid);
  }

  resize() {
    const w = this.container.clientWidth, h = this.container.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h);
    this.labelRenderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  /* ───────── сцены ───────── */
  load(id, { instant = false } = {}) {
    if (this.current?.id === id) return this.current;
    const def = SCENES.find(s => s.id === id);
    if (!def) return;
    if (this.current) {
      this.scene.remove(this.current.root);
      this.current.labels.forEach(l => l.element.remove());
      this.current.root.traverse(o => { o.geometry?.dispose(); });
    }
    const built = def.build();
    const root = built.group;
    // каждая структура — в своей обёртке, чтобы разнесение не мешало анимации
    built.parts.forEach(p => {
      p.wrapper = new THREE.Group();
      p.wrapper.userData.partId = p.id;
      p.objects.forEach(o => { root.remove(o); p.wrapper.add(o); });
      root.add(p.wrapper);
      p.wrapper.traverse(o => {
        if (!o.material) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => { m.userData.base = { opacity: m.opacity ?? 1, emissive: m.emissiveIntensity ?? 0 }; m.transparent = true; });
      });
    });
    built.update(0, 0);
    root.updateMatrixWorld(true);
    const labels = built.parts.map(p => {
      const el = document.createElement('button');
      el.className = 'part-label';
      el.innerHTML = `<i style="--c:#${p.color.toString(16).padStart(6, '0')}"></i>${p.name}`;
      el.addEventListener('click', e => { e.stopPropagation(); this.select(p.id); });
      const box = new THREE.Box3().setFromObject(p.wrapper);
      const c = box.getCenter(new THREE.Vector3());
      const lab = new CSS2DObject(el);
      if (p.label) lab.position.set(...p.label); else { lab.position.copy(c); lab.position.y = box.max.y + 0.15; }
      p.home = c; p.size = box.getSize(new THREE.Vector3()).length() || 1;
      p.wrapper.add(lab);
      lab.position.sub(p.wrapper.position);
      return lab;
    });
    this.current = { id, def, root, parts: built.parts, update: built.update, labels };
    this.scene.add(root);
    this.hidden.clear();
    this.selected = null;
    root.scale.setScalar(0.001);
    this.intro = 0;
    this.applyLook();
    this.flyTo(new THREE.Vector3(...def.camera), new THREE.Vector3(0, 0, 0), instant ? 0 : 1.4);
    this.dispatchEvent(new CustomEvent('scene', { detail: this.current }));
    return this.current;
  }

  part(id) { return this.current?.parts.find(p => p.id === id); }

  /* ───────── выбор ───────── */
  select(id, { focus = true } = {}) {
    const p = id ? this.part(id) : null;
    this.selected = p ? p.id : null;
    this.applyLook();
    if (p && focus) this.focusPart(p);
    this.dispatchEvent(new CustomEvent('select', { detail: p }));
  }

  focusPart(p) {
    const center = new THREE.Box3().setFromObject(p.wrapper).getCenter(new THREE.Vector3());
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    const dist = THREE.MathUtils.clamp(p.size * 1.6, 3, 9);
    this.flyTo(center.clone().add(dir.multiplyScalar(dist)), center, 1.1);
  }

  reset() {
    this.select(null, { focus: false });
    this.setState({ explode: 0 });
    const def = this.current.def;
    this.flyTo(new THREE.Vector3(...def.camera), new THREE.Vector3(), 1.1);
  }

  toggleHidden(id) {
    this.hidden.has(id) ? this.hidden.delete(id) : this.hidden.add(id);
    this.applyLook();
    return !this.hidden.has(id);
  }

  isolate(id) {
    this.hidden = new Set(this.current.parts.filter(p => p.id !== id).map(p => p.id));
    this.applyLook();
  }
  showAll() { this.hidden.clear(); this.applyLook(); }

  setState(patch) {
    Object.assign(this.state, patch);
    this.controls.autoRotate = this.state.autoRotate;
    this.applyLook();
    this.dispatchEvent(new CustomEvent('state', { detail: this.state }));
  }

  applyLook() {
    if (!this.current) return;
    const { xray, wire, labels } = this.state;
    this.current.parts.forEach((p, i) => {
      const isSel = this.selected === p.id;
      const dim = this.selected && !isSel;
      p.wrapper.visible = !this.hidden.has(p.id);
      p.wrapper.traverse(o => {
        if (o.isCSS2DObject) { o.visible = labels && p.wrapper.visible; o.element.classList.toggle('on', isSel); o.element.classList.toggle('dim', !!dim); return; }
        if (!o.material) return;
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        ms.forEach(m => {
          const b = m.userData.base; if (!b) return;
          let op = b.opacity;
          if (xray) op *= 0.28;
          if (dim) op *= 0.18;
          if (isSel) op = Math.max(op, Math.min(1, b.opacity * 1.0));
          m.opacity = op;
          m.depthWrite = !xray && !dim && b.opacity > 0.9;
          if ('emissiveIntensity' in m) m.emissiveIntensity = b.emissive * (isSel ? 1.7 : dim ? 0.4 : 1) + (xray ? 0.3 : 0);
          if ('wireframe' in m && o.isMesh) m.wireframe = wire;
        });
      });
    });
  }

  /* ───────── камера ───────── */
  flyTo(pos, target, dur = 1.2) {
    if (!dur) { this.camera.position.copy(pos); this.controls.target.copy(target); return; }
    this.tween = { t: 0, dur, p0: this.camera.position.clone(), p1: pos, t0: this.controls.target.clone(), t1: target };
  }
  zoom(f) {
    const d = this.camera.position.clone().sub(this.controls.target).multiplyScalar(f);
    if (d.length() < 1.5 || d.length() > 25) return;
    this.flyTo(this.controls.target.clone().add(d), this.controls.target.clone(), 0.4);
  }
  orbit(dx, dy) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    s.theta += dx; s.phi = THREE.MathUtils.clamp(s.phi + dy, 0.15, Math.PI - 0.15);
    this.flyTo(this.controls.target.clone().add(new THREE.Vector3().setFromSpherical(s)), this.controls.target.clone(), 0.4);
  }

  /* ───────── указатель ───────── */
  bindPointer() {
    const el = this.renderer.domElement;
    let down = null;
    el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; this.dispatchEvent(new Event('interact')); });
    el.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 5) return;
      const hit = this.pick(e);
      this.select(hit);
    });
    let last = 0;
    el.addEventListener('pointermove', e => {
      const now = performance.now(); if (now - last < 60) return; last = now;
      const hit = this.pick(e);
      el.style.cursor = hit ? 'pointer' : 'grab';
      if (hit !== this.hover) { this.hover = hit; this.dispatchEvent(new CustomEvent('hover', { detail: { part: hit ? this.part(hit) : null, x: e.clientX, y: e.clientY } })); }
      else if (hit) this.dispatchEvent(new CustomEvent('hover', { detail: { part: this.part(hit), x: e.clientX, y: e.clientY } }));
    });
    el.addEventListener('pointerleave', () => { this.hover = null; this.dispatchEvent(new CustomEvent('hover', { detail: { part: null } })); });
  }

  pick(e) {
    if (!this.current) return null;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const targets = this.current.parts.filter(p => p.wrapper.visible).map(p => p.wrapper);
    const hits = this.raycaster.intersectObjects(targets, true);
    // приоритет — мешам, потом точкам и линиям
    const mesh = hits.find(h => h.object.isMesh && h.object.material.opacity > 0.1);
    const h = mesh || hits[0];
    return h ? h.object.userData.partId : null;
  }

  /* ───────── цикл ───────── */
  loop() {
    requestAnimationFrame(this.loop);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    if (!this.visible) return;
    this.time += dt * this.state.speed;
    if (this.tween) {
      const tw = this.tween; tw.t += dt / tw.dur; const k = ease(Math.min(tw.t, 1));
      this.camera.position.lerpVectors(tw.p0, tw.p1, k);
      this.controls.target.lerpVectors(tw.t0, tw.t1, k);
      if (tw.t >= 1) this.tween = null;
    }
    if (this.current) {
      if (this.intro < 1) { this.intro = Math.min(1, this.intro + dt * 1.3); this.current.root.scale.setScalar(ease(this.intro)); }
      this.current.update(this.time, dt * this.state.speed);
      const ex = this.state.explode;
      this.current.parts.forEach(p => {
        const target = p.explode.clone().multiplyScalar(ex * 1.6);
        p.wrapper.position.lerp(target, 0.12);
      });
    }
    this.stars.rotation.y += dt * 0.005;
    this.controls.update();
    this.composer.render();
    this.labelRenderer.render(this.scene, this.camera);
  }

  snapshot() {
    this.composer.render();
    return this.renderer.domElement.toDataURL('image/png');
  }
}
