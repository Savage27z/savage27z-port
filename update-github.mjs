// Refresh the GitHub snapshot used by the basic page's proof strip.
// usage: node update-github.mjs [path/to/repos.json]
// Without an argument it reads the public GitHub API (no token needed).
import fs from 'node:fs';
import { summarize, GITHUB_USER } from './dist/github.js';
import { projects } from './dist/projects.js';

async function fetchRepos() {
  const repos = [];
  for (let page = 1; page <= 5; page++) {
    const response = await fetch('https://api.github.com/users/' + GITHUB_USER + '/repos?per_page=100&type=owner&page=' + page,
      { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'savage27z-port' } });
    if (!response.ok) throw new Error('GitHub API ' + response.status);
    const batch = await response.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }
  return repos;
}

const repos = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : await fetchRepos();
const summary = { date: new Date().toISOString().slice(0, 10), ...summarize(repos, projects.map(p => p.repo)) };
const file = 'dist/github.js';
const source = fs.readFileSync(file, 'utf8').replace(/export const snapshot = [\s\S]*$/, 'export const snapshot = ' + JSON.stringify(summary, null, 1) + ';\n');
fs.writeFileSync(file, source);

// Keep the static fallbacks in index.html in step with the snapshot.
let html = fs.readFileSync('dist/index.html', 'utf8');
for (const key of ['projects', 'live', 'recent', 'languages']) {
  html = html.replace(new RegExp('(data-stat="' + key + '"[^>]*>)\\d+(<)', 'g'), '$1' + summary[key] + '$2');
}
fs.writeFileSync('dist/index.html', html);
console.log('Snapshot', summary.date + ':', summary.projects, 'projects,', summary.live, 'live,', summary.recent, 'started in the last year,',
  summary.languages, 'languages,', summary.more.length, 'more live builds.');
