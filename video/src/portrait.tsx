import type { ReactNode } from 'react';
import {
  AbsoluteFill,
  Audio,
  Easing,
  Sequence,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import { Diya, Petals, Rangoli, Toran, festive } from './festive';
import {
  BAR_H,
  BillsScreen,
  BottomBar,
  COMMITTEE,
  ChatScreen,
  EventScreen,
  HomeScreen,
  MoneyScreen,
  PayScreen,
  RESIDENT,
  ReconcileScreen,
  SCREEN,
  STATUS_H,
  StatusBar,
  ramp,
} from './screens';
import { color, fontFamily, sec } from './theme';

/**
 * The portrait cut: one phone, nine beats, no footage.
 *
 * Two things shape it. It is vertical because a residents' society reads its
 * ledger standing in a lift, and a landscape video cropped to a phone is a
 * landscape video with its sides cut off. And it is drawn rather than
 * recorded, because a recording moves at the speed a browser navigates —
 * every shot opened with a page settling, and the cut ran a third longer than
 * the thing it was saying.
 *
 * Structurally that buys the one trick this file is built around: the phone
 * never cuts. The ground, the bezel and the camera are rendered once, for the
 * whole video, and each shot supplies only the screen inside them. So the
 * screens push through a phone that stays put — which is what using an app
 * looks like — instead of nine shots of a phone being re-established.
 */

const SIZE = { width: 1080, height: 1920 };

/** Logical phone pixels → canvas pixels. */
const SCALE = 1.88;
const BEZEL = 14;
const TOP = 54;

const SCREEN_W = SCREEN.width * SCALE;
const SCREEN_H = SCREEN.height * SCALE;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_L = (SIZE.width - PHONE_W) / 2;
/** Where a screen sits on the canvas. The shell and every slot share this. */
const RECT = { left: PHONE_L + BEZEL, top: TOP + BEZEL, width: SCREEN_W, height: SCREEN_H };
const RADIUS = 46;

// ---------------------------------------------------------------------------
// The parts that never cut
// ---------------------------------------------------------------------------

/** Festive ground: kolam, toran, petals. Rendered once, so it never restarts. */
function Ground({ frame, length }: { frame: number; length: number }) {
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1560}
          opacity={0.06}
          spin={-frame * 0.025}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.72 }}>
        <Toran width={SIZE.width} />
      </div>
      <Petals hold={length} count={11} />
    </AbsoluteFill>
  );
}

/**
 * The handset. Its screen is filled with the app's own surface colour, which
 * is what shows through in the gap while one screen pushes the next along.
 */
function Shell() {
  return (
    <div
      style={{
        position: 'absolute',
        left: PHONE_L,
        top: TOP,
        width: PHONE_W,
        height: SCREEN_H + BEZEL * 2,
        backgroundColor: festive.deep,
        borderRadius: RADIUS + BEZEL,
        padding: BEZEL,
        boxShadow: '0 44px 100px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.1)',
      }}
    >
      <div
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          borderRadius: RADIUS,
          backgroundColor: color.surface,
        }}
      />
    </div>
  );
}

/**
 * The chrome that does not move: the clock at the top, the tabs at the bottom.
 *
 * Drawn per shot rather than once, because which four tabs there are depends on
 * who is holding the phone — residents get Money, the committee trades it for
 * Manage — and because a shot that carries its own bar cross-fades into the
 * next one's instead of snapping. Where two shots agree, which is most of them,
 * the fade is between two identical bars and invisible.
 *
 * It sits above the sliding pages, so a page passes underneath the clock and
 * stops at the tab bar, which is what a real navigation push looks like.
 */
function Chrome({ tabs, active }: { tabs: string[]; active: string }) {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        position: 'absolute',
        left: RECT.left,
        top: RECT.top,
        width: RECT.width,
        height: RECT.height,
        borderRadius: RADIUS,
        overflow: 'hidden',
        opacity: ramp(frame, 0, sec(0.25)),
        pointerEvents: 'none',
      }}
    >
      <div
        style={{
          width: SCREEN.width,
          height: SCREEN.height,
          transform: `scale(${SCALE})`,
          transformOrigin: 'top left',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ height: STATUS_H }}>
          <StatusBar />
        </div>
        <div style={{ height: BAR_H }}>
          <BottomBar tabs={tabs} active={active} />
        </div>
      </div>
    </div>
  );
}

/**
 * One screen, in the phone, pushing the last one out of the way.
 *
 * Slots stack at the same rect in shot order, so the arriving screen paints
 * over the leaving one. It slides in from the right while the leaving screen
 * slides left — a navigation push, which is the transition the app itself
 * makes, rather than a dissolve, which is the transition a slideshow makes.
 */
