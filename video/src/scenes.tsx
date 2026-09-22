import { AbsoluteFill, Sequence } from 'remotion';
import { Bookend, Caption, Clip, PhoneShot, Shot, Statement } from './components';
import { sec } from './theme';
import timing from './clips.json';

/**
 * The script.
 *
 * One argument, told in the order a committee meets it: the problem everybody
 * already has, then the four screens that answer it, then what is left when
 * the event is over. Each scene knows its own length, so the two cuts are the
 * same scenes picked differently rather than two timelines to keep in step.
 *
 * Captured sizes are the screenshots' CSS pixels — half the file's pixels,
 * because the capture runs at deviceScaleFactor 2 so text stays sharp when a
 * shot is scaled up.
 */

const SHOTS = {
  landing: { src: 'captures/landing.png', width: 1280, height: 1141 },
  ledger: { src: 'captures/ledger.png', width: 1100, height: 1126 },
  ledgerPhone: { src: 'captures/ledger-phone.png', width: 390, height: 1622 },
  contribute: { src: 'captures/contribute.png', width: 1100, height: 900 },
  closure: { src: 'captures/closure.png', width: 900, height: 700 },
  closureChosen: { src: 'captures/closure-chosen.png', width: 900, height: 700 },
} as const;

const WINDOW = { width: 1200, height: 700 };

/**
 * Where to start each recording.
 *
 * A Playwright recording opens on a blank page and a navigation — two and a
 * half seconds of nothing, on the festival clip, before a key is pressed. The
 * capture measures it rather than anybody eyeballing it, so re-recording on a
 * slower day cannot quietly push the interaction past the end of its scene.
 */
const startOf = (name: keyof typeof timing) => sec(timing[name].startSeconds);

/** How far a shot can travel before it runs out of screenshot. */
function travel(shot: { width: number; height: number }, scale: number, viewportHeight: number) {
  return Math.max(0, shot.height - viewportHeight / scale);
}

/** A framed shot with its caption, which is how every screen scene is built. */
function Scene({
  children,
  caption,
  hold,
}: {
  children: React.ReactNode;
  caption?: string;
  hold: number;
}) {
  return (
    <AbsoluteFill>
      {children}
      {caption ? <Caption text={caption} hold={hold} /> : null}
    </AbsoluteFill>
  );
}

export type SceneSpec = { id: string; hold: number; node: (hold: number) => React.ReactNode };

/**
 * Every scene the video can draw on, written once.
 *
 * `hold` on each entry is the length it wants in the long cut; the short cut
 * overrides it, because a shot that earns twelve seconds in a walkthrough
 * earns half that in something posted to a group chat.
 */
