import * as T from './vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { buildNeighborhood } from './neighborhood.js';
import { createResidents } from './interactions.js';
import { projects } from './projects.js';
import { getHeadCorners, projectHead, placeHotspot } from './hotspot-layout.js';

// Rendering is demand-driven: animate camera transitions and short idle moments,
// then stop. There is no permanent 60fps loop, bloom pass, shadow map or physics.
export async function createScene(host, { onSelect, onSlow, onPanelRect }) {
  let mobile = matchMedia('(max-width:700px)').matches;
  const renderer = new T.WebGLRenderer({ antialias: !mobile, powerPreference: 'low-power', alpha: false });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0x111b2e);
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x111b2e, 24, 65);
  const camera = new T.PerspectiveCamera(36, 1, .1, 100);
  const hemi = new T.HemisphereLight(0xbad5ed, 0x5b4057, 1.3); scene.add(hemi);
  const key = new T.DirectionalLight(0xffd2a1, 1.65); key.position.set(-3, 8, 5); scene.add(key);
  const fill = new T.DirectionalLight(0x8faedf, .65); fill.position.set(7, 4, -3); scene.add(fill);
  function makeLabel(lines, { background = '#1b3338', color = '#dfe3c5', size = 55 } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = lines.length > 1 ? 256 : 128;
    const context = canvas.getContext('2d');
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = color; context.textAlign = 'center'; context.textBaseline = 'middle';
    context.font = '600 ' + size + 'px monospace';
    lines.forEach((line, i) => context.fillText(line, 256, canvas.height * (i + .5) / lines.length, 460));
    const texture = new T.CanvasTexture(canvas); texture.colorSpace = T.SRGBColorSpace;
    texture.minFilter = T.LinearFilter; texture.generateMipmaps = false; return texture;
  }
  const initialScreen = makeLabel(['PROJECT ARCHIVE', 'SAVAGE 愛 / ' + projects.length + ' PROJECTS'], { size: 38 });
  const world = buildWorld(makeLabel, initialScreen);
  scene.add(world.root);
  scene.add(buildNeighborhood());
  world.root.traverse(item => { item.updateMatrix(); item.matrixAutoUpdate = false; });
  world.lanterns.forEach(item => { item.matrixAutoUpdate = true; });
  world.animatables.forEach(item => { item.matrixAutoUpdate = true; });
  const residents = createResidents(world);

  // City silhouettes and lit windows are batched, with a deterministic layout.
  let randomSeed = 27;
  function random() { randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0; return randomSeed / 4294967296; }
  const cityBoxes = [], windows = [];
  for (let row = 0; row < 2; row++) for (let i = 0; i < 15; i++) {
    const x = (i - 7) * 3.3, height = 1.7 + random() * 8, z = -12 - row * 11;
    const width = 1.3 + random() * 1.9, depth = 1.6 + random() * 2;
    cityBoxes.push({ x, y: height / 2 - 5.5, z, w: width, h: height, d: depth });
    for (let floor = 0; floor < Math.floor(height / .65); floor++) for (let col = 0; col < 3; col++) {
      if (random() > .43) continue;
      windows.push({ x: x + (col - 1) * width * .24, y: floor * .65 - 5.1, z: z + depth / 2 + .015, w: .15, h: .21, d: .015 });
    }
  }
  function instanceBoxes(items, color) {
    const mesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color }), items.length);
    const dummy = new T.Object3D();
    items.forEach((item, i) => { dummy.position.set(item.x, item.y, item.z); dummy.scale.set(item.w, item.h, item.d); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); });
    mesh.instanceMatrix.needsUpdate = true; scene.add(mesh); return mesh;
  }
  instanceBoxes(cityBoxes, 0x202d44); instanceBoxes(windows, 0x897464);
  const moon = new T.Mesh(new T.SphereGeometry(1.45, 24, 16), new T.MeshBasicMaterial({ color: 0xf4d2b5 }));
  moon.position.set(-5.5, 9.2, -23); scene.add(moon);
  // Static atmospheric points. These are not continuously simulated particles.
  const stars = new Float32Array(95 * 3);
  for (let i = 0; i < 95; i++) stars.set([(random() - .5) * 65, random() * 18 + 6, -30 - random() * 15], i * 3);
  const starGeometry = new T.BufferGeometry(); starGeometry.setAttribute('position', new T.BufferAttribute(stars, 3));
  scene.add(new T.Points(starGeometry, new T.PointsMaterial({ color: 0xd9c5bc, size: .05, transparent: true, opacity: .5 })));

  const hotspotElements = Object.fromEntries(Object.keys(world.anchors).map(key => [key, document.querySelector('#hotspot-' + key)]));
  const headCorners = getHeadCorners(world.characterHead);
  const hotspotSizes = {};
  function measureHotspots() {
    for (const [key, element] of Object.entries(hotspotElements)) {
      hotspotSizes[key] = { width: element.offsetWidth, height: element.offsetHeight };
    }
  }
  const look = new T.Vector3();
  const orbitTarget = new T.Vector3(0, 1.15, 0);
  let width = 1, height = 1, view = 'home', enabled = true, visible = true, motion = true, lost = false;
  let raf = 0, last = 0, animation = null, dirty = true, idleUntil = 0;
  let yaw = .69, tilt = .6, zoom = 1, drag = null, lastDragAt = 0;
  let lagFrames = 0, lagTotal = 0;
  const ray = new T.Raycaster(), pointer = new T.Vector2(), projected = new T.Vector3();
  const offset = new T.Vector2();
  const screenHalf = new T.Vector3(world.screenWidth / 2, world.screenHeight / 2, 0);
  function homePose() {
    const aspect = width / height;
    const distance = (mobile ? Math.max(22, 15.5 / aspect) : aspect < 1.4 ? 18.5 : 16.8) * zoom;
    const target = orbitTarget.clone();
    const position = new T.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)).multiplyScalar(distance).add(target);
    return { position, target, offset: new T.Vector2(0, 0) };
  }
  function poseFor(name) {
    if (name === 'home') return homePose();
    const target = world.targets[name].clone();
    if (name === 'projects') {
      // The final camera faces the physical screen directly. The readable DOM
      // archive is aligned with that screen on desktop, not drawn into a texture.
      const desiredHeight = Math.max(220, Math.min(height - 215, height * .68));
      const desiredWidth = Math.max(320, Math.min(width - 150, width * .78));
      const pixelsPerUnit = Math.min(desiredHeight / world.screenHeight, desiredWidth / world.screenWidth);
      const distance = height / (2 * Math.tan(T.MathUtils.degToRad(camera.fov / 2)) * pixelsPerUnit);
      return { position: target.clone().add(new T.Vector3(0, 0, distance)), target, offset: new T.Vector2(0, 2) };
    }
    return { position: target.clone().add(new T.Vector3(3.0, 3.0, 5.2)), target, offset: new T.Vector2(mobile ? 0 : width * .23, 0) };
  }
  function setCamera(pose) {
    camera.position.copy(pose.position); look.copy(pose.target); offset.copy(pose.offset);
    camera.setViewOffset(width, height, offset.x, offset.y, width, height);
    camera.lookAt(look); camera.updateMatrixWorld(true);
  }
  function pointOnScreen(point) {
    projected.copy(point).project(camera);
    return { x: (projected.x * .5 + .5) * width, y: (-projected.y * .5 + .5) * height, z: projected.z };
  }
  function positionUI() {
    if (view === 'home') {
      const protectedHead = projectHead(headCorners, world.characterHead.matrixWorld, camera, width, height);
      const obstacles = [protectedHead];
      const bounds = { left: 14, top: mobile ? 83 : 95, right: width - 14, bottom: height - 130 };
      for (const [key, anchor] of Object.entries(world.anchors)) {
        const p = pointOnScreen(anchor), element = hotspotElements[key];
        const preferred = { x: p.x, y: p.y - 18 };
        const placement = p.z < 1 ? placeHotspot(preferred, hotspotSizes[key], bounds, obstacles) : null;
        element.dataset.blocked = String(!placement);
        if (!placement) continue;
        element.style.left = placement.x + 'px'; element.style.top = placement.y + 'px';
        element.dataset.repositioned = String(Math.hypot(placement.x - preferred.x, placement.y - preferred.y) > 2);
        obstacles.push(placement.rect);
      }
    }
    if (view === 'projects' && !animation && !mobile) {
      const tl = pointOnScreen(world.screenCenter.clone().add(new T.Vector3(-screenHalf.x, screenHalf.y, .01)));
      const br = pointOnScreen(world.screenCenter.clone().add(new T.Vector3(screenHalf.x, -screenHalf.y, .01)));
      onPanelRect({ left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y });
    } else if (mobile) onPanelRect(null);
  }
  function render() {
    if (!enabled || !visible || document.hidden || lost || width < 2) return;
    camera.lookAt(look); camera.updateMatrixWorld(true);
    if (view === 'home') world.faceViewer(camera.position);
    renderer.render(scene, camera); positionUI(); dirty = false;
  }
  function requestFrame() { if (!raf && enabled && visible && !document.hidden && !lost) raf = requestAnimationFrame(tick); }
  function tick(now) {
    raf = 0;
    if (!enabled || !visible || document.hidden || lost) return;
    const delta = now - last;
    if (delta < (mobile ? 32 : 23)) { requestFrame(); return; } // cap desktop at ~40fps, phone at ~30fps
    last = now;
    if (animation) {
      const progress = Math.min(1, (now - animation.start) / animation.duration);
      const eased = progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
      camera.position.lerpVectors(animation.from.position, animation.to.position, eased);
      look.lerpVectors(animation.from.target, animation.to.target, eased);
      offset.lerpVectors(animation.from.offset, animation.to.offset, eased);
      camera.setViewOffset(width, height, offset.x, offset.y, width, height);
      dirty = true;
      if (progress === 1) { const resolve = animation.resolve; animation = null; render(); resolve(true); }
    }
    if (motion && view === 'home' && now < idleUntil && !drag) {
      world.lanterns.forEach((lantern, i) => { lantern.rotation.z = Math.sin(now * .0007 + i) * .045; });
      dirty = true;
    }
    if (residents.active) { residents.tick(now); dirty = true; }
    if (dirty) render();
    const continuing = animation || drag || residents.active || (motion && view === 'home' && now < idleUntil);
    if (continuing) {
      if (delta > 0 && delta < 250) {
        lagFrames++; lagTotal += delta;
        if (lagFrames >= 75) {
          if (lagTotal / lagFrames > 70) { enabled = false; settleAnimation(false); onSlow(); return; }
          lagFrames = 0; lagTotal = 0;
        }
      }
      requestFrame();
    }
  }
  function settleAnimation(completed = false) {
    if (animation) { const pending = animation; animation = null; pending.resolve(completed); }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    mobile = width <= 700;
    measureHotspots();
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1 : 1.5));
    renderer.setSize(width, height, false); camera.aspect = width / height;
    settleAnimation(false); setCamera(poseFor(view)); dirty = true; render();
  }
  function focus(name, instant = false) {
    settleAnimation(false); view = name; drag = null;
    if (name !== 'home') residents.finish();
    const target = poseFor(name);
    if (!enabled || lost || !motion || instant || document.hidden) {
      setCamera(target); dirty = true; render(); return Promise.resolve(true);
    }
    return new Promise(resolve => {
      animation = { from: { position: camera.position.clone(), target: look.clone(), offset: offset.clone() }, to: target, start: performance.now(), duration: mobile ? 620 : 900, resolve };
      last = performance.now(); requestFrame();
    });
  }
  function hitTest(event) {
    const bounds = host.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    ray.setFromCamera(pointer, camera); return ray.intersectObjects(world.pickables, false)[0]?.object.userData.view;
  }
  host.addEventListener('pointerdown', event => {
    if (view !== 'home' || !enabled || event.button !== 0) return;
    drag = { x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false, id: event.pointerId };
    host.setPointerCapture(event.pointerId);
  });
  host.addEventListener('pointermove', event => {
    if (view !== 'home' || !enabled) return;
    if (drag && event.pointerId === drag.id) {
      const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 5) drag.moved = true;
      if (drag.moved) {
        settleAnimation(false);
        yaw = T.MathUtils.clamp(yaw - dx * .003, -.32, 1.35);
        tilt = T.MathUtils.clamp(tilt + dy * .002, .32, .9);
        setCamera(homePose()); dirty = true; requestFrame(); host.style.cursor = 'grabbing';
      }
      drag.x = event.clientX; drag.y = event.clientY;
    } else host.style.cursor = hitTest(event) ? 'pointer' : 'grab';
  });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved; drag = null; host.style.cursor = 'grab';
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    if (moved) { lastDragAt = performance.now(); idleUntil = performance.now() + 1500; }
    if (event.type === 'pointerup' && !moved && performance.now() - lastDragAt > 150) {
      const hit = hitTest(event); if (hit) onSelect(hit);
    }
  }
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('lostpointercapture', () => { drag = null; });
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const hotspotObserver = new ResizeObserver(() => { measureHotspots(); dirty = true; requestFrame(); });
  Object.values(hotspotElements).forEach(element => hotspotObserver.observe(element));
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { dirty = true; requestFrame(); } else { stop(); settleAnimation(false); }
  }); observer.observe(host);
  const visibilityChanged = () => {
    if (document.hidden) { stop(); settleAnimation(false); residents.finish(); }
    else { setCamera(poseFor(view)); dirty = true; requestFrame(); }
  };
  document.addEventListener('visibilitychange', visibilityChanged);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; stop(); settleAnimation(false); onSlow();
  });
  let previewSequence = 0, previewId;
  function setProjectPreview(image, name = 'PROJECT ARCHIVE') {
    if (previewId === image) return;
    previewId = image; const sequence = ++previewSequence;
    function use(texture) {
      if (sequence !== previewSequence) { texture.dispose(); return; }
      texture.colorSpace = T.SRGBColorSpace;
      world.screen.material.map?.dispose(); world.screen.material.map = texture;
      world.screen.material.needsUpdate = true; dirty = true; requestFrame();
    }
    if (!image) { use(makeLabel([name.toUpperCase(), 'SOURCE AVAILABLE'], { size: 40 })); return; }
    new T.TextureLoader().load('/assets/' + image + '.webp', texture => {
      texture.anisotropy = Math.min(2, renderer.capabilities.getMaxAnisotropy()); use(texture);
    }, undefined, () => { if (sequence === previewSequence) use(makeLabel([name.toUpperCase(), 'OPEN PROJECT ARCHIVE'], { size: 38 })); });
  }
  setProjectPreview('plot', 'Plot');
  resize(); host.classList.add('ready'); host.style.cursor = 'grab';
  idleUntil = performance.now() + 5000; last = performance.now(); requestFrame();
  return {
    focus, setProjectPreview,
    playCat() { if (!enabled || lost) return; residents.playCat(performance.now(), motion); dirty = true; requestFrame(); },
    wave() { const result = residents.wave(performance.now(), motion && enabled && !lost); dirty = true; requestFrame(); return result; },
    setMotion(value) {
      motion = value;
      if (!value && animation) { const destination = animation.to; settleAnimation(true); setCamera(destination); }
      if (!value) { residents.finish(); stop(); dirty = true; render(); }
      else { idleUntil = performance.now() + 4000; requestFrame(); }
    },
    setEnabled(value) {
      enabled = value && !lost;
      if (value && lost) { onSlow(); return; }
      if (enabled) { measureHotspots(); dirty = true; requestFrame(); }
      else { residents.finish(); stop(); settleAnimation(false); }
    },
    stats() { return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, idle: !raf }; }
  };
}
