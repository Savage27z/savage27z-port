import { projects } from './projects.js';
import { projectCard, filterButtons, inGroup } from './project-cards.js';
import { summarize, snapshot, GITHUB_USER } from './github.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
const savePref = (key, value) => { try { localStorage.setItem(key, value); } catch {} };

// Project grid and filters, rendered from the same data as the 3D archive.
const grid = $('#project-grid');
grid.innerHTML = projects.map(projectCard).join('');
$('#filters').innerHTML = filterButtons('all');
// GitHub numbers: the snapshot renders immediately, then a once-per-session
// refresh from the public API keeps them current. Failures keep the snapshot.
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function applySummary(summary) {
  const values = { ...summary, featured: projects.length };
  for (const key of ['projects', 'live', 'recent', 'languages', 'featured']) $$('[data-stat="' + key + '"]').forEach(cell => { cell.textContent = values[key]; });
  $('#more-list').innerHTML = summary.more.map(item =>
    '<li><a href="' + escape(item.url) + '" target="_blank" rel="noopener noreferrer"><span>' + escape(item.name) + '</span><em>' + escape(item.language) +
    '</em><svg class="i" aria-hidden="true"><use href="#i-arrow-up-right"/></svg></a></li>').join('');
  $('#more').hidden = !summary.more.length;
}
applySummary(snapshot);
async function refreshFromGitHub() {
  try {
    const cached = JSON.parse(sessionStorage.getItem('savage-github') || 'null');
    if (cached && Date.now() - cached.at < 6 * 36e5) { applySummary(cached.summary); return; }
    const repos = [];
    for (let page = 1; page <= 5; page++) {
      const response = await fetch('https://api.github.com/users/' + GITHUB_USER + '/repos?per_page=100&type=owner&page=' + page, { headers: { Accept: 'application/vnd.github+json' } });
      if (!response.ok) return;
      const batch = await response.json();
      if (!Array.isArray(batch)) return;
      repos.push(...batch);
      if (batch.length < 100) break;
    }
    const summary = summarize(repos, projects.map(p => p.repo));
    if (!summary.projects) return;
    applySummary(summary);
    sessionStorage.setItem('savage-github', JSON.stringify({ at: Date.now(), summary }));
  } catch {}
}
if ('requestIdleCallback' in window) requestIdleCallback(refreshFromGitHub, { timeout: 3000 }); else setTimeout(refreshFromGitHub, 1500);

function applyFilter(key) {
  $$('.filter').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === key)));
  projects.forEach(project => {
    const card = $('#project-' + project.id);
    const show = inGroup(project, key);
    card.hidden = !show;
    if (show) card.classList.add('is-in');
  });
}
$('#filters').addEventListener('click', event => {
  const button = event.target.closest('.filter');
  if (button) applyFilter(button.dataset.filter);
});

// Scroll reveals: a heavy fade up as elements enter, observed rather than polled.
const revealObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    entry.target.classList.add('is-in');
    revealObserver.unobserve(entry.target);
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
// The hero always animates in on load; everything else waits for its moment.
requestAnimationFrame(() => $$('.hero .reveal').forEach(element => element.classList.add('is-in')));
$$('.reveal').forEach(element => { if (!element.closest('.hero')) revealObserver.observe(element); });

// Floating nav: glass state once the hero leaves, plus the current section.
const navWrap = $('.nav-wrap');
new IntersectionObserver(([entry]) => navWrap.classList.toggle('is-scrolled', !entry.isIntersecting),
  { rootMargin: '-80px 0px 0px 0px' }).observe($('.hero-title'));
const navLinks = $$('.nav-links a, .menu-links a[href^="#"]');
const spy = new IntersectionObserver(entries => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    navLinks.forEach(link => {
      if (link.getAttribute('href') === '#' + entry.target.id) link.setAttribute('aria-current', 'location');
      else link.removeAttribute('aria-current');
    });
  }
}, { rootMargin: '-45% 0px -50% 0px' });
['top', 'projects', 'services', 'about', 'faq', 'contact'].forEach(id => spy.observe(document.getElementById(id)));

// Mobile menu: the burger morphs into a cross; links stagger in.
const menu = $('#menu'), burger = $('.burger');
function setMenu(open) {
  burger.setAttribute('aria-expanded', String(open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  root.classList.toggle('menu-open', open);
  if (open) {
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add('is-open')));
  } else {
    menu.classList.remove('is-open');
    setTimeout(() => { if (!menu.classList.contains('is-open')) menu.hidden = true; }, reduce.matches ? 0 : 500);
  }
}
burger.addEventListener('click', () => setMenu(burger.getAttribute('aria-expanded') !== 'true'));
menu.addEventListener('click', event => { if (event.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && root.classList.contains('menu-open')) { setMenu(false); burger.focus(); }
});

// Theme: dark by default to match the night-time hideout.
const themeButton = $('.theme-toggle');
function setTheme(theme, persist = true) {
  root.dataset.theme = theme;
  themeButton.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  $('meta[name="theme-color"]').setAttribute('content', theme === 'dark' ? '#131209' : '#fbfaf7');
  if (persist) savePref('savage-theme', theme);
}
setTheme(root.dataset.theme === 'light' ? 'light' : 'dark', false);
themeButton.addEventListener('click', () => setTheme(root.dataset.theme === 'dark' ? 'light' : 'dark'));

