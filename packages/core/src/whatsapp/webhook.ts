/**
 * Meta WhatsApp Cloud API webhook plumbing: signature verification and payload
 * flattening. No I/O, so both halves are unit-testable.
 */

export type InboundMessage = {
  /** Meta's message id. Unique, and the basis for de-duplicating retries. */
  waMessageId: string;
  /** E.164, with the leading `+` that Meta omits. */
  from: string;
  /** WhatsApp profile name, when the sender shares it. */
  profileName?: string;
  /** Business number that received this, for multi-number deployments. */
  phoneNumberId?: string;
  type: string;
  /** Body text for a text message, or the title of the button/list reply. */
  text: string | null;
  timestamp: string;
};

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase();
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) return new Uint8Array();
    out[i] = byte;
  }
  return out;
}

/** Length-independent comparison, so timing cannot leak the expected digest. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length || a.length === 0) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a[i]! ^ b[i]!;
  return diff === 0;
}

/**
 * Verifies the `X-Hub-Signature-256` header Meta sends.
 *
 * `rawBody` must be the exact bytes received — re-serialising the parsed JSON
 * changes key order and whitespace, and the HMAC will not match.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;

  const match = signatureHeader.match(/^sha256=([a-f0-9]+)$/i);
  if (!match) return false;

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const expected = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)),
  );

  return timingSafeEqual(expected, hexToBytes(match[1]!));
}

/** Meta sends `919876543210`; everything downstream expects `+919876543210`. */
export function toE164(waId: string): string {
  const digits = waId.replace(/[^\d]/g, '');
  return digits.startsWith('+') ? digits : `+${digits}`;
}

type WebhookPayload = {
  object?: string;
  entry?: {
    changes?: {
      field?: string;
      value?: {
        metadata?: { phone_number_id?: string };
        contacts?: { wa_id?: string; profile?: { name?: string } }[];
        messages?: Record<string, unknown>[];
      };
    }[];
  }[];
};

/**
 * Flattens the deeply nested webhook body into a plain list of messages.
 * Status callbacks (delivered/read) carry no `messages` array and are skipped.
 */
export function extractInboundMessages(payload: unknown): InboundMessage[] {
  const body = payload as WebhookPayload;
  if (!body || typeof body !== 'object') return [];

  const out: InboundMessage[] = [];

  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages?.length) continue;

      const namesByWaId = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        if (contact.wa_id && contact.profile?.name) {
          namesByWaId.set(contact.wa_id, contact.profile.name);
        }
      }

      for (const raw of value.messages) {
        const id = typeof raw.id === 'string' ? raw.id : null;
        const from = typeof raw.from === 'string' ? raw.from : null;
        if (!id || !from) continue;

        const type = typeof raw.type === 'string' ? raw.type : 'unknown';
        const profileName = namesByWaId.get(from);

        out.push({
          waMessageId: id,
          from: toE164(from),
          ...(profileName ? { profileName } : {}),
          ...(value.metadata?.phone_number_id
            ? { phoneNumberId: value.metadata.phone_number_id }
            : {}),
          type,
          text: readText(raw, type),
          timestamp: typeof raw.timestamp === 'string' ? raw.timestamp : '',
        });
      }
    }
  }

  return out;
}

/** Text lives in a different place for each message type. */
function readText(raw: Record<string, unknown>, type: string): string | null {
  const pick = (obj: unknown, key: string): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    const value = (obj as Record<string, unknown>)[key];
    return typeof value === 'string' ? value : null;
  };

  switch (type) {
    case 'text':
      return pick(raw.text, 'body');
    case 'button':
      return pick(raw.button, 'text');
    case 'interactive': {
      const interactive = raw.interactive as Record<string, unknown> | undefined;
      // A tapped button or a chosen list row both surface as a title.
      return (
        pick(interactive?.button_reply, 'title') ?? pick(interactive?.list_reply, 'title') ?? null
      );
    }
    default:
      return null;
  }
}
