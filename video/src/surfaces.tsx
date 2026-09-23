import { AbsoluteFill, interpolate, useCurrentFrame, Easing } from 'remotion';
import { Fade } from './components';
import { color, fontFamily, sec } from './theme';

/**
 * The two surfaces that are not screens.
 *
 * Samudaya has four of them — web, phone, a WhatsApp bot and an MCP server —
 * and a screen recorder can only point at two. Filming WhatsApp would mean
 * photographing somebody else's product, and an MCP server has no pixels at
 * all. So these are drawn, in the app's own palette, from the app's own
 * source: every command below is in `packages/core/src/whatsapp/commands.ts`
 * and every tool name is in `apps/web/src/lib/api/mcp-tools.ts`. Nothing here
 * is a capability the product does not have.
 */

/** Eased 0→1 over a window, so nothing snaps into place. */
const ramp = (frame: number, from: number, to: number) =>
  interpolate(frame, [from, to], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.out(Easing.cubic),
  });

// ---------------------------------------------------------------------------
// WhatsApp
// ---------------------------------------------------------------------------
type Turn = { from: 'them' | 'bot'; text: string; at: number };

/**
 * A resident asking the society's accounts a question from the app they
 * already have open. The replies carry the same figures as every other scene,
 * because a demo whose numbers disagree with themselves is a demo of a bug.
 */
const THREAD: Turn[] = [
  { from: 'them', text: 'fund', at: 0.4 },
  {
    from: 'bot',
    text: 'Ganesh Chaturthi 2026\n₹24,500 raised of ₹30,000 · 18 households\n₹31,200 spent, every bill on the ledger\n₹1,100 left',
    at: 1.1,
  },
  { from: 'them', text: 'contribute 2000', at: 2.7 },
  {
    from: 'bot',
    text: 'Here you go — this opens your UPI app with the note already filled in so the committee can tell your payment apart.\nsamudaya.app/p/gan-2026',
    at: 3.4,
  },
  { from: 'them', text: 'tasks', at: 5.2 },
  {
    from: 'bot',
    text: 'Waiting on you:\n• Print the programme — due 12 Sept',
    at: 5.9,
  },
];

function Bubble({ turn, frame }: { turn: Turn; frame: number }) {
  const mine = turn.from === 'them';
  const appear = ramp(frame, sec(turn.at), sec(turn.at + 0.32));
  return (
    <div
      style={{
        alignSelf: mine ? 'flex-end' : 'flex-start',
        maxWidth: '78%',
        backgroundColor: mine ? '#d9fdd3' : color.surfaceRaised,
        color: color.ink,
        borderRadius: 14,
        // The one corner WhatsApp squares off, which is most of why a chat
        // bubble reads as a chat bubble at a glance.
        [mine ? 'borderTopRightRadius' : 'borderTopLeftRadius']: 4,
        padding: '14px 18px',
        fontSize: 27,
        lineHeight: 1.42,
        whiteSpace: 'pre-line',
        boxShadow: '0 1px 2px rgba(22,33,30,0.13)',
        opacity: appear,
        transform: `translateY(${(1 - appear) * 14}px)`,
      }}
    >
      {turn.text}
    </div>
  );
}

export function WhatsAppScene({ hold }: { hold: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: color.surfaceSunken, fontFamily }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{ justifyContent: 'center', alignItems: 'center', paddingBottom: 170 }}
        >
          <div
            style={{
              width: 900,
              borderRadius: 22,
              overflow: 'hidden',
              border: `1px solid ${color.border}`,
              boxShadow: '0 40px 90px rgba(22,33,30,0.20)',
              backgroundColor: '#ece5dd',
            }}
          >
            <div
              style={{
                backgroundColor: '#075e54',
                color: '#fff',
                padding: '18px 24px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 46,
                  height: 46,
                  borderRadius: 999,
                  backgroundColor: color.accent,
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                स
              </div>
              <div>
                <div style={{ fontSize: 26, fontWeight: 600 }}>Shanti Nivas</div>
                <div style={{ fontSize: 19, opacity: 0.75 }}>Samudaya bot</div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                padding: '24px 22px 28px',
                minHeight: 470,
              }}
            >
              {THREAD.map((turn) => (
                <Bubble key={turn.text} turn={turn} frame={frame} />
              ))}
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}