export const SCENES: Record<string, SceneSpec> = {
  open: {
    id: 'open',
    hold: sec(4),
    node: (hold) => (
      <Bookend
        headline="Samudaya"
        sub="Your society's events and money, in the open."
        hold={hold}
      />
    ),
  },

  problem: {
    id: 'problem',
    hold: sec(5),
    node: (hold) => (
      <Statement
        lines={['₹40,000 collected for Diwali.', 'Four people know where it went.']}
        sub="Every residents’ society has this problem, and it is never really about the money."
        hold={hold}
      />
    ),
  },

  landing: {
    id: 'landing',
    hold: sec(7),
    node: (hold) => {
      const scale = WINDOW.width / SHOTS.landing.width;
      return (
        <Scene
          hold={hold}
          caption="One place for the whole society — not a group chat and a notebook."
        >
          <Shot
            {...SHOTS.landing}
            viewport={WINDOW}
            from={{ scale, x: 0, y: 0 }}
            to={{ scale, x: 0, y: travel(SHOTS.landing, scale, WINDOW.height) }}
            hold={hold}
            label="samudaya.app"
          />
        </Scene>
      );
    },
  },

  startEvent: {
    id: 'startEvent',
    hold: sec(3.5),
    node: (hold) => <Statement lines={['It starts with an event.']} hold={hold} />,
  },

  festival: {
    id: 'festival',
    hold: sec(9),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="Type three letters. It knows when the festival falls — and says so when the date still moves."
      >
        <Clip
          src="captures/festival.webm"
          width={900}
          height={620}
          scale={1.18}
          hold={hold}
          label="Create an event"
          startFrom={startOf('festival')}
        />
      </Scene>
    ),
  },

  residentsPay: {
    id: 'residentsPay',
    hold: sec(3.5),
    node: (hold) => <Statement lines={['Then the flats pay.']} hold={hold} />,
  },

  contribute: {
    id: 'contribute',
    hold: sec(8),
    node: (hold) => {
      const scale = WINDOW.width / SHOTS.contribute.width;
      return (
        <Scene
          hold={hold}
          caption="The society's own UPI ID, and a note that names the flat. Samudaya never touches the money."
        >
          <Shot
            {...SHOTS.contribute}
            viewport={WINDOW}
            from={{ scale, x: 0, y: 0 }}
            to={{ scale, x: 0, y: travel(SHOTS.contribute, scale, WINDOW.height) }}
            hold={hold}
            label="Contribute"
          />
        </Scene>
      );
    },
  },

  flat: {
    id: 'flat',
    hold: sec(8),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="No flat on record? It asks — before the note is copied, not after the money has gone."
      >
        <Clip
          src="captures/flat.webm"
          width={900}
          height={760}
          scale={0.96}
          hold={hold}
          label="Contribute"
          startFrom={startOf('flat')}
        />
      </Scene>
    ),
  },

  oneLedger: {
    id: 'oneLedger',
    hold: sec(3.5),
    node: (hold) => <Statement lines={['Every rupee lands in one ledger.']} hold={hold} />,
  },

  ledger: {
    id: 'ledger',
    hold: sec(14),
    node: (hold) => {
      const scale = WINDOW.width / SHOTS.ledger.width;
      return (
        <Scene
          hold={hold}
          caption="Who paid, which flat, how it arrived — and which committee member confirmed it."
        >
          <Shot
            {...SHOTS.ledger}
            viewport={WINDOW}
            from={{ scale, x: 0, y: 0 }}
            to={{ scale, x: 0, y: travel(SHOTS.ledger, scale, WINDOW.height) }}
            hold={hold}
            label="Money"
          />
        </Scene>
      );
    },
  },

  whenItCloses: {
    id: 'whenItCloses',
    hold: sec(3.5),
    node: (hold) => <Statement lines={['And when the event is over?']} hold={hold} />,
  },

  closure: {
    id: 'closure',
    hold: sec(4.5),
    node: (hold) => (
      <Scene hold={hold} caption="Two answers, not a conversation that never happens.">
        <Shot
          {...SHOTS.closure}
          viewport={{ width: 900, height: 700 }}
          from={{ scale: 1, x: 0, y: 0 }}
          to={{ scale: 1, x: 0, y: 0 }}
          hold={hold}
          label="Close the event"
          zoom={1.12}
        />
      </Scene>
    ),
  },

  closureChosen: {
    id: 'closureChosen',
    hold: sec(4.5),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="Keep it for the society, or put it behind the next event — and say which."
      >
        <Shot
          {...SHOTS.closureChosen}
          viewport={{ width: 900, height: 700 }}
          from={{ scale: 1, x: 0, y: 0 }}
          to={{ scale: 1, x: 0, y: 0 }}
          hold={hold}
          label="Close the event"
          zoom={1.12}
        />
      </Scene>
    ),
  },

  movements: {
    id: 'movements',
    hold: sec(6),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="Money moved between events is on the record too, with the name of whoever decided it."
      >
        <Shot
          {...SHOTS.ledger}
          viewport={{ width: 1180, height: 520 }}
          from={{ scale: 1.32, x: 0, y: 150 }}
          to={{ scale: 1.32, x: 0, y: 235 }}
          hold={hold}
          label="Money"
        />
      </Scene>
    ),
  },

  phone: {
    id: 'phone',
    hold: sec(8),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="The same ledger on the phone, which is where most of the society will read it."
      >
        <PhoneShot {...SHOTS.ledgerPhone} from={0} to={740} hold={hold} />
      </Scene>
    ),
  },

  close: {
    id: 'close',
    hold: sec(5),
    node: (hold) => (
      <Bookend headline="Samudaya" sub="Nothing hidden. Nothing to chase." hold={hold} />
    ),
  },
};

/** Lays a list of scenes end to end, each overlapping the last as it fades. */
export function Reel({ order }: { order: { id: keyof typeof SCENES; hold?: number }[] }) {
  let at = 0;
  const overlap = sec(0.3);

  return (
    <AbsoluteFill>
      {order.map(({ id, hold }) => {
        const scene = SCENES[id];
        const length = hold ?? scene.hold;
        const from = at;
        at += length - overlap;
        return (
          <Sequence key={`${id}-${from}`} from={from} durationInFrames={length}>
            {scene.node(length)}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

/** Total frames a running order takes, once the cross-fades are counted. */
export function reelLength(order: { id: keyof typeof SCENES; hold?: number }[]) {
  const overlap = sec(0.3);
  return order.reduce(
    (total, { id, hold }) => total + (hold ?? SCENES[id].hold) - overlap,
    overlap,
  );
}
