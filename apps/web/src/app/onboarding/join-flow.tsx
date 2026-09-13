'use client';

import { useActionState, useMemo, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardBody } from '@/components/ui/card';
import { Field, Input, Select } from '@/components/ui/field';
import { startJoin, submitJoinDetails, type JoinState } from './actions';

function Submit({ label, busy }: { label: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : label}
    </Button>
  );
}

const initial: JoinState = {};

/**
 * Two short steps: the society code with who you are, then your flat. The
 * second step needs the society's flat list, which only exists once the code
 * has been checked.
 */
export function JoinFlow({
  initialCode = '',
  initialName = '',
}: {
  /** From a shared join link. */
  initialCode?: string;
  /** From the Google account, so most people only add their mobile number. */
  initialName?: string;
}) {
  const [start, startAction] = useActionState(startJoin, initial);
  const [details, detailsAction] = useActionState(submitJoinDetails, initial);
  const [code, setCode] = useState(initialCode);

  const blocks = useMemo(() => {
    const names = new Set((start.units ?? []).map((unit) => unit.block ?? ''));
    return [...names].sort();
  }, [start.units]);
  const [block, setBlock] = useState<string | null>(null);
  const [relation, setRelation] = useState('owner');
  const worksHere = relation === 'other';
  const activeBlock = block ?? blocks[0] ?? '';
  const flats = (start.units ?? []).filter((unit) => (unit.block ?? '') === activeBlock);

  if (start.step === 'details' && start.society) {
    return (
      <Card>
        <CardBody>
          <form action={detailsAction} className="space-y-4">
            <input type="hidden" name="join_code" value={start.society.code} />
            <input type="hidden" name="name" value={start.name ?? ''} />
            <input type="hidden" name="phone" value={start.phone ?? ''} />

            <div className="border-border-base bg-surface-sunken rounded-xl border p-4">
              <p className="text-ink-subtle text-xs tracking-wide uppercase">Joining</p>
              <p className="text-ink mt-1 text-lg font-semibold tracking-tight">
                {start.society.name}
              </p>
              <p className="text-ink-muted mt-0.5 text-sm">
                {start.name} · {start.phone}
              </p>
            </div>

            <Field label="You are" htmlFor="jr-relation">
              {(control) => (
                <Select
                  {...control}
                  name="relation"
                  value={relation}
                  onChange={(event) => setRelation(event.target.value)}
                >
                  <option value="owner">Owner of a flat</option>
                  <option value="tenant">Tenant</option>
                  <option value="family">Family member of an owner or tenant</option>
                  <option value="other">I work for the society</option>
                </Select>
              )}
            </Field>

            {worksHere ? (
              <p className="text-ink-muted text-sm">
                Supervisors, managers and other staff don’t need a flat. The committee will choose
                your role when they approve you.
              </p>
            ) : start.units?.length ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {blocks.length > 1 ? (
                  <Field label="Tower" htmlFor="jr-block">
                    {(control) => (
                      <Select
                        {...control}
                        value={activeBlock}
                        onChange={(event) => setBlock(event.target.value)}
                      >
                        {blocks.map((name) => (
                          <option key={name} value={name}>
                            {name ? `Tower ${name}` : 'No tower'}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                ) : null}
                <Field label="Flat" htmlFor="jr-unit" required>
                  {(control) => (
                    <Select {...control} name="unit_id" required defaultValue="">
                      <option value="" disabled>
                        Pick your flat
                      </option>
                      {flats.map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {unit.block ? `${unit.block}-${unit.number}` : unit.number}
                        </option>
                      ))}
                    </Select>
                  )}
                </Field>
              </div>
            ) : (
              <p className="text-ink-muted text-sm">
                This society hasn’t listed its flats yet. You can still send your request; staff
                will confirm your flat.
              </p>
            )}

            {details.error ? (
              <p role="alert" className="text-danger text-sm">
                {details.error}
              </p>
            ) : null}

            <Submit label="Send for approval" busy="Sending…" />
          </form>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardBody>
        <form action={startAction} className="space-y-4">
          <Field
            label="Society code"
            htmlFor="join-code"
            error={start.fieldErrors?.join_code}
            hint={
              initialCode
                ? 'Filled in from your join link.'
                : 'Your committee shares one code with every resident.'
            }
            required
          >
            {(control) => (
              <Input
                {...control}
                name="join_code"
                value={code}
                onChange={(event) => setCode(event.target.value.toUpperCase())}
                placeholder="VJ4FQW"
                autoCapitalize="characters"
                spellCheck={false}
                required
                className="text-center font-mono text-lg tracking-[0.2em]"
              />
            )}
          </Field>
          <Field label="Your name" htmlFor="jr-name" error={start.fieldErrors?.name} required>
            {(control) => (
              <Input
                {...control}
                name="name"
                autoComplete="name"
                defaultValue={initialName}
                required
              />
            )}
          </Field>
          <Field
            label="Mobile number"
            htmlFor="jr-phone"
            error={start.fieldErrors?.phone}
            hint="So staff can confirm it’s you."
            required
          >
            {(control) => (
              <Input
                {...control}
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="98450 12345"
                autoFocus={Boolean(initialCode)}
                required
              />
            )}
          </Field>

          {start.error ? (
            <p role="alert" className="text-danger text-sm">
              {start.error}
            </p>
          ) : null}

          <Submit label="Continue" busy="Checking…" />
          <p className="text-ink-subtle flex items-start gap-2 text-xs">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            The code only lets you ask. Staff or the committee approve who gets in.
          </p>
        </form>
      </CardBody>
    </Card>
  );
}
