'use client';

import { useEffect, useRef } from 'react';

/**
 * Forty seconds of the app, on the front page.
 *
 * Animated rather than filmed since `video/src/story.tsx` — what plays here is
 * the `Explain` cut, drawn from the app's own screens and data.
 *
 * A society's committee is being asked to put the society's money somewhere,
 * and six feature cards do not answer the question they actually have, which
 * is what this looks like when their neighbours use it. So the ledger is on
 * the page, moving, before anybody has signed in.
 *
 * It starts itself rather than carrying `autoplay`, because that attribute has
 * no way to ask whether the visitor wants motion. Somebody who has told their
 * system to reduce it gets the poster and the controls, which is the whole
 * video, just not uninvited. Browsers that block autoplay outright land in the
 * same place, so there is nothing extra to handle.
 */
export function DemoVideo() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Rejects when the browser declines to autoplay. The poster and controls
    // are already there, so there is nothing to fall back to.
    void video.play().catch(() => {});
  }, []);

  return (
    <video
      ref={ref}
      className="bg-surface-sunken block aspect-video w-full"
      src="/samudaya-demo.mp4"
      poster="/samudaya-demo-poster.jpg"
      controls
      muted
      loop
      playsInline
      preload="metadata"
    >
      Samudaya, following one contribution the whole way: a resident pays ₹2,001 towards Ganesh
      Chaturthi, it arrives on the committee&rsquo;s list, somebody who did not pay it confirms it
      against the screenshot, and it lands on a ledger every resident can read with a name and a
      flat beside it. Then the money out — a bill the person who filed it may not approve, the
      spending against budget, the bank statement reconciled, and the ₹1,100 left at the end going
      to the society by a recorded decision.
    </video>
  );
}