// Entering the hideout is remembered, so returning visitors land in 3D.
document.addEventListener('click', event => {
  if (event.target.closest('[data-enter-3d]')) savePref('savage-view-mode', '3d');
});

// Tagline: words light up one at a time as the line scrolls past.
const tagline = $('#tagline');
tagline.innerHTML = tagline.textContent.trim().split(/\s+/).map(word => '<span class="word">' + word + '</span>').join(' ');
const words = $$('#tagline .word');
let taglineFrame = 0;
function paintTagline() {
  taglineFrame = 0;
  const box = tagline.getBoundingClientRect(), view = innerHeight;
  // Progress runs from the block's top entering the lower fifth to its bottom reaching the middle.
  const progress = Math.min(1, Math.max(0, (view * .8 - box.top) / (box.height + view * .3)));
  const lit = Math.round(progress * words.length);
  words.forEach((word, i) => word.classList.toggle('on', i < lit));
}
const onTaglineScroll = () => { if (!taglineFrame) taglineFrame = requestAnimationFrame(paintTagline); };
if (reduce.matches) words.forEach(word => word.classList.add('on'));
else {
  new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) { addEventListener('scroll', onTaglineScroll, { passive: true }); paintTagline(); }
    else removeEventListener('scroll', onTaglineScroll);
  }).observe(tagline);
}

// How it works: each step swaps the preview card.
const captions = ['Set the goal and the output.', 'A first version you can click.', 'Polished, shipped and linked.'];
$('#steps').addEventListener('click', event => {
  const step = event.target.closest('.step');
  if (!step) return;
  $$('.step').forEach(button => button.setAttribute('aria-pressed', String(button === step)));
  $('.preview-inner').dataset.state = step.dataset.step;
  $('#preview-caption').textContent = captions[step.dataset.step];
});

// Brief: examples fill the form; sending opens the visitor's email app.
const examples = {
  website: ['Website', 'A landing page for my coffee subscription. Visitors should understand the three plans in ten seconds and sign up from their phone.'],
  ai: ['AI tool', 'A tool that reads our support tickets every morning and drafts a summary of what customers asked about most, with links to the tickets.'],
  onchain: ['Onchain app', 'An escrow page where a client funds a milestone and the freelancer can claim it once the client approves the work.'],
  game: ['3D or browser game', 'A short browser game for our launch week. It should run on phones, take about two minutes to play and keep a leaderboard.']
};
const form = $('#brief');
const field = name => form.elements[name];
form.addEventListener('click', event => {
  const chip = event.target.closest('[data-example]');
  if (!chip) return;
  const [kind, brief] = examples[chip.dataset.example];
  field('kind').value = kind; field('brief').value = brief;
  $$('.chip').forEach(button => button.classList.toggle('is-active', button === chip));
  clearError('brief');
});
function showError(name, message) {
  field(name).setAttribute('aria-invalid', 'true');
  $('#' + name + '-error').textContent = message;
}
function clearError(name) {
  field(name).removeAttribute('aria-invalid');
  $('#' + name + '-error').textContent = '';
}
['name', 'brief'].forEach(name => field(name).addEventListener('input', () => clearError(name)));
function validate() {
  let first = null;
  if (!field('name').value.trim()) { showError('name', 'Add your name so I know who is asking.'); first = first || 'name'; }
  if (field('brief').value.trim().length < 20) { showError('brief', 'Tell me a little more. Twenty characters or so is enough.'); first = first || 'brief'; }
  if (first) field(first).focus();
  return !first;
}
function composeBrief() {
  const timeline = field('timeline').value.trim();
  return 'Hi SAVAGE,\n\n' + field('brief').value.trim() + '\n\nWhat: ' + field('kind').value +
    (timeline ? '\nTimeline: ' + timeline : '') + '\n\n— ' + field('name').value.trim();
}
const status = $('#brief-status');
form.addEventListener('submit', event => {
  event.preventDefault();
  if (!validate()) return;
  const subject = 'Project brief: ' + field('kind').value + ' from ' + field('name').value.trim();
  location.href = 'mailto:savage27zzz@gmail.com?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(composeBrief());
  status.textContent = 'Your email app should open with the brief. Nothing happened? Copy the brief and send it to savage27zzz@gmail.com.';
  status.classList.add('is-done');
});
$('#copy-brief').addEventListener('click', async () => {
  if (!validate()) return;
  const label = $('#copy-brief span');
  try {
    await navigator.clipboard.writeText(composeBrief());
    label.textContent = 'Copied';
    status.textContent = 'Brief copied. Paste it into an email, X or Telegram message.';
  } catch {
    status.textContent = 'Copying is blocked in this browser. Select the brief text and copy it manually.';
  }
  setTimeout(() => { label.textContent = 'Copy brief'; }, 2200);
});

// Old 3D-style links like #projects/sumi open the matching card.
function readAddress() {
  const [view, id] = location.hash.slice(1).split('/');
  if (view === 'home') { scrollTo({ top: 0, behavior: reduce.matches ? 'auto' : 'smooth' }); return; }
  if (view !== 'projects' || !id) return;
  const card = document.getElementById('project-' + id);
  if (!card) return;
  applyFilter('all');
  card.classList.add('is-in', 'is-highlighted');
  card.scrollIntoView({ block: 'center', behavior: reduce.matches ? 'auto' : 'smooth' });
  setTimeout(() => card.classList.remove('is-highlighted'), 2400);
}
addEventListener('hashchange', readAddress);
readAddress();
$('#year').textContent = new Date().getFullYear();
