import { Composition } from 'remotion';
import { Reel, reelLength } from './scenes';
import { FPS, HEIGHT, WIDTH } from './theme';

/**
 * Two cuts of one video.
 *
 * Walkthrough is what a committee watches once, before deciding whether to
 * put their society's money in an app. Launch is what gets forwarded into a
 * WhatsApp group, where nobody has decided to watch anything: same scenes,
 * fewer of them, held for less time, and the argument made in the first ten
 * seconds rather than the last.
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
  { id: 'billTrail' as const },
  { id: 'ownMoney' as const },
  { id: 'reconcileLive' as const },
  { id: 'whenItCloses' as const },
  { id: 'closure' as const },
  { id: 'fourSurfaces' as const },
  { id: 'whatsapp' as const },
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
  { id: 'whatsapp' as const, hold: 165 },
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
    </>
  );
}
