import type { ApiPrincipal } from './auth';
import { allows } from './auth';
import * as resources from './resources';
import type { Outcome } from './resources';

/**
 * Turns a failed Outcome into a sentence an agent can act on. Field-level
 * detail matters here: "title is required" lets the model retry correctly,
 * where a generic failure just makes it guess.
 */
function describe(result: Extract<Outcome<unknown>, { ok: false }>): string {
  if (result.reason === 'not_found') return 'No record with that id in this community.';
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ');
  return `Invalid arguments — ${issues}`;
}

/**
 * Samudaya exposed as MCP tools.
 *
 * Each tool declares the API scope it needs, so an AI agent holding a
 * read-only key sees only the read-only tools — `tools/list` filters on the
 * calling key's scopes rather than advertising things that will then 403.
 */

export type McpTool = {
  name: string;
  title: string;
  description: string;
  scope: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  run: (principal: ApiPrincipal, args: Record<string, unknown>) => Promise<unknown>;
};

const str = (description: string) => ({ type: 'string', description });
const int = (description: string, maximum = 100) => ({
  type: 'integer',
  minimum: 1,
  maximum,
  description,
});

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'get_community',
    title: 'Get community',
    description:
      'Details of the community this key belongs to, plus the caller’s role and scopes. ' +
      'Call this first to find out what you are working with.',
    scope: 'members:read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (principal) => resources.whoami(principal),
  },
  {
    name: 'list_announcements',
    title: 'List announcements',
    description: 'Notices currently visible to residents, newest and pinned first.',
    scope: 'announcements:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 20.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listAnnouncements(principal, Number(args.limit) || 20),
  },
  {
    name: 'post_announcement',
    title: 'Post an announcement',
    description:
      'Publishes a notice to the community. Residents see it immediately, including over WhatsApp. ' +
      'Use sparingly and only when asked to — this reaches real people.',
    scope: 'announcements:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: str('Short headline, e.g. “Water supply interruption”.'),
        body: str('The notice itself. Plain text.'),
        audience: {
          type: 'string',
          enum: ['all', 'residents', 'owners', 'committee', 'staff'],
          description: 'Who should see it. Defaults to everyone.',
        },
        is_pinned: { type: 'boolean', description: 'Pin to the top of the feed.' },
        expires_at: str('ISO 8601 timestamp after which to hide it. Optional.'),
      },
      required: ['title', 'body'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.createAnnouncement(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'list_service_requests',
    title: 'List service requests',
    description:
      'Maintenance tickets and complaints. Filter with `status` to see only what is open.',
    scope: 'requests:read',
    inputSchema: {
      type: 'object',
      properties: {
        status: str('Comma-separated statuses, e.g. "open,in_progress". Omit for all.'),
        limit: int('How many to return. Defaults to 25.'),
      },
      additionalProperties: false,
    },
    run: (principal, args) =>
      resources.listRequests(principal, {
        limit: Number(args.limit) || 25,
        status: typeof args.status === 'string' ? args.status : null,
      }),
  },
  {
    name: 'get_service_request',
    title: 'Get a service request',
    description:
      'One maintenance ticket in full, by id, including its current status and ' +
      'who it is assigned to. Get the id from list_service_requests first.',
    scope: 'requests:read',
    inputSchema: {
      type: 'object',
      properties: { id: str('The request id (UUID).') },
      required: ['id'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const found = await resources.getRequest(principal, String(args.id));
      if (!found) throw new Error('No request with that id in this community.');
      return found;
    },
  },
  {
    name: 'create_service_request',
    title: 'Raise a service request',
    description:
      'Files a maintenance ticket on behalf of the key’s member. Real staff will see and work it.',
    scope: 'requests:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: str('Short summary, e.g. “Leaking tap in kitchen”.'),
        description: str('What is wrong, since when, any access notes.'),
        category: {
          type: 'string',
          enum: [
            'plumbing',
            'electrical',
            'housekeeping',
            'security',
            'common_area',
            'parking',
            'billing',
            'other',
          ],
          description: 'Best-fitting category.',
        },
        priority: {
          type: 'string',
          enum: ['low', 'normal', 'high', 'urgent'],
          description: 'Use "urgent" only for safety or major damage.',
        },
        unit_id: str('Unit the issue relates to. Optional.'),
      },
      required: ['title'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.createRequest(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'comment_on_request',
    title: 'Comment on a request',
    description: 'Adds an update to a ticket. The resident sees it unless it is marked internal.',
    scope: 'requests:write',
    inputSchema: {
      type: 'object',
      properties: {
        id: str('The request id (UUID).'),
        body: str('The update to post.'),
        is_internal: {
          type: 'boolean',
          description: 'Staff-only note, hidden from the resident. Defaults to false.',
        },
      },
      required: ['id', 'body'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const { id, ...rest } = args;
      const result = await resources.addRequestComment(principal, String(id), rest);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'list_visitors',
    title: 'List visitor passes',
    description: 'Gate passes: who is expected, who is inside, and their codes.',
    scope: 'visitors:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 25.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listVisitors(principal, Number(args.limit) || 25),
  },
  {
    name: 'create_visitor_pass',
    title: 'Create a visitor pass',
    description:
      'Pre-authorises a guest and returns the code they read out at the gate. ' +
      'Times are ISO 8601; the pass must stay valid past the expected arrival.',
    scope: 'visitors:write',
    inputSchema: {
      type: 'object',
      properties: {
        visitor_name: str('Who is visiting.'),
        visitor_phone: str('E.164 phone, e.g. +919876543210. Optional.'),
        kind: {
          type: 'string',
          enum: ['guest', 'delivery', 'cab', 'service', 'staff'],
          description: 'Type of visit.',
        },
        expected_at: str('ISO 8601 arrival time.'),
        valid_until: str('ISO 8601 expiry. Must be after expected_at.'),
        party_size: int('How many people. Defaults to 1.', 50),
        unit_id: str('Unit being visited. Optional.'),
        purpose: str('Why they are coming. Optional.'),
        vehicle_number: str('Vehicle registration. Optional.'),
      },
      required: ['visitor_name', 'expected_at', 'valid_until'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.createVisitorPass(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'list_amenities',
    title: 'List amenities and bookings',
    description: 'Bookable facilities plus the slots already taken.',
    scope: 'amenities:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many bookings to return. Defaults to 25.') },
      additionalProperties: false,
    },
    run: async (principal, args) => ({
      amenities: await resources.listAmenities(principal),
      upcoming_bookings: await resources.listBookings(principal, Number(args.limit) || 25),
    }),
  },
  {
    name: 'list_invoices',
    title: 'List invoices',
    description: 'Maintenance invoices and their outstanding balances.',
    scope: 'billing:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 25.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listInvoices(principal, Number(args.limit) || 25),
  },
  {
    name: 'list_members',
    title: 'List members',
    description: 'Active members of the community and their roles.',
    scope: 'members:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 50.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listMembers(principal, Number(args.limit) || 50),
  },
];

export const toolsFor = (principal: ApiPrincipal): McpTool[] =>
  MCP_TOOLS.filter((tool) => allows(principal, tool.scope));

export const findTool = (name: string): McpTool | undefined =>
  MCP_TOOLS.find((tool) => tool.name === name);
