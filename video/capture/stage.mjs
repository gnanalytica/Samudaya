/**
 * Puts the demo society into the app, and takes it out again.
 *
 * Both scripts here need the same thing: a society with pages to photograph or
 * film, mounted inside the real app rather than beside it. So the harness is
 * copied to apps/web/src/app/zz-demo, and the society half of it is served at
 * /app/shanti-nivas — the path the app's own navigation builds — by a rewrite
 * in the proxy. The pages beside it stay at /zz-demo, deliberately outside the
 * app shell: they are filmed at 900px for clips about one control, where a
 * 256px sidebar is a quarter of the frame spent on something else.
 *
 * That rewrite is the whole trick. SidebarNav builds every href from the slug
 * and lights the active one from usePathname(), so a demo served at /zz-demo
 * would have a sidebar that navigates nowhere and highlights nothing. Served
 * where the app expects it, the real navigation works: clicking Money in the
 * real sidebar loads the real Money layout, with a client-side transition,
 * exactly as it does for a member.
 *
 * Everything written here is removed in the same run. apps/web is byte for
 * byte what it was when the script finishes, so no page that exists only to be
 * filmed can reach a commit or a build.
 */
import { spawn } from 'node:child_process';
import { cp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const WEB = join(REPO, 'apps', 'web');
const STAGE = join(WEB, 'src', 'app', 'zz-demo');
const PROXY = join(WEB, 'src', 'proxy.ts');
const BACKUP = `${PROXY}.demo-backup`;

/** The society the demo set invents. Must match harness/demo-data.ts. */
export const DEMO_SLUG = 'shanti-nivas';
export const DEMO_BASE = `/app/${DEMO_SLUG}`;

/**
 * next dev paints a floating badge over the bottom-left corner of every page.
 * It is invisible to everyone who works on the app and glaring in a frame.
 */
export const HIDE_DEV_BADGE = 'nextjs-portal { display: none !important; }';

const REWRITE = `
  // Demo capture (video/capture/stage.mjs): the throwaway routes are served
  // where the app's own navigation points, so the sidebar works and lights up.
  // Returns before the session check, because there is no session.
  {
    const demoPath = request.nextUrl.pathname;
    if (demoPath === '${DEMO_BASE}' || demoPath.startsWith('${DEMO_BASE}/')) {
      const demoUrl = request.nextUrl.clone();
      demoUrl.pathname = '/zz-demo/society' + demoPath.slice(${DEMO_BASE.length});
      return NextResponse.rewrite(demoUrl);
    }
  }
`;

export async function stageRoutes(log) {
  log('writing the throwaway routes');
  await rm(STAGE, { recursive: true, force: true });
  await cp(join(HERE, 'harness'), STAGE, { recursive: true });

  const proxy = await readFile(PROXY, 'utf8');
  await writeFile(BACKUP, proxy);

  const anchor = 'export async function proxy(request: NextRequest) {';
  if (!proxy.includes(anchor)) throw new Error('proxy.ts no longer starts the way this expects');

  await writeFile(
    PROXY,
    proxy
      // The signed-out branch would send every shot to /login, which
      // photographs very well and shows nothing.
      .replace('const PUBLIC_PATHS = [', `const PUBLIC_PATHS = [\n  '/zz-demo',\n  '${DEMO_BASE}',`)
      .replace(anchor, anchor + REWRITE),
  );
}

export async function unstageRoutes(log) {
  log('removing the throwaway routes');
  await rm(STAGE, { recursive: true, force: true });
  await cp(BACKUP, PROXY).catch(() => {});
  await rm(BACKUP, { force: true });
  // next dev leaves generated types behind that name routes which no longer
  // exist, and tsc fails on them long after this script has forgotten it ran.
  await rm(join(WEB, '.next', 'dev'), { recursive: true, force: true });
  await rm(join(WEB, '.next', 'types'), { recursive: true, force: true });
  // next dev also rewrites next-env.d.ts to point into .next/dev.
  spawn('git', ['checkout', '--', 'apps/web/next-env.d.ts'], { cwd: REPO, stdio: 'ignore' });
}

export const paths = { REPO, WEB, STAGE, PROXY };
