import {
  AbsoluteFill,
  Audio,
  OffthreadVideo,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Fade } from './components';
import { Diya, Petals, Rangoli, Toran, festive } from './festive';
import { fontFamily, sec } from './theme';
import take from './phone-beats.json';

/**
 * The portrait cut.
 *
 * Most of a residents' society reads its ledger standing in a lift, and a
 * landscape video cropped to a phone is a landscape video with its sides cut
 * off. So this is built from its own recording — `capture/record-phone.mjs`,
 * at a phone's viewport, through the app's own mobile layout, where the
 * sidebar becomes a sheet and a four-slot bar appears along the bottom.
 *
 * Captions are larger and shorter than the landscape ones. A phone is held at
 * arm's length on a bus, usually on mute, and anything that needs two lines at
 * this size needs to be a different sentence.
 */

const SIZE = { width: 1080, height: 1920 };
/** The recording's own pixels; see record-phone.mjs on why it is 1:1. */
const TAKE = { src: 'captures/phone.webm', width: 390, height: 844 };
/** Big enough to read, small enough to leave the caption its own air. */
const SCALE = 1.86;
const BEZEL = 13;

function beatAt(name: string) {
  const found = take.beats.find((entry) => entry.name === name);
  // Better to fail the render than to publish a cut that opens on the wrong
  // screen because a beat was renamed in the recorder and not here.
  if (!found) throw new Error(`phone-beats.json has no beat named "${name}"`);
  return found.at;
}

/** The phone itself: the take, in a slim dark bezel, on the festive ground. */
function PhoneTake({ at, lead = 1.4, hold }: { at: string; lead?: number; hold: number }) {
  const width = TAKE.width * SCALE;
  const height = TAKE.height * SCALE;
  return (
    <AbsoluteFill style={{ alignItems: 'center', paddingTop: 92 }}>
      <div
        style={{
          width: width + BEZEL * 2,
          height: height + BEZEL * 2,
          backgroundColor: festive.deep,
          borderRadius: 54,
          padding: BEZEL,
          boxShadow: '0 40px 90px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.09)',
        }}
      >
        <div style={{ width, height, borderRadius: 42, overflow: 'hidden' }}>
          <OffthreadVideo
            src={staticFile(TAKE.src)}
            startFrom={sec(Math.max(0, beatAt(at) - lead))}
            muted
            style={{ width, height, objectFit: 'cover' }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
}

/** Bigger than the landscape caption, and sitting under the phone. */
function PortraitCaption({ text, hold }: { text: string; hold: number }) {
  const frame = useCurrentFrame();
  const entered = interpolate(frame, [sec(0.2), sec(0.8)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const leaving =
    1 -
    interpolate(frame, [hold - sec(0.4), hold], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    });
  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 56 }}>
      <div
        style={{
          maxWidth: 940,
          color: 'white',
          fontFamily,
          fontSize: 52,
          lineHeight: 1.22,
          textAlign: 'center',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          textShadow: '0 4px 18px rgba(0,0,0,0.5)',
          opacity: Math.min(entered, leaving),
          transform: `translateY(${(1 - entered) * 16}px)`,
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

function PortraitBookend({ headline, sub, hold }: { headline: string; sub: string; hold: number }) {
  const frame = useCurrentFrame();
  const entered = interpolate(frame, [sec(0.2), sec(1.2)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <Fade hold={hold}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Rangoli
            size={1300}
            opacity={0.1 * entered}
            spin={frame * 0.05}
            accent={festive.accent}
            ribbon={festive.accent}
            strokeWidth={0.6}
          />
        </AbsoluteFill>
        <Petals hold={hold} count={12} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.85 }}>
          <Toran width={SIZE.width} />
        </div>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: 90 }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <Diya size={180} lit={sec(0.35)} />
            </div>
            <div
              style={{
                color: 'white',
                fontSize: 116,
                fontWeight: 600,
                letterSpacing: '-0.035em',
                opacity: entered,
              }}
            >
              {headline}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.8)',
                fontSize: 46,
                marginTop: 24,
                lineHeight: 1.25,
                opacity: interpolate(frame, [sec(0.9), sec(1.8)], [0, 1], {
                  extrapolateLeft: 'clamp',
                  extrapolateRight: 'clamp',
                }),
              }}
            >
              {sub}
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/** A screen from the take, dressed, with its caption. */
function PortraitScene({
  at,
  caption,
  hold,
  lead,
}: {
  at: string;
  caption: string;
  hold: number;
  /** How long before the beat to open, when the scroll into it is the point. */
  lead?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <Fade hold={hold}>
        <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Rangoli
            size={1500}
            opacity={0.06}
            spin={-frame * 0.03}
            accent={festive.accent}
            ribbon={festive.accent}
            strokeWidth={0.6}
          />
        </AbsoluteFill>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, opacity: 0.7 }}>
          <Toran width={SIZE.width} />
        </div>
        <PhoneTake at={at} lead={lead} hold={hold} />
        <PortraitCaption text={caption} hold={hold} />
      </Fade>
    </AbsoluteFill>
  );
}

