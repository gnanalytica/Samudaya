import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useVideoConfig } from 'remotion';
import { Bookend, Caption, Clip, PhoneShot, Shot, Statement } from './components';
import { sec } from './theme';
import clips from './clips.json';
import shots from './shots.json';
import take from './beats.json';

/**
 * The script.
 *
 * One argument, told in the order a committee meets it: the problem everybody
 * already has, then the product answering it, then what is left when the event
 * is over. Each scene knows its own length, so the two cuts are the same scenes
 * picked differently rather than two timelines to keep in step.
 *
 * Most of it is one continuous recording of somebody using the app — landing
 * page, home, the ledger, an event, paying for it — cut into scenes by the
 * beats the recorder timestamped. A few shots are stills, where the scene wants
 * a slow pan across something taller than a screen, or a phone.
 */

/**
 * Every still's real size, measured when it was taken.
 *
 * Shots are captured fullPage, so their height is whatever the content needed
 * that day. Remotion pans by subtracting the viewport from that height, so a
 * number typed in here by hand goes wrong the first time a ledger row is added:
 * the pan stops early, or runs off the image into background. Imported instead.
 */
const SHOTS = shots;

const WINDOW = { width: 1200, height: 700 };

/** The continuous take, and where in it each moment happened. */
const TAKE = { src: 'captures/take.webm', width: 1440, height: 900, scale: 0.94 };

function beatAt(name: string) {
  const found = take.beats.find((entry) => entry.name === name);
  // Better to fail the render than to publish a cut that silently opens on the
  // wrong page because a beat was renamed in the recorder and not here.
  if (!found) throw new Error(`beats.json has no beat named "${name}"`);
  return found.at;
}

/**
 * A slice of the take.
 *
 * `lead` is how long before the beat to start, because a beat marks the moment
 * something arrived — the Money page, the chosen flat — and a scene that opens
 * there has already missed the click that caused it.
 */
function Take({
  at,
  lead = 1.8,
  hold,
  label,
}: {
  at: string;
  lead?: number;
  hold: number;
  label: string;
}) {
  return (
    <Clip {...TAKE} hold={hold} label={label} startFrom={sec(Math.max(0, beatAt(at) - lead))} />
  );
}

/**
 * Where to start each of the short recordings.
 *
 * A Playwright recording opens on a blank page and a navigation — a couple of
 * seconds of nothing before a key is pressed. The capture measures it rather
 * than anybody eyeballing it, so re-recording on a slower day cannot quietly
 * push the interaction past the end of its scene.
 */
const startOf = (name: keyof typeof clips) => sec(clips[name].startSeconds);

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
    hold: sec(8),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="One place for the whole society — not a group chat and a notebook."
      >
        <Take at="landing:top" lead={1.2} hold={hold} label="samudaya.app" />
      </Scene>
    ),
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

  openApp: {
    id: 'openApp',
    hold: sec(5.5),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="What the society is running, and what its money looks like, on the way in."
      >
        <Take at="app:home" lead={2} hold={hold} label="Shanti Nivas · Home" />
      </Scene>
    ),
  },

  oneLedger: {
    id: 'oneLedger',
    hold: sec(3.5),
    node: (hold) => <Statement lines={['Every rupee lands in one ledger.']} hold={hold} />,
  },

  ledgerLive: {
    id: 'ledgerLive',
    hold: sec(9),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="Who paid, which flat, how it arrived — and which committee member confirmed it."
      >
        <Take at="app:money" lead={2.2} hold={hold} label="Shanti Nivas · Money" />
      </Scene>
    ),
  },

  flatGap: {
    id: 'flatGap',
    hold: sec(4.5),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="Nobody listed this neighbour at a door. The ledger says so, rather than leaving a blank."
      >
        <Take at="app:flat-gap" lead={1} hold={hold} label="Shanti Nivas · Money" />
      </Scene>
    ),
  },

  eventsLive: {
    id: 'eventsLive',
    hold: sec(4),
    node: (hold) => (
      <Scene hold={hold} caption="Every event the society has run, is running, and has planned.">
        <Take at="app:events" lead={2} hold={hold} label="Shanti Nivas · Events" />
      </Scene>
    ),
  },

  contributeLive: {
    id: 'contributeLive',
    hold: sec(9.5),
    node: (hold) => (
      <Scene
        hold={hold}
        caption="Name your flat and the payment note writes itself. Samudaya never touches the money."
      >
        <Take at="app:contribute" lead={2.6} hold={hold} label="Shanti Nivas · Contribute" />
      </Scene>
    ),
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
          {...SHOTS['closure-chosen']}
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
    node: (hold) => {
      const phone = SHOTS['ledger-phone'];
      return (
        <Scene
          hold={hold}
          caption="The same ledger on the phone, which is where most of the society will read it."
        >
          <PhoneShot {...phone} from={0} to={Math.max(0, phone.height - 844)} hold={hold} />
        </Scene>
      );
    },
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
export function Reel({
  order,
  score,
}: {
  order: { id: keyof typeof SCENES; hold?: number }[];
  /** The bed under the whole cut, sized to it by score/compose.mjs. */
  score?: string;
}) {
  const { durationInFrames } = useVideoConfig();
  let at = 0;
  const overlap = sec(0.3);

  return (
    <AbsoluteFill>
      {score ? (
        <Audio
          src={staticFile(score)}
          // Up over half a second so it does not begin mid-note, and away over
          // the last two so the end is a decision rather than a power cut.
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
