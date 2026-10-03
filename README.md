# SAVAGE 愛

vibe building tools so you don’t have to….

A static portfolio with two ways in: a fast, editorial **basic page** (`/`) and an interactive **3D rooftop hideout** (`/hideout.html`). No framework, no build step. Serve `dist/` as static files.

## Basic page (`index.html`, `site.css`, `site.js`)
Layout after thegreatola.com: hero, proof strip, selected work, services, about, contact. The look follows uphive.xyz (dark olive canvas, lime accent, pill buttons, numbered steps, FAQ, lime closing band). The visual rules come from the `landing-page-design` skill in elayadesign/ai-design-skills:

- **Type and spacing**: one typeface (Manrope), no italics, Tailwind type-scale sizes only, spacing tokens from 2 to 96px, Tailwind radii.
- **Backgrounds**: flat everywhere. The only gradient is on the hero heading text.
- **Navigation**: a floating glass pill nav. On mobile the hamburger morphs into an X and opens a blurred overlay.
- **Motion**: blur fade-up reveals via IntersectionObserver, and a word-by-word tagline reveal, all on one custom easing curve. Reduced motion is respected.
- **Themes**: dark by default, with a light theme in thegreatola's paper tones.

`check.mjs` enforces these rules.

Sections and behaviour:
- **Work**: renders from `projects.js`, with filters for All, AI, Onchain, 3D and games, and Tools. Plot is the featured card. Old links like `#projects/sumi` scroll to and highlight that card.
- **Recognition**: 6× hackathon winner (stated by the owner; also in the proof strip), plus the Kane CLI Hackathon certificate of participation from TestMu AI. The 3D journal repeats both.
- **More live builds**: lists your other deployed GitHub repos.
- **Contact**: a brief form that opens the visitor's email app with the brief filled in, or copies it. No server needed.
- **404 page**: branded.
- **Images**: the share card (`assets/og.jpg`), the hero card and the about portrait are real renders of the 3D scene.

## GitHub numbers (`github.js`, `update-github.mjs`)
The proof strip counts your public, non-fork repos: projects, live demos (repos with a homepage URL), projects started in the last year, and programming languages. Your profile README, the GitHub exercise repos and the empty `code` repo are excluded.

The page shows the saved snapshot immediately, then refreshes it from the public GitHub API once per session. If the API is unreachable, the snapshot stays.

To refresh the snapshot and the no-JavaScript fallbacks:

```
node update-github.mjs
```

## 3D hideout (`hideout.html`, `hideout.js`, `scene.js`, `atmosphere.js`, `world.js`, `avatar.js`)

**Scene**
- An anime-style rooftop with three-step toon shading.
- Cool moonlight casts soft shadows on desktop. Lanterns, the door and the monitor are warm practical lights with glow halos.
- A gradient night sky, twinkling stars, a haloed moon and drifting clouds.
- Blinking red beacons on the distant towers, and sakura petals blowing off the potted tree.

**Resident**
- Styled after the owner's current PFP: fluffy white hair, sleepy half-lidded yellow-green eyes with tired creases, and a dark teal turtleneck.
- Built the way anime-style 3D characters usually are: a smooth head with the face painted onto it (a canvas texture, with an open and a closed version for blinking), hair made of tapered locks over a scalp cap, and an ink outline. Face and hair use their own gentle shading and take no cast shadows.
- A stylized adaptation, not a reproduction.
- It blinks, breathes, and turns to face the camera. The cat breathes and flicks its tail, and the lanterns sway.

**Camera**
- The opening shot looks up at the moon, then cranes down onto the roof.
- Mouse movement adds subtle parallax, and drag orbits within bounded limits.

**Interaction**
- The workstation opens the project archive, the journal opens about, and the pocket radio opens contact.
- "Say hello" waves; "Wake the cat" sends it to its other spot.
- City sound is synthesized locally, and stays off until clicked.

**Performance**
- Ambient animation is capped at about 30 fps and sleeps after 90 seconds without interaction.
- It stops entirely with reduced motion, in background tabs, or offscreen.
- Sustained slow frames step quality down (shadows, then petals, clouds and extra lights, then static), with a prompt to switch to the basic page.
- If WebGL fails, the page shows a fallback that links to the basic page.
- Static parts are instanced or merged: about 155 draw calls and 23k triangles for the rooftop model. Most of the triangles are the resident's smooth head, hair and outline.

**Navigation**
- Choosing "3D hideout" on the basic page is remembered, so the next fresh visit to `/` opens the hideout. "Basic page" switches back.
- Back and forward navigation never bounces between the two pages.

## Assets
- `hideout.webp`, `hideout-portrait.webp`, `resident.webp` and `og.jpg` are renders of the 3D scene. To re-capture them, add `?capture` to the hideout URL: this disables the intro and slow-device fallbacks, and exposes `window.__hideout.pose(position, target)` for framing and `window.__hideout.blink(closed)` for checking the eyes.
- `certificate-kane-cli.png` is the owner's TestMu AI certificate, shown as issued, name included.
- Twelve project previews are captured from the real public frontends. Sumi and Vandal show their title screens. Recon, Redstring and REVOKED have no confirmed public demo and link to source only.
- `rooftop.webp` and `rooftop-mobile.webp` (the original illustration) are no longer referenced by either page.
- Icons are Phosphor (MIT), inlined as an SVG sprite. Manrope is loaded from Google Fonts.

## Verification
Run:

```
node check.mjs
```

It covers:
- **Pages**: syntax, local assets, icon references, link safety and no-script fallbacks on all three pages.
- **Design rules** on the basic page.
- **Data**: card rendering, filter counts, the GitHub summariser (forks excluded) and the stat fallbacks.
- **Hideout app**: a simulated DOM run through every view, focus return, keyboard navigation, history and sound.
- **3D model**: model budgets, viewport bounds, and that both eyes stay visible past the hair from every allowed angle.
- **Camera and labels**: the Projects camera path stays clear of the resident, and hotspot labels stay clear of the head at measured label sizes.

Visuals were reviewed with headless Chrome screenshots; real-device frame rates are not measured.

## Serving
Static hosting of `dist/`. On Vercel, `vercel.json` serves `dist/` with no install or build step and uses `404.html` for missing pages; import the repo with default settings. The earlier host identity is in `.openai/hosting.json`. No server keys, wallet connections or paid API calls. Runtime requests go only to Google Fonts and the public GitHub API.
