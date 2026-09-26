import type { InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// 16px on a phone, 14px from `sm`. Mobile Safari zooms the page in on any
// field it focuses whose text is under 16px, and then leaves it zoomed — so
// tapping a form on an iPhone jumped the layout and the rest of the page had
// to be scrolled sideways to read. The size only looks different on a phone,
// where the field is full-width anyway; `sm` and up is unchanged at 14px.
const control =
  'w-full rounded-xl border border-border-base bg-surface-raised px-3 py-2 text-base sm:text-sm text-ink ' +
  'transition-[border-color,box-shadow] focus:border-border-strong ' +
  'placeholder:text-ink-subtle disabled:opacity-60 disabled:cursor-not-allowed ' +
  'aria-[invalid=true]:border-danger';

/** Accessibility wiring the control needs; spread it onto the input. */
export type ControlProps = {
  id: string;
  'aria-describedby': string | undefined;
  'aria-invalid': true | undefined;
};

/**
 * Label + control + hint/error, with the `aria-describedby` and `aria-invalid`
 * wiring handed to the caller as a render prop. Passing the control as a
 * function makes that wiring impossible to forget, which is exactly the kind
 * of thing that silently rots when it is left to each call site.
 */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string | undefined;
  required?: boolean;
  children: ReactNode | ((props: ControlProps) => ReactNode);
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined;

  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-ink block text-sm font-medium">
        {label}
        {required ? (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>

      {typeof children === 'function'
        ? children({
            id: htmlFor,
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
          })
        : children}

      {hint && !error ? (
        <p id={`${htmlFor}-hint`} className="text-ink-subtle text-xs">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="text-danger text-xs">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, 'min-h-24 resize-y', className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(control, 'pr-8', className)} {...props} />;
}
