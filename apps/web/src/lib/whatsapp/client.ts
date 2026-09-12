/**
 * Outbound messaging through the Meta WhatsApp Cloud API.
 *
 * Sending is best-effort by design: the webhook must answer Meta quickly and
 * with a 200, otherwise the message is redelivered. A failure to send a reply
 * is logged and swallowed rather than allowed to fail the whole webhook and
 * trigger a retry storm.
 */

export type WhatsAppConfig = {
  phoneNumberId: string;
  accessToken: string;
  appSecret: string;
  verifyToken: string;
  graphVersion: string;
};

export function readWhatsAppConfig(): WhatsAppConfig | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const appSecret = process.env.WHATSAPP_APP_SECRET;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;

  // All four are required. A partially configured bot would accept webhooks it
  // cannot verify, which is worse than not running at all.
  if (!phoneNumberId || !accessToken || !appSecret || !verifyToken) return null;

  return {
    phoneNumberId,
    accessToken,
    appSecret,
    verifyToken,
    graphVersion: process.env.WHATSAPP_GRAPH_VERSION ?? 'v21.0',
  };
}

export type SendResult = { ok: true; id?: string } | { ok: false; error: string };

export async function sendText(
  config: WhatsAppConfig,
  to: string,
  body: string,
): Promise<SendResult> {
  const url = `https://graph.facebook.com/${config.graphVersion}/${config.phoneNumberId}/messages`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        // Link previews would expand any URL a resident pasted back at them.
        text: { preview_url: false, body: body.slice(0, 4096) },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, error: `${response.status}: ${detail.slice(0, 300)}` };
    }

    const payload = (await response.json()) as { messages?: { id?: string }[] };
    return { ok: true, id: payload.messages?.[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'send failed' };
  }
}
