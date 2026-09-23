import type { ReactNode } from 'react';
import { Easing, interpolate, useCurrentFrame } from 'remotion';
import { color, fontFamily, sec } from './theme';
import { Rangoli, Toran, festive } from './festive';

/**
 * The app, drawn rather than filmed.
 *
 * Earlier cuts played back a screen recording of the real thing. That is the
 * most honest way to show a product and the worst way to show it quickly: a
 * recording moves at the speed a browser navigates, most of every shot is the
 * page sitting still, and the one number the caption is about is nine
 * point-something of a 390-pixel column. Redrawing the same screens means each
 * one can arrive in a third of a second and spend its whole life doing the
 * thing it is there to show.
 *
 * The rule that keeps it from becoming a lie: every figure, label and rule
 * below is the one in `capture/harness/society/demo-data.ts`, which is the
 * data the filmed cut used. ₹24,500 of ₹30,000 here is ₹24,500 of ₹30,000
 * there. The layout is the app's mobile layout — a festival header, a scroll,
 * and the four-tab bar from `apps/web/src/components/sidebar-nav.tsx`. Nothing
 * here is a screen the product does not have or a number it would not show.
 */

/** Logical phone pixels. Everything in this file is written at this scale. */
export const SCREEN = { width: 390, height: 844 };

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
/** Eased 0→1 across a window, clamped at both ends. */
export function ramp(frame: number, from: number, to: number, easing = Easing.out(Easing.cubic)) {
  return interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing,
  });
}

/** A row that rises into place, staggered by its index. */
function rise(frame: number, index: number, at = 0.25, step = 0.07) {
  return ramp(frame, sec(at + index * step), sec(at + index * step + 0.42));
}

/**
 * Indian digit grouping, written out rather than left to `Intl`.
 *
 * The app renders ₹1,46,300, not ₹146,300, and a demo that groups its rupees
 * the American way is a demo made somewhere else.
 */
export function rupees(value: number) {
  const digits = String(Math.round(Math.abs(value)));
  const tail = digits.slice(-3);
  const head = digits.slice(0, -3);
  const grouped = head ? `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${tail}` : tail;
  return `${value < 0 ? '−' : ''}₹${grouped}`;
}

/** A number that counts up to its value, so a total lands rather than appears. */
function counted(frame: number, to: number, from = 0, at = 0.2, over = 1.1) {
  return from + (to - from) * ramp(frame, sec(at), sec(at + over));
}

// ---------------------------------------------------------------------------
// Chrome
// ---------------------------------------------------------------------------
const ink = color.ink;
const muted = color.inkMuted;
const subtle = color.inkSubtle;

/** The status bar and the tab bar do not scroll or slide; see portrait.tsx. */
export const STATUS_H = 44;
export const BAR_H = 62;

export function StatusBar() {
  return (
    <div
      style={{
        height: STATUS_H,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 22px 0 26px',
        fontSize: 13,
        fontWeight: 600,
        color: ink,
      }}
    >
      <span>9:41</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        {[4, 6, 8, 10].map((h) => (
          <span key={h} style={{ width: 3, height: h, borderRadius: 1, backgroundColor: ink }} />
        ))}
        <span
          style={{
            marginLeft: 3,
            width: 22,
            height: 11,
            borderRadius: 3,
            border: `1px solid ${ink}`,
            padding: 1.5,
          }}
        >
          <span style={{ display: 'block', width: '72%', height: '100%', backgroundColor: ink }} />
        </span>
      </span>
    </div>
  );
}

/** The festival header: wash, toran, kolam — the app's own, at phone size. */
function FestivalTop({ title, sub, frame }: { title: string; sub: string; frame: number }) {
  const entered = ramp(frame, 0, sec(0.5));
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        backgroundColor: festive.wash,
        borderBottom: `1px solid ${color.border}`,
        padding: '26px 18px 18px',
      }}
    >
      <div style={{ position: 'absolute', inset: '0 0 auto 0', opacity: 0.7 }}>
        <Toran width={SCREEN.width} scale={0.62} />
      </div>
      <div style={{ position: 'absolute', top: -34, right: -28, opacity: 0.13 }}>
        <Rangoli size={150} spin={frame * 0.12} strokeWidth={1.4} />
      </div>
      <div style={{ position: 'relative', opacity: entered }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.09em', color: muted }}>
          SHANTI NIVAS
        </div>
        <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: ink }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
}

