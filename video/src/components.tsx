import type { ReactNode } from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
  Easing,
} from 'remotion';
import { color, fontFamily, sec } from './theme';

/**
 * The parts every scene is built from.
 *
 * Two rules hold the whole video together. Nothing moves faster than a reader
 * can follow — a ledger is text, and text that slides past is decoration
 * rather than evidence. And nothing here invents a colour: everything comes
 * from theme.ts, which is the app's own palette, so a title card and a
 * screenshot are the same product rather than two designs that nearly agree.
 */

/** Eased 0→1 over a window, for fades that do not snap. */
function ramp(frame: number, from: number, to: number) {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });
}

/** Fade in at the head of a scene, out at its tail. */
export function Fade({ children, hold }: { children: ReactNode; hold: number }) {
  const frame = useCurrentFrame();
  const edge = sec(0.45);
  const opacity = Math.min(ramp(frame, 0, edge), 1 - ramp(frame, hold - edge, hold));
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

/**
 * A full-bleed statement, in the app's deepest green.
 *
 * Used for the sentences the product is an argument about, which are the ones
 * no screenshot can make on its own.
 */
export function Statement({
  lines,
  sub,
  hold,
  size = 84,
}: {
  lines: string[];
  sub?: string;
  hold: number;
  size?: number;
}) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: color.accentDeeper }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0 180px',
            fontFamily,
          }}
        >
          <div style={{ textAlign: 'center', maxWidth: 1400 }}>
            {lines.map((line, index) => {
              // Lines arrive one after another, so a two-part sentence reads as
              // two beats instead of a wall that appears all at once.
              const entered = ramp(frame, sec(0.2 + index * 0.45), sec(0.9 + index * 0.45));
              return (
                <div
                  key={line}
                  style={{
                    color: 'white',
                    fontSize: size,
                    lineHeight: 1.18,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    opacity: entered,
                    transform: `translateY(${(1 - entered) * 18}px)`,
                  }}
                >
                  {line}
                </div>
              );
            })}
            {sub ? (
              <div
                style={{
                  color: 'rgba(255,255,255,0.72)',
                  fontSize: 38,
                  lineHeight: 1.45,
                  marginTop: 34,
                  fontWeight: 400,
                  opacity: ramp(
                    frame,
                    sec(0.6 + lines.length * 0.45),
                    sec(1.4 + lines.length * 0.45),
                  ),
                }}
              >
                {sub}
              </div>
            ) : null}
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/** The chrome around a desktop shot: a window, not a floating rectangle. */
function WindowFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: color.surfaceRaised,
        boxShadow: '0 40px 90px rgba(22,33,30,0.20), 0 4px 12px rgba(22,33,30,0.08)',
        border: `1px solid ${color.border}`,
      }}
    >
      <div
        style={{
          height: 46,
          backgroundColor: color.surfaceSunken,
          borderBottom: `1px solid ${color.border}`,
          display: 'flex',
          alignItems: 'center',
          padding: '0 18px',
          gap: 9,
        }}
      >
        {[0, 1, 2].map((dot) => (
          <div
            key={dot}
            style={{ width: 11, height: 11, borderRadius: 999, backgroundColor: color.border }}
          />
        ))}
        <div
          style={{
            marginLeft: 14,
            padding: '5px 16px',
            borderRadius: 999,
            backgroundColor: color.surfaceRaised,
            border: `1px solid ${color.border}`,
            color: color.inkSubtle,
            fontSize: 16,
            fontFamily,
          }}
        >
          {label}
        </div>
      </div>
      {children}
    </div>
  );
}

type Move = { scale: number; x: number; y: number };

/**
 * A still, moved across the frame.
 *
 * `from` and `to` are in the screenshot's own CSS pixels, so a move is written
 * as "start at the top, end 700px down" rather than as a transform nobody can
 * picture.
 */
