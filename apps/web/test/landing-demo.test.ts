import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The demo video on the front page.
 *
 * A committee is being asked to put the society's money somewhere, and six
 * feature cards do not answer the question they actually have — what this
 * looks like when their neighbours use it. So forty seconds of the ledger runs
 * on the landing page before anybody signs in.
 *
 * What is pinned here is what would break it quietly. A hero that autoplays
 * for somebody who asked their system for less motion is a bug nobody reports.
 * A file that has crept up to eight megabytes is a landing page nobody waits
 * for, and the number only moves when someone re-encodes it, which is exactly
 * when a test should object.
 */
const ROOT = join(import.meta.dirname, '..');
const page = () => readFileSync(join(ROOT, 'src', 'app', 'page.tsx'), 'utf8');
const player = () => readFileSync(join(ROOT, 'src', 'app', 'demo-video.tsx'), 'utf8');
const proxy = () => readFileSync(join(ROOT, 'src', 'proxy.ts'), 'utf8');
const asset = (name: string) => join(ROOT, 'public', name);

describe('the demo video on the landing page', () => {
  it('is on the page, above the feature cards', () => {
    // Below them it is a footnote. The whole argument for putting a video on a
    // landing page is that somebody sees it before they decide to stop reading.
    const source = page();
    expect(source).toContain('<DemoVideo />');
    expect(source.indexOf('<DemoVideo />')).toBeLessThan(source.indexOf('FEATURES.map'));
  });

  it('says the society in it is invented', () => {
    // The footage names residents and what they paid. They are made up, and a
    // page about transparency is the last place to be coy about that.
    expect(page()).toContain('are invented');
  });

  it('never autoplays at somebody who asked for less motion', () => {
    // There is no markup for this: `autoplay` has no media query, so the
    // attribute has to be absent and the play call has to be conditional.
    const source = player();
    expect(source).not.toMatch(/\bautoPlay\b/);
    expect(source).toContain("window.matchMedia('(prefers-reduced-motion: reduce)').matches");
    expect(source).toContain('video.play()');
  });

  it('is muted, looping and inline, so a phone plays it in place', () => {
    // Without playsInline, iOS Safari takes the video fullscreen the moment it
    // starts, which on a landing page reads as a popup.
    const source = player();
    for (const attribute of ['muted', 'loop', 'playsInline', 'controls']) {
      expect(source).toContain(attribute);
    }
  });

  it('shows a poster, so the hero is never a black rectangle', () => {
    expect(player()).toContain('poster="/samudaya-demo-poster.jpg"');
    expect(existsSync(asset('samudaya-demo-poster.jpg'))).toBe(true);
  });

  it('is reachable by somebody who has not signed in', () => {
    // The proxy redirects anything it matches and does not recognise as public
    // to /login. Before video was excluded from its matcher, a signed-out
    // visitor asking for the demo was answered with an HTML login page under a
    // 200 and a video/mp4-shaped request — which the <video> tag reports as
    // DEMUXER_ERROR_COULD_NOT_OPEN, a long way from the cause.
    const matcher = proxy().slice(proxy().indexOf('matcher:'));
    expect(matcher).toContain('mp4');

    // And the rule itself still has to match the file, or the assertion above
    // is only about a comment.
    const pattern = /'\/\(\(\?!(.+)\)\.\*\)'/.exec(matcher);
    expect(pattern).not.toBeNull();
    const matches = (path: string) =>
      new RegExp(`^/((?!${pattern![1].replace(/\\\\/g, '\\')}).*)$`).test(path);
    expect(matches('/samudaya-demo.mp4')).toBe(false);
    expect(matches('/samudaya-demo-poster.jpg')).toBe(false);
    // Pages still go through it, or nobody is signed in anywhere.
    expect(matches('/app/shanti-nivas/money')).toBe(true);
  });

  it('is small enough to autoplay on mobile data', () => {
    // video/landing.mjs makes this file. If a re-encode pushes it past two
    // megabytes, that was a decision, and it should be made on purpose.
    const file = asset('samudaya-demo.mp4');
    expect(existsSync(file)).toBe(true);
    expect(statSync(file).size).toBeLessThan(2 * 1024 * 1024);
    expect(statSync(asset('samudaya-demo-poster.jpg')).size).toBeLessThan(200 * 1024);
  });
});
