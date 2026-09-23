/**
 * Makes the copy of the video that the landing page serves.
 *
 * The render is 1920×1080 at CRF 18, which is right for anything anybody
 * downloads and wrong for a hero that autoplays: seven megabytes before a
 * visitor has read the headline. This is the same cut at 720p and a bitrate
 * chosen by looking at it — the footage is a ledger, so the test is whether
 * the amounts are still legible, not whether the file is small.
 *
 * The poster matters as much as the video. Without one the hero is a black
 * rectangle until enough has buffered to paint, which on a phone on mobile
 * data is most of the time somebody spends on the page.
 *
 *   npm run landing
 */
import { createRequire } from 'node:module';
import { execFile } from 'node:child_process';
import { mkdir, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE = join(HERE, 'out', 'samudaya-explain.mp4');
const PUBLIC = join(HERE, '..', 'apps', 'web', 'public');
const VIDEO = join(PUBLIC, 'samudaya-demo.mp4');
const POSTER = join(PUBLIC, 'samudaya-demo-poster.jpg');

/**
 * Home, with the fund counted up and the panel beside it filled in.
 *
 * The poster is what most visitors actually see — on a slow connection, and
 * for anybody who has asked their system for less motion, it is the whole
 * video — so it wants a frame that is both inviting and legible. The opening
 * card and the statement after it are neither: one is a logo and the other is
 * a sentence about a problem, and a still of either says nothing about what
 * the product is.
 */
const POSTER_AT = '6.2';

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);
const mb = (bytes) => `${(bytes / 1_048_576).toFixed(2)} MB`;

await stat(SOURCE).catch(() => {
  throw new Error(`${SOURCE} is missing — run: npm run render:explain`);
});
await mkdir(PUBLIC, { recursive: true });

await run(ffmpeg, [
  '-loglevel',
  'error',
  '-i',
  SOURCE,
  '-vf',
  'scale=1280:720:flags=lanczos',
  '-c:v',
  'libx264',
  // Main profile and yuv420p, because High or yuv444 will not play on older
  // Android browsers, which is a large share of who this is for.
  '-profile:v',
  'main',
  '-pix_fmt',
  'yuv420p',
  '-crf',
  '25',
  '-preset',
  'slow',
  // Puts the index at the front, so the browser can start playing before the
  // whole file has arrived instead of after.
  '-movflags',
  '+faststart',
  '-c:a',
  'aac',
  '-b:a',
  '96k',
  '-ac',
  '2',
  '-y',
  VIDEO,
]);
log(`video  → apps/web/public/samudaya-demo.mp4 (${mb((await stat(VIDEO)).size)})`);

await run(ffmpeg, [
  '-loglevel',
  'error',
  '-ss',
  POSTER_AT,
  '-i',
  SOURCE,
  '-frames:v',
  '1',
  '-vf',
  'scale=1280:720:flags=lanczos',
  '-q:v',
  '5',
  '-y',
  POSTER,
]);
log(`poster → apps/web/public/samudaya-demo-poster.jpg (${mb((await stat(POSTER)).size)})`);
