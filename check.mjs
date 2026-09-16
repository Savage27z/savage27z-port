import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import * as T from './dist/vendor/three.module.min.js';
import { buildWorld } from './dist/world.js';
import { projects } from './dist/projects.js';
import { createResidents } from './dist/interactions.js';
import { buildNeighborhood } from './dist/neighborhood.js';
import { getHeadCorners, projectHead, placeHotspot, overlaps } from './dist/hotspot-layout.js';

const html = fs.readFileSync('dist/index.html', 'utf8');
const app = fs.readFileSync('dist/app.js', 'utf8');
const scene = fs.readFileSync('dist/scene.js', 'utf8');
const css = fs.readFileSync('dist/style.css', 'utf8');
for (const file of ['app.js', 'scene.js', 'world.js', 'avatar.js', 'hotspot-layout.js', 'projects.js', 'neighborhood.js', 'interactions.js', 'audio.js']) execFileSync(process.execPath, ['--check', 'dist/' + file]);
assert.equal(projects.length, 15);
assert.equal(new Set(projects.map(p => p.id)).size, projects.length);
assert.equal(projects.filter(p => p.image).length, 12);
assert.equal(projects[0].id, 'plot');
for (const project of projects) assert.ok(html.includes('https://github.com/Savage27z/' + project.repo), 'Repository missing from no-script archive');
for (const project of projects) if (project.image) assert.ok(fs.existsSync('dist/assets/' + project.image + '.webp'));
for (const path of [...html.matchAll(/(?:href|src|srcset)="(\/[^"#]+)"/g)].map(m => m[1])) assert.ok(fs.existsSync('dist' + path), 'Missing asset: ' + path);
for (const file of ['app.js', 'scene.js', 'world.js', 'avatar.js', 'hotspot-layout.js']) {
  for (const match of fs.readFileSync('dist/' + file, 'utf8').matchAll(/(?:from |import\()['"](\.\/[^'"]+)['"]/g)) {
    assert.ok(fs.existsSync('dist/' + match[1]), 'Missing import: ' + match[1]);
  }
}
assert.ok(!html.includes('<iframe'));
assert.ok(!html.includes('<video'));
for (const text of ['SAVAGE', 'vibe building tools', 'savage27zzz@gmail.com', 'https://x.com/savage27z', 'https://t.me/savage27z']) assert.ok(html.includes(text));
assert.ok(!app.includes('millw11488'));
assert.ok(!html.includes('AN INDEPENDENT BUILDER’S LITTLE WORLD'));
assert.ok(!html.includes('Somewhere<br>after'));
assert.ok(!html.includes('id="intro"'));
assert.ok(html.includes('City sound off'));
assert.ok(css.includes('@media(prefers-reduced-motion:reduce)'));
for (const guard of ['IntersectionObserver', 'visibilitychange', 'webglcontextlost', 'setPixelRatio', 'idleUntil', 'settleAnimation', 'lagTotal']) assert.ok(scene.includes(guard));

// Simulated DOM exercises every content branch without a browser or GPU.
let document;
function element(dataset = {}, tagName = 'BUTTON') {
  return {
    dataset, tagName, attrs: {}, listeners: {}, style: {}, hidden: false, inert: false, isConnected: true,
    innerHTML: '', textContent: '', scrollTop: 0,
    setAttribute(k, v) { this.attrs[k] = v; },
    removeAttribute(k) { delete this.attrs[k]; if (k === 'style') this.style = {}; },
    addEventListener(k, fn) { this.listeners[k] = fn; },
    focus() { document.activeElement = this; },
    scrollIntoView() {},
    closest(selector) { return selector === '.project-select' && this.dataset.project ? this : null; }
  };
}
const elements = new Map();
const projectButtons = projects.map(p => element({ project: p.id }));
const navButtons = ['home', 'projects', 'about', 'contact'].map(view => element({ view }));
const panels = ['projects', 'about', 'contact'].map(view => {
  const panel = element({}, 'SECTION'); elements.set('#' + view + '-panel', panel); return panel;
});
document = {
  body: element({}, 'BODY'), listeners: {}, activeElement: navButtons[0],
  querySelector(selector) {
    const project = selector.match(/^\.project-select\[data-project="([^"]+)"\]$/);
    if (project) return projectButtons.find(p => p.dataset.project === project[1]);
    if (selector === '#navigation [data-view="home"]') return navButtons[0];
    if (!elements.has(selector)) elements.set(selector, element());
    return elements.get(selector);
  },
  querySelectorAll(selector) {
    if (selector === '.project-select') return projectButtons;
    if (selector === '#navigation [data-view]') return navButtons;
    if (selector === '.panel') return panels;
    return [];
  },
  addEventListener(k, fn) { this.listeners[k] = fn; }
};
const preferences = new Map([['savage-view-mode', 'light'], ['savage-motion', 'off']]);
const location = { hash: '' };
const historyCalls = [];
const history = Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (_a, _b, hash) => { location.hash = hash; historyCalls.push([method, hash]); }]));
const windowListeners = {};
const context = {
  document, location, history, projects, console, setTimeout,
  createAmbience: () => ({ setEnabled: async enabled => enabled }),
  localStorage: { getItem: key => preferences.get(key), setItem: (key, value) => preferences.set(key, value) },
  navigator: { connection: { saveData: true } },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  window: { addEventListener: (key, fn) => { windowListeners[key] = fn; } }
};
vm.createContext(context);
vm.runInContext(app.replace(/^import .+;\n/gm, '').replace(/export /g, '') +
  '\nthis.api={selectProject,setView};', context);
assert.equal(document.body.dataset.mode, 'light');
assert.equal(document.querySelector('#motion-toggle').textContent, 'Motion off');
assert.equal(document.querySelector('#project-count').textContent, '15');
assert.ok(document.querySelector('#project-index').innerHTML.includes('>10</span>Rewind'));
assert.ok(!document.querySelector('#project-index').innerHTML.includes('>010</span>'));

for (const project of projects) {
  context.api.selectProject(project.id);
  const content = document.querySelector('#project-detail').innerHTML;
  assert.ok(content.includes(project.name));
  assert.ok(content.includes(project.short));
  assert.ok(content.includes('data-view="contact">Let’s build yours'));
  assert.equal((content.match(/<img /g) || []).length, project.image ? 1 : 0, 'Only the selected preview should be rendered');
  assert.ok(content.includes('https://github.com/Savage27z/' + project.repo));
  if (project.url) assert.ok(content.includes(project.url));
  else assert.ok(content.includes('No confirmed public demo'));
  assert.equal(projectButtons.filter(b => b.attrs['aria-current'] === 'true').length, 1);
  for (const match of content.matchAll(/<a [^>]+target="_blank"[^>]*>/g)) assert.ok(match[0].includes('noopener noreferrer'));
}
for (const view of ['projects', 'about', 'contact']) {
  document.activeElement = navButtons[0];
  await context.api.setView(view);
  assert.equal(document.body.dataset.view, view);
  assert.equal(panels.filter(p => !p.hidden).length, 1);
  assert.equal(document.querySelector('#' + view + '-panel').hidden, false);
  assert.equal(document.activeElement, document.querySelector('#' + view + '-title'));
  assert.equal(document.querySelector('#object-actions').inert, true);
  await context.api.setView('home');
  assert.equal(panels.filter(p => !p.hidden).length, 0);
  assert.equal(document.activeElement, navButtons[0]);
}
await context.api.setView('projects');
document.listeners.keydown({ key: 'ArrowRight', target: projectButtons[0], preventDefault() {} });
assert.equal(document.activeElement, projectButtons[1]);
assert.ok(document.querySelector('#project-detail').innerHTML.includes('ShipZen'));
document.listeners.keydown({ key: 'End', target: projectButtons[1], preventDefault() {} });
assert.equal(document.activeElement, projectButtons.at(-1));
assert.equal(document.querySelector('#archive-position').textContent, '15 / 15');
assert.ok(document.querySelector('#project-detail').innerHTML.includes('Collect'));
document.listeners.keydown({ key: 'Escape', target: projectButtons[1], preventDefault() {} });
await Promise.resolve();
assert.equal(document.body.dataset.view, 'home');
location.hash = '#projects/sumi';
windowListeners.popstate();
await Promise.resolve();
assert.equal(document.body.dataset.view, 'projects');
assert.ok(document.querySelector('#project-detail').innerHTML.includes('Sumi 墨'));
const before = document.body.dataset.view;
await context.api.setView('not-a-view');
assert.equal(document.body.dataset.view, before);
assert.ok(historyCalls.some(([, hash]) => hash === '#about'));

// Construct the entire model headlessly; verify finite geometry and its budget.
const world = buildWorld(() => new T.Texture(), new T.Texture());
let meshes = 0, triangles = 0, instances = 0;
world.root.traverse(object => {
  if (!object.isMesh) return;
  meshes++;
  const geometry = object.geometry;
  triangles += (geometry.index?.count || geometry.attributes.position.count) / 3 * (object.count || 1);
  if (object.isInstancedMesh) instances += object.count;
  for (const number of geometry.attributes.position.array) assert.ok(Number.isFinite(number));
});
assert.ok(meshes < 175, 'Model draw-call budget exceeded');
assert.ok(triangles < 16000, 'Model triangle budget exceeded');
assert.ok(instances > 100, 'Repeated parts should be instanced');
assert.equal(new Set(world.pickables.map(p => p.userData.view)).size, 5);
const box = new T.Box3().setFromObject(world.root);
assert.ok(box.getSize(new T.Vector3()).length() < 16);

// Ensure all interactive objects fit the phone/desktop overview and that the
// desktop screen-aligned HTML panel has a useful size.
for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const mobile = width <= 700, aspect = width / height;
  const distance = mobile ? Math.max(22, 15.5 / aspect) : aspect < 1.4 ? 18.5 : 16.8;
  const camera = new T.PerspectiveCamera(36, aspect, .1, 100);
  const target = new T.Vector3(0, 1.15, 0);
  camera.position.set(Math.sin(.69) * Math.cos(.6), Math.sin(.6), Math.cos(.69) * Math.cos(.6)).multiplyScalar(distance).add(target);
  camera.setViewOffset(width, height, 0, 0, width, height);
  camera.lookAt(target); camera.updateMatrixWorld(true);
  for (const [name, anchor] of Object.entries(world.anchors)) {
    const point = anchor.clone().project(camera);
    const x = (point.x * .5 + .5) * width, y = (-point.y * .5 + .5) * height;
    assert.ok(x > 20 && x < width - 20, name + ' outside horizontal viewport at ' + width);
    assert.ok(y > 90 && y < height - 90, name + ' outside vertical viewport at ' + height);
  }
  if (!mobile) {
    const desiredHeight = Math.max(220, Math.min(height - 215, height * .68));
    const desiredWidth = Math.max(320, Math.min(width - 150, width * .78));
    const scale = Math.min(desiredHeight / world.screenHeight, desiredWidth / world.screenWidth);
    assert.ok(world.screenWidth * scale > 700, 'Desktop archive too narrow');
    assert.ok(world.screenHeight * scale > 450, 'Desktop archive too short');
  }
}
// Regression: the resident must not cross the workstation screen while its
// camera approaches, even after looking around from either end of the orbit.
// The eyes must also remain visible instead of disappearing into the face.
for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const aspect = width / height, mobile = width <= 700;
  const scale = Math.min(Math.max(220, Math.min(height - 215, height * .68)) / world.screenHeight,
    Math.max(320, Math.min(width - 150, width * .78)) / world.screenWidth);
  const distance = height / (2 * Math.tan(T.MathUtils.degToRad(18)) * scale);
  const destination = world.screenCenter.clone().add(new T.Vector3(0, 0, distance));
  for (const yaw of [-.32, .69, 1.35]) for (const tilt of [.32, .6, .9]) {
    const homeDistance = mobile ? Math.max(22, 15.5 / aspect) : aspect < 1.4 ? 18.5 : 16.8;
    const start = new T.Vector3(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt))
      .multiplyScalar(homeDistance).add(new T.Vector3(0, 1.15, 0));
    world.faceViewer(start); world.root.updateMatrixWorld(true);
    const headPosition = world.characterHead.getWorldPosition(new T.Vector3());
    const normal = new T.Vector3(0, 0, 1).applyQuaternion(world.characterHead.getWorldQuaternion(new T.Quaternion()));
    assert.ok(normal.dot(start.clone().sub(headPosition).normalize()) > .8, 'Resident should face the viewer');
    for (const name of ['left-eye', 'right-eye']) {
      const eye = world.characterHead.getObjectByName(name), point = eye.getWorldPosition(new T.Vector3());
      const ray = new T.Raycaster(start, point.clone().sub(start).normalize());
      assert.equal(ray.intersectObject(world.characterHead, true)[0]?.object === eye, true, name + ' is obscured');
    }
    for (const progress of [0, .25, .5, .75, 1]) {
      const position = start.clone().lerp(destination, progress);
      for (let y = 0; y < 7; y++) for (let x = 0; x < 11; x++) {
        const point = world.screenCenter.clone().add(new T.Vector3((x / 10 - .5) * world.screenWidth, (y / 6 - .5) * world.screenHeight, 0));
        const ray = new T.Raycaster(position, point.clone().sub(position).normalize(), 0, position.distanceTo(point));
        assert.equal(ray.intersectObject(world.seating, true).length, 0,
          'Resident overlaps Projects at ' + [width, height, yaw, tilt, progress].join('/'));
      }
    }
  }
}

