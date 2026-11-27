// Hero WebGL layer: sits between the hero photo and the copy. Transparent canvas, unlit materials so
// the brand colours render exactly. Rings + scan cone are pinned to the drone in hero-bg.webp.
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js';

const hero = document.querySelector('.hero'), photo = document.querySelector('.hero-img');
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = matchMedia('(max-width: 760px)').matches;
const ACC = 0xfa5c19, GREY = 0x8b949e, BG = 0x0d1013;
const DRONE = [0.73, 0.335], PEAK = [0.675, 0.64]; // drone + laser target, as fractions of hero-bg.webp

function start() {
  const canvas = document.createElement('canvas');
  canvas.className = 'hero-gl';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: !small, powerPreference: 'high-performance' }); }
  catch { return; } // no WebGL: the photo-only hero stays as it was
  hero.querySelector('.hero-scene').after(canvas);
  renderer.setPixelRatio(Math.min(devicePixelRatio, small ? 1 : 1.5));
  renderer.setClearColor(0, 0);

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(BG, 12, 38);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 10);
  const add = (geo, mat) => new (mat.isPointsMaterial ? THREE.Points : THREE.LineSegments)(geo, mat);
  const lineMat = (color, opacity) => new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false });

  // Ground: perspective topo grid that the radar pulse runs across.
  const ground = new THREE.Group();
  ground.position.set(0, -3.2, -8);
  const seg = small ? 36 : 60, gGeo = new THREE.PlaneGeometry(60, 40, seg, seg * 2 / 3).rotateX(-Math.PI / 2);
  const p = gGeo.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); p.setY(i, Math.sin(x * .35) * Math.cos(z * .3) * .55 + Math.sin(x * .9 + z * .7) * .18); }
  ground.add(add(gGeo, new THREE.PointsMaterial({ color: GREY, size: .045, transparent: true, opacity: .55, depthWrite: false })));
  const pulse = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(new THREE.EllipseCurve(0, 0, 1, 1).getPoints(128)).rotateX(-Math.PI / 2), lineMat(ACC, 1));
  pulse.position.y = .6;
  ground.add(pulse);
  scene.add(ground);

  // Depth particles: grey dust with a few accent sparks.
  const N = small ? 350 : 900, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  const cg = new THREE.Color(GREY), ca = new THREE.Color(ACC);
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - .5) * 34, (Math.random() - .35) * 16, -Math.random() * 26 + 4], i * 3);
    (Math.random() < .08 ? ca : cg).toArray(col, i * 3);
  }
  const dGeo = new THREE.BufferGeometry();
  dGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  dGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dust = add(dGeo, new THREE.PointsMaterial({ size: small ? .05 : .04, vertexColors: true, transparent: true, opacity: .8, depthWrite: false }));
  scene.add(dust);

  // Target lock on the drone: three tilted rings + a wireframe scan cone pointing at the peak.
  const lock = new THREE.Group(), rings = [];
  [[1, .9, ACC, 6.29], [1.35, .4, 0xffffff, 4.4], [1.7, .3, ACC, 2.2]].forEach(([r, o, c, arc], i) => {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r, r + .018, 128, 1, 0, arc), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, depthWrite: false, side: THREE.DoubleSide }));
    ring.rotation.x = 1.1 + i * .25; rings.push(ring); lock.add(ring);
  });
  const coneMat = lineMat(ACC, .22);
  const cone = add(new THREE.WireframeGeometry(new THREE.ConeGeometry(1, 1, 18, 1, true).translate(0, -.5, 0)), coneMat);
  cone.rotation.order = 'ZYX'; // spin about own axis first, then tilt toward the peak
  lock.add(cone);
  scene.add(lock);

  // Map a point of the (moving) hero photo onto the z=0 plane, so 3D stays locked to the 2D drone.
  const ray = new THREE.Vector3(), out = new THREE.Vector3();
  let objX = .5; // object-position x (mobile CSS crops the photo with object-fit:cover)
  const toWorld = (fx, fy, r, target) => {
    const W = hero.clientWidth, H = hero.clientHeight, hr = hero.getBoundingClientRect();
    const k = Math.max(r.width / photo.naturalWidth, r.height / photo.naturalHeight), dw = photo.naturalWidth * k, dh = photo.naturalHeight * k;
    const px = r.left + (r.width - dw) * objX + fx * dw, py = r.top + (r.height - dh) / 2 + fy * dh;
    ray.set(((px - hr.left) / W) * 2 - 1, -(((py - hr.top) / H) * 2 - 1), .5).unproject(camera).sub(camera.position).normalize();
    return target.copy(camera.position).addScaledVector(ray, -camera.position.z / ray.z);
  };
  const peak = new THREE.Vector3();

  const size = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    objX = parseFloat(getComputedStyle(photo).objectPosition) / 100 || .5;
  };
  size(); addEventListener('resize', size);

  let mx = 0, my = 0, visible = true, raf = 0;
  if (matchMedia('(pointer:fine)').matches) addEventListener('mousemove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; });

  const frame = t => {
    t *= .001;
    const prog = Math.min(scrollY / hero.offsetHeight, 1); // scroll binding: camera pushes in and climbs as the hero leaves
    camera.position.x += (mx * 1.4 - camera.position.x) * .04;
    camera.position.y += (-my * .8 + prog * 1.6 - camera.position.y) * .04;
    camera.position.z = 10 - prog * 3;
    camera.lookAt(0, prog * .8, 0);
    camera.updateMatrixWorld();

    const r = photo.getBoundingClientRect();
    toWorld(DRONE[0], DRONE[1], r, lock.position);
    toWorld(PEAK[0], PEAK[1], r, peak);
    // ring size follows the drone's on-screen size: displayed photo width (px) × world units per px at z=0
    const dw = Math.max(r.width, r.height * photo.naturalWidth / photo.naturalHeight);
    lock.scale.setScalar(dw * 2 * Math.tan(camera.fov * Math.PI / 360) * camera.position.z / hero.clientHeight * .09);
    rings.forEach((ring, i) => { ring.rotation.z = t * (i % 2 ? -.4 : .55); ring.rotation.y = Math.sin(t * .6 + i) * .25; });
    // cone: apex at drone, base at the peak, slowly spinning
    const len = lock.position.distanceTo(peak) / lock.scale.x;
    cone.scale.set(len * .32, len, len * .32);
    cone.rotation.set(0, t * .5, Math.atan2(peak.x - lock.position.x, lock.position.y - peak.y));
    coneMat.opacity = .14 + Math.sin(t * 2.2) * .08;

    const k = (t * .28) % 1; // radar pulse
    pulse.scale.setScalar(.5 + k * 14); pulse.material.opacity = (1 - k) * .55;
    dust.rotation.y = t * .012; dust.position.y = Math.sin(t * .3) * .15;
    ground.position.z = -8 + ((t * .6) % (40 / (seg * 2 / 3))); // grid creeps toward camera, one cell, then loops

    renderer.render(scene, camera);
    if (!still && visible) raf = requestAnimationFrame(frame);
  };

  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible && !still) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
  }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible && !still) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } });
  requestAnimationFrame(t => { frame(t); canvas.classList.add('on'); });
  if (still) addEventListener('resize', () => requestAnimationFrame(frame)); // reduced motion: static frames only
}

// Wait for the hero photo / first paint so WebGL setup never competes with the LCP image.
if (hero && photo) document.readyState === 'complete' ? start() : addEventListener('load', start, { once: true });
