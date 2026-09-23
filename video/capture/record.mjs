/**
 * Films the app being used, rather than photographed.
 *
 * capture.mjs takes stills of components and Remotion pans across them. That
 * reads as a brochure. This drives the real app with a real cursor — moves
 * that accelerate and settle, clicks that land visibly, pages that actually
 * transition — and records the whole journey as one continuous take. Remotion
 * then cuts it, which is the right order: the footage is a recording of the
 * product working, and the edit is an edit.
 *
 * Playwright draws no cursor of its own (its mouse is synthetic, so there is
 * nothing for the compositor to capture), which is why every screen recording
 * made this way looks haunted — menus open with nothing touching them. So one
 * is drawn into the page, fed by the same mouse events the app receives.
 *
 * Each beat is timestamped against the start of the recording and written to
 * beats.json, so the edit refers to "the moment Money opened" rather than to a
 * frame number that a re-record would invalidate.
 *
 *   node capture/record.mjs
 *
 * Signed-in flows need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * and SUPABASE_SERVICE_ROLE_KEY in the environment. Without them this records
 * only what a signed-out visitor can reach, and says so.
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const WEB = join(REPO, 'apps', 'web');
const OUT = join(HERE, '..', 'public', 'captures');
const PORT = 3124;
// Next only hydrates its dev chunks over `localhost`; on 127.0.0.1 it treats
// them as cross-origin and blocks them, so nothing on the page would work.
const BASE = `http://localhost:${PORT}`;
const VIEW = { width: 1440, height: 900 };

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const signedIn = Boolean(supabaseUrl && anonKey && !supabaseUrl.includes('placeholder'));

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);

// ---------------------------------------------------------------------------
// The cursor
// ---------------------------------------------------------------------------
/**
 * Runs before anything on the page, on every navigation. It listens in the
 * capture phase so a page that stops propagation on its own handlers cannot
 * freeze the pointer, and it never touches layout: everything is fixed,
 * pointer-events:none, and appended to <html> rather than <body>, so the app
 * underneath behaves exactly as it does without it.
 */
const CURSOR_SCRIPT = `(() => {
  const ID = '__samudaya_cursor';
  const install = () => {
    if (document.getElementById(ID)) return;

    const style = document.createElement('style');
    style.textContent = \`
      #\${ID}, #\${ID}-ring { position: fixed; pointer-events: none; z-index: 2147483647; }
      #\${ID} { width: 24px; height: 24px; margin: -2px 0 0 -2px; opacity: 0;
               transition: opacity .25s ease; filter: drop-shadow(0 2px 4px rgba(0,0,0,.35)); }
      #\${ID}-ring { width: 14px; height: 14px; border-radius: 999px; margin: -7px 0 0 -7px;
                    background: rgba(15,118,110,.30); border: 2px solid rgba(15,118,110,.85);
                    opacity: 0; transform: scale(.4); }
      #\${ID}-ring.pulse { animation: \${ID}-pulse .5s ease-out; }
      @keyframes \${ID}-pulse {
        0%   { opacity: .95; transform: scale(.4); }
        100% { opacity: 0;   transform: scale(3.2); }
      }
      /* The dev-server badge is invisible to anyone who works on the app and
         glaring in a frame. */
      nextjs-portal { display: none !important; }
    \`;
    document.documentElement.appendChild(style);

    const ring = document.createElement('div');
    ring.id = ID + '-ring';
    document.documentElement.appendChild(ring);

    const cursor = document.createElement('div');
    cursor.id = ID;
    cursor.innerHTML =
      '<svg viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M5 2.5 L5 19.2 L9.2 15.3 L12.1 21.6 L15.1 20.2 L12.2 14 L18 13.6 Z" ' +
      'fill="#16211e" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.documentElement.appendChild(cursor);

    addEventListener('mousemove', (event) => {
      cursor.style.opacity = '1';
      cursor.style.left = event.clientX + 'px';
      cursor.style.top = event.clientY + 'px';
      ring.style.left = event.clientX + 'px';
      ring.style.top = event.clientY + 'px';
    }, true);

    addEventListener('mousedown', (event) => {
      ring.style.left = event.clientX + 'px';
      ring.style.top = event.clientY + 'px';
      ring.classList.remove('pulse');
      // Reading offsetWidth restarts the animation; without it a second click
      // in the same place draws nothing.
      void ring.offsetWidth;
      ring.classList.add('pulse');
    }, true);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
  // Next replaces large parts of the tree on navigation; this puts the cursor
  // back if it ever goes with them.
  setInterval(install, 500);
})();`;

// ---------------------------------------------------------------------------
// Moving like a person
// ---------------------------------------------------------------------------
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Where the pointer currently is, so every move starts where the last ended. */
let at = { x: VIEW.width / 2, y: VIEW.height - 120 };

/**
 * A move with acceleration and a settle. Playwright's `steps` option
 * interpolates linearly, which reads as a machine; this eases, which reads as
 * a hand.
 */
