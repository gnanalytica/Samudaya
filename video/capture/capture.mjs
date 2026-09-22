/**
 * Films the real app for the demo video.
 *
 * The product this video is about is a ledger, so the shots have to be the
 * ledger — not a drawing of one. But the pages that show it are behind a
 * sign-in and a society's real data, which is exactly the data that must not
 * be in a video: the Money page names neighbours and what they paid.
 *
 * So this mounts the app's own components — LedgerRow, ContributeForm,
 * FestivalNameField, AllocateSurplusForm — on throwaway routes with a
 * fabricated society, and films those. Real components, real CSS, real
 * layout, invented people. Every frame in the video is the product; none of
 * it is anybody's money.
 *
 * The routes are written in, filmed, and deleted again in one run, so the
 * repository never carries a page that exists only to be photographed, and
 * `next build` never ships one.
 *
 *   node capture/capture.mjs
 */
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is installed globally in this environment rather than as a
// dependency of this package, which is also why the browser is never
// downloaded: PLAYWRIGHT_BROWSERS_PATH already points at one.
const require = createRequire('/opt/node22/lib/node_modules/');
const { chromium } = require('playwright');

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const WEB = join(REPO, 'apps', 'web');
const STAGE = join(WEB, 'src', 'app', 'zz-demo');
const PROXY = join(WEB, 'src', 'proxy.ts');
const OUT = join(HERE, '..', 'public', 'captures');
const PORT = 3123;
// Next only hydrates its dev chunks over `localhost`; on 127.0.0.1 it treats
// them as cross-origin and blocks them, so the page renders and nothing on it
// works. Every interactive shot here would silently come out dead.
const BASE = `http://localhost:${PORT}`;

const env = {
  ...process.env,
  NEXT_PUBLIC_SUPABASE_URL: 'https://placeholder.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'placeholder-service-role-key',
  NEXT_PUBLIC_SITE_URL: BASE,
};

/** Where the interaction actually begins inside each recording. */
const clipTiming = {};

const log = (message) => console.log(`\x1b[36m▸\x1b[0m ${message}`);

/**
 * next dev paints a floating badge over the bottom-left corner of every page.
 * It is invisible to everyone who works on the app and glaring in a still.
 */
const HIDE_DEV_BADGE = 'nextjs-portal { display: none !important; }';

async function stageRoutes() {
  log('writing the throwaway routes');
  await rm(STAGE, { recursive: true, force: true });
  await cp(join(HERE, 'harness'), STAGE, { recursive: true });
  // The proxy sends a signed-out visitor to /login, which would photograph
  // very well and show nothing.
  const proxy = await readFile(PROXY, 'utf8');
  await writeFile(`${PROXY}.demo-backup`, proxy);
  await writeFile(
    PROXY,
    proxy.replace('const PUBLIC_PATHS = [', "const PUBLIC_PATHS = [\n  '/zz-demo',"),
  );
}

async function unstageRoutes() {
  log('removing the throwaway routes');
  await rm(STAGE, { recursive: true, force: true });
  const backup = `${PROXY}.demo-backup`;
  await cp(backup, PROXY).catch(() => {});
  await rm(backup, { force: true });
  // next dev leaves generated types behind that name routes which no longer
  // exist, and tsc fails on them long after this script has forgotten it ran.
  await rm(join(WEB, '.next', 'dev'), { recursive: true, force: true });
  await rm(join(WEB, '.next', 'types'), { recursive: true, force: true });
  // next dev also rewrites next-env.d.ts to point into .next/dev.
  spawn('git', ['checkout', '--', 'apps/web/next-env.d.ts'], { cwd: REPO, stdio: 'ignore' });
}

function startServer() {
  log(`starting next dev on ${PORT}`);
  const server = spawn(
    'node',
    [join(REPO, 'node_modules', 'next', 'dist', 'bin', 'next'), 'dev', '-p', String(PORT)],
    { cwd: WEB, env, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  server.stdout.on('data', (chunk) => process.env.DEBUG && process.stdout.write(chunk));
  server.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return server;
}

async function waitForServer(page) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await page.goto(`${BASE}/zz-demo/ledger`, { timeout: 4000 });
      if (response && response.status() < 400) return;
    } catch {
      /* not up yet */
    }
    await page.waitForTimeout(1000);
  }
  throw new Error('next dev never came up');
}

/** One still, at a named size, with the fonts settled. */
async function still(browser, { name, path, width, height, before }) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  page.on('pageerror', (error) => console.error(`  ! ${name}: ${error.message}`));
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  if (before) await before(page);
  await page.waitForTimeout(600);
  // fullPage, so the image is exactly as tall as the content. A fixed height
  // leaves dead space at the bottom, and dead space in a still is dead space
  // in the frame once Remotion pans across it.
  await page.screenshot({ path: join(OUT, `${name}.png`), fullPage: true });
  log(`shot ${name} (${width}×${height})`);
  await page.close();
}

