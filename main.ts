// Velmara — a sun-soaked coastal open-world crime game for make.fun's
// "Make GTA 6" bounty (Node 22, standard library only): the game is this
// directory's game/ folder, plain static files a desktop browser loads
// offline (game/index.html, three.js vendored under game/vendor/, no network
// request), and the program hands it in. It copies game/ and screenshots/
// from beside this file to /output and writes /output/dossier.json, the
// summary the judge reads, with the vendored make.fun library.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output,
// or pass --out <dir>:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//   mkdir -p out && node main.ts --out out
//   node main.ts --help

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const outIndex = process.argv.indexOf('--out');
const out = outIndex !== -1 && process.argv[outIndex + 1]
  ? process.argv[outIndex + 1]
  : (process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

if (process.argv.includes('--help')) {
  console.log('Usage: node main.ts [--out <dir>]');
  console.log('  Copies game/ and screenshots/ beside this file to /output');
  console.log('  (or MAKEFUN_OUTPUT_DIR, or --out <dir>) and writes dossier.json.');
  process.exit(0);
}

// Refuse to hand in a half-built entry: the game folder and the screenshots
// the judge reads must both be there before anything is copied.
for (const needed of ['game', 'screenshots']) {
  if (!existsSync(join(here, needed))) throw new Error(`missing ${needed}/ beside main.ts`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
console.log(`Wrote ${out}/dossier.json from ${join(here, 'game')} and ${join(here, 'screenshots')}.`);
