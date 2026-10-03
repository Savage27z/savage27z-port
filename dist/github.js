// Numbers for the proof strip and the "more live builds" list, derived from
// the public GitHub API. The snapshot below is the fallback (and what visitors
// without JavaScript see); site.js refreshes it from the API once per session.
export const GITHUB_USER = 'Savage27z';
const housekeeping = new Set(['savage27z', 'skills-communicate-using-markdown', 'skills-introduction-to-github', 'code']);
const notShowcased = new Set(['savage-portfolio', 'savage27z-port']);
const markup = new Set(['HTML', 'CSS', 'SCSS', 'Astro', 'Vue', 'Svelte', 'MDX', 'Jupyter Notebook', 'Dockerfile']);
const YEAR = 365 * 864e5;

export const prettyName = name => {
  const words = name.replace(/^-+|-+$/g, '').replace(/[-_]+/g, ' ').replace(/(^| )i( |$)/g, '$1I$2');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// repos: GitHub API objects. curatedRepos: repository names already featured.
export function summarize(repos, curatedRepos, now = Date.now()) {
  const own = repos.filter(repo => !repo.fork && !housekeeping.has(repo.name.toLowerCase()));
  const live = own.filter(repo => /^https?:\/\//.test(repo.homepage || ''));
  const curated = new Set(curatedRepos.map(name => name.toLowerCase()));
  return {
    projects: own.length,
    live: live.length,
    recent: own.filter(repo => now - Date.parse(repo.created_at) < YEAR).length,
    languages: new Set(own.map(repo => repo.language).filter(language => language && !markup.has(language))).size,
    more: live
      .filter(repo => !curated.has(repo.name.toLowerCase()) && !notShowcased.has(repo.name.toLowerCase()))
      .sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at))
      .map(repo => ({ name: prettyName(repo.name), url: repo.homepage, repo: repo.name, language: repo.language || '' }))
  };
}

export const snapshot = {
 "date": "2026-10-02",
 "projects": 63,
 "live": 30,
 "recent": 60,
 "languages": 5,
 "more": [
  {
   "name": "Moodmint",
   "url": "https://moodmint-beta.vercel.app",
   "repo": "moodmint",
   "language": "TypeScript"
  },
  {
   "name": "Veil",
   "url": "https://veil-six-smoky.vercel.app",
   "repo": "Veil",
   "language": "TypeScript"
  },
  {
   "name": "Grann",
   "url": "https://grann-nine.vercel.app",
   "repo": "grann",
   "language": "HTML"
  },
  {
   "name": "Techmonk",
   "url": "https://techmonk-dun.vercel.app",
   "repo": "Techmonk",
   "language": "CSS"
  },
  {
   "name": "Bullseye",
   "url": "https://bullseye-pi.vercel.app",
   "repo": "Bullseye",
   "language": "HTML"
  },
  {
   "name": "Blitz",
   "url": "https://blitz-pied.vercel.app",
   "repo": "Blitz",
   "language": "TypeScript"
  },
  {
   "name": "Jailbreak",
   "url": "https://jailbreak-beta.vercel.app",
   "repo": "Jailbreak",
   "language": "TypeScript"
  },
  {
   "name": "Nullspace",
   "url": "https://nullspace-kappa.vercel.app",
   "repo": "Nullspace",
   "language": "TypeScript"
  },
  {
   "name": "Zeitgeist",
   "url": "https://zeitgeist-five.vercel.app",
   "repo": "zeitgeist",
   "language": "JavaScript"
  },
  {
   "name": "AlphaDesk",
   "url": "https://alpha-desk-eight.vercel.app",
   "repo": "AlphaDesk",
   "language": "JavaScript"
  },
  {
   "name": "DEGEN.ID",
   "url": "https://degen-id.vercel.app",
   "repo": "DEGEN.ID",
   "language": "TypeScript"
  },
  {
   "name": "Hall of Rugs",
   "url": "https://hall-of-rugs.vercel.app",
   "repo": "Hall-of-Rugs",
   "language": "TypeScript"
  },
  {
   "name": "Memecoin Launch Kit Generator",
   "url": "https://memecoin-launch-kit-generator.vercel.app",
   "repo": "Memecoin-Launch-Kit-Generator",
   "language": "TypeScript"
  },
  {
   "name": "The Tweet city",
   "url": "https://the-tweet-city.vercel.app",
   "repo": "The-Tweet-city",
   "language": "TypeScript"
  },
  {
   "name": "Am I being scammed",
   "url": "https://am-i-being-scammed.vercel.app",
   "repo": "Am-i-being-scammed-",
   "language": "TypeScript"
  },
  {
   "name": "Savage news",
   "url": "https://savage-news.vercel.app",
   "repo": "savage-news",
   "language": "TypeScript"
  },
  {
   "name": "Rock paper scissor game",
   "url": "https://rock-paper-scissor-game-virid.vercel.app",
   "repo": "Rock-paper-scissor-game",
   "language": ""
  }
 ]
};
