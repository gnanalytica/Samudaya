import { Building2, Trash2 } from 'lucide-react';
import { formatMoney, unitLabel } from '@samudaya/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { UnitForms } from './unit-forms';
import { deleteUnit } from './actions';

export const metadata = { title: 'Units' };

export default async function UnitsPage(props: PageProps<'/app/[community]/admin/units'>) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'units:manage');
  const supabase = await getSupabase();

  const { data: units } = await supabase
    .from('units')
    .select(
      'id, block, number, floor, monthly_dues, unit_occupants(id, memberships(profiles(full_name)))',
    )
    .eq('community_id', community.id)
    .order('block', { nullsFirst: true })
    .order('number')
    .limit(1000);

  return (
    <>
      <PageHeader
        title="Units"
        description="The flats, villas and shops in this community. Invite codes can be tied to one."
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
          <Card>
            <CardHeader title="All units" description={`${units?.length ?? 0} on record`} />
            {units?.length ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Unit
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Residents
                      </th>
                      <th scope="col" className="px-5 py-2.5 text-right font-medium">
                        Monthly dues
                      </th>
                      <th scope="col" className="px-5 py-2.5">
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-border-base divide-y">
                    {units.map((unit) => {
                      const occupants = unit.unit_occupants
                        .map((occupant) => occupant.memberships?.profiles?.full_name)
                        .filter(Boolean);
                      return (
                        <tr key={unit.id}>
                          <td className="text-ink px-5 py-3 font-medium">{unitLabel(unit)}</td>
                          <td className="text-ink-muted px-5 py-3">
                            {occupants.length ? occupants.join(', ') : 'Vacant'}
                          </td>
                          <td className="text-ink-muted px-5 py-3 text-right">
                            {formatMoney(unit.monthly_dues, community.currency)}
                          </td>
                          <td className="px-5 py-3 text-right">
                            {/* Deleting a unit cascades to its occupancy rows, so
                                only offer it while nobody lives there. */}
                            {occupants.length === 0 ? (
                              <form action={deleteUnit}>
                                <input type="hidden" name="slug" value={slug} />
                                <input type="hidden" name="id" value={unit.id} />
                                <button
                                  type="submit"
                                  aria-label={`Delete unit ${unitLabel(unit)}`}
                                  className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-1.5"
                                >
                                  <Trash2 className="size-4" aria-hidden="true" />
                                </button>
                              </form>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<Building2 className="size-6" />}
                title="No units yet"
                description="Add your flats so residents can be attached to one."
              />
            )}
          </Card>

          <UnitForms slug={slug} />
        </div>
      </PageBody>
    </>
  );
}
