import { Composition } from 'remotion';
import { LandscapeCover, PortraitCover } from './cover';
import { Reel, reelLength } from './scenes';
import { EXPLAIN_SIZE, ExplainReel, explainLength } from './landscape';
import { PORTRAIT_SIZE, PortraitReel, portraitLength } from './portrait';
import { FPS, HEIGHT, WIDTH, sec } from './theme';

/**
 * Two cuts of one video.
 *
 * Walkthrough is what a committee watches once, before deciding whether to
 * put their society's money in an app. Launch is what gets forwarded into a
 * group chat, where nobody has decided to watch anything: same scenes, fewer
 * of them, held for less time, and the argument made in the first ten seconds
 * rather than the last.
 */

const WALKTHROUGH = [
  { id: 'open' as const },
  { id: 'problem' as const },
  { id: 'startEvent' as const },
  { id: 'festival' as const },
  { id: 'openApp' as const },
  { id: 'eventLive' as const },
  { id: 'readiness' as const },
  { id: 'residentsPay' as const },
  { id: 'contributeLive' as const },
  { id: 'oneLedger' as const },
  { id: 'ledgerLive' as const },
  { id: 'flatGap' as const },
  { id: 'billTrail' as const },
  { id: 'ownMoney' as const },
  { id: 'reconcileLive' as const },
  { id: 'whenItCloses' as const },
  { id: 'closure' as const },
  { id: 'closureChosen' as const },
  { id: 'fourSurfaces' as const },
  { id: 'mcp' as const },
  { id: 'phone' as const },
  { id: 'close' as const },
];

const LAUNCH = [
  { id: 'open' as const, hold: 75 },
  { id: 'problem' as const, hold: 105 },
  { id: 'eventLive' as const, hold: 120 },
  { id: 'contributeLive' as const, hold: 150 },
  { id: 'ledgerLive' as const, hold: 150 },
  { id: 'phone' as const, hold: 105 },
  { id: 'close' as const, hold: 105 },
];

export function Root() {
  return (
    <>
      <Composition
        id="Walkthrough"
        component={Reel}
        durationInFrames={reelLength(WALKTHROUGH)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ order: WALKTHROUGH, score: 'score-walkthrough.wav' }}
      />
      <Composition
        id="Launch"
        component={Reel}
        durationInFrames={reelLength(LAUNCH)}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        defaultProps={{ order: LAUNCH, score: 'score-launch.wav' }}
      />
      {/* The two animated cuts, from one script in src/story.tsx. Each shot
          lasts as long as its headline and specifics take to read, and both
          cuts show the same words, so they share one timeline and one score.
          Only the layout around the handset differs. */}
      <Composition
        id="Explain"
        component={ExplainReel}
        durationInFrames={explainLength()}
        fps={FPS}
        width={EXPLAIN_SIZE.width}
        height={EXPLAIN_SIZE.height}
        defaultProps={{ score: 'score-story.wav' }}
      />
      <Composition
        id="Phone"
        component={PortraitReel}
        durationInFrames={portraitLength()}
        fps={FPS}
        width={PORTRAIT_SIZE.width}
        height={PORTRAIT_SIZE.height}
        defaultProps={{ score: 'score-story.wav' }}
      />
      {/* Their covers: the frame each video opens on when it is shared, and
          the thumbnails and link preview, which carry a play button. See
          src/cover.tsx and share.mjs. Stills in all but name: four seconds
          long only so the phone inside can be frozen three seconds into its
          shot, with its rows risen and its totals counted up. */}
      <Composition
        id="CoverPhone"
        component={PortraitCover}
        width={PORTRAIT_SIZE.width}
        height={PORTRAIT_SIZE.height}
        durationInFrames={sec(4)}
        fps={FPS}
        defaultProps={{ play: true }}
      />
      <Composition
        id="CoverWide"
        component={LandscapeCover}
        width={EXPLAIN_SIZE.width}
        height={EXPLAIN_SIZE.height}
        durationInFrames={sec(4)}
        fps={FPS}
        defaultProps={{ play: true }}
      />
      <Composition
        id="CoverLink"
        component={LandscapeCover}
        width={1200}
        height={630}
        durationInFrames={sec(4)}
        fps={FPS}
        defaultProps={{ play: true }}
      />
    </>
  );
}