/**
 * One interaction, filmed. Playwright writes webm; Remotion reads it happily,
 * and not transcoding keeps the text crisp — a re-encode at this size turns
 * 12px captions into mush.
 */
async function clip(browser, { name, path, width, height, act }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: join(OUT, `${name}-raw`), size: { width, height } },
  });
  const page = await context.newPage();
  page.on('pageerror', (error) => console.error(`  ! ${name}: ${error.message}`));

  // Recording starts with the context, so the file opens on a blank page, a
  // navigation and a first paint — several seconds of nothing before anybody
  // touches the app. The video cannot start there and it cannot be guessed
  // at either, so the wall clock is read on both sides of the interaction and
  // written out beside the file. Remotion seeks to it.
  const opened = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
  await page.addStyleTag({ content: HIDE_DEV_BADGE });
  await page.waitForTimeout(700);
  const began = Date.now();
  await act(page);
  const ended = Date.now();
  await page.waitForTimeout(700);

  const video = page.video();
  await context.close();
  await video.saveAs(join(OUT, `${name}.webm`));
  await rm(join(OUT, `${name}-raw`), { recursive: true, force: true });

  // A beat before the first move, so the scene does not open mid-gesture.
  const lead = 0.5;
  clipTiming[name] = {
    startSeconds: Math.max(0, (began - opened) / 1000 - lead),
    actionSeconds: (ended - began) / 1000 + lead,
  };
  log(`clip ${name} (${width}×${height}) — action at ${clipTiming[name].startSeconds.toFixed(1)}s`);
}

async function main() {
  await mkdir(OUT, { recursive: true });
  await stageRoutes();
  const server = startServer();
  let browser;

  try {
    browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
    const probe = await browser.newPage();
    await waitForServer(probe);
    await probe.close();

    // ---- the ledger, which is the whole argument for the product ----------
    await still(browser, {
      name: 'ledger',
      path: '/zz-demo/ledger',
      width: 1100,
      height: 900,
    });
    await still(browser, {
      name: 'ledger-phone',
      path: '/zz-demo/ledger',
      width: 390,
      height: 844,
    });

    // ---- the landing page, which is real and needs no set at all ---------
    await still(browser, { name: 'landing', path: '/', width: 1280, height: 800 });

    // ---- contributing, before and after the flat is answered -------------
    await still(browser, {
      name: 'contribute',
      path: '/zz-demo/contribute',
      width: 1100,
      height: 900,
      before: async (page) => {
        await page.locator('select').first().selectOption({ index: 2 });
        await page.waitForTimeout(300);
      },
    });

    // ---- closing an event: two answers, not three ------------------------
    await still(browser, {
      name: 'closure',
      path: '/zz-demo/closure',
      width: 900,
      height: 700,
    });
    await still(browser, {
      name: 'closure-chosen',
      path: '/zz-demo/closure',
      width: 900,
      height: 700,
      before: async (page) => {
        await page.getByRole('radio').nth(1).check();
        await page.waitForTimeout(400);
        await page.locator('select[name="to_event"]').selectOption({ index: 1 });
        await page.waitForTimeout(300);
      },
    });

    // ---- typing three letters and having the year's festival answer ------
    await clip(browser, {
      name: 'festival',
      path: '/zz-demo/festival',
      width: 900,
      height: 620,
      act: async (page) => {
        const box = page.getByRole('combobox');
        await box.click();
        await page.waitForTimeout(400);
        for (const letter of 'gan') {
          await box.press(letter);
          await page.waitForTimeout(260);
        }
        await page.waitForTimeout(1100);
        await page.getByRole('option').first().click();
        await page.waitForTimeout(1200);
      },
    });

    // ---- the flat question, and the note answering it --------------------
    await clip(browser, {
      name: 'flat',
      path: '/zz-demo/contribute',
      width: 900,
      height: 760,
      act: async (page) => {
        await page.waitForTimeout(500);
        await page.locator('select').first().selectOption({ index: 1 });
        await page.waitForTimeout(1600);
      },
    });
    // Beside the source, not with the captures: scenes.tsx imports it, so a
    // clean clone has to typecheck before anybody has run a capture.
    await writeFile(
      join(HERE, '..', 'src', 'clips.json'),
      `${JSON.stringify(clipTiming, null, 2)}\n`,
    );
  } finally {
    if (browser) await browser.close();
    server.kill('SIGTERM');
    await unstageRoutes();
  }

  log('done — captures are in video/public/captures');
}

main().catch(async (error) => {
  console.error(error);
  process.exitCode = 1;
});
