// Фон первого экрана: «квантовое облако» из частиц с орбитами и реакцией на мышь.
import * as THREE from 'three';

export function initHero(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 9);

  const N = 9000;
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N);
  const c = new THREE.Color();
  for (let i = 0; i < N; i++) {
    const k = i % 3; // три «орбитали»
    const v = new THREE.Vector3();
    if (k === 0) { v.randomDirection().multiplyScalar(0.4 + Math.pow(Math.random(), 2) * 1.6); }
    else {
      const ax = k === 1 ? new THREE.Vector3(1, 0.3, 0).normalize() : new THREE.Vector3(-0.4, 1, 0.3).normalize();
      const s = Math.random() < 0.5 ? 1 : -1; const t = 0.4 + Math.random() * 2.6;
      const spread = 0.65 * Math.sin(Math.min(t, 3) / 3 * Math.PI);
      v.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread).add(ax.multiplyScalar(s * t));
    }
    v.toArray(pos, i * 3);
    c.setHSL([0.52, 0.75, 0.85][k] + Math.random() * 0.05, 1, 0.6);
    c.toArray(col, i * 3);
    seed[i] = Math.random() * 6.28;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() } },
    vertexShader: `attribute float seed; uniform float uTime; uniform float uPx; varying vec3 vC; varying float vA;
      void main(){ vec3 p = position; float w = sin(uTime*1.2 + seed)*0.06; p += normalize(p+0.001)*w;
        vec4 mv = modelViewMatrix*vec4(p,1.); gl_Position = projectionMatrix*mv;
        gl_PointSize = (2.2 + sin(uTime*2.+seed)*1.2) * uPx * (8. / -mv.z); vC = color; vA = 0.55 + 0.45*sin(uTime+seed); }`,
    fragmentShader: `varying vec3 vC; varying float vA; void main(){ float d = length(gl_PointCoord-0.5); if(d>0.5) discard; gl_FragColor = vec4(vC, (1.-d*2.)*vA); }`
  });
  const cloud = new THREE.Points(g, mat);
  scene.add(cloud);

  const rings = new THREE.Group();
  [[3.2, 0.3, 0x38e8ff], [3.8, -0.9, 0x9b6bff], [4.4, 1.2, 0xff4fd8]].forEach(([r, tilt, color]) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, 0.006, 6, 200), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    m.rotation.set(Math.PI / 2 + tilt, tilt * 0.6, 0);
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), new THREE.MeshBasicMaterial({ color }));
    m.add(e); m.userData = { e, r, sp: 0.4 + Math.random() * 0.4 };
    rings.add(m);
  });
  scene.add(rings);

  const mouse = new THREE.Vector2();
  window.addEventListener('pointermove', e => { mouse.set(e.clientX / innerWidth - 0.5, e.clientY / innerHeight - 0.5); });

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    cloud.position.x = rings.position.x = w > 900 ? 2.6 : 0;
  }
  new ResizeObserver(resize).observe(canvas); resize();

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);
  const clock = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    const t = clock.getElapsedTime();
    mat.uniforms.uTime.value = t;
    cloud.rotation.y = t * 0.08 + mouse.x * 0.6;
    cloud.rotation.x = mouse.y * 0.4;
    rings.rotation.y = cloud.rotation.y * 0.5; rings.rotation.x = cloud.rotation.x;
    rings.children.forEach(m => { const { e, r, sp } = m.userData; const a = t * sp; e.position.set(Math.cos(a) * r, Math.sin(a) * r, 0); });
    renderer.render(scene, camera);
  })();
}
