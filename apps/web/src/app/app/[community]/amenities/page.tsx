import { CalendarCheck, X } from 'lucide-react';
import { formatMoney } from '@samudaya/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { BookingForm } from './booking-form';
import { cancelBooking } from './actions';

export const metadata = { title: 'Amenities' };

const formatSlot = (starts: string, ends: string) => {
  const from = new Date(starts);
  const to = new Date(ends);
  const time = (d: Date) =>
    d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${from.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}, ${time(from)}–${time(to)}`;
};

export default async function AmenitiesPage(props: PageProps<'/app/[community]/amenities'>) {
  const { community: slug } = await props.params;
  const { community, membership } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const now = new Date().toISOString();

  const [amenities, bookings] = await Promise.all([
    supabase
      .from('amenities')
      .select(
        'id, name, description, capacity, opens_at, closes_at, booking_fee, requires_approval, max_hours_per_booking',
      )
      .eq('community_id', community.id)
      .eq('is_active', true)
      .order('name'),
    supabase
      .from('amenity_bookings')
      .select(
        'id, starts_at, ends_at, status, guests, membership_id, amenities(name), memberships(profiles(full_name))',
      )
      .eq('community_id', community.id)
      .gte('ends_at', now)
      .in('status', ['pending', 'confirmed'])
      .order('starts_at', { ascending: true })
      .limit(50),
  ]);

  return (
    <>
      <PageHeader
        title="Amenities"
        description="Book the clubhouse, the courts, or whatever your society shares."
      />
      <PageBody>
        <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <div className="space-y-4">
            {amenities.data?.length ? (
              amenities.data.map((amenity) => (
                <Card key={amenity.id}>
                  <CardHeader
                    title={amenity.name}
                    description={
                      [
                        amenity.description,
                        `Open ${amenity.opens_at.slice(0, 5)}–${amenity.closes_at.slice(0, 5)}`,
                        amenity.capacity ? `Up to ${amenity.capacity}` : null,
                        Number(amenity.booking_fee) > 0
                          ? formatMoney(amenity.booking_fee, community.currency)
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    action={
                      amenity.requires_approval ? <Badge tone="info">Needs approval</Badge> : null
                    }
                  />
                  <CardBody>
                    <BookingForm
                      slug={slug}
                      amenityId={amenity.id}
                      requiresApproval={amenity.requires_approval}
                      maxHours={amenity.max_hours_per_booking}
                    />
                  </CardBody>
                </Card>
              ))
            ) : (
              <Card>
                <EmptyState
                  icon={<CalendarCheck className="size-6" />}
                  title="No amenities set up"
                  description="An admin can add the clubhouse, gym or courts from the admin area."
                />
              </Card>
            )}
          </div>

          <Card className="h-fit">
            <CardHeader title="Upcoming bookings" description="Everyone’s, so you can plan." />
            {bookings.data?.length ? (
              <ul className="divide-border-base divide-y">
                {bookings.data.map((booking) => {
                  const mine = booking.membership_id === membership.id;
                  return (
                    <li
                      key={booking.id}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0">
                        <p className="text-ink truncate text-sm font-medium">
                          {booking.amenities?.name}
                        </p>
                        <p className="text-ink-subtle mt-0.5 text-xs">
                          {formatSlot(booking.starts_at, booking.ends_at)}
                        </p>
                        <p className="text-ink-subtle mt-0.5 text-xs">
                          {mine
                            ? 'You'
                            : (booking.memberships?.profiles?.full_name ?? 'A resident')}
                          {booking.guests > 0 ? ` · ${booking.guests} guests` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {booking.status === 'pending' ? (
                          <Badge tone="warning">Pending</Badge>
                        ) : null}
                        {mine ? (
                          <form action={cancelBooking}>
                            <input type="hidden" name="slug" value={slug} />
                            <input type="hidden" name="id" value={booking.id} />
                            <button
                              type="submit"
                              aria-label="Cancel booking"
                              className="text-ink-subtle hover:bg-surface-sunken hover:text-danger rounded-md p-1.5"
                            >
                              <X className="size-4" aria-hidden="true" />
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title="Nothing booked" description="The calendar is clear." />
            )}
          </Card>
        </div>
      </PageBody>
    </>
  );
}
