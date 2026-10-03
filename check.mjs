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
import { projectCard, filterButtons, filters, countGroup } from './dist/project-cards.js';
import { summarize, snapshot, prettyName } from './dist/github.js';

const read = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const index = read('dist/index.html');
const hideout = read('dist/hideout.html');
const lost = read('dist/404.html');
const hideoutApp = read('dist/hideout.js');
const scene = read('dist/scene.js');
const siteCss = read('dist/site.css');
const hideoutCss = read('dist/hideout.css');
const modules = fs.readdirSync('dist').filter(name => name.endsWith('.js'));
for (const file of modules) execFileSync(process.execPath, ['--check', 'dist/' + file]);

// Data: fifteen curated projects, twelve real previews, Plot featured first.
assert.equal(projects.length, 15);
assert.equal(new Set(projects.map(p => p.id)).size, projects.length);
assert.equal(projects.filter(p => p.image).length, 12);
assert.equal(projects[0].id, 'plot');
assert.ok(projects[0].featured && projects[0].steps.length === 3);
const groupKeys = new Set(filters.map(f => f.key).concat('games'));
for (const project of projects) {
  assert.ok(project.groups.length && project.groups.every(g => groupKeys.has(g)), project.id + ' has an unknown group');
  if (project.image) assert.ok(fs.existsSync('dist/assets/' + project.image + '.webp'));
}

