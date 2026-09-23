/**
 * Films the app being used, rather than photographed.
 *
 * capture.mjs takes stills of components and Remotion pans across them. That
 * reads as a brochure. This drives the app with a real cursor — moves that
 * accelerate and settle, clicks that land visibly, pages that actually
 * transition — and records the whole journey as one continuous take. Remotion
 * then cuts it, which is the right order round: the footage is a recording of
 * the product working, and the edit is an edit.
 *
 * What it films is the demo society, staged by stage.mjs and served at
 * /app/shanti-nivas, so the sidebar, the switcher, the profile menu and the
 * bottom bar are the app's own and the navigation between pages is the app's
 * own too. Invented residents, real product.
 *
 * The pointer it draws, and the moves it makes, are in capture/drive.mjs,
 * shared with the phone recorder beside it.
 *
 * Each beat is timestamped against the start of the recording and written to
 * beats.json, so the edit refers to "the moment Money opened" rather than to a
 * frame number that a re-record would invalidate.
 *
 *   node capture/record.mjs
 */
import { execFile, spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { promisify } from 'node:util';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_BASE, stageRoutes, unstageRoutes } from './stage.mjs';
import {
  arrived,
  cursorScript,
  glide,
  glideTo,
  press,
  readDown,
  startPointerAt,
} from './drive.mjs';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
// ffmpeg is a dependency of this package, not a global one like Playwright.
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const WEB = join(REPO, 'apps', 'web');
const OUT = join(HERE, '..', 'public', 'captures');
const PORT = 3124;
// Next only hydrates its dev chunks over `localhost`; on 127.0.0.1 it treats
// them as cross-origin and blocks them, so nothing on the page would work.
const BASE = `http://localhost:${PORT}`;
const VIEW = { width: 1440, height: 900 };

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);

