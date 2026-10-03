import { projects } from './projects.js';

// Pure HTML builders for the basic page. No DOM access, so check.mjs can
// exercise every project without a browser.
export const filters = [
  { key: 'all', label: 'All' },
  { key: 'ai', label: 'AI' },
  { key: 'web3', label: 'Onchain' },
  { key: '3d', label: '3D and games' },
  { key: 'tools', label: 'Tools' }
];

export const inGroup = (project, key) => key === 'all' || project.groups.includes(key);
export const countGroup = key => projects.filter(project => inGroup(project, key)).length;


const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = name => '<svg class="i" aria-hidden="true"><use href="#i-' + name + '"/></svg>';
const external = (href, label, className) =>
  '<a class="' + className + '" href="' + escape(href) + '" target="_blank" rel="noopener noreferrer">' + label + icon('arrow-up-right') + '</a>';
const number = index => String(index + 1).padStart(2, '0');

function links(project, primaryClass) {
  const game = project.groups.includes('games');
  return '<div class="card-links">' +
    (project.url ? external(project.url, game ? 'Play game' : 'Live site', primaryClass) : '') +
    external('https://github.com/Savage27z/' + project.repo, 'Source', 'btn btn-sm btn-ghost') + '</div>';
}

function shot(project, className, eager = false) {
  if (!project.image) {
    return '<div class="' + className + ' shot-empty"><span class="shot-empty-name">' + escape(project.name) +
      '</span><span class="shot-empty-note">' + icon('github-logo') + 'Source available · no public demo</span></div>';
  }
  const game = project.groups.includes('games');
  return '<figure class="' + className + '"><img src="/assets/' + project.image + '.webp" alt="' + escape(project.name) +
    (game ? ' title screen' : ' landing page') + '" width="1350" height="930" decoding="async"' + (eager ? '' : ' loading="lazy"') + '></figure>';
}

const chips = tags => '<ul class="chips">' + tags.map(tag => '<li>' + escape(tag) + '</li>').join('') + '</ul>';

export function projectCard(project, index) {
  const groups = escape(project.groups.join(' '));
  if (project.featured) {
    return '<article class="card card-featured reveal" id="project-' + project.id + '" data-groups="' + groups + '">' +
      '<div class="feat-text">' +
      '<div class="feat-top"><span class="badge">Featured</span><span class="card-kind">' + escape(project.type) + '</span></div>' +
      '<h3 class="feat-title">' + escape(project.name) + '</h3>' +
      '<p class="feat-short">' + escape(project.short) + '</p>' +
      '<p class="feat-detail">' + escape(project.detail) + '</p>' +
      chips(project.tags) + links(project, 'btn btn-sm btn-lime') + '</div>' +
      shot(project, 'feat-shot', true) +
      '<ol class="feat-steps">' + (project.steps || []).map(([title, body], i) =>
        '<li><span>' + number(i) + '</span><strong>' + escape(title) + '</strong><p>' + escape(body) + '</p></li>').join('') + '</ol></article>';
  }
  return '<article class="card reveal" id="project-' + project.id + '" data-groups="' + groups + '">' +
    shot(project, 'card-shot') +
    '<div class="card-body">' +
    '<p class="card-kind"><span>' + number(index) + '</span>' + escape(project.type) + '</p>' +
    '<h3 class="card-title">' + escape(project.name) + '</h3>' +
    '<p class="card-short">' + escape(project.short) + '</p>' + chips(project.tags) +
    '<details class="card-more"><summary>How it works' + icon('plus') + '</summary><p>' + escape(project.detail) + '</p></details>' +
    links(project, 'btn btn-sm btn-lime') + '</div></article>';
}

export function filterButtons(active = 'all') {
  return filters.map(({ key, label }) =>
    '<button type="button" class="filter" data-filter="' + key + '" aria-pressed="' + (key === active) + '">' +
    label + '<span class="filter-count">' + countGroup(key) + '</span></button>').join('');
}