// Pages: every local asset exists, links are safe, no embeds, contact details present.
for (const [name, html] of [['index', index], ['hideout', hideout], ['404', lost]]) {
  for (const path of [...html.matchAll(/(?:href|src|srcset|content)="(\/[^"#?]+)"/g)].map(m => m[1])) {
    assert.ok(fs.existsSync('dist' + path), name + ': missing asset ' + path);
  }
  for (const match of html.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.ok(match[0].includes('noopener noreferrer'), name + ': unsafe link');
  assert.ok(!/<iframe|<video/.test(html), name + ': embeds are not allowed');
  assert.ok(html.includes('<symbol id="i-'), name + ': icon sprite missing');
  for (const use of html.matchAll(/href="#i-([a-z-]+)"/g)) assert.ok(html.includes('id="i-' + use[1] + '"'), name + ': icon ' + use[1] + ' missing');
}
for (const html of [index, hideout]) {
  for (const text of ['SAVAGE', 'savage27zzz@gmail.com', 'https://x.com/savage27z', 'https://t.me/savage27z']) assert.ok(html.includes(text));
  for (const project of projects) assert.ok(html.includes('https://github.com/Savage27z/' + project.repo), 'Repository missing from no-script fallback');
}
for (const script of [...index.matchAll(/(?:src|import)[^'"]*['"](\/?\.?\/?[\w-]+\.js)['"]/g)].map(m => m[1].replace(/^\.?\//, ''))) assert.ok(fs.existsSync('dist/' + script), 'Missing ' + script);
for (const file of modules) {
  for (const match of read('dist/' + file).matchAll(/(?:from |import\()['"](\.\/[^'"]+)['"]/g)) assert.ok(fs.existsSync('dist/' + match[1]), file + ': missing import ' + match[1]);
}
assert.ok(index.includes('vibe building tools so you don’t have to'));
assert.ok(index.includes('Vibe building tools<br>so you don’t have to'));
assert.ok(hideout.includes('City sound off') && hideout.includes('data-leave-3d'));
assert.ok(index.includes('data-enter-3d'));

// Skill rules on the basic page: no hyphenated words in visible copy (approved
// project data aside), Tailwind type scale, spacing tokens and radii only.
const visible = index.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<svg[\s\S]*?<\/svg>|<noscript[\s\S]*?<\/noscript>|<head[\s\S]*?<\/head>/g, '')
  .replace(/<[^>]+>/g, ' ').replace(/&\w+;/g, ' ');
assert.deepEqual(visible.match(/[A-Za-z]-[A-Za-z]/g) || [], [], 'Hyphenated words in basic page copy');
const scale = new Set([12, 14, 16, 18, 20, 24, 30, 36, 48, 60, 72, 96, 128]);
for (const [, size] of siteCss.matchAll(/font-size:(\d+)px/g)) assert.ok(scale.has(+size), 'Off-scale font size ' + size);
const spacing = new Set([0, 2, 4, 8, 12, 16, 24, 32, 40, 48, 64, 80, 96]);
for (const [, value] of siteCss.matchAll(/(?:^|[;{])(?:padding|margin|gap)(?:-[a-z]+)*:([^;}]+)/g)) {
  for (const px of value.matchAll(/(-?\d+)px/g)) assert.ok(spacing.has(Math.abs(+px[1])), 'Off-token spacing ' + value);
}
const radii = new Set([0, 2, 4, 6, 8, 12, 16, 24, 9999]);
for (const [, value] of siteCss.matchAll(/border-radius:([^;}]+)/g)) for (const px of value.matchAll(/(\d+)px/g)) assert.ok(radii.has(+px[1]), 'Off-scale radius ' + value);
assert.ok(!/font-style:italic|(?:Inter|Roboto|Arial|Helvetica)/.test(siteCss), 'No italics or banned fonts');
assert.ok(!/body[^{]*\{[^}]*gradient/.test(siteCss), 'Flat page background');
for (const css of [siteCss, hideoutCss]) assert.ok(css.includes('prefers-reduced-motion:reduce'));

// Cards render every project with honest links; filters count the data.
const rendered = projects.map(projectCard);
projects.forEach((project, i) => {
  const html = rendered[i];
  assert.ok(html.includes('id="project-' + project.id + '"') && html.includes(project.short.replace(/'/g, '&#39;').replace(/"/g, '&quot;')));
  assert.ok(html.includes('https://github.com/Savage27z/' + project.repo));
  assert.equal(html.includes(project.url || '\u0000'), Boolean(project.url));
  assert.equal((html.match(/<img /g) || []).length, project.image ? 1 : 0);
  if (!project.image) assert.ok(html.includes('no public demo'));
  for (const match of html.matchAll(/<a [^>]+>/g)) assert.ok(match[0].includes('noopener noreferrer'));
});
assert.equal(countGroup('all'), 15);
assert.ok(filterButtons('ai').includes('data-filter="ai" aria-pressed="true"'));

// GitHub numbers: forks and housekeeping repos are excluded; fallbacks match the snapshot.
const day = 864e5, now = Date.parse('2026-10-02');
const fixture = [
  { name: 'Plot', fork: false, homepage: 'https://plot.example', language: 'TypeScript', created_at: '2026-06-12', pushed_at: '2026-06-15' },
  { name: 'Am-i-being-scammed-', fork: false, homepage: 'https://scam.example', language: 'TypeScript', created_at: '2026-04-13', pushed_at: '2026-04-13' },
  { name: 'old-bot', fork: false, homepage: '', language: 'Python', created_at: '2024-01-01', pushed_at: '2024-01-01' },
  { name: 'someone-elses', fork: true, homepage: 'https://fork.example', language: 'Rust', created_at: '2026-04-01', pushed_at: '2026-04-01' },
  { name: 'Savage27z', fork: false, homepage: '', language: null, created_at: '2026-03-18', pushed_at: '2026-03-18' },
  { name: 'page', fork: false, homepage: 'https://page.example', language: 'HTML', created_at: new Date(now - 10 * day).toISOString(), pushed_at: new Date(now).toISOString() }
];
const summary = summarize(fixture, ['Plot'], now);
assert.deepEqual([summary.projects, summary.live, summary.recent, summary.languages], [4, 3, 3, 2]);
assert.deepEqual(summary.more.map(item => item.name), ['Page', 'Am I being scammed']);
assert.equal(prettyName('Hall-of-Rugs'), 'Hall of Rugs');
for (const key of ['projects', 'live', 'recent', 'languages']) {
  assert.ok(Number.isInteger(snapshot[key]) && snapshot[key] > 0);
  for (const match of index.matchAll(new RegExp('data-stat="' + key + '"[^>]*>(\\d+)<', 'g'))) assert.equal(+match[1], snapshot[key], key + ' fallback differs from snapshot');
}
for (const match of index.matchAll(/data-stat="featured"[^>]*>(\d+)</g)) assert.equal(+match[1], projects.length);
assert.ok(snapshot.more.every(item => /^https:\/\//.test(item.url) && !projects.some(p => p.repo.toLowerCase() === item.repo.toLowerCase())));

// Hideout app in a simulated DOM: every view, focus return, keys, history, sound.
for (const guard of ['IntersectionObserver', 'visibilitychange', 'webglcontextlost', 'setPixelRatio', 'AMBIENT_MS', 'settleAnimation', 'lagTotal', 'setQuality']) assert.ok(scene.includes(guard));
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
  body: element({ view: 'home', mode: 'loading' }, 'BODY'), listeners: {}, activeElement: navButtons[0],
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
const preferences = new Map([['savage-motion', 'off']]);
const location = { hash: '' };
const historyCalls = [];
const history = Object.fromEntries(['pushState', 'replaceState'].map(method => [method, (_a, _b, hash) => { location.hash = hash; historyCalls.push([method, hash]); }]));
const windowListeners = {};
const context = {
  document, location, history, projects, console, setTimeout,
  createAmbience: () => ({ setEnabled: async enabled => enabled }),
  localStorage: { getItem: key => preferences.get(key), setItem: (key, value) => preferences.set(key, value) },
  matchMedia: () => ({ matches: false, addEventListener() {} }),
  requestIdleCallback: () => {},
  window: { addEventListener: (key, fn) => { windowListeners[key] = fn; }, requestIdleCallback: true }
};
vm.createContext(context);
vm.runInContext(hideoutApp.replace(/^import .+;$/gm, '').replace(/export /g, '') + '\nthis.api={selectProject,setView};', context);
assert.equal(preferences.get('savage-view-mode'), undefined, 'Opening a shared hideout link does not change the landing page');
assert.equal(document.querySelector('#motion-toggle').attrs['aria-pressed'], 'true');
assert.ok(document.querySelector('#motion-toggle').innerHTML.includes('Motion off'));
assert.equal(document.querySelector('#project-count').textContent, '15');
assert.ok(document.querySelector('#project-index').innerHTML.includes('>10</span>Rewind'));
for (const project of projects) {
  context.api.selectProject(project.id);
  const content = document.querySelector('#project-detail').innerHTML;
  assert.ok(content.includes(project.name) && content.includes(project.short));
  assert.ok(content.includes('data-view="contact">Let’s build yours'));
  assert.equal((content.match(/<img /g) || []).length, project.image ? 1 : 0, 'Only the selected preview should be rendered');
  assert.ok(content.includes('https://github.com/Savage27z/' + project.repo));
  if (project.url) assert.ok(content.includes(project.url)); else assert.ok(content.includes('No confirmed public demo'));
  assert.equal(projectButtons.filter(b => b.attrs['aria-current'] === 'true').length, 1);
  for (const match of content.matchAll(/<a [^>]+target="_blank"[^>]*>/g)) assert.ok(match[0].includes('noopener noreferrer'));
}
for (const view of ['projects', 'about', 'contact']) {
  document.activeElement = navButtons[0];
  await context.api.setView(view);
  assert.equal(document.body.dataset.view, view);
  assert.equal(panels.filter(p => !p.hidden).length, 1);
  assert.equal(document.activeElement, document.querySelector('#' + view + '-title'));
  assert.equal(document.querySelector('#object-actions').inert, true);
  await context.api.setView('home');
  assert.equal(panels.filter(p => !p.hidden).length, 0);
  assert.equal(document.activeElement, navButtons[0]);
}
await context.api.setView('projects');
document.listeners.keydown({ key: 'ArrowRight', target: projectButtons[0], preventDefault() {} });
assert.equal(document.activeElement, projectButtons[1]);
document.listeners.keydown({ key: 'End', target: projectButtons[1], preventDefault() {} });
assert.equal(document.querySelector('#archive-position').textContent, '15 / 15');
document.listeners.keydown({ key: 'Escape', target: projectButtons[1], preventDefault() {} });
await Promise.resolve();
assert.equal(document.body.dataset.view, 'home');
location.hash = '#projects/sumi';
windowListeners.popstate();
await Promise.resolve();
assert.equal(document.body.dataset.view, 'projects');
assert.ok(document.querySelector('#project-detail').innerHTML.includes('Sumi 墨'));
await context.api.setView('not-a-view');
assert.equal(document.body.dataset.view, 'projects');
assert.ok(historyCalls.some(([, hash]) => hash === '#about'));
document.listeners.click({ target: { closest: selector => selector === '[data-leave-3d]' ? {} : null } });
assert.equal(preferences.get('savage-view-mode'), 'light', 'Leaving 3D is remembered');
await document.querySelector('#sound-toggle').listeners.click();
assert.equal(document.querySelector('#sound-toggle').attrs['aria-pressed'], 'true');
document.hidden = true;
document.listeners.visibilitychange();
assert.equal(document.querySelector('#sound-toggle').attrs['aria-pressed'], 'false');

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
assert.ok(meshes < 175, 'Model draw-call budget exceeded: ' + meshes);
// The resident's smooth head, painted face, hair, clothes and their ink
// outlines take about 18k of these; draw calls, the real cost on phones,
// stay under 175.
assert.ok(triangles < 28000, 'Model triangle budget exceeded: ' + triangles);
assert.ok(instances > 100, 'Repeated parts should be instanced');
assert.equal(new Set(world.pickables.map(p => p.userData.view)).size, 5);
const eyeHighlights = ['left-eye', 'right-eye'].map(name => world.characterHead.getObjectByName(name));
world.blink(true);
assert.ok(eyeHighlights.every(eye => !eye.visible), 'Blinking closes both eyes');
world.blink(false);
assert.ok(eyeHighlights.every(eye => eye.visible), 'Eyes reopen after a blink');
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
    const fit = Math.min(desiredHeight / world.screenHeight, desiredWidth / world.screenWidth);
    assert.ok(world.screenWidth * fit > 700, 'Desktop archive too narrow');
    assert.ok(world.screenHeight * fit > 450, 'Desktop archive too short');
  }
}
// Regression: the resident must not cross the workstation screen while its
// camera approaches, even after looking around from either end of the orbit.
// The eyes must also remain visible instead of disappearing behind hair.
for (const [width, height] of [[1440, 900], [1024, 768], [390, 844], [320, 640]]) {
  const aspect = width / height, mobile = width <= 700;
  const fit = Math.min(Math.max(220, Math.min(height - 215, height * .68)) / world.screenHeight,
    Math.max(320, Math.min(width - 150, width * .78)) / world.screenWidth);
  const distance = height / (2 * Math.tan(T.MathUtils.degToRad(18)) * fit);
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
      assert.equal(ray.intersectObject(world.characterHead, true)[0]?.object === eye, true, name + ' is obscured at ' + [yaw, tilt]);
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

// HTML labels must clear the resident's whole head (hair included) and one another.
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
        const size = { width: (mobile ? 120 : key === 'projects' ? 190 : 170) * textScale, height: (mobile ? 40 : 60) * textScale };
        const oldRect = { left: preferred.x - size.width / 2, right: preferred.x + size.width / 2, top: preferred.y - size.height, bottom: preferred.y };
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

let total = 0;
for (const dir of ['dist', 'dist/assets', 'dist/vendor']) for (const name of fs.readdirSync(dir)) {
  const path = dir + '/' + name;
  if (fs.statSync(path).isFile()) total += fs.statSync(path).size;
}
console.log('PASS: syntax, assets, icons, link safety and no-script fallbacks on all three pages.');
console.log('PASS: basic page follows the design rules (type scale, spacing, radii, no italics, no hyphenated copy).');
console.log('PASS: project cards, filters, GitHub summary (forks excluded) and stat fallbacks match the data.');
console.log('PASS: hideout views, focus return, keys, history, sound, and remembered 3D choice.');
console.log('PASS: model budget, viewport bounds, eyes visible past the hair, clear camera path, label placement, finite resident animations.');
console.log({ modelMeshes: meshes, modelTriangles: triangles, instancedParts: instances, totalSiteBytes: total, threeGzipBytes: gzipSync(fs.readFileSync('dist/vendor/three.module.min.js')).length });
console.log('Static, geometry and simulated-DOM checks. Visuals were reviewed with headless Chrome screenshots; real-device frame rates are not measured.');
