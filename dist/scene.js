import * as T from './vendor/three.module.min.js';
import { buildWorld } from './world.js';
import { buildNeighborhood } from './neighborhood.js';
import { createResidents } from './interactions.js';
import { createAtmosphere } from './atmosphere.js';
import { projects } from './projects.js';
import { getHeadCorners, projectHead, placeHotspot } from './hotspot-layout.js';

// Rendering is demand driven with one exception: a short "ambient life" window
// (petals, twinkling stars, blinking resident) that runs at a capped frame rate
// and goes to sleep after 90 seconds without interaction. It never runs with
// reduced motion, in background tabs, offscreen, or on the lowest quality tier.
const AMBIENT_MS = 90000;
const capture = /[?&]capture\b/.test(location.search);

export async function createScene(host, { onSelect, onSlow, onPanelRect, onHover = () => {}, onIntro = () => {} }) {
  let mobile = matchMedia('(max-width:700px)').matches;
  const modest = mobile || navigator.deviceMemory <= 4 || navigator.hardwareConcurrency <= 4;
  let quality = capture ? 'high' : modest ? 'medium' : 'high';
  const pixelRatio = () => Math.min(devicePixelRatio || 1, quality === 'high' ? 1.75 : quality === 'medium' ? (mobile ? 1.25 : 1.5) : 1);
  const renderer = new T.WebGLRenderer({ antialias: !mobile, powerPreference: mobile ? 'low-power' : 'high-performance', alpha: false, preserveDrawingBuffer: capture });
  renderer.setPixelRatio(pixelRatio());
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.setClearColor(0x1d1a33);
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');
  const scene = new T.Scene();
  scene.fog = new T.Fog(0x241f3d, 24, 70);
  const camera = new T.PerspectiveCamera(36, 1, .1, 100);

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
  instanceBoxes(cityBoxes, 0x1f2440); instanceBoxes(windows, 0xd6a874);
  const beaconSpots = [...cityBoxes].sort((a, b) => (b.y + b.h / 2) - (a.y + a.h / 2)).slice(0, 9)
    .map(box => new T.Vector3(box.x, box.y + box.h / 2 + .14, box.z));
  const atmosphere = createAtmosphere(scene, world, { quality, random, beaconSpots });

  // A three step ramp gives the toon materials crisp, anime style shading.
  const ramp = new T.DataTexture(new Uint8Array([96, 178, 255]), 3, 1, T.RedFormat);
  ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.generateMipmaps = false; ramp.needsUpdate = true;
  const toonMaterials = new Set(), shadowCasters = [];
  scene.traverse(item => {
    if (!item.isMesh) return;
    if (item.material?.isMeshToonMaterial) {
      if (!item.material.userData.ownRamp) item.material.gradientMap = ramp;
      toonMaterials.add(item.material);
    }
    if (world.root.getObjectById(item.id) && item.material?.isMeshToonMaterial) shadowCasters.push(item);
  });

  function setQuality(level) {
    quality = level;
    const shadows = level === 'high' && !mobile;
    if (renderer.shadowMap.enabled !== shadows) {
      renderer.shadowMap.enabled = shadows; atmosphere.moonLight.castShadow = shadows;
      // Anime faces and hair take no cast shadows; they still cast their own.
      shadowCasters.forEach(item => { item.castShadow = shadows; item.receiveShadow = shadows && !item.material.userData.ownRamp; });
      toonMaterials.forEach(material => { material.needsUpdate = true; });
    }
    atmosphere.setQuality(level);
    renderer.setPixelRatio(pixelRatio());
    if (width > 1) renderer.setSize(width, height, false);
    dirty = true;
  }

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
  let raf = 0, last = 0, animation = null, dirty = true, ambientUntil = 0;
  let yaw = .69, tilt = .6, zoom = 1, drag = null, lastDragAt = 0, hovered = null;
  let lagFrames = 0, lagTotal = 0, nextBlink = 0, blinkUntil = 0, eyesClosed = false;
  const parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  const ray = new T.Raycaster(), pointer = new T.Vector2(), projected = new T.Vector3();
  const offset = new T.Vector2();
  const screenHalf = new T.Vector3(world.screenWidth / 2, world.screenHeight / 2, 0);
  function homePose() {
    const aspect = width / height;
    const distance = (mobile ? Math.max(22, 15.5 / aspect) : aspect < 1.4 ? 18.5 : 16.8) * zoom;
    const target = orbitTarget.clone();
    const y = yaw + parallax.x * .045, t = tilt - parallax.y * .03;
    const position = new T.Vector3(Math.sin(y) * Math.cos(t), Math.sin(t), Math.cos(y) * Math.cos(t)).multiplyScalar(distance).add(target);
    return { position, target, offset: new T.Vector2(0, 0) };
  }
  // The opening shot looks up at the moon, then cranes down onto the roof.
  function introPose() {
    const home = homePose();
    const position = home.position.clone().multiplyScalar(1.35).setY(3.4);
    const moon = new T.Vector3(-.34, .4, -.85).normalize();
    const direction = new T.Vector3(moon.x * 1.25, moon.y * .62, moon.z).normalize();
    return { position, target: position.clone().add(direction.multiplyScalar(30)), offset: new T.Vector2(0, 0) };
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
    atmosphere.follow(camera);
    renderer.render(scene, camera); positionUI(); dirty = false;
  }
  function requestFrame() { if (!raf && enabled && visible && !document.hidden && !lost) raf = requestAnimationFrame(tick); }
  const ambientOn = now => motion && quality !== 'low' && now < ambientUntil;
  function wake() { ambientUntil = performance.now() + AMBIENT_MS; requestFrame(); }

  // Small signs of life: blinking, breathing, a lazy tail, swaying lanterns.
  function lifeTick(now) {
    const t = now / 1000;
    world.lanterns.forEach((lantern, i) => { lantern.rotation.z = Math.sin(now * .0007 + i) * .045; });
    if (now > nextBlink) { blinkUntil = now + 130; nextBlink = now + 2400 + random() * 3400; if (random() < .2) nextBlink = now + 320; }
    const closed = now < blinkUntil;
    if (closed !== eyesClosed) { eyesClosed = closed; world.blink(closed); }
    world.torso.scale.y = 1 + Math.sin(t * 1.7) * .012;
    world.characterHead.position.y = 1.27 + Math.sin(t * 1.7 - .5) * .006;
    if (!residents.active) {
      world.catBody.scale.y = .7 + Math.sin(t * 1.9) * .02;
      world.catTail.rotation.y = Math.sin(t * .8) * .14;
    }
  }
  function openEyes() { world.blink(false); eyesClosed = false; blinkUntil = 0; }
  let wasAmbient = false;
  const ease = progress => progress < .5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
  function tick(now) {
    raf = 0;
    if (!enabled || !visible || document.hidden || lost) return;
    const delta = now - last;
    const busy = animation || drag || residents.active;
    const ambient = ambientOn(now);
    // Interactions may run near 60fps; ambient-only frames are capped lower.
    const minimum = busy ? (mobile ? 30 : 15) : (mobile ? 38 : 30);
    if (delta < minimum) { requestFrame(); return; }
    last = now;
    const dt = Math.min(.1, delta / 1000);
    if (animation) {
      const progress = Math.min(1, Math.max(0, (now - animation.start) / animation.duration));
      const eased = ease(progress);
      camera.position.lerpVectors(animation.from.position, animation.to.position, eased);
      look.lerpVectors(animation.from.target, animation.to.target, eased);
      offset.lerpVectors(animation.from.offset, animation.to.offset, eased);
      camera.setViewOffset(width, height, offset.x, offset.y, width, height);
      dirty = true;
      if (progress === 1) { const { resolve, intro } = animation; animation = null; if (intro) onIntro(false); render(); resolve(true); }
    }
    if (wasAmbient && !ambient) { openEyes(); dirty = true; }
    wasAmbient = ambient;
    if (ambient) {
      atmosphere.update(now, dt); lifeTick(now); dirty = true;
      if (view === 'home' && !animation && !drag) {
        const before = parallax.x + parallax.y;
        parallax.x += (parallax.tx - parallax.x) * Math.min(1, dt * 2.5);
        parallax.y += (parallax.ty - parallax.y) * Math.min(1, dt * 2.5);
        if (Math.abs(parallax.x + parallax.y - before) > 1e-5) setCamera(homePose());
      }
    }
    if (residents.active) { residents.tick(now); dirty = true; }
    if (dirty) render();
    if (animation || drag || residents.active || ambient) {
      if (!capture && delta > 0 && delta < 250) {
        lagFrames++; lagTotal += delta;
        if (lagFrames >= 90) {
          // Sustained slow frames step quality down: high, medium, then static.
          if (lagTotal / lagFrames > Math.max(66, minimum * 2.1)) {
            if (quality === 'high') setQuality('medium');
            else if (quality === 'medium') { setQuality('low'); onSlow(); }
          }
          lagFrames = 0; lagTotal = 0;
        }
      }
      requestFrame();
    }
  }
  function settleAnimation(completed = false) {
    if (animation) { const pending = animation; animation = null; if (pending.intro) onIntro(false); pending.resolve(completed); }
  }
  function stop() { cancelAnimationFrame(raf); raf = 0; }
  function resize() {
    width = Math.max(1, host.clientWidth); height = Math.max(1, host.clientHeight);
    mobile = width <= 700;
    measureHotspots();
    renderer.setPixelRatio(pixelRatio());
    renderer.setSize(width, height, false); camera.aspect = width / height;
    // A resize during the opening shot retargets it rather than cutting it short.
    if (animation?.intro) animation.to = homePose();
    else { settleAnimation(false); setCamera(poseFor(view)); }
    dirty = true; render();
  }
  function focus(name, instant = false) {
    if (name === view && animation?.intro) return animation.promise;
    settleAnimation(false); view = name; drag = null; wake();
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
  function intro() {
    if (!motion || capture || view !== 'home' || !enabled || lost) return Promise.resolve(false);
    settleAnimation(false);
    const from = introPose(), to = homePose();
    setCamera(from); render(); onIntro(true);
    let resolve; const promise = new Promise(done => { resolve = done; });
    animation = { from, to, start: performance.now() + 250, duration: mobile ? 2600 : 3400, resolve, promise, intro: true };
    last = performance.now(); wake(); return promise;
  }
  function hitTest(event) {
    const bounds = host.getBoundingClientRect();
    pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
    ray.setFromCamera(pointer, camera); return ray.intersectObjects(world.pickables, false)[0]?.object.userData.view;
  }
  host.addEventListener('pointerdown', event => {
    wake();
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
    } else {
      const hit = hitTest(event);
      host.style.cursor = hit ? 'pointer' : 'grab';
      if (hit !== hovered) { hovered = hit; onHover(hit || null); }
      if (event.pointerType === 'mouse') {
        const bounds = host.getBoundingClientRect();
        parallax.tx = (event.clientX - bounds.left) / bounds.width * 2 - 1;
        parallax.ty = (event.clientY - bounds.top) / bounds.height * 2 - 1;
      }
      if (performance.now() > ambientUntil - AMBIENT_MS + 1000) wake();
    }
  });
  host.addEventListener('pointerleave', () => { parallax.tx = parallax.ty = 0; if (hovered) { hovered = null; onHover(null); } });
  function endDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved; drag = null; host.style.cursor = 'grab';
    if (host.hasPointerCapture(event.pointerId)) host.releasePointerCapture(event.pointerId);
    if (moved) lastDragAt = performance.now();
    if (event.type === 'pointerup' && !moved && performance.now() - lastDragAt > 150) {
      const hit = hitTest(event); if (hit) onSelect(hit);
    }
  }
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);
  host.addEventListener('lostpointercapture', () => { drag = null; });
  addEventListener('keydown', wake);
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(host);
  const hotspotObserver = new ResizeObserver(() => { measureHotspots(); dirty = true; requestFrame(); });
  Object.values(hotspotElements).forEach(element => hotspotObserver.observe(element));
  const observer = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) { dirty = true; requestFrame(); } else { stop(); settleAnimation(false); }
  }); observer.observe(host);
  const visibilityChanged = () => {
    if (document.hidden) { stop(); settleAnimation(false); residents.finish(); }
    else { setCamera(poseFor(view)); dirty = true; wake(); }
  };
  document.addEventListener('visibilitychange', visibilityChanged);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault(); lost = true; stop(); settleAnimation(false); onSlow(true);
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
      texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); use(texture);
    }, undefined, () => { if (sequence === previewSequence) use(makeLabel([name.toUpperCase(), 'OPEN PROJECT ARCHIVE'], { size: 38 })); });
  }
  setProjectPreview('plot', 'Plot');
  setQuality(quality);
  atmosphere.settle();
  resize(); host.classList.add('ready'); host.style.cursor = 'grab';
  last = performance.now(); wake();
  if (capture) window.__hideout = {
    pose(position, target) { setCamera({ position: new T.Vector3(...position), target: new T.Vector3(...target), offset: new T.Vector2() }); dirty = true; render(); },
    // Holds the eyes open or shut (motion off stops the idle blink from overriding it).
    blink(closed) { motion = false; wasAmbient = false; world.blink(closed); dirty = true; render(); }
  };
  return {
    focus, setProjectPreview, intro,
    playCat() { if (!enabled || lost) return; wake(); residents.playCat(performance.now(), motion); dirty = true; requestFrame(); },
    wave() { wake(); const result = residents.wave(performance.now(), motion && enabled && !lost); dirty = true; requestFrame(); return result; },
    setMotion(value) {
      motion = value;
      if (!value && animation) { const destination = animation.to; settleAnimation(true); setCamera(destination); }
      if (!value) { residents.finish(); openEyes(); parallax.x = parallax.y = parallax.tx = parallax.ty = 0; setCamera(poseFor(view)); stop(); dirty = true; render(); }
      else wake();
    },
    setEnabled(value) {
      enabled = value && !lost;
      if (value && lost) { onSlow(true); return; }
      if (enabled) { measureHotspots(); dirty = true; wake(); }
      else { residents.finish(); stop(); settleAnimation(false); }
    },
    get quality() { return quality; },
    stats() { return { drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, textures: renderer.info.memory.textures, quality, idle: !raf }; }
  };
}
