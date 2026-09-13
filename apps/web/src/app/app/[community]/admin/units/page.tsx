import Link from 'next/link';
import { ArrowLeft, Building2 } from 'lucide-react';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { EditUnitForm, GenerateFlatsForm, ImportFlatsForm } from './unit-forms';
import { deleteUnit } from './actions';

export const metadata = { title: 'Flats' };

export default async function FlatsPage(props: PageProps<'/app/[community]/admin/units'>) {
  const { community: slug } = await props.params;
  const { edit } = await props.searchParams;
  const { community } = await requireCapability(slug, 'roles:manage');
  const supabase = await getSupabase();
  const base = `/app/${community.slug}`;

  const [{ data: units }, { data: pending }] = await Promise.all([
    supabase
      .from('units')
      .select('id, block, number, floor, bedrooms, area_sqft, unit_occupants(count)')
      .eq('community_id', community.id)
      .order('block', { nullsFirst: true })
      .order('floor', { nullsFirst: true })
      .order('number')
      .limit(10000),
    supabase
      .from('join_requests')
      .select('unit_id')
      .eq('community_id', community.id)
      .eq('status', 'pending'),
  ]);

  const rows = (units ?? []).map((unit) => ({
    ...unit,
    occupants: unit.unit_occupants?.[0]?.count ?? 0,
  }));
  const requested = new Set((pending ?? []).map((request) => request.unit_id));
  const towers = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = row.block ?? '';
    towers.set(key, [...(towers.get(key) ?? []), row]);
  }
  const editing = typeof edit === 'string' ? rows.find((row) => row.id === edit) : undefined;

  return (
    <>
      <PageHeader
        title="Flats"
        description={`${rows.length} flat${rows.length === 1 ? '' : 's'} across ${towers.size} tower${
          towers.size === 1 ? '' : 's'
        }. Residents pick their flat from this list when they join.`}
      />
      <PageBody>
        <Link
          href={`${base}/admin/settings#flats`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Society settings
        </Link>

        <div className="space-y-5">
          {editing ? (
            <Card className="border-accent/40">
              <CardHeader
                title={`Edit ${editing.block ? `${editing.block}-` : ''}${editing.number}`}
                action={
                  <Link
                    href={`${base}/admin/units`}
                    className="text-ink-muted text-sm hover:underline"
                  >
                    Done
                  </Link>
                }
              />
              <CardBody>
                <EditUnitForm slug={community.slug} unit={editing} />
              </CardBody>
            </Card>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Generate flats"
                description="For towers where every floor has the same number of flats."
              />
              <CardBody>
                <GenerateFlatsForm slug={community.slug} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader
                title="Import from a spreadsheet"
                description="For irregular layouts, or to add BHK and area."
              />
              <CardBody>
                <ImportFlatsForm slug={community.slug} />
              </CardBody>
            </Card>
          </div>

          {rows.length ? (
            [...towers.entries()].map(([tower, flats]) => (
              <Card key={tower || 'none'}>
                <details open={towers.size === 1}>
                  <summary className="text-ink flex cursor-pointer items-center justify-between gap-3 px-5 py-4 text-sm font-semibold">
                    <span>{tower ? `Tower ${tower}` : 'No tower'}</span>
                    <span className="text-ink-muted font-normal">
                      {flats.length} flats · {flats.filter((flat) => flat.occupants > 0).length}{' '}
                      occupied
                    </span>
                  </summary>
                  <div className="border-border-base overflow-x-auto border-t">
                    <table className="w-full text-sm">
                      <thead className="text-ink-muted text-left text-xs">
                        <tr>
                          <th className="px-5 py-2 font-medium">Flat</th>
                          <th className="px-3 py-2 font-medium">Floor</th>
                          <th className="px-3 py-2 font-medium">BHK</th>
                          <th className="px-3 py-2 font-medium">Area</th>
                          <th className="px-3 py-2 font-medium">Residents</th>
                          <th className="px-5 py-2" />
                        </tr>
                      </thead>
                      <tbody className="divide-border-base divide-y">
                        {flats.map((flat) => {
                          const locked = flat.occupants > 0 || requested.has(flat.id);
                          return (
                            <tr key={flat.id}>
                              <td className="text-ink px-5 py-2 font-medium">
                                {flat.block ? `${flat.block}-` : ''}
                                {flat.number}
                              </td>
                              <td className="text-ink-muted px-3 py-2">{flat.floor ?? '—'}</td>
                              <td className="text-ink-muted px-3 py-2">{flat.bedrooms ?? '—'}</td>
                              <td className="text-ink-muted px-3 py-2">
                                {flat.area_sqft ? `${flat.area_sqft} sq ft` : '—'}
                              </td>
                              <td className="text-ink-muted px-3 py-2">
                                {flat.occupants ||
                                  (requested.has(flat.id) ? 'Request pending' : '—')}
                              </td>
                              <td className="px-5 py-2">
                                <div className="flex justify-end gap-1">
                                  <Link
                                    href={`${base}/admin/units?edit=${flat.id}`}
                                    className="text-accent px-2 py-1 text-xs hover:underline"
                                  >
                                    Edit
                                  </Link>
                                  {!locked ? (
                                    <form action={deleteUnit}>
                                      <input type="hidden" name="slug" value={community.slug} />
                                      <input type="hidden" name="id" value={flat.id} />
                                      <Button type="submit" size="sm" variant="ghost">
                                        Delete
                                      </Button>
                                    </form>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </Card>
            ))
          ) : (
            <Card>
              <EmptyState
                icon={<Building2 className="size-6" />}
                title="No flats yet"
                description="Generate them from your towers and floors, or import a spreadsheet."
              />
            </Card>
          )}
        </div>
      </PageBody>
    </>
  );
}
