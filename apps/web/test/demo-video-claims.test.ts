import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The demo video may not claim a capability the product does not have.
 *
 * Most of the video is a recording of the app, which cannot lie. Two scenes
 * are drawn rather than filmed — the WhatsApp bot and the MCP server, because
 * one is somebody else's app and the other has no pixels — and a drawing can
 * say anything. The first draft of the MCP scene invented four scope names
 * that read perfectly and matched nothing.
 *
 * So every command and every tool name those scenes show is checked against
 * the source it came from. A tool renamed in `mcp-tools.ts` or a command
 * dropped from `commands.ts` fails here rather than shipping as a promise the
 * product no longer keeps.
 */
const ROOT = join(import.meta.dirname, '..', '..', '..');
const surfaces = () => readFileSync(join(ROOT, 'video', 'src', 'surfaces.tsx'), 'utf8');
const mcpTools = () =>
  readFileSync(join(ROOT, 'apps', 'web', 'src', 'lib', 'api', 'mcp-tools.ts'), 'utf8');
const commands = () =>
  readFileSync(join(ROOT, 'packages', 'core', 'src', 'whatsapp', 'commands.ts'), 'utf8');

/** `{ name: 'x', scope: 'y' }` as the scene lists them. */
function scenePairs() {
  return [...surfaces().matchAll(/\{ name: '([a-z_]+)', scope: '([a-z:]+)' \}/g)].map((match) => ({
    name: match[1],
    scope: match[2],
  }));
}

/** The real registry: a `name:` and the `scope:` that follows it. */
function realScopes() {
  const source = mcpTools();
  const found = new Map<string, string>();
  for (const match of source.matchAll(/name: '([a-z_]+)',[\s\S]{0,700}?scope: '([a-z:]+)'/g)) {
    if (!found.has(match[1])) found.set(match[1], match[2]);
  }
  return found;
}

describe('what the drawn scenes claim', () => {
  it('shows enough MCP tools to be worth checking', () => {
    // Guards the regex above: if it stops matching, every assertion below
    // passes over an empty list and the test becomes decoration.
    expect(scenePairs().length).toBeGreaterThanOrEqual(10);
    expect(realScopes().size).toBeGreaterThanOrEqual(12);
  });

  it('names only tools the MCP server actually registers', () => {
    const real = realScopes();
    for (const { name } of scenePairs()) {
      expect(real.has(name), `${name} is in the video but not in mcp-tools.ts`).toBe(true);
    }
  });

  it('gives each tool the scope the server gives it', () => {
    const real = realScopes();
    for (const { name, scope } of scenePairs()) {
      expect(scope, `${name} is shown under the wrong scope`).toBe(real.get(name));
    }
  });

  it('withholds a write tool from the read-only key, which is the point', () => {
    // The scene's argument is that tools/list is filtered by scope. If every
    // tool it struck through were a read tool, it would be arguing nothing.
    const source = surfaces();
    const withheld = source.slice(source.indexOf('const WITHHELD'));
    expect(withheld).toContain(':write');
    expect(withheld).toContain('not in scope');
  });

  it('types only commands the WhatsApp bot understands', () => {
    const source = surfaces();
    const thread = source.slice(source.indexOf('const THREAD'), source.indexOf('function Bubble'));
    const typed = [...thread.matchAll(/from: 'them', text: '([a-z]+)/g)].map((m) => m[1]);
    expect(typed.length).toBeGreaterThanOrEqual(3);

    const aliases = commands();
    for (const word of typed) {
      expect(aliases, `the video types "${word}" at a bot that has no such command`).toContain(
        `  ${word}:`,
      );
    }
  });
});
