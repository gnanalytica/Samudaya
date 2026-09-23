import { Composition } from 'remotion';
import { Reel, reelLength } from './scenes';
import { EXPLAIN_SIZE, ExplainReel, explainLength } from './landscape';
import { PORTRAIT_SIZE, PortraitReel, portraitLength } from './portrait';
import { FPS, HEIGHT, WIDTH } from './theme';

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
      {/* The two animated cuts, from one script in src/story.tsx: fourteen
          beats following a single ₹2,001 from a resident's phone to a signed
          decision. Explain uses the width beside the handset for the points
          the portrait cut has no room for; Phone is the fast one. */}
      <Composition
        id="Explain"
        component={ExplainReel}
        durationInFrames={explainLength()}
        fps={FPS}
        width={EXPLAIN_SIZE.width}
        height={EXPLAIN_SIZE.height}
        defaultProps={{ score: 'score-phone.wav' }}
      />
      <Composition
        id="Phone"
        component={PortraitReel}
        durationInFrames={portraitLength()}
        fps={FPS}
        width={PORTRAIT_SIZE.width}
        height={PORTRAIT_SIZE.height}
        defaultProps={{ score: 'score-phone.wav' }}
      />
    </>
  );
}
