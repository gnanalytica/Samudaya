/* eslint-disable */
// Generated set for the demo video — see video/capture/capture.mjs.
import { ContributeForm } from '@/app/app/[community]/events/[event]/contribute/contribute-form';

const flats = [
  { id: 'u1', block: 'A', number: '402' },
  { id: 'u2', block: 'A', number: '703' },
  { id: 'u3', block: 'B', number: '306' },
  { id: 'u4', block: 'B', number: '1104' },
];

export default function Harness() {
  return (
    <div className="bg-surface min-h-screen p-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-ink text-3xl font-semibold tracking-tight">
          Support Ganesh Chaturthi 2026
        </h1>
        <p className="text-ink-muted mt-1 text-sm">
          Your contribution goes to the Ganesh Chaturthi 2026 fund and nowhere else.
        </p>
        <div className="mt-6">
          <ContributeForm
            slug="shanti-nivas"
            eventSlug="ganesh-chaturthi-2026"
            eventName="Ganesh Chaturthi 2026"
            currency="INR"
            suggested={null}
            askedPerFlat={1001}
            upi={{ vpa: 'shantinivas@okicici', payeeName: 'Shanti Nivas Welfare' }}
            flatLabel={null}
            flats={flats}
            proofFolder="demo/demo"
          />
        </div>
      </div>
    </div>
  );
}
