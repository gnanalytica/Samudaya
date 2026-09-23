/* eslint-disable */
// Generated set for the demo video — see video/capture/capture.mjs.
'use client';

import { useState } from 'react';
import { FestivalNameField, approximateDateNote } from '@/components/festival-name-field';
import type { FestivalDraft } from '@/components/festival-name-field';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Field, Input } from '@/components/ui/field';

const TODAY = '2026-06-18';

export default function Harness() {
  const [name, setName] = useState('');
  const [draft, setDraft] = useState<FestivalDraft | null>(null);
  const [startsOn, setStartsOn] = useState('');
  const [emoji, setEmoji] = useState('');

  return (
    <div className="bg-surface min-h-screen p-8">
      <div className="mx-auto max-w-xl">
        <h1 className="text-ink text-3xl font-semibold tracking-tight">Create an event</h1>
        <p className="text-ink-muted mt-1 text-sm">
          Name, date and budget are enough to start. You can add bills and more activities later.
        </p>

        <Card className="mt-6">
          <CardHeader title="What are you planning?" />
          <CardBody className="space-y-4">
            <FestivalNameField
              value={name}
              onChange={setName}
              onPick={(picked) => {
                setDraft(picked);
                setStartsOn(picked.startsOn);
                setEmoji(picked.emoji ?? '');
              }}
              today={TODAY}
            />
            <div className="grid grid-cols-[5rem_1fr] gap-3">
              <Field label="Emoji" htmlFor="ne-emoji">
                {(control) => (
                  <Input {...control} name="emoji" value={emoji} onChange={() => {}} readOnly />
                )}
              </Field>
              <Field
                label="Starts on"
                htmlFor="ne-start"
                hint={approximateDateNote(draft)}
                required
              >
                {(control) => (
                  <Input
                    {...control}
                    name="starts_on"
                    type="date"
                    value={startsOn}
                    onChange={(event) => setStartsOn(event.target.value)}
                  />
                )}
              </Field>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