// ---------------------------------------------------------------------------
// The dev server
// ---------------------------------------------------------------------------
function startServer() {
  log(`starting next dev on ${PORT}`);
  return spawn(
    'node',
    [join(REPO, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT)],
    {
      cwd: WEB,
      env: {
        ...process.env,
        // The demo society is rendered from a file, not from a project, so
        // these only have to be present. Nothing here reads a real row.
        NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
        SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
        NEXT_PUBLIC_SITE_URL: BASE,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

async function waitForServer(page) {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    try {
      const response = await page.goto(`${BASE}${DEMO_BASE}`, { timeout: 4000 });
      if (response && response.status() < 400) return;
    } catch {
      /* not up yet */
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('next dev never came up');
}

/**
 * Visits every page the take will visit, before the camera is on.
 *
 * next dev compiles a route the first time it is asked for, which takes
 * seconds. Inside a recording that is a freeze in the middle of a click, and
 * no amount of waiting afterwards gets the time back. Paid for here instead,
 * where nothing is being filmed.
 */
async function warm(page) {
  const routes = [
    '/',
    DEMO_BASE,
    `${DEMO_BASE}/money`,
    `${DEMO_BASE}/events`,
    `${DEMO_BASE}/event`,
    `${DEMO_BASE}/contribute`,
    `${DEMO_BASE}/admin/reconcile`,
  ];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  }
  log(`warmed ${routes.length} routes`);
}

/** How long the recording ran, read from the file rather than guessed. */
async function videoSeconds(file) {
  // ffmpeg-static ships no ffprobe, and -i alone exits non-zero after printing
  // the header, which is where the duration is.
  const { stderr } = await run(ffmpeg, ['-i', file]).catch((error) => error);
  const match = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr ?? '');
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

// ---------------------------------------------------------------------------
// The take
// ---------------------------------------------------------------------------
async function main() {
  await mkdir(OUT, { recursive: true });
  await stageRoutes(log);
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
    await warm(probe);
    await probe.close();

    const context = await browser.newContext({
      viewport: VIEW,
      deviceScaleFactor: 1,
      recordVideo: { dir: join(OUT, 'take-raw'), size: VIEW },
    });
    await context.addInitScript(cursorScript('pointer'));

    const page = await context.newPage();
    page.on('pageerror', (error) => console.error(`  ! ${error.message}`));
    startPointerAt(VIEW.width / 2, VIEW.height - 120);

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

    // ---- inside the society ----------------------------------------------
    await page.goto(`${BASE}${DEMO_BASE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1100);
    beat('app:home');
    // Across the three figures, left to right, the way anybody reads them.
    await glide(page, 480, 300, 800);
    await page.waitForTimeout(500);
    await glide(page, 900, 300, 700);
    await page.waitForTimeout(900);

    // The sidebar is the app's own, so this is the app's own navigation.
    await press(page, page.getByRole('link', { name: 'Money', exact: true }).first());
    await arrived(page, page.getByText('Every transaction'));
    await page.waitForTimeout(900);
    beat('app:money');

    await readDown(page, 520, 2600);
    await page.waitForTimeout(1200);
    beat('app:ledger');

    // The row the flat question exists for: a neighbour nobody had listed at
    // a door. It says so, rather than leaving a space that reads as a bug.
    const gap = page.getByText('Flat not recorded').first();
    if (await gap.count()) {
      await glideTo(page, gap, 900);
      await page.waitForTimeout(1500);
      beat('app:flat-gap');
    }

    await readDown(page, 520, 2400);
    await page.waitForTimeout(1000);
    beat('app:ledger-end');

    await press(page, page.getByRole('link', { name: 'Events', exact: true }).first());
    await arrived(page, page.getByText('All events'));
    await page.waitForTimeout(1000);
    beat('app:events');
    await glide(page, 760, 360, 800);
    await page.waitForTimeout(1200);

    // Into the event itself, which is what everything else hangs off.
    await press(page, page.getByRole('link', { name: /Ganesh Chaturthi 2026/i }).first());
    await arrived(page, page.getByText('Readiness'));
    await page.waitForTimeout(1200);
    beat('app:event');

    // The checklist, and the readiness figure it computes.
    await glide(page, 600, 300, 900);
    await page.waitForTimeout(1600);
    beat('app:readiness');

    // Down to the bills: vendor, amount, who approved it, and the bill itself.
    await readDown(page, 470, 2400);
    await page.waitForTimeout(1500);
    beat('app:bills');

    // And the one nobody may approve, because they filed it.
    await readDown(page, 520, 2200);
    await page.waitForTimeout(1800);
    beat('app:ownMoney');

    // Back up to the fund, and through the door a resident walks.
    await readDown(page, -990, 1800);
    await page.waitForTimeout(700);
    await press(page, page.getByRole('link', { name: 'Contribute', exact: true }).first());
    await arrived(page, page.getByText('Which flat is this payment for?'));
    await page.waitForTimeout(1000);
    beat('app:contribute');

    // Naming the flat, before the note that carries it is copied.
    const flat = page.locator('select').first();
    if (await flat.count()) {
      await glideTo(page, flat, 800);
      await page.waitForTimeout(500);
      await flat.selectOption({ index: 1 });
      await page.waitForTimeout(1800);
      beat('app:flat-named');
    }

    await readDown(page, 420, 2000);
    await page.waitForTimeout(1600);
    beat('app:note');

    // A reported payment is a claim until the bank agrees with it.
    await press(page, page.getByRole('link', { name: 'Reconcile', exact: true }).first());
    await arrived(page, page.getByText('Nobody has explained these yet'));
    await page.waitForTimeout(1300);
    beat('app:reconcile');
    await glide(page, 700, 430, 900);
    await page.waitForTimeout(2200);
    beat('app:matched');

    beat('end');
    await page.waitForTimeout(800);

    const video = page.video();
    const closedAt = Date.now();
    await context.close();
    const file = join(OUT, 'take.webm');
    await video.saveAs(file);
    await rm(join(OUT, 'take-raw'), { recursive: true, force: true });

    // Recording starts when the context opens, which is before the clock the
    // beats are measured against — a blank page and a navigation, and in this
    // container about two and a half seconds of it. Every beat is that much
    // later in the file than it is in the log, so the edit would cut early
    // all the way through. Measured, not guessed: the file knows how long it
    // is, and the wall clock knows how long the take was.
    const duration = await videoSeconds(file);
    const lead = duration ? Math.max(0, duration - (closedAt - opened) / 1000) : 0;

    await writeFile(
      join(HERE, '..', 'src', 'beats.json'),
      `${JSON.stringify(
        {
          viewport: VIEW,
          lead: Number(lead.toFixed(2)),
          duration: duration ? Number(duration.toFixed(2)) : null,
          beats: beats.map((entry) => ({ ...entry, at: Number((entry.at + lead).toFixed(2)) })),
        },
        null,
        2,
      )}\n`,
    );
    log(`take saved — ${beats.length} beats, ${lead.toFixed(2)}s lead-in`);
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await unstageRoutes(log);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