// The user's screenshot showed an HTML label covering the avatar, which a 3D
// visibility check alone cannot detect. Check full label rectangles here.
const headCorners = getHeadCorners(world.characterHead);
let oldLabelOverlapDetected = false;
for (const [width, height] of [[1920, 972], [1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const aspect = width / height, mobile = width <= 700;
  const distance = mobile ? Math.max(22, 15.5 / aspect) : aspect < 1.4 ? 18.5 : 16.8;
  const camera = new T.PerspectiveCamera(36, aspect, .1, 100);
  const bounds = { left: 14, top: mobile ? 83 : 95, right: width - 14, bottom: height - 130 };
  for (const yaw of [-.32, 0, .69, 1.35]) for (const tilt of [.32, .6, .9]) {
    const target = new T.Vector3(0, 1.15, 0);
    camera.position.set(Math.sin(yaw) * Math.cos(tilt), Math.sin(tilt), Math.cos(yaw) * Math.cos(tilt)).multiplyScalar(distance).add(target);
    camera.lookAt(target); camera.updateMatrixWorld(true);
    world.faceViewer(camera.position); world.root.updateMatrixWorld(true);
    const head = projectHead(headCorners, world.characterHead.matrixWorld, camera, width, height);
    for (const textScale of [1, 1.25]) {
      const obstacles = [head];
      for (const [key, anchor] of Object.entries(world.anchors)) {
        const p = anchor.clone().project(camera);
        const preferred = { x: (p.x * .5 + .5) * width, y: (-p.y * .5 + .5) * height - 18 };
        const size = { width: (mobile ? 110 : key === 'projects' ? 230 : key === 'about' ? 195 : 175) * textScale,
          height: (mobile ? 42 : 72) * textScale };
        const oldRect = { left: preferred.x - size.width / 2, right: preferred.x + size.width / 2,
          top: preferred.y - size.height, bottom: preferred.y };
        if (overlaps(oldRect, head)) oldLabelOverlapDetected = true;
        const placement = placeHotspot(preferred, size, bounds, obstacles);
        assert.ok(placement, key + ' label should remain available at ' + width);
        assert.ok(obstacles.every(obstacle => !overlaps(placement.rect, obstacle, 13)), key + ' label covers the head or another label');
        assert.ok(placement.rect.left >= bounds.left && placement.rect.right <= bounds.right &&
          placement.rect.top >= bounds.top && placement.rect.bottom <= bounds.bottom, key + ' label leaves the usable viewport');
        obstacles.push(placement.rect);
      }
    }
  }
}
assert.ok(oldLabelOverlapDetected, 'Regression cases must reproduce the old label overlap');

// Finite interactions complete and stop, including their reduced-motion path.
const residents = createResidents(world);
const firstSpot = world.cat.position.clone();
residents.playCat(100, true);
assert.equal(residents.active, true);
residents.tick(2000);
assert.ok(world.catLegs.some(leg => leg.visible));
residents.tick(5500);
assert.equal(residents.active, false);
assert.ok(world.cat.position.distanceTo(firstSpot) > .5);
assert.ok(world.catLegs.every(leg => !leg.visible));
residents.playCat(5600, false);
assert.ok(world.cat.position.distanceTo(firstSpot) < .001);
assert.equal(residents.active, false);
const wave = residents.wave(6000, true);
residents.tick(6500);
assert.ok(world.waveArm.rotation.z > 1);
residents.finish();
assert.equal(await wave, true);
assert.equal(world.waveArm.rotation.z, 0);
assert.equal(residents.active, false);
const neighborhood = buildNeighborhood();
const neighborhoodBounds = new T.Box3().setFromObject(neighborhood);
assert.ok(neighborhoodBounds.min.y < -10);
assert.ok(neighborhoodBounds.max.x > 15 && neighborhoodBounds.min.x < -15);
assert.ok(neighborhood.children.every(child => child.isInstancedMesh));
await document.querySelector('#sound-toggle').listeners.click();
assert.equal(document.querySelector('#sound-toggle').attrs['aria-pressed'], 'true');
document.hidden = true;
document.listeners.visibilitychange();
assert.equal(document.querySelector('#sound-toggle').attrs['aria-pressed'], 'false');
let total = 0;
for (const dir of ['dist', 'dist/assets', 'dist/vendor']) for (const name of fs.readdirSync(dir)) {
  const path = dir + '/' + name;
  if (fs.statSync(path).isFile()) total += fs.statSync(path).size;
}
console.log('PASS: syntax, local assets, 15 projects, 12 real previews, two-digit numbering, selected-preview loading, link safety, three sections, close/focus restoration, arrow keys, browser history, lightweight default, finite geometry, viewport bounds.');
console.log('PASS: Projects camera path stays clear of the resident; both eyes remain visible throughout the allowed overview angles.');
console.log('PASS: HTML labels stay clear of the entire head and one another across camera angles, phone/desktop layouts and larger text.');
console.log({ modelMeshes: meshes, modelTriangles: triangles, instancedParts: instances, totalSiteBytes: total, threeGzipBytes: gzipSync(fs.readFileSync('dist/vendor/three.module.min.js')).length });
console.log('Static and simulated-DOM checks only. Browser visuals and real-device frame rates have not been measured.');