type Shot = { id: string; hold: number; node: (hold: number) => React.ReactNode };

export const PORTRAIT_SHOTS: Record<string, Shot> = {
  open: {
    id: 'open',
    hold: sec(3.5),
    node: (hold) => (
      <PortraitBookend
        headline="Samudaya"
        sub="Your society's festivals, in your pocket."
        hold={hold}
      />
    ),
  },
  home: {
    id: 'home',
    hold: sec(4.5),
    node: (hold) => (
      <PortraitScene
        at="home"
        caption="Open it in September and it looks like September."
        hold={hold}
      />
    ),
  },
  event: {
    id: 'event',
    hold: sec(5),
    node: (hold) => (
      <PortraitScene at="event" caption="One page for the whole festival." hold={hold} />
    ),
  },
  bills: {
    id: 'bills',
    hold: sec(5),
    node: (hold) => (
      <PortraitScene
        at="event:bills"
        // Opens during the scroll rather than at the end of it, so the approved
        // bills go past before the one nobody may approve arrives.
        lead={3.4}
        caption="Every bill on the record — and nobody signs off their own."
        hold={hold}
      />
    ),
  },
  pay: {
    id: 'pay',
    hold: sec(5.5),
    node: (hold) => (
      <PortraitScene
        at="contribute:flat"
        caption="Two taps to pay, straight into the society's account."
        hold={hold}
      />
    ),
  },
  sheet: {
    id: 'sheet',
    hold: sec(3.5),
    node: (hold) => (
      <PortraitScene at="sheet" caption="Everything the society has, one tap away." hold={hold} />
    ),
  },
  ledger: {
    id: 'ledger',
    hold: sec(6),
    node: (hold) => (
      <PortraitScene
        at="money:ledger"
        caption="Every rupee in, with a name beside it."
        hold={hold}
      />
    ),
  },
  close: {
    id: 'close',
    hold: sec(3.5),
    node: (hold) => (
      <PortraitBookend headline="Samudaya" sub="Nothing hidden. Nothing to chase." hold={hold} />
    ),
  },
};

export const PORTRAIT_ORDER = [
  'open',
  'home',
  'event',
  'bills',
  'pay',
  'sheet',
  'ledger',
  'close',
] as const;

const OVERLAP = sec(0.3);

export function PortraitReel({ score }: { score?: string }) {
  const { durationInFrames } = useVideoConfig();
  let at = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      {score ? (
        <Audio
          src={staticFile(score)}
          volume={(frame) =>
            Math.min(
              interpolate(frame, [0, sec(0.5)], [0, 1], { extrapolateRight: 'clamp' }),
              interpolate(frame, [durationInFrames - sec(2), durationInFrames], [1, 0], {
                extrapolateLeft: 'clamp',
              }),
            )
          }
        />
      ) : null}
      {PORTRAIT_ORDER.map((id) => {
        const shot = PORTRAIT_SHOTS[id];
        const from = at;
        at += shot.hold - OVERLAP;
        return (
          <Sequence key={id} from={from} durationInFrames={shot.hold}>
            {shot.node(shot.hold)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

export function portraitLength() {
  return PORTRAIT_ORDER.reduce((total, id) => total + PORTRAIT_SHOTS[id].hold - OVERLAP, OVERLAP);
}

export const PORTRAIT_SIZE = SIZE;
