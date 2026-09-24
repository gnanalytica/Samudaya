'use client';

import { Player } from '@remotion/player';
import { CollectScene, PlanScene, ProveScene, SCENE, SpendScene, type SceneProps } from './scenes';

const SCENES = {
  plan: PlanScene,
  collect: CollectScene,
  spend: SpendScene,
  prove: ProveScene,
} as const;

export type SceneId = keyof typeof SCENES;

/**
 * One chapter of the tour, played by the Remotion Player.
 *
 * Loaded on its own (tour.tsx imports it with next/dynamic, client-only) so
 * the Player and the compositions are fetched when the tour is about to be
 * seen rather than with the first paint. Somebody who has asked for less
 * motion gets the chapter's last frame — the finished state — standing still.
 */
export default function ScenePlayer({
  scene,
  calm,
  ...props
}: SceneProps & { scene: SceneId; calm: boolean }) {
  return (
    <Player
      key={scene}
      component={SCENES[scene]}
      inputProps={props}
      durationInFrames={SCENE.frames}
      fps={SCENE.fps}
      compositionWidth={SCENE.width}
      compositionHeight={SCENE.height}
      initialFrame={calm ? SCENE.frames - 1 : 0}
      autoPlay={!calm}
      loop={!calm}
      controls={false}
      clickToPlay={false}
      style={{ width: '100%' }}
      // The team is small enough for Remotion's free licence, which covers
      // companies of up to three people (remotion.dev/license). Saying so
      // silences the note the Player otherwise logs in every visitor's
      // console. A bigger team needs a company licence, and this should go.
      acknowledgeRemotionLicense
    />
  );
}