// ---------------------------------------------------------------------------
// MCP
// ---------------------------------------------------------------------------
/**
 * Every name here is a tool the server actually registers. The point of the
 * scene is the last line: `tools/list` is filtered by the key's scopes, so a
 * read-only key is never even shown the tool that would post to the society.
 */
const TOOLS = [
  { name: 'list_events', scope: 'events:read' },
  { name: 'get_event', scope: 'events:read' },
  { name: 'get_ledger', scope: 'expenses:read' },
  { name: 'list_members', scope: 'members:read' },
  { name: 'list_tasks', scope: 'events:read' },
  { name: 'list_activities', scope: 'activities:read' },
  { name: 'list_volunteer_roles', scope: 'activities:read' },
  { name: 'list_announcements', scope: 'announcements:read' },
];

const WITHHELD = [
  { name: 'add_task', scope: 'events:write' },
  { name: 'file_expense', scope: 'expenses:write' },
  { name: 'post_announcement', scope: 'announcements:write' },
];

export function McpScene({ hold }: { hold: number }) {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: color.accentDeeper, fontFamily }}>
      <Fade hold={hold}>
        <AbsoluteFill
          style={{
            justifyContent: 'center',
            alignItems: 'center',
            paddingBottom: 170,
            gap: 34,
          }}
        >
          <div style={{ display: 'flex', gap: 34, alignItems: 'flex-start' }}>
            {/* The config somebody actually pastes. */}
            <div
              style={{
                width: 620,
                backgroundColor: 'rgba(0,0,0,0.28)',
                border: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 16,
                padding: '24px 28px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 23,
                lineHeight: 1.6,
                color: 'rgba(255,255,255,0.92)',
                // HTML collapses leading spaces, so without this the config
                // draws flush left and reads as sloppy JSON rather than JSON.
                whiteSpace: 'pre',
                opacity: ramp(frame, sec(0.3), sec(1.1)),
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{'{'}</div>
              <div>{'  "samudaya": {'}</div>
              <div>{'    "type": "http",'}</div>
              <div>{'    "url": "…/api/mcp",'}</div>
              <div>{'    "headers": {'}</div>
              <div style={{ color: '#7fe3c0' }}>{'      "Authorization":'}</div>
              <div style={{ color: '#7fe3c0' }}>{'        "Bearer sam_live_…"'}</div>
              <div>{'    }'}</div>
              <div>{'  }'}</div>
              <div style={{ color: 'rgba(255,255,255,0.5)' }}>{'}'}</div>
            </div>

            {/* What the key is then allowed to see. */}
            <div style={{ width: 640 }}>
              <div
                style={{
                  color: 'rgba(255,255,255,0.62)',
                  fontSize: 22,
                  letterSpacing: 0.4,
                  textTransform: 'uppercase',
                  marginBottom: 14,
                  opacity: ramp(frame, sec(1.1), sec(1.5)),
                }}
              >
                tools/list · read-only key
              </div>
              {TOOLS.map((tool, index) => {
                const appear = ramp(frame, sec(1.4 + index * 0.16), sec(1.75 + index * 0.16));
                return (
                  <div
                    key={tool.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: 'rgba(255,255,255,0.07)',
                      border: '1px solid rgba(255,255,255,0.12)',
                      borderRadius: 10,
                      padding: '11px 18px',
                      marginBottom: 9,
                      opacity: appear,
                      transform: `translateX(${(1 - appear) * 18}px)`,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 24,
                        color: '#fff',
                      }}
                    >
                      {tool.name}
                    </span>
                    <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.55)' }}>
                      {tool.scope}
                    </span>
                  </div>
                );
              })}

              {WITHHELD.map((tool, index) => {
                const appear = ramp(frame, sec(3.1 + index * 0.14), sec(3.5 + index * 0.14));
                return (
                  <div
                    key={tool.name}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      border: '1px dashed rgba(255,255,255,0.22)',
                      borderRadius: 10,
                      padding: '11px 18px',
                      marginBottom: 9,
                      opacity: appear * 0.5,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                        fontSize: 24,
                        color: 'rgba(255,255,255,0.7)',
                        textDecoration: 'line-through',
                      }}
                    >
                      {tool.name}
                    </span>
                    <span style={{ fontSize: 20, color: 'rgba(255,255,255,0.5)' }}>
                      not in scope
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </AbsoluteFill>
      </Fade>
    </AbsoluteFill>
  );
}
