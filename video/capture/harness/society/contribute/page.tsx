/* eslint-disable */
// Generated set for the demo video. Copied into apps/web/src/app/zz-demo/ by
// video/capture/stage.mjs and deleted again when the capture finishes.
//
// The real Contribute form, with an event's worth of props handed to it. The
// flat question at the top of it is the app's own: it appears because this
// society has no flat on record for the payer, which is exactly when a
// resident sees it.
import { PageBody, PageHeader } from '@/components/page-header';
import { ContributeForm } from '@/app/app/[community]/events/[event]/contribute/contribute-form';

const flats = [
  { id: 'u1', block: 'A', number: '402' },
  { id: 'u2', block: 'A', number: '703' },
  { id: 'u3', block: 'B', number: '306' },
  { id: 'u4', block: 'B', number: '1104' },
];

export default function DemoContribute() {
  return (
    <>
      <PageHeader
        title="Support Ganesh Chaturthi 2026"
        description="Your contribution goes to the Ganesh Chaturthi 2026 fund and nowhere else."
      />
      <PageBody>
        <div className="max-w-3xl">
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
      </PageBody>
    </>
  );
}