function Slot({ hold, children }: { hold: number; children: ReactNode }) {
  const frame = useCurrentFrame();
  const enter = ramp(frame, 0, sec(0.36), Easing.out(Easing.cubic));
  const leave = ramp(frame, hold - sec(0.32), hold, Easing.in(Easing.cubic));
  return (
    <div
      style={{
        position: 'absolute',
        left: RECT.left,
        top: RECT.top,
        width: RECT.width,
        height: RECT.height,
        borderRadius: RADIUS,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: SCREEN.width,
          height: SCREEN.height,
          transform: `scale(${SCALE}) translateX(${(1 - enter) * SCREEN.width - leave * SCREEN.width * 0.34}px)`,
          transformOrigin: 'top left',
        }}
      >
        {children}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Captions and bookends
// ---------------------------------------------------------------------------

/** Under the phone, in the band the phone deliberately does not fill. */
function Caption({ text, hold }: { text: string; hold: number }) {
  const frame = useCurrentFrame();
  const entered = ramp(frame, sec(0.18), sec(0.62));
  const leaving = 1 - ramp(frame, hold - sec(0.3), hold);
  return (
    <div
      style={{
        position: 'absolute',
        left: 60,
        right: 60,
        top: RECT.top + RECT.height + BEZEL,
        bottom: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          color: 'white',
          fontFamily,
          fontSize: 50,
          lineHeight: 1.2,
          textAlign: 'center',
          fontWeight: 600,
          letterSpacing: '-0.015em',
          textShadow: '0 4px 20px rgba(0,0,0,0.55)',
          opacity: Math.min(entered, leaving),
          transform: `translateY(${(1 - entered) * 14}px)`,
        }}
      >
        {text}
      </div>
    </div>
  );
}

/** A full-frame card, over the phone. `enter` opens on it; otherwise it lands. */
function Bookend({
  headline,
  sub,
  hold,
  opening,
}: {
  headline: string;
  sub: string;
  hold: number;
  opening?: boolean;
}) {
  const frame = useCurrentFrame();
  const cover = opening ? 1 - ramp(frame, hold - sec(0.42), hold) : ramp(frame, 0, sec(0.42));
  const entered = ramp(frame, sec(opening ? 0.1 : 0.3), sec(opening ? 0.9 : 1.1));
  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep, opacity: cover }}>
      <AbsoluteFill style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Rangoli
          size={1320}
          opacity={0.11}
          spin={frame * 0.05}
          accent={festive.accent}
          ribbon={festive.accent}
          strokeWidth={0.6}
        />
      </AbsoluteFill>
      <Petals hold={hold} count={12} />
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.85 }}>
        <Toran width={SIZE.width} />
      </div>
      <AbsoluteFill
        style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: 86 }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
            <Diya size={172} lit={sec(0.2)} />
          </div>
          <div
            style={{
              color: 'white',
              fontSize: 112,
              fontWeight: 600,
              letterSpacing: '-0.035em',
              opacity: entered,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              color: 'rgba(255,255,255,0.82)',
              fontSize: 45,
              marginTop: 22,
              lineHeight: 1.25,
              opacity: ramp(frame, sec(0.6), sec(1.4)),
            }}
          >
            {sub}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// The cut
// ---------------------------------------------------------------------------

/**
 * A shot is a screen, a caption, and where the camera is looking.
 *
 * `zoom` runs from its first value to its second across the shot, and `origin`
 * is the height it pushes towards as a fraction of the frame — so the caption
 * about a locked bill is shown over a slow move down onto the locked bill,
 * rather than over the whole phone from the same distance as everything else.
 */
type Shot = {
  id: string;
  hold: number;
  caption?: string;
  screen?: ReactNode;
  bookend?: { headline: string; sub: string; opening?: boolean };
  zoom?: [number, number];
  origin?: number;
  /** Which tab bar rides over this screen, and which slot is lit. */
  tabs?: string[];
  active?: string;
  /** WhatsApp is a different app: it draws its own chrome, over ours. */
  fullBleed?: boolean;
};

