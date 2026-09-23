/**
 * The same society, filmed on a phone.
 *
 * Most of a residents' society reads its ledger standing in a lift, so the
 * portrait cut is not a crop of the desktop one — it is a second recording, at
 * a phone's viewport, through the app's own mobile layout. That layout is a
 * different product: the sidebar becomes a sheet behind the society's name, a
 * four-slot bar appears along the bottom, and Money gives up its slot to Manage
 * for anybody on the committee, so the ledger is reached through the sheet.
 * None of that exists in the landscape take.
 *
 * The pointer is a finger rather than an arrow — see capture/drive.mjs. A
 * phone has no cursor, and drawing one would be a small lie about how the app
 * is actually used.
 *
 *   node capture/record-phone.mjs
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
  press,
  readDown,
  reachAndPress,
  startPointerAt,
} from './drive.mjs';

const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');
const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
const run = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const WEB = join(REPO, 'apps', 'web');
const OUT = join(HERE, '..', 'public', 'captures');
const PORT = 3127;
// Next only hydrates its dev chunks over `localhost`; on 127.0.0.1 it treats
// them as cross-origin and blocks them, so nothing on the page would work.
const BASE = `http://localhost:${PORT}`;
/** An iPhone-ish logical viewport, which is what the app's breakpoints assume. */
const VIEW = { width: 390, height: 844 };

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);

function startServer() {
  log(`starting next dev on ${PORT}`);
  return spawn(
    'node',
    [join(REPO, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT)],
    {
      cwd: WEB,
      env: {
        ...process.env,
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

/** Every route the take visits, compiled before the camera is on. */
async function warm(page) {
  const routes = [
    '/',
    DEMO_BASE,
    `${DEMO_BASE}/money`,
    `${DEMO_BASE}/events`,
    `${DEMO_BASE}/event`,
    `${DEMO_BASE}/contribute`,
  ];
  for (const route of routes) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  }
  log(`warmed ${routes.length} routes`);
}

/** How long the recording ran, read from the file rather than guessed. */
async function videoSeconds(file) {
  const { stderr } = await run(ffmpeg, ['-i', file]).catch((error) => error);
  const match = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(stderr ?? '');
  if (!match) return null;
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

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
      isMobile: true,
      hasTouch: true,
      // Playwright records at the viewport's CSS pixels and pads anything
      // larger rather than scaling to it: asking for a phone's 3x device
      // pixels produced a 390-wide page in the corner of a 1170-wide grey
      // frame. So the take is captured at 1:1 and the portrait composition
      // scales it, which is what a screen recording looks like anyway.
      recordVideo: { dir: join(OUT, 'phone-raw'), size: VIEW },
    });
    await context.addInitScript(cursorScript('touch'));

    const page = await context.newPage();
    page.on('pageerror', (error) => console.error(`  ! ${error.message}`));
    startPointerAt(VIEW.width / 2, VIEW.height - 60);

    opened = Date.now();
    await page.goto(`${BASE}${DEMO_BASE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1400);
    beat('home');

    // The stat tiles, two across on a phone because three never fit.
    await glide(page, 195, 330, 700);
    await page.waitForTimeout(1500);
    beat('home:money');

    // The bottom bar: four slots, and Money is not one of them for anybody on
    // the committee — Manage takes that slot, with the To-do count riding it.
    await press(page, page.getByRole('link', { name: 'Events', exact: true }).last());
    await arrived(page, page.getByText('All events'));
    await page.waitForTimeout(1200);
    beat('events');

    await press(page, page.getByRole('link', { name: /Ganesh Chaturthi 2026/i }).first());
    await arrived(page, page.getByText('Readiness'));
    await page.waitForTimeout(1400);
    beat('event');

    await readDown(page, 420, 2200);
    await page.waitForTimeout(1400);
    beat('event:readiness');

    await readDown(page, 620, 2400);
    await page.waitForTimeout(1500);
    beat('event:bills');

    // Through the door a resident actually walks. On a phone the page's two
    // columns stack, so Contribute is a long way down rather than beside the
    // fold — reachAndPress scrolls to it rather than guessing an offset.
    await reachAndPress(page, page.getByRole('link', { name: 'Contribute', exact: true }));
    await arrived(page, page.getByText('Which flat is this payment for?'));
    await page.waitForTimeout(1200);
    beat('contribute');

    const flat = page.locator('select').first();
    if (await flat.count()) {
      await flat.selectOption({ index: 1 });
      await page.waitForTimeout(1800);
      beat('contribute:flat');
    }

    await readDown(page, 360, 1800);
    await page.waitForTimeout(1500);
    beat('contribute:note');

    // The sheet behind the society's name, which is the only way to the ledger
    // from a phone when the bottom bar has given Money's slot to Manage.
    await page.goto(`${BASE}${DEMO_BASE}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    const sheet = page.getByRole('button', { name: /Shanti Nivas/i }).first();
    if (await sheet.count()) {
      await press(page, sheet);
      await page.waitForTimeout(1300);
      beat('sheet');
      await press(page, page.getByRole('link', { name: 'Money', exact: true }).first());
    } else {
      await page.goto(`${BASE}${DEMO_BASE}/money`, { waitUntil: 'networkidle' });
    }
    await arrived(page, page.getByText('Every transaction'));
    await page.waitForTimeout(1200);
    beat('money');

    await readDown(page, 700, 2800);
    await page.waitForTimeout(1600);
    beat('money:ledger');

    beat('end');
    await page.waitForTimeout(900);

    const video = page.video();
    const closedAt = Date.now();
    await context.close();
    const file = join(OUT, 'phone.webm');
    await video.saveAs(file);
    await rm(join(OUT, 'phone-raw'), { recursive: true, force: true });

    // Recording starts when the context opens, before the clock the beats are
    // measured against. Measured from the file's own duration against the wall
    // clock, or the whole cut runs early.
    const duration = await videoSeconds(file);
    const lead = duration ? Math.max(0, duration - (closedAt - opened) / 1000) : 0;

    await writeFile(
      join(HERE, '..', 'src', 'phone-beats.json'),
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
    log(`phone take saved — ${beats.length} beats, ${lead.toFixed(2)}s lead-in`);
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