async function glide(page, x, y, ms = 650) {
  const from = { ...at };
  const steps = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= steps; i += 1) {
    const t = ease(i / steps);
    await page.mouse.move(from.x + (x - from.x) * t, from.y + (y - from.y) * t);
    await page.waitForTimeout(ms / steps);
  }
  at = { x, y };
}

async function glideTo(page, locator, ms) {
  const box = await locator.boundingBox();
  if (!box) throw new Error('nothing to glide to');
  await glide(page, box.x + box.width / 2, box.y + box.height / 2, ms);
  return box;
}

/** Move to a thing, pause as if reading it, then click it. */
async function press(page, locator, { settle = 420 } = {}) {
  await glideTo(page, locator);
  await page.waitForTimeout(settle);
  await page.mouse.down();
  await page.waitForTimeout(90);
  await page.mouse.up();
}

/**
 * Scrolling the way a reader does: eased, and slow enough that the text is
 * legible on the way past. A wheel event jumps, which in a video about a
 * ledger means the evidence goes by unread.
 */
async function readDown(page, distance, ms = 2200) {
  await page.evaluate(
    ([dy, duration]) =>
      new Promise((resolve) => {
        const start = window.scrollY;
        const began = performance.now();
        const step = (now) => {
          const t = Math.min(1, (now - began) / duration);
          const eased = t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
          window.scrollTo(0, start + dy * eased);
          if (t < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      }),
    [distance, ms],
  );
}

// ---------------------------------------------------------------------------
// The dev server
// ---------------------------------------------------------------------------
function startServer() {
  log(
    `starting next dev on ${PORT}${signedIn ? ' against the real project' : ' (signed-out only)'}`,
  );
  return spawn(
    'node',
    [join(REPO, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT)],
    {
      cwd: WEB,
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ?? 'https://placeholder.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: anonKey ?? 'placeholder-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'placeholder',
        NEXT_PUBLIC_SITE_URL: BASE,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function waitForServer(page) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await page.goto(BASE, { timeout: 4000 });
      if (response && response.status() < 400) return;
    } catch {
      /* not up yet */
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('next dev never came up');
}

// ---------------------------------------------------------------------------
// The take
// ---------------------------------------------------------------------------
async function main() {
  await mkdir(OUT, { recursive: true });
  const server = startServer();
  let browser;
  const beats = [];
  let opened = 0;
  const beat = (name) => {
    const atSeconds = (Date.now() - opened) / 1000;
    beats.push({ name, at: Number(atSeconds.toFixed(2)) });
    log(`  ${atSeconds.toFixed(1).padStart(5)}s  ${name}`);
  };

  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const probe = await browser.newPage();
    await waitForServer(probe);
    await probe.close();

    const context = await browser.newContext({
      viewport: VIEW,
      deviceScaleFactor: 1,
      recordVideo: { dir: join(OUT, 'take-raw'), size: VIEW },
    });
    await context.addInitScript(CURSOR_SCRIPT);

    const page = await context.newPage();
    page.on('pageerror', (error) => console.error(`  ! ${error.message}`));

    opened = Date.now();
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    // Nudge the pointer on screen, so it fades in before it is needed rather
    // than appearing from nowhere at the first click.
    await glide(page, VIEW.width / 2, VIEW.height - 160, 300);
    await page.waitForTimeout(400);

    // ---- the landing page, read the way a visitor reads it ---------------
    beat('landing:top');
    await glide(page, 620, 430, 700);
    await page.waitForTimeout(700);

    const joinCta = page.getByRole('link', { name: /Join your society/i }).first();
    if (await joinCta.count()) {
      await glideTo(page, joinCta, 800);
      await page.waitForTimeout(900);
      beat('landing:cta');
    }

    await readDown(page, 620, 2600);
    beat('landing:features');
    await page.waitForTimeout(1400);

    await readDown(page, 620, 2400);
    beat('landing:bottom');
    await page.waitForTimeout(1200);

    if (!signedIn) {
      log('no Supabase credentials in the environment — stopping after the public pages');
      beat('end');
    } else {
      // The signed-in journey goes here once the environment carries the keys.
      beat('end');
    }

    await page.waitForTimeout(800);
    const video = page.video();
    await context.close();
    await video.saveAs(join(OUT, 'take.webm'));
    await rm(join(OUT, 'take-raw'), { recursive: true, force: true });

    await writeFile(
      join(HERE, '..', 'src', 'beats.json'),
      `${JSON.stringify({ viewport: VIEW, signedIn, beats }, null, 2)}\n`,
    );
    log(`take saved — ${beats.length} beats`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await rm(join(WEB, '.next', 'dev'), { recursive: true, force: true });
    await rm(join(WEB, '.next', 'types'), { recursive: true, force: true });
    spawn('git', ['checkout', '--', 'apps/web/next-env.d.ts'], { cwd: REPO, stdio: 'ignore' });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