export function Shot({
  src,
  width,
  height,
  viewport,
  from,
  to,
  hold,
  label,
  zoom = 1,
}: {
  src: string;
  /** The screenshot's CSS size, which is half its pixel size at 2× capture. */
  width: number;
  height: number;
  /** How much of it the window shows at once. */
  viewport: { width: number; height: number };
  from: Move;
  to: Move;
  hold: number;
  label: string;
  /** Scales the whole window, for a shot narrower than the frame. */
  zoom?: number;
}) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, hold], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const at = (key: keyof Move) => from[key] + (to[key] - from[key]) * progress;
  const scale = at('scale');

  return (
    <AbsoluteFill style={{ backgroundColor: color.surface }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 170 }}
        >
          <div style={{ transform: `scale(${zoom})` }}>
            <WindowFrame label={label}>
              <div
                style={{
                  width: viewport.width,
                  height: viewport.height,
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                <Img
                  src={staticFile(src)}
                  style={{
                    position: 'absolute',
                    width,
                    height,
                    top: 0,
                    left: 0,
                    transformOrigin: 'top left',
                    transform: `scale(${scale}) translate(${-at('x')}px, ${-at('y')}px)`,
                  }}
                />
              </div>
            </WindowFrame>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/** A recorded interaction, in the same window chrome. */
export function Clip({
  src,
  width,
  height,
  scale,
  hold,
  label,
  startFrom = 0,
}: {
  src: string;
  width: number;
  height: number;
  scale: number;
  hold: number;
  label: string;
  startFrom?: number;
}) {
  return (
    <AbsoluteFill style={{ backgroundColor: color.surface }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 170 }}
        >
          <div style={{ transform: `scale(${scale})` }}>
            <WindowFrame label={label}>
              <OffthreadVideo
                src={staticFile(src)}
                startFrom={startFrom}
                muted
                style={{ width, height, display: 'block' }}
              />
            </WindowFrame>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/** A tall phone still, scrolled inside a phone. */
export function PhoneShot({
  src,
  width,
  height,
  from,
  to,
  hold,
}: {
  src: string;
  width: number;
  height: number;
  from: number;
  to: number;
  hold: number;
}) {
  const frame = useCurrentFrame();
  const y = interpolate(frame, [0, hold], [from, to], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.quad),
  });
  const SCREEN = { width: 390, height: 844 };
  // A status-bar band above the page, so the notch sits on chrome rather than
  // on top of a row of the ledger — which reads as a rendering fault, not as
  // a phone.
  const STATUS = 44;
  const scale = 1.04;

  return (
    <AbsoluteFill style={{ backgroundColor: color.surface }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 150 }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 54,
              backgroundColor: color.ink,
              boxShadow: '0 40px 90px rgba(22,33,30,0.28)',
              transform: `scale(${scale})`,
            }}
          >
            <div
              style={{
                width: SCREEN.width,
                height: SCREEN.height,
                borderRadius: 42,
                overflow: 'hidden',
                position: 'relative',
                backgroundColor: color.surface,
              }}
            >
              <Img
                src={staticFile(src)}
                style={{
                  position: 'absolute',
                  width,
                  height,
                  top: STATUS,
                  left: 0,
                  transform: `translateY(${-y}px)`,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: STATUS,
                  backgroundColor: color.surface,
                }}
              />
              {/* The notch, so the frame reads as a phone at a glance rather
                  than as a tall rounded box. */}
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 112,
                  height: 26,
                  borderRadius: 999,
                  backgroundColor: color.ink,
                }}
              />
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

/**
 * The line under a shot.
 *
 * A caption rather than a voiceover, because this gets forwarded into
 * WhatsApp groups and watched on mute in a lift.
 */
export function Caption({ text, hold }: { text: string; hold: number }) {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const entered = ramp(frame, sec(0.25), sec(0.95));
  const leaving = 1 - ramp(frame, hold - sec(0.4), hold);

  return (
    <AbsoluteFill style={{ justifyContent: 'flex-end', alignItems: 'center', paddingBottom: 54 }}>
      <div
        style={{
          maxWidth: width - 420,
          padding: '18px 34px',
          borderRadius: 16,
          backgroundColor: color.accentDeeper,
          color: 'white',
          fontFamily,
          fontSize: 34,
          lineHeight: 1.35,
          textAlign: 'center',
          fontWeight: 500,
          opacity: Math.min(entered, leaving),
          transform: `translateY(${(1 - entered) * 14}px)`,
          boxShadow: '0 18px 44px rgba(22,33,30,0.22)',
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

/** The opening and closing card: the name, and what it is for. */
export function Bookend({ headline, sub, hold }: { headline: string; sub: string; hold: number }) {
  const frame = useCurrentFrame();
  const entered = ramp(frame, sec(0.2), sec(1.2));
  return (
    <AbsoluteFill style={{ backgroundColor: color.accentDeeper }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', fontFamily, padding: 120 }}
        >
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                color: 'white',
                fontSize: 128,
                fontWeight: 600,
                letterSpacing: '-0.035em',
                opacity: entered,
                transform: `scale(${0.965 + entered * 0.035})`,
              }}
            >
              {headline}
            </div>
            <div
              style={{
                color: 'rgba(255,255,255,0.75)',
                fontSize: 42,
                marginTop: 26,
                opacity: ramp(frame, sec(0.9), sec(1.8)),
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
