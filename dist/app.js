import { projects } from './projects.js';
import { createAmbience } from './audio.js';
const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const views = ['home', 'projects', 'about', 'contact'];
const body = document.body;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const getPref = key => { try { return localStorage.getItem(key); } catch { return null; } };
const savePref = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
let currentView = 'home', currentProject = 'plot', epoch = 0, scene = null, loading = null;
let lightweight = getPref('savage-view-mode') === 'light' ||
  (!getPref('savage-view-mode') && (reduce.matches || navigator.connection?.saveData || navigator.deviceMemory <= 2));
let motion = !reduce.matches && getPref('savage-motion') !== 'off';
let returnFocus = null;
const ambience = createAmbience();
let soundOn = false;
const numberLabel = value => String(value).padStart(2, '0');
const projectCount = numberLabel(projects.length);

$('#project-count').textContent = projectCount;
$('#project-index').innerHTML = projects.map((p, i) =>
  '<button class="project-select" data-project="' + p.id + '" aria-current="' + (i === 0) + '">' +
  '<span class="project-number">' + numberLabel(i + 1) + '</span>' + p.name + '</button>').join('');

export function selectProject(id, updateAddress = true) {
  const project = projects.find(p => p.id === id);
  if (!project) return;
  currentProject = id;
  scene?.setProjectPreview(project.image, project.name);
  const index = projects.indexOf(project);
  const game = ['sumi', 'vandal'].includes(id);
  $('#project-detail').innerHTML =
    '<div class="project-topline"><div><h3>' + project.name + '</h3><p class="project-category">' +
    (id === 'plot' ? 'FEATURED / ' : '') + project.type + '</p></div><div class="project-links">' +
    (project.url ? '<a href="' + project.url + '" target="_blank" rel="noopener noreferrer">' +
    (game ? 'Play game' : 'Live site') + ' ↗</a>' : '') +
    '<a class="secondary" href="https://github.com/Savage27z/' + project.repo +
    '" target="_blank" rel="noopener noreferrer">Source ↗</a></div></div>' +
    '<p class="project-purpose">' + project.short + '</p>' +
    (project.image ? '<figure class="preview"><img src="/assets/' + project.image +
    '.webp" alt="' + project.name + (game ? ' real game title screen' : ' actual landing page') +
    '" width="1350" height="930" decoding="async"><figcaption>' +
    (game ? 'REAL TITLE SCREEN / GAMEPLAY NOT CAPTURED' : 'REAL FRONTEND / OPEN LIVE SITE TO INTERACT') +
    '</figcaption></figure>' : '<p class="source-note">Source available. No confirmed public demo—explore the repository below.</p>') +
    '<details class="project-notes"><summary>About this project</summary><p class="project-description">' + project.detail + '</p><div class="tags">' +
    project.tags.map(t => '<span>' + t + '</span>').join('') + '</div></details>' +
    '<div class="project-next"><span>Got an idea of your own?</span><button data-view="contact">Let’s build yours ↗</button></div>';
  $('#project-detail').scrollTop = 0;
  $$('.project-select').forEach(b => b.setAttribute('aria-current', String(b.dataset.project === id)));
  $('#archive-position').textContent = numberLabel(index + 1) + ' / ' + projectCount;
  if (updateAddress && currentView === 'projects') writeAddress('projects', false);
}
function writeAddress(view, push = true) {
  const hash = view === 'home' ? '#home' : '#' + view + (view === 'projects' ? '/' + currentProject : '');
  if (location.hash !== hash) history[push ? 'pushState' : 'replaceState'](null, '', hash);
}
function showPanel(view, focus) {
  const panel = $('#' + view + '-panel');
  if (panel) {
    panel.hidden = false;
    if (focus) $('#' + view + '-title').focus({ preventScroll: true });
  }
}
export async function setView(view, { address = true, focus = true } = {}) {
  if (!views.includes(view)) return;
  const sequence = ++epoch;
  const previous = currentView;
  if (previous === 'home' && view !== 'home') returnFocus = document.activeElement;
  currentView = view;
  body.dataset.view = view;
  $('#object-actions').inert = view !== 'home';
  $('#hotspots').inert = view !== 'home';
  $$('.panel').forEach(panel => { panel.hidden = true; });
  $$('#navigation [data-view]').forEach(button => {
    if (button.dataset.view === view) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (address) writeAddress(view);
  $('#announcement').textContent = view === 'home' ? 'Back at the hideout.' : 'Opening ' + view + '.';
  updateHint();
  if (scene && !lightweight) await scene.focus(view, !motion || previous === view);
  if (sequence !== epoch) return;
  if (view !== 'home') showPanel(view, focus);
  else if (focus && previous !== 'home') {
    (returnFocus?.isConnected ? returnFocus : $('#navigation [data-view="home"]')).focus({ preventScroll: true });
  }
}
function updateHint(message) {
  $('#scene-hint').textContent = message || (lightweight ? 'LIGHTWEIGHT VIEW / SAME WORK, LESS MOTION' :
    currentView === 'home' ? 'DRAG TO LOOK AROUND · SELECT AN OBJECT' : 'ESC TO RETURN TO THE ROOFTOP');
}
function setMotion(value) {
  motion = value && !reduce.matches;
  savePref('savage-motion', motion ? 'on' : 'off');
  $('#motion-toggle').textContent = motion ? 'Motion on' : 'Motion off';
  $('#motion-toggle').setAttribute('aria-pressed', String(!motion));
  scene?.setMotion(motion);
}
async function enableScene() {
  if (scene) return scene;
  if (loading) return loading;
  loading = (async () => {
    try {
      const module = await import('./scene.js');
      scene = await module.createScene($('#scene'), {
        onSelect: action => ['cat', 'character'].includes(action) ? interact(action) : setView(action),
        onSlow: () => switchMode(true, 'Switched to lightweight view to keep things responsive.'),
        onPanelRect: rect => {
          const panel = $('#projects-panel');
          if (!rect) { panel.removeAttribute('style'); return; }
          Object.assign(panel.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
        }
      });
      scene.setMotion(motion);
      const selected = projects.find(p => p.id === currentProject);
      scene.setProjectPreview(selected.image, selected.name);
      if (lightweight) scene.setEnabled(false);
      else {
        body.dataset.mode = '3d';
        scene.setEnabled(true);
        await setView(currentView, { address: false, focus: false });
        updateHint();
      }
      return scene;
    } catch (error) {
      console.warn('3D is unavailable; all portfolio sections remain available.', error);
      switchMode(true, '3D isn’t available here. All projects are available in lightweight view.');
      return null;
    } finally { loading = null; }
  })();
  return loading;
}
async function switchMode(value, message) {
  lightweight = value;
  savePref('savage-view-mode', value ? 'light' : '3d');
  body.dataset.mode = value ? 'light' : scene ? '3d' : 'loading';
  $('#mode-toggle').textContent = value ? 'Enter 3D hideout' : 'Lightweight view';
  $('#mode-toggle').setAttribute('aria-pressed', String(value));
  $('#projects-panel').removeAttribute('style');
  scene?.setEnabled(!value);
  if (!value) await enableScene();
  await setView(currentView, { address: false, focus: false });
  updateHint(message);
}
document.addEventListener('click', event => {
  const viewButton = event.target.closest('[data-view]');
  // Only navigation buttons carry actions; body also has a data-view state.
  if (viewButton?.tagName === 'BUTTON') setView(viewButton.dataset.view);
  const projectButton = event.target.closest('[data-project]');
  if (projectButton) selectProject(projectButton.dataset.project);
  const actionButton = event.target.closest('[data-action]');
  if (actionButton) interact(actionButton.dataset.action);
});
async function interact(action) {
  if (action === 'cat') {
    if (scene && !lightweight) {
      scene.playCat();
      $('#announcement').textContent = motion ? 'The cat stretches, finds another spot and curls up.' : 'The cat has moved to another resting spot.';
    } else $('#announcement').textContent = 'Enter the 3D hideout to meet the cat.';
  } else if (action === 'character') {
    const sequence = epoch;
    if (scene && !lightweight) await scene.wave();
    if (sequence === epoch && currentView === 'home') setView('about');
  }
}
$('#sound-toggle').addEventListener('click', async () => {
  const button = $('#sound-toggle'); button.disabled = true;
  try {
    soundOn = await ambience.setEnabled(!soundOn);
    button.textContent = soundOn ? 'City sound on' : 'City sound off';
    button.setAttribute('aria-pressed', String(soundOn));
  } catch { $('#announcement').textContent = 'Audio isn’t available in this browser.'; }
  finally { button.disabled = false; }
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    soundOn = false; ambience.setEnabled(false);
    $('#sound-toggle').textContent = 'City sound off';
    $('#sound-toggle').setAttribute('aria-pressed', 'false');
  }
});
$('#mode-toggle').addEventListener('click', () => switchMode(!lightweight));
$('#motion-toggle').addEventListener('click', () => setMotion(!motion));
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && currentView !== 'home') { event.preventDefault(); setView('home'); }
  const choice = event.target.closest?.('.project-select');
  if (choice && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
    event.preventDefault();
    const index = projects.findIndex(p => p.id === choice.dataset.project);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? projects.length - 1 :
      (index + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) + projects.length) % projects.length;
    selectProject(projects[next].id);
    const button = $('.project-select[data-project="' + projects[next].id + '"]');
    button.focus({ preventScroll: true });
    button.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
  }
});
reduce.addEventListener('change', event => { if (event.matches) setMotion(false); });
function readAddress() {
  const [view, id] = location.hash.slice(1).split('/');
  if (id) selectProject(id, false);
  setView(views.includes(view) ? view : 'home', { address: false, focus: false });
}
window.addEventListener('popstate', readAddress);
window.addEventListener('hashchange', readAddress);
selectProject('plot', false);
setMotion(motion);
body.dataset.mode = lightweight ? 'light' : 'loading';
$('#mode-toggle').textContent = lightweight ? 'Enter 3D hideout' : 'Lightweight view';
$('#mode-toggle').setAttribute('aria-pressed', String(lightweight));
readAddress();
if (!lightweight) {
  if ('requestIdleCallback' in window) requestIdleCallback(enableScene, { timeout: 900 });
  else setTimeout(enableScene, 50);
}