const SHOTS: Shot[] = [
  {
    id: 'open',
    hold: sec(2.0),
    bookend: {
      headline: 'Samudaya',
      sub: 'Your society’s festivals — and its money — in the open.',
      opening: true,
    },
  },
  {
    id: 'home',
    hold: sec(2.7),
    caption: 'Open it, and the whole festival is on one screen.',
    screen: <HomeScreen />,
    active: 'Home',
    zoom: [1.0, 1.06],
    origin: 0.34,
  },
  {
    id: 'event',
    hold: sec(2.8),
    caption: 'Six jobs. Four done. One with nobody on it.',
    screen: <EventScreen />,
    active: 'Events',
    zoom: [1.03, 1.1],
    origin: 0.52,
  },
  {
    id: 'pay',
    hold: sec(2.9),
    caption: 'Two taps to pay — the note fills itself in.',
    screen: <PayScreen />,
    active: 'Events',
    zoom: [1.02, 1.09],
    origin: 0.36,
  },
  {
    id: 'money',
    hold: sec(2.9),
    caption: 'Every rupee in, with a name and a flat beside it.',
    screen: <MoneyScreen />,
    active: 'Money',
    zoom: [1.0, 1.1],
    origin: 0.5,
  },
  {
    id: 'bills',
    hold: sec(3.0),
    caption: 'Every rupee out, too — and nobody approves their own bill.',
    screen: <BillsScreen />,
    tabs: COMMITTEE,
    active: 'Events',
    zoom: [1.0, 1.11],
    origin: 0.7,
  },
  {
    id: 'reconcile',
    hold: sec(2.8),
    caption: 'Upload the bank statement. It matches itself.',
    screen: <ReconcileScreen />,
    tabs: COMMITTEE,
    active: 'Manage',
    zoom: [1.04, 1.09],
    origin: 0.44,
  },
  {
    id: 'chat',
    hold: sec(2.8),
    caption: 'Or just ask the group. No app to install.',
    screen: <ChatScreen />,
    fullBleed: true,
    zoom: [1.02, 1.07],
    origin: 0.42,
  },
  {
    id: 'close',
    hold: sec(2.3),
    bookend: { headline: 'samudaya.app', sub: 'Nothing hidden. Nothing to chase.' },
  },
];

/** Shots overlap by this much, which is what makes the push a push. */
const OVERLAP = sec(0.28);

/** Where each shot starts on the timeline. */
function starts() {
  let at = 0;
  return SHOTS.map((shot) => {
    const from = at;
    at += shot.hold - OVERLAP;
    return from;
  });
}

export function portraitLength() {
  return SHOTS.reduce((total, shot) => total + shot.hold - OVERLAP, OVERLAP);
}

/**
 * The camera, for the whole video.
 *
 * It has to live out here rather than inside a shot, because the bezel and the
 * screen have to move together — a zoom applied to the screen alone is a phone
 * whose display grows out of its case.
 */
function camera(frame: number) {
  const at = starts();
  let index = 0;
  for (let i = 0; i < SHOTS.length; i += 1) if (frame >= at[i]) index = i;
  const shot = SHOTS[index];
  const [from, to] = shot.zoom ?? [1, 1.04];
  const progress = interpolate(frame, [at[index], at[index] + shot.hold], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  return { zoom: from + (to - from) * progress, origin: (shot.origin ?? 0.45) * 100 };
}

export function PortraitReel({ score }: { score?: string }) {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const at = starts();
  const { zoom, origin } = camera(frame);

  return (
    <AbsoluteFill style={{ backgroundColor: festive.deep }}>
      {score ? (
        <Audio
          src={staticFile(score)}
          volume={(f) =>
            Math.min(
              interpolate(f, [0, sec(0.5)], [0, 1], { extrapolateRight: 'clamp' }),
              interpolate(f, [durationInFrames - sec(1.6), durationInFrames], [1, 0], {
                extrapolateLeft: 'clamp',
              }),
            )
          }
        />
      ) : null}

      <Ground frame={frame} length={durationInFrames} />

      {/* Shell and screens, under one transform, so they move as one object. */}
      <AbsoluteFill style={{ transform: `scale(${zoom})`, transformOrigin: `50% ${origin}%` }}>
        <Shell />
        {SHOTS.map((shot, index) =>
          shot.screen ? (
            <Sequence key={shot.id} from={at[index]} durationInFrames={shot.hold}>
              <Slot hold={shot.hold}>{shot.screen}</Slot>
              {shot.fullBleed ? null : (
                <Chrome tabs={shot.tabs ?? RESIDENT} active={shot.active ?? 'Home'} />
              )}
            </Sequence>
          ) : null,
        )}
      </AbsoluteFill>

      {/* Captions stay put while the camera moves, so the text never drifts. */}
      {SHOTS.map((shot, index) =>
        shot.caption ? (
          <Sequence key={`${shot.id}-cap`} from={at[index]} durationInFrames={shot.hold}>
            <Caption text={shot.caption} hold={shot.hold} />
          </Sequence>
        ) : null,
      )}

      {SHOTS.map((shot, index) =>
        shot.bookend ? (
          <Sequence key={`${shot.id}-end`} from={at[index]} durationInFrames={shot.hold}>
            <Bookend {...shot.bookend} hold={shot.hold} />
          </Sequence>
        ) : null,
      )}
    </AbsoluteFill>
  );
}

export const PORTRAIT_SIZE = SIZE;