/** Everything that is not an event page: a plain title bar. */
function PlainTop({ title, sub }: { title: string; sub?: string }) {
  return (
    <div
      style={{
        backgroundColor: color.surfaceRaised,
        borderBottom: `1px solid ${color.border}`,
        padding: '18px 18px 16px',
      }}
    >
      <div style={{ fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: ink }}>
        {title}
      </div>
      {sub ? <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{sub}</div> : null}
    </div>
  );
}

const ICONS: Record<string, string> = {
  // Lucide, the set the app already uses: LayoutDashboard, CalendarDays,
  // Wallet, SquareMenu, UserRound.
  Home: 'M3 3h7v7H3zM14 3h7v5h-7zM14 12h7v9h-7zM3 14h7v7H3z',
  Events: 'M3 5h18v16H3zM3 10h18M8 2v4M16 2v4M8 14h.01M12 14h.01M16 14h.01',
  Money: 'M3 7h15a3 3 0 013 3v7a3 3 0 01-3 3H6a3 3 0 01-3-3zM3 7a3 3 0 013-3h9M17 13h.01',
  Manage: 'M3 4h18v16H3zM7 9h10M7 13h10M7 17h5',
  Me: 'M12 3a4 4 0 110 8 4 4 0 010-8zM4 21a8 8 0 0116 0',
};

/**
 * The four-tab bar.
 *
 * Which four depends on the role, and the app is specific about it: residents
 * get Home, Events, Money, Me; the committee trades Money for Manage, because
 * what is waiting on them is why they opened the app. Passing the set per
 * screen keeps that true instead of drawing one bar everywhere.
 */
export function BottomBar({ tabs, active }: { tabs: string[]; active: string }) {
  return (
    <div
      style={{
        height: BAR_H,
        display: 'grid',
        gridAutoFlow: 'column',
        gridAutoColumns: '1fr',
        borderTop: `1px solid ${color.border}`,
        backgroundColor: color.surfaceRaised,
        paddingBottom: 12,
      }}
    >
      {tabs.map((tab) => {
        const on = tab === active;
        return (
          <div
            key={tab}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              padding: '9px 0 4px',
              fontSize: 10.5,
              fontWeight: on ? 600 : 500,
              color: on ? festive.accent : subtle,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path
                d={ICONS[tab]}
                stroke={on ? festive.accent : subtle}
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {tab}
          </div>
        );
      })}
    </div>
  );
}

export const RESIDENT = ['Home', 'Events', 'Money', 'Me'];
export const COMMITTEE = ['Home', 'Events', 'Manage', 'Me'];

/**
 * A page: its header and its scroll, and nothing else.
 *
 * The status bar and the tab bar are deliberately absent. They are drawn once,
 * over every page, by the reel — because in a real app they are the parts that
 * stay while the page under them changes, and a transition that slides two
 * clocks and two Home tabs past each other is a transition no app makes. The
 * space they occupy is reserved here so nothing is drawn underneath them.
 */
function Page({ top, children }: { top: ReactNode; children: ReactNode }) {
  return (
    <div
      style={{
        width: SCREEN.width,
        height: SCREEN.height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: color.surface,
        fontFamily,
        color: ink,
        overflow: 'hidden',
      }}
    >
      <div style={{ height: STATUS_H, flexShrink: 0 }} />
      {top}
      <div style={{ flex: 1, overflow: 'hidden', padding: '14px 14px 0' }}>{children}</div>
      <div style={{ height: BAR_H, flexShrink: 0 }} />
    </div>
  );
}

