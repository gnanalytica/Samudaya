import { describe, expect, it } from 'vitest';
import { API_SCOPES } from '@samudaya/core';
import { MCP_TOOLS, findTool, toolsFor } from '@/lib/api/mcp-tools';
import type { ApiPrincipal } from '@/lib/api/auth';

/** A principal carrying exactly the given scopes. `null` means a user token. */
const principalWith = (scopes: string[] | null): ApiPrincipal =>
  ({
    kind: scopes === null ? 'user' : 'api_key',
    communityId: 'c',
    communitySlug: 'c',
    membershipId: 'm',
    role: 'resident',
    scopes,
    apiKeyId: null,
    userId: null,
    // Never touched: these tests only exercise the registry, not the queries.
    db: null as never,
    bypassesRls: scopes !== null,
  }) as ApiPrincipal;

describe('the MCP tool registry', () => {
  it('has unique, agent-friendly names', () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('declares only scopes the API actually knows about', () => {
    for (const tool of MCP_TOOLS) {
      expect(API_SCOPES as readonly string[]).toContain(tool.scope);
    }
  });

  it('gives every tool a description worth reading', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(30);
      expect(tool.title.length).toBeGreaterThan(0);
    }
  });

  it('publishes closed JSON Schemas, so an agent cannot smuggle extra fields', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.additionalProperties).toBe(false);
      // Every required field must actually be declared.
      for (const required of tool.inputSchema.required ?? []) {
        expect(Object.keys(tool.inputSchema.properties)).toContain(required);
      }
    }
  });
});

describe('scope filtering', () => {
  it('shows a read-only key only the read tools', () => {
    const readOnly = API_SCOPES.filter((scope) => scope.endsWith(':read'));
    const visible = toolsFor(principalWith([...readOnly]));

    expect(visible.length).toBeGreaterThan(0);
    for (const tool of visible) expect(tool.scope.endsWith(':read')).toBe(true);
    expect(visible.map((t) => t.name)).not.toContain('post_announcement');
  });

  it('lets a write scope imply its own read scope', () => {
    const visible = toolsFor(principalWith(['announcements:write']));
    const names = visible.map((tool) => tool.name);
    expect(names).toContain('post_announcement');
    expect(names).toContain('list_announcements');
    expect(names).not.toContain('list_service_requests');
  });

  it('shows nothing at all to a key with no scopes', () => {
    expect(toolsFor(principalWith([])).length).toBe(0);
  });

  it('shows everything to a user token, where RLS decides instead', () => {
    expect(toolsFor(principalWith(null)).length).toBe(MCP_TOOLS.length);
  });

  it('does not leak a tool across resources', () => {
    const visible = toolsFor(principalWith(['visitors:write']));
    expect(visible.map((t) => t.name)).toEqual(
      expect.arrayContaining(['create_visitor_pass', 'list_visitors']),
    );
    expect(visible.map((t) => t.name)).not.toContain('list_invoices');
  });
});

describe('findTool', () => {
  it('finds a known tool and refuses an unknown one', () => {
    expect(findTool('list_announcements')?.scope).toBe('announcements:read');
    expect(findTool('drop_database')).toBeUndefined();
    expect(findTool('')).toBeUndefined();
  });
});
