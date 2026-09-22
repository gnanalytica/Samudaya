/* eslint-disable */
// Generated set for the demo video — see video/capture/capture.mjs.
import { AllocateSurplusForm } from '@/app/app/[community]/admin/events/[event]/forms';

const openEvents = [
  { id: 'e1', name: 'Diwali 2026', emoji: '🪔', starts_on: '2026-11-08' },
  { id: 'e2', name: 'Cleanliness Drive', emoji: '🧹', starts_on: '2026-10-04' },
];

export default function Harness() {
  return (
    <div className="bg-surface min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-ink text-3xl font-semibold tracking-tight">Closing the event</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Ganesh Chaturthi 2026 · every bill approved, every payment confirmed.
        </p>
        <div className="mt-6">
          <AllocateSurplusForm
            slug="shanti-nivas"
            eventSlug="ganesh-chaturthi-2026"
            surplus={6900}
            currency="INR"
            openEvents={openEvents}
            nextEdition="Ganesh Chaturthi 2027"
          />
        </div>
      </div>
    </div>
  );
}