/** The app's card: raised surface, hairline border, soft corner. */
function Card({ children, style }: { children: ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        backgroundColor: color.surfaceRaised,
        border: `1px solid ${color.border}`,
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * A progress bar that fills as the shot runs.
 *
 * `blend` is for the festival fund only, where the sweep from ribbon red into
 * marigold is the festival's own gradient. Everywhere else the bar's colour is
 * carrying a meaning — under budget, short of volunteers — and a two-colour
 * bar says a full row is half one thing and half another.
 */
function Bar({
  fraction,
  tone = festive.accent,
  blend = false,
}: {
  fraction: number;
  tone?: string;
  blend?: boolean;
}) {
  return (
    <div
      style={{
        height: 8,
        borderRadius: 999,
        backgroundColor: color.surfaceSunken,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${Math.max(0, Math.min(1, fraction)) * 100}%`,
          height: '100%',
          borderRadius: 999,
          background: blend ? `linear-gradient(90deg, ${festive.ribbon}, ${tone})` : tone,
        }}
      />
    </div>
  );
}

function Tick({ on, size = 17 }: { on: number; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <circle
        cx="12"
        cy="12"
        r="10"
        fill={color.accent}
        style={{ opacity: on, transform: `scale(${0.6 + on * 0.4})`, transformOrigin: '12px 12px' }}
      />
      <path
        d="M7.5 12.4l3.1 3.1 6-6.4"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        style={{ opacity: on }}
      />
    </svg>
  );
}

/** The flat chip, which is the whole point of half these rows. */
function Flat({ label }: { label: string | null }) {
  if (!label) {
    return (
      <span style={{ fontSize: 11.5, color: subtle, fontStyle: 'italic' }}>Flat not recorded</span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 600,
        color: festive.ribbon,
        backgroundColor: 'oklch(0.96 0.03 40)',
        border: `1px solid oklch(0.89 0.05 40)`,
        borderRadius: 6,
        padding: '1px 6px',
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// The screens
// ---------------------------------------------------------------------------

const ACTIVITIES = [
  { name: 'Classical dance', slot: '15 Sept · 6:30 pm', signed: 7, cap: 10 },
  { name: 'Children’s fancy dress', slot: '15 Sept · 5:00 pm', signed: 12, cap: 12 },
  { name: 'Bhajan group', slot: '16 Sept · 7:00 pm', signed: 4, cap: 8 },
];

/** Home: what the society is doing this month, and what it has. */
export function HomeScreen() {
  const frame = useCurrentFrame();
  return (
    <Page
      top={<FestivalTop title="Ganesh Chaturthi 2026" sub="Starts 15 September" frame={frame} />}
    >
      <Card
        style={{ opacity: rise(frame, 0), transform: `translateY(${(1 - rise(frame, 0)) * 12}px)` }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <span style={{ fontSize: 13, color: muted }}>Collected so far</span>
          <span style={{ fontSize: 12, color: muted }}>of {rupees(30000)}</span>
        </div>
        <div
          style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em', margin: '2px 0 10px' }}
        >
          {rupees(counted(frame, 24500))}
        </div>
        <Bar fraction={ramp(frame, sec(0.2), sec(1.3)) * (24500 / 30000)} blend />
        <div style={{ fontSize: 12.5, color: muted, marginTop: 9 }}>18 of 24 flats have paid</div>
      </Card>
      <div style={{ display: 'flex', gap: 10 }}>
        {[
          { label: 'Society balance', value: 4200 },
          { label: 'Spent this year', value: 31200 },
        ].map((tile, index) => (
          <Card
            key={tile.label}
            style={{
              flex: 1,
              opacity: rise(frame, index + 1),
              transform: `translateY(${(1 - rise(frame, index + 1)) * 12}px)`,
            }}
          >
            <div style={{ fontSize: 11.5, color: muted }}>{tile.label}</div>
            <div style={{ fontSize: 20, fontWeight: 650, marginTop: 3 }}>
              {rupees(counted(frame, tile.value, 0, 0.35, 0.9))}
            </div>
          </Card>
        ))}
      </div>
      <Card
        style={{ opacity: rise(frame, 3), transform: `translateY(${(1 - rise(frame, 3)) * 12}px)` }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          COMING UP
        </div>
        {[
          { name: 'Deepavali 2026', when: '8 November' },
          { name: 'Independence Day 2026', when: '15 August' },
        ].map((event) => (
          <div
            key={event.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
              fontSize: 14,
            }}
          >
            <span>{event.name}</span>
            <span style={{ fontSize: 11.5, color: subtle }}>{event.when}</span>
          </div>
        ))}
      </Card>
      <Card
        style={{ opacity: rise(frame, 4), transform: `translateY(${(1 - rise(frame, 4)) * 12}px)` }}
      >
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          WHAT’S ON
        </div>
        {ACTIVITIES.map((activity) => (
          <div
            key={activity.name}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '7px 0',
            }}
          >
            <div>
              <div style={{ fontSize: 14 }}>{activity.name}</div>
              <div style={{ fontSize: 11.5, color: subtle, marginTop: 1 }}>{activity.slot}</div>
            </div>
            <span
              style={{
                fontSize: 11.5,
                fontWeight: 600,
                color: activity.signed === activity.cap ? subtle : color.accent,
              }}
            >
              {activity.signed === activity.cap
                ? 'Full'
                : `${activity.cap - activity.signed} places left`}
            </span>
          </div>
        ))}
      </Card>
    </Page>
  );
}

const CHECKLIST = [
  { title: 'Book the idol', owner: 'Bala Krishnan', done: true },
  { title: 'Confirm the priest', owner: 'Chitra Rao', done: true },
  { title: 'Sound and lights', owner: 'Bala Krishnan', done: true },
  { title: 'Order prasadam for 180', owner: 'Chitra Rao', done: true },
  { title: 'Print the programme', owner: 'Asha Menon', done: false },
  { title: 'Arrange parking marshals', owner: null, done: false },
];

const VOLUNTEERS = [
  { name: 'Kitchen help', needed: 6, signed: 6 },
  { name: 'Parking marshal', needed: 4, signed: 1 },
  { name: 'Stage and sound', needed: 3, signed: 2 },
];

/** The event page: the checklist, the ring, and who owes what. */
export function EventScreen() {
  const frame = useCurrentFrame();
  const done = CHECKLIST.filter((item) => item.done).length;
  const sweep = ramp(frame, sec(0.25), sec(1.2));
  const percent = Math.round((done / CHECKLIST.length) * 100 * sweep);
  return (
    <Page
      top={
        <FestivalTop title="Ganesh Chaturthi 2026" sub="Collecting · 15 September" frame={frame} />
      }
    >
      <Card style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="76" height="76" viewBox="0 0 76 76" style={{ flexShrink: 0 }}>
          <circle cx="38" cy="38" r="31" fill="none" stroke={color.surfaceSunken} strokeWidth="9" />
          <circle
            cx="38"
            cy="38"
            r="31"
            fill="none"
            stroke={festive.accent}
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 31}`}
            strokeDashoffset={2 * Math.PI * 31 * (1 - (done / CHECKLIST.length) * sweep)}
            transform="rotate(-90 38 38)"
          />
          <text
            x="38"
            y="43"
            textAnchor="middle"
            fontSize="19"
            fontWeight="700"
            fill={ink}
            fontFamily={fontFamily}
          >
            {percent}%
          </text>
        </svg>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>Ready for the 15th</div>
          <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>
            {done} of {CHECKLIST.length} jobs done
          </div>
          <div style={{ fontSize: 12.5, color: festive.ribbon, marginTop: 5, fontWeight: 600 }}>
            1 job still has nobody on it
          </div>
        </div>
      </Card>
      <Card>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 6 }}>
          CHECKLIST
        </div>
        {CHECKLIST.map((item, index) => {
          const shown = rise(frame, index, 0.3, 0.09);
          return (
            <div
              key={item.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '7px 0',
                opacity: shown,
                transform: `translateX(${(1 - shown) * 14}px)`,
              }}
            >
              {item.done ? (
                <Tick on={ramp(frame, sec(0.42 + index * 0.09), sec(0.72 + index * 0.09))} />
              ) : (
                <span
                  style={{
                    width: 17,
                    height: 17,
                    borderRadius: 999,
                    border: `1.8px solid ${color.borderStrong}`,
                    flexShrink: 0,
                  }}
                />
              )}
              <span
                style={{
                  fontSize: 14,
                  flex: 1,
                  color: item.done ? subtle : ink,
                  textDecoration: item.done ? 'line-through' : 'none',
                }}
              >
                {item.title}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  color: item.owner ? muted : festive.ribbon,
                  fontWeight: item.owner ? 400 : 600,
                }}
              >
                {item.owner ?? 'Unassigned'}
              </span>
            </div>
          );
        })}
      </Card>
      <Card style={{ opacity: rise(frame, 6, 0.3, 0.09) }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          VOLUNTEERS
        </div>
        {VOLUNTEERS.map((role, index) => {
          const filled = ramp(frame, sec(0.7 + index * 0.1), sec(1.4 + index * 0.1));
          return (
            <div key={role.name} style={{ padding: '6px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                <span>{role.name}</span>
                <span style={{ color: role.signed < role.needed ? festive.ribbon : subtle }}>
                  {role.signed} of {role.needed}
                </span>
              </div>
              <div style={{ marginTop: 5 }}>
                <Bar
                  fraction={(role.signed / role.needed) * filled}
                  tone={role.signed < role.needed ? festive.accent : color.accent}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}

/** Contribute: an amount, a UPI handoff, and a note the committee can read. */
export function PayScreen() {
  const frame = useCurrentFrame();
  const typed = Math.round(counted(frame, 2001, 0, 0.2, 0.7));
  const pressed = ramp(frame, sec(1.35), sec(1.5));
  const sent = ramp(frame, sec(1.6), sec(2.0));
  return (
    <Page top={<PlainTop title="Contribute" sub="Ganesh Chaturthi 2026" />}>
      <Card>
        <div style={{ fontSize: 12.5, color: muted, marginBottom: 6 }}>How much?</div>
        <div
          style={{
            border: `1.5px solid ${festive.accent}`,
            borderRadius: 11,
            padding: '13px 14px',
            fontSize: 30,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            backgroundColor: color.surface,
          }}
        >
          {rupees(typed)}
          <span
            style={{
              display: 'inline-block',
              width: 2,
              height: 26,
              marginLeft: 3,
              verticalAlign: '-4px',
              backgroundColor: festive.accent,
              opacity: pressed > 0 ? 0 : frame % 20 < 10 ? 1 : 0,
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
          {[501, 1001, 2001, 5001].map((amount) => (
            <span
              key={amount}
              style={{
                flex: 1,
                textAlign: 'center',
                fontSize: 12.5,
                fontWeight: 600,
                padding: '6px 0',
                borderRadius: 8,
                border: `1px solid ${amount === 2001 ? festive.accent : color.border}`,
                color: amount === 2001 ? festive.accent : muted,
                backgroundColor: amount === 2001 ? festive.wash : color.surfaceRaised,
              }}
            >
              {rupees(amount)}
            </span>
          ))}
        </div>
      </Card>
      <div
        style={{
          backgroundColor: festive.accent,
          color: 'white',
          borderRadius: 12,
          padding: '15px 0',
          textAlign: 'center',
          fontSize: 16,
          fontWeight: 650,
          transform: `scale(${1 - pressed * 0.03})`,
          boxShadow: `0 6px 18px oklch(0.6 0.17 62 / ${0.3 - pressed * 0.2})`,
        }}
      >
        Pay with UPI
      </div>
      <div
        style={{
          marginTop: 9,
          border: `1px solid ${color.border}`,
          backgroundColor: color.surfaceRaised,
          borderRadius: 11,
          padding: '12px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 550 }}>Copy UPI ID</div>
          <div style={{ fontSize: 11.5, color: subtle, marginTop: 1 }}>shantinivas@okaxis</div>
        </div>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <rect x="9" y="9" width="11" height="11" rx="2.5" stroke={muted} strokeWidth="1.9" />
          <path d="M5 15V6a2 2 0 012-2h8" stroke={muted} strokeWidth="1.9" strokeLinecap="round" />
        </svg>
      </div>
      <Card
        style={{
          marginTop: 12,
          opacity: sent,
          transform: `translateY(${(1 - sent) * 16}px)`,
          borderColor: color.accent,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Tick on={sent} size={22} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Opening your UPI app</div>
            <div style={{ fontSize: 12.5, color: muted, marginTop: 1 }}>
              The note is filled in already, so the committee can tell your payment apart.
            </div>
          </div>
        </div>
      </Card>
      <div
        style={{
          fontSize: 12.5,
          color: muted,
          lineHeight: 1.45,
          padding: '2px 4px',
          opacity: ramp(frame, sec(2.0), sec(2.4)),
        }}
      >
        It lands on the Money page with your name and your flat against it, for everyone in the
        society to see.
      </div>
    </Page>
  );
}

const INFLOWS = [
  { name: 'Asha Menon', flat: 'A 402', method: 'UPI', amount: 2001 },
  { name: 'Esha Patil', flat: 'B 306', method: 'UPI', amount: 3001 },
  { name: 'Dev Sharma', flat: 'B 1104', method: 'UPI', amount: 1001 },
  { name: 'Pranav Aditya', flat: null, method: 'UPI', amount: 1001 },
  { name: 'Cash at the door', flat: 'A 703', method: 'Cash', amount: 500 },
];

const OUTFLOWS = [
  { name: 'Anand Caterers', detail: 'Prasadam for 180 · bill attached', amount: 16300 },
  { name: 'Paper Glow Decorators', detail: 'Decoration · bill attached', amount: 8400 },
  { name: 'Sri Ganesh Sound Service', detail: 'Sound and lights · bill attached', amount: 6500 },
];

/** Money: every rupee in, with a name and a flat beside it. */
export function MoneyScreen() {
  const frame = useCurrentFrame();
  // The newest row lands last and is the one the previous shot just paid.
  const highlight = ramp(frame, sec(1.5), sec(2.0));
  return (
    <Page top={<PlainTop title="Money" sub="Every rupee, in and out" />}>
      <Card style={{ display: 'flex', justifyContent: 'space-between' }}>
        {[
          { label: 'In', value: 46500, tone: color.accent },
          { label: 'Out', value: -31200, tone: festive.ribbon },
          { label: 'Left', value: 15300, tone: ink },
        ].map((total) => (
          <div key={total.label}>
            <div style={{ fontSize: 11.5, color: muted }}>{total.label}</div>
            <div style={{ fontSize: 17, fontWeight: 650, color: total.tone, marginTop: 2 }}>
              {rupees(counted(frame, total.value, 0, 0.15, 0.85))}
            </div>
          </div>
        ))}
      </Card>
      <Card style={{ padding: '6px 14px' }}>
        {INFLOWS.map((row, index) => {
          const shown = rise(frame, index, 0.3, 0.1);
          const lit = index === 0 ? highlight : 0;
          return (
            <div
              key={row.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '11px 8px',
                margin: '0 -8px',
                borderRadius: 9,
                borderBottom: index < INFLOWS.length - 1 ? `1px solid ${color.border}` : 'none',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 16}px)`,
                backgroundColor: `oklch(0.97 0.05 68 / ${lit})`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{row.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 4 }}>
                  <Flat label={row.flat} />
                  <span style={{ fontSize: 11.5, color: subtle }}>{row.method}</span>
                </div>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 650, color: color.accent }}>
                +{rupees(row.amount)}
              </div>
            </div>
          );
        })}
      </Card>
      <div style={{ fontSize: 12, fontWeight: 600, color: muted, margin: '2px 4px 7px' }}>
        MONEY OUT
      </div>
      <Card style={{ padding: '6px 14px' }}>
        {OUTFLOWS.map((row, index) => {
          const shown = rise(frame, index + 5, 0.3, 0.1);
          return (
            <div
              key={row.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 0',
                borderBottom: index < OUTFLOWS.length - 1 ? `1px solid ${color.border}` : 'none',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 16}px)`,
              }}
            >
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{row.name}</div>
                <div style={{ fontSize: 11.5, color: subtle, marginTop: 3 }}>{row.detail}</div>
              </div>
              <div style={{ fontSize: 15.5, fontWeight: 650, color: festive.ribbon }}>
                {rupees(-row.amount)}
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}

const BILLS = [
  { name: 'Prasadam for 180', vendor: 'Anand Caterers', amount: 16300, by: 'Chitra Rao' },
  { name: 'Decoration', vendor: 'Paper Glow Decorators', amount: 8400, by: 'Bala Krishnan' },
  {
    name: 'Sound and lights',
    vendor: 'Sri Ganesh Sound Service',
    amount: 6500,
    by: 'Bala Krishnan',
  },
];

const BUDGET = [
  { category: 'Food', planned: 18000, spent: 16300 },
  { category: 'Decor', planned: 9000, spent: 8400 },
  { category: 'Production', planned: 6000, spent: 6500 },
  { category: 'Printing', planned: 2000, spent: 0 },
];

/**
 * Bills: three signed off, and the one the person looking at it filed.
 *
 * That last card is the shot. The rule is enforced in the database, not in the
 * interface, and the only way to show a rule is to show it refusing.
 */
export function BillsScreen() {
  const frame = useCurrentFrame();
  const arrives = ramp(frame, sec(0.85), sec(1.3));
  const locks = ramp(frame, sec(1.5), sec(1.95));
  return (
    <Page top={<PlainTop title="Bills" sub="Ganesh Chaturthi 2026" />}>
      {BILLS.map((bill, index) => {
        const shown = rise(frame, index, 0.15, 0.09);
        return (
          <Card
            key={bill.name}
            style={{
              opacity: shown,
              transform: `translateY(${(1 - shown) * 12}px)`,
              padding: 12,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 550 }}>{bill.name}</div>
                <div style={{ fontSize: 11.5, color: subtle, marginTop: 2 }}>{bill.vendor}</div>
              </div>
              <div style={{ fontSize: 15, fontWeight: 650 }}>{rupees(bill.amount)}</div>
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                marginTop: 8,
                fontSize: 11.5,
                color: color.accent,
                fontWeight: 600,
              }}
            >
              <Tick on={ramp(frame, sec(0.35 + index * 0.09), sec(0.6 + index * 0.09))} size={14} />
              Approved by {bill.by}
            </div>
          </Card>
        );
      })}
      <Card
        style={{
          opacity: arrives,
          transform: `translateY(${(1 - arrives) * 18}px)`,
          borderColor: festive.accent,
          borderWidth: 1.5,
          backgroundColor: festive.wash,
          padding: 12,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 550 }}>Idol and puja items</div>
            <div style={{ fontSize: 11.5, color: subtle, marginTop: 2 }}>Sri Vinayaka Stores</div>
          </div>
          <div style={{ fontSize: 15, fontWeight: 650 }}>{rupees(9200)}</div>
        </div>
        <div
          style={{
            marginTop: 10,
            borderRadius: 9,
            padding: '9px 11px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            backgroundColor: color.surfaceRaised,
            border: `1px solid ${color.border}`,
            opacity: locks,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
            <rect x="4" y="10" width="16" height="11" rx="2.5" stroke={muted} strokeWidth="1.9" />
            <path
              d="M8 10V7a4 4 0 018 0v3"
              stroke={muted}
              strokeWidth="1.9"
              strokeLinecap="round"
            />
          </svg>
          <span style={{ fontSize: 12.5, color: muted, lineHeight: 1.35 }}>
            You filed this one. Another committee member has to approve it.
          </span>
        </div>
      </Card>
      <Card style={{ opacity: ramp(frame, sec(1.1), sec(1.6)) }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: muted, marginBottom: 8 }}>
          AGAINST BUDGET
        </div>
        {BUDGET.map((line, index) => {
          const filled = ramp(frame, sec(1.2 + index * 0.08), sec(1.9 + index * 0.08));
          const over = line.spent > line.planned;
          return (
            <div key={line.category} style={{ padding: '5px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span>{line.category}</span>
                <span
                  style={{ color: over ? festive.ribbon : muted, fontWeight: over ? 600 : 400 }}
                >
                  {rupees(line.spent)} of {rupees(line.planned)}
                </span>
              </div>
              <div style={{ marginTop: 4 }}>
                <Bar
                  fraction={Math.min(1, line.spent / line.planned) * filled}
                  tone={over ? festive.ribbon : color.accent}
                />
              </div>
            </div>
          );
        })}
      </Card>
    </Page>
  );
}

const SETTLED = [
  { who: 'Esha Patil · B 306', amount: 3001, matched: true },
  { who: 'Dev Sharma · B 1104', amount: 1001, matched: true },
  { who: 'UPI/9843•••221', amount: 1500, matched: false },
];

/** Reconcile: the bank statement on one side, the ledger on the other. */
export function ReconcileScreen() {
  const frame = useCurrentFrame();
  const close = ramp(frame, sec(0.7), sec(1.45), Easing.inOut(Easing.cubic));
  const matched = ramp(frame, sec(1.45), sec(1.8));
  const line = (label: string, sub: string, amount: number, side: 1 | -1) => (
    <div
      style={{
        backgroundColor: color.surfaceRaised,
        border: `1px solid ${matched > 0.5 ? color.accent : color.border}`,
        borderRadius: 11,
        padding: '11px 13px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        transform: `translateX(${side * (1 - close) * 120}px)`,
        opacity: ramp(frame, sec(0.2), sec(0.6)),
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: subtle, letterSpacing: '0.06em', fontWeight: 600 }}>
          {label}
        </div>
        <div style={{ fontSize: 13.5, marginTop: 2 }}>{sub}</div>
      </div>
      <div style={{ fontSize: 15, fontWeight: 650 }}>{rupees(amount)}</div>
    </div>
  );
  return (
    <Page top={<PlainTop title="Reconcile" sub="September statement" />}>
      <Card style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 12.5, color: muted }}>Matched against the bank</div>
          <div style={{ fontSize: 22, fontWeight: 700, marginTop: 2 }}>
            {Math.round(counted(frame, 23, 0, 0.15, 0.9))} of 24
          </div>
        </div>
        <div style={{ fontSize: 12.5, color: festive.ribbon, fontWeight: 600, textAlign: 'right' }}>
          1 to look at
        </div>
      </Card>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 4 }}>
        {line('BANK STATEMENT', 'UPI/ASHA MENON/4021', 2001, -1)}
        <div
          style={{
            alignSelf: 'center',
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            backgroundColor: color.accent,
            color: 'white',
            borderRadius: 999,
            padding: '5px 13px',
            fontSize: 12.5,
            fontWeight: 650,
            opacity: matched,
            transform: `scale(${0.8 + matched * 0.2})`,
          }}
        >
          <Tick on={matched} size={14} />
          Matched
        </div>
        {line('SAMUDAYA LEDGER', 'Asha Menon · A 402', 2001, 1)}
      </div>
      <div style={{ marginTop: 14, opacity: ramp(frame, sec(1.75), sec(2.15)) }}>
        {SETTLED.map((row, index) => (
          <div
            key={row.who}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '9px 13px',
              marginBottom: 7,
              borderRadius: 10,
              backgroundColor: color.surfaceRaised,
              border: `1px solid ${color.border}`,
              opacity: rise(frame, index, 1.8, 0.07),
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <Tick on={row.matched ? 1 : 0} size={15} />
              <span style={{ fontSize: 13.5 }}>{row.who}</span>
            </div>
            <span
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                color: row.matched ? muted : festive.ribbon,
              }}
            >
              {row.matched ? rupees(row.amount) : 'No ledger row'}
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
}

const THREAD = [
  { mine: true, text: 'fund', at: 0.25 },
  {
    mine: false,
    text: 'Ganesh Chaturthi 2026\n₹24,500 raised of ₹30,000 · 18 households\n₹31,200 spent, every bill on the ledger',
    at: 0.85,
  },
  { mine: true, text: 'tasks', at: 1.7 },
  { mine: false, text: 'Waiting on you:\n• Print the programme — due 12 Sept', at: 2.15 },
];

/**
 * WhatsApp, drawn.
 *
 * Both commands are in `packages/core/src/whatsapp/commands.ts`; the figures
 * are the ones every other screen in this cut shows. Filming this would mean
 * photographing somebody else's product.
 */
export function ChatScreen() {
  const frame = useCurrentFrame();
  return (
    <div
      style={{
        width: SCREEN.width,
        height: SCREEN.height,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#ece5dd',
        fontFamily,
        overflow: 'hidden',
      }}
    >
      <div style={{ backgroundColor: '#075e54' }}>
        <div style={{ filter: 'invert(1) grayscale(1) brightness(2)' }}>
          <StatusBar />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 16px 13px' }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              backgroundColor: festive.accent,
              display: 'grid',
              placeItems: 'center',
              color: 'white',
              fontWeight: 700,
              fontSize: 15,
            }}
          >
            SN
          </div>
          <div>
            <div style={{ color: 'white', fontSize: 15, fontWeight: 600 }}>Shanti Nivas</div>
            <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5 }}>Samudaya · online</div>
          </div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 9,
          padding: '16px 13px',
        }}
      >
        {THREAD.map((turn) => {
          const shown = ramp(frame, sec(turn.at), sec(turn.at + 0.3));
          return (
            <div
              key={turn.text}
              style={{
                alignSelf: turn.mine ? 'flex-end' : 'flex-start',
                maxWidth: '82%',
                backgroundColor: turn.mine ? '#d9fdd3' : 'white',
                color: ink,
                borderRadius: 11,
                [turn.mine ? 'borderTopRightRadius' : 'borderTopLeftRadius']: 3,
                padding: '9px 12px',
                fontSize: 13.5,
                lineHeight: 1.45,
                whiteSpace: 'pre-line',
                boxShadow: '0 1px 1.5px rgba(22,33,30,0.15)',
                opacity: shown,
                transform: `translateY(${(1 - shown) * 9}px)`,
              }}
            >
              {turn.text}
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '9px 13px 22px',
        }}
      >
        <div
          style={{
            flex: 1,
            backgroundColor: 'white',
            borderRadius: 999,
            padding: '10px 15px',
            fontSize: 13.5,
            color: subtle,
          }}
        >
          Message
        </div>
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 999,
            backgroundColor: '#00a884',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M3 20l19-8L3 4v6l12 2-12 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}
