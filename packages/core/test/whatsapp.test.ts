import { describe, expect, it } from 'vitest';
import { parseCommand } from '../src/whatsapp/commands';
import { extractInboundMessages, toE164, verifyWebhookSignature } from '../src/whatsapp/webhook';

describe('parseCommand', () => {
  it('recognises greetings as a request for help', () => {
    for (const input of ['hi', 'Hello', 'HEY', 'menu', 'help', '  start  ', '?']) {
      expect(parseCommand(input).kind).toBe('help');
    }
  });

  it('reads a link code off the message', () => {
    expect(parseCommand('link ABC123')).toEqual({ kind: 'link', code: 'ABC123' });
    expect(parseCommand('JOIN  xyz789')).toEqual({ kind: 'link', code: 'xyz789' });
  });

  it('pulls a rupee amount out of a contribution, however it is written', () => {
    expect(parseCommand('contribute 2000')).toEqual({ kind: 'contribute', amount: 2000 });
    expect(parseCommand('pay ₹2,000')).toEqual({ kind: 'contribute', amount: 2000 });
    expect(parseCommand('donate 500.50')).toEqual({ kind: 'contribute', amount: 500.5 });
  });

  it('accepts a bare contribute, since the bot can just send the link', () => {
    expect(parseCommand('contribute')).toEqual({ kind: 'contribute', amount: null });
  });

  it('ignores a nonsense amount rather than guessing one', () => {
    expect(parseCommand('contribute lots')).toEqual({ kind: 'contribute', amount: null });
    expect(parseCommand('contribute 0')).toEqual({ kind: 'contribute', amount: null });
  });

  it('keeps the whole suggestion text, punctuation and all', () => {
    expect(parseCommand('suggest A weekend badminton tournament, open to all!')).toEqual({
      kind: 'suggest',
      text: 'A weekend badminton tournament, open to all!',
    });
  });

  it('treats a bare verb that needs an argument as unparsable', () => {
    for (const input of ['suggest', 'link']) {
      expect(parseCommand(input).kind).toBe('unknown');
    }
  });

  it('maps synonyms onto the same command', () => {
    expect(parseCommand('upcoming').kind).toBe('events');
    expect(parseCommand('next').kind).toBe('events');
    expect(parseCommand('raised').kind).toBe('fund');
    expect(parseCommand('accounts').kind).toBe('fund');
    expect(parseCommand('announcements').kind).toBe('notices');
    expect(parseCommand('cultural').kind).toBe('activities');
    expect(parseCommand('checklist').kind).toBe('tasks');
  });

  it('distinguishes empty input from unrecognised input', () => {
    expect(parseCommand('').kind).toBe('empty');
    expect(parseCommand('   ').kind).toBe('empty');
    expect(parseCommand(null).kind).toBe('empty');
    expect(parseCommand('do a backflip')).toEqual({ kind: 'unknown', input: 'do a backflip' });
  });

  it('handles the opt-out keyword', () => {
    expect(parseCommand('STOP').kind).toBe('stop');
    expect(parseCommand('unsubscribe').kind).toBe('stop');
  });
});

describe('toE164', () => {
  it('adds the plus that Meta omits', () => {
    expect(toE164('919876543210')).toBe('+919876543210');
  });

  it('leaves an already-formatted number alone', () => {
    expect(toE164('+919876543210')).toBe('+919876543210');
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'test-app-secret';
  const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });

  const sign = async (payload: string, withSecret = secret) => {
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(withSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    );
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
    const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `sha256=${hex}`;
  };

  it('accepts a correctly signed body', async () => {
    expect(await verifyWebhookSignature(body, await sign(body), secret)).toBe(true);
  });

  it('rejects a body that was tampered with after signing', async () => {
    const signature = await sign(body);
    expect(await verifyWebhookSignature(body + ' ', signature, secret)).toBe(false);
  });

  it('rejects a signature made with the wrong secret', async () => {
    expect(await verifyWebhookSignature(body, await sign(body, 'wrong'), secret)).toBe(false);
  });

  it('rejects a missing, malformed or truncated signature', async () => {
    expect(await verifyWebhookSignature(body, null, secret)).toBe(false);
    expect(await verifyWebhookSignature(body, 'garbage', secret)).toBe(false);
    expect(await verifyWebhookSignature(body, 'sha256=', secret)).toBe(false);
    expect(await verifyWebhookSignature(body, 'sha256=abcd', secret)).toBe(false);
  });

  it('refuses to verify when no app secret is configured', async () => {
    expect(await verifyWebhookSignature(body, await sign(body), '')).toBe(false);
  });
});

describe('extractInboundMessages', () => {
  const textPayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: '0',
        changes: [
          {
            field: 'messages',
            value: {
              messaging_product: 'whatsapp',
              metadata: { display_phone_number: '15550001', phone_number_id: 'PNID1' },
              contacts: [{ profile: { name: 'Chitra' }, wa_id: '919876543210' }],
              messages: [
                {
                  from: '919876543210',
                  id: 'wamid.TEST1',
                  timestamp: '1750000000',
                  type: 'text',
                  text: { body: 'report tap leaking' },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it('flattens a text message and normalises the sender', () => {
    const [message] = extractInboundMessages(textPayload);
    expect(message).toMatchObject({
      waMessageId: 'wamid.TEST1',
      from: '+919876543210',
      profileName: 'Chitra',
      phoneNumberId: 'PNID1',
      type: 'text',
      text: 'report tap leaking',
    });
  });

  it('ignores delivery-status callbacks, which carry no messages', () => {
    const statusPayload = {
      entry: [
        {
          changes: [
            {
              field: 'messages',
              value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] },
            },
          ],
        },
      ],
    };
    expect(extractInboundMessages(statusPayload)).toEqual([]);
  });

  it('reads the title out of an interactive reply', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    from: '919876543210',
                    id: 'wamid.BTN',
                    timestamp: '1',
                    type: 'interactive',
                    interactive: { button_reply: { id: 'notices', title: 'See notices' } },
                  },
                ],
              },
            },
          ],
        },
      ],
    };
    expect(extractInboundMessages(payload)[0]?.text).toBe('See notices');
  });

  it('keeps unsupported types but reports no text, rather than dropping them', () => {
    const payload = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  { from: '919876543210', id: 'wamid.IMG', timestamp: '1', type: 'image' },
                ],
              },
            },
          ],
        },
      ],
    };
    const [message] = extractInboundMessages(payload);
    expect(message?.type).toBe('image');
    expect(message?.text).toBeNull();
  });

  it('returns an empty list for junk input instead of throwing', () => {
    for (const junk of [null, undefined, {}, 'nope', 42, []]) {
      expect(extractInboundMessages(junk)).toEqual([]);
    }
  });

  it('skips messages missing an id or a sender', () => {
    const payload = {
      entry: [
        {
          changes: [
            { value: { messages: [{ type: 'text', text: { body: 'hi' } }, { from: '91' }] } },
          ],
        },
      ],
    };
    expect(extractInboundMessages(payload)).toEqual([]);
  });
});
