import { KeyRound } from 'lucide-react';
import { relativeTime } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { ApiKeyForm } from './key-form';
import { revokeApiKey } from './actions';

export const metadata = { title: 'API & AI access' };

export default async function ApiKeysPage(props: PageProps<'/app/[community]/admin/api-keys'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'apikeys:manage');
  const supabase = await getSupabase();

  const { data: keys } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, expires_at, revoked_at, created_at')
    .eq('community_id', community.id)
    .order('created_at', { ascending: false })
    .limit(100);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://your-deployment';

  return (
    <>
      <PageHeader
        title="API & AI access"
        description="Keys let scripts, integrations and AI assistants work with this community."
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_400px]">
          <div className="space-y-5">
            <Card>
              <CardHeader title="Keys" description={`${keys?.length ?? 0} created`} />
              {keys?.length ? (
                <ul className="divide-border-base divide-y">
                  {keys.map((key) => {
                    const expired = key.expires_at && new Date(key.expires_at) <= new Date();
                    const dead = Boolean(key.revoked_at) || expired;
                    return (
                      <li key={key.id} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-ink text-sm font-medium">{key.name}</p>
                            <p className="text-ink-subtle mt-0.5 font-mono text-xs">
                              {key.key_prefix}…
                            </p>
                            <p className="text-ink-subtle mt-1 text-xs">
                              {key.last_used_at
                                ? `Last used ${relativeTime(key.last_used_at)}`
                                : 'Never used'}
                              {' · created '}
                              {relativeTime(key.created_at)}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            {key.revoked_at ? (
                              <Badge tone="danger">Revoked</Badge>
                            ) : expired ? (
                              <Badge tone="neutral">Expired</Badge>
                            ) : (
                              <Badge tone="success">Active</Badge>
                            )}
                            {!dead ? (
                              <form action={revokeApiKey}>
                                <input type="hidden" name="slug" value={slug} />
                                <input type="hidden" name="id" value={key.id} />
                                <button
                                  type="submit"
                                  className="text-ink-muted hover:text-danger text-sm underline underline-offset-4"
                                >
                                  Revoke
                                </button>
                              </form>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {key.scopes.map((scope) => (
                            <span
                              key={scope}
                              className="bg-surface-sunken text-ink-muted rounded px-1.5 py-0.5 font-mono text-[11px]"
                            >
                              {scope}
                            </span>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <EmptyState
                  icon={<KeyRound className="size-6" />}
                  title="No keys yet"
                  description="Create one to let an assistant or a script work with this community."
                />
              )}
            </Card>

            <Card>
              <CardHeader
                title="Connecting an AI assistant"
                description="Samudaya speaks the Model Context Protocol, so an agent can use it as tools."
              />
              <CardBody className="space-y-4 text-sm">
                <div>
                  <p className="text-ink font-medium">MCP endpoint</p>
                  <pre className="bg-surface-sunken text-ink-muted mt-1.5 overflow-x-auto rounded-lg p-3 font-mono text-xs">
                    {`{
  "mcpServers": {
    "samudaya": {
      "type": "http",
      "url": "${siteUrl}/api/mcp",
      "headers": { "Authorization": "Bearer sam_live_…" }
    }
  }
}`}
                  </pre>
                  <p className="text-ink-subtle mt-1.5 text-xs">
                    The assistant only sees the tools your key’s scopes allow.
                  </p>
                </div>
                <div>
                  <p className="text-ink font-medium">Or the REST API</p>
                  <pre className="bg-surface-sunken text-ink-muted mt-1.5 overflow-x-auto rounded-lg p-3 font-mono text-xs">
                    {`curl ${siteUrl}/api/v1/requests?status=open \\
  -H "Authorization: Bearer sam_live_…"`}
                  </pre>
                </div>
              </CardBody>
            </Card>
          </div>

          <ApiKeyForm slug={slug} />
        </div>
      </PageBody>
    </>
  );
}
