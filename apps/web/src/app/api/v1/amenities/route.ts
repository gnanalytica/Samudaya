import { withApi } from '@/lib/api/handler';
import { ok, parseLimit } from '@/lib/api/respond';
import { listAmenities, listBookings } from '@/lib/api/resources';

export const GET = withApi('amenities:read', async (principal, request) => {
  const limit = parseLimit(new URL(request.url).searchParams.get('limit'));
  const [amenities, bookings] = await Promise.all([
    listAmenities(principal),
    listBookings(principal, limit),
  ]);
  return ok({ amenities, upcoming_bookings: bookings });
});
