// src/components/ui/Textarea.tsx
import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/utils/cn';

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  /** Shown bottom-right (e.g. "12/200" character counter). */
  counter?: string | undefined;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, error, helperText, counter, className, id, ...props }, ref) => {
    const reactId = useId();
    const fieldId = id ?? reactId;
    const describedById = error
      ? `${fieldId}-error`
      : helperText
        ? `${fieldId}-helper`
        : undefined;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={fieldId}
            className="text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedById}
          className={cn(
            'min-h-20 w-full resize-y rounded-card bg-bg-deepest px-3 py-2 text-sm text-text-normal',
            'placeholder:text-text-muted',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
            'disabled:cursor-not-allowed disabled:opacity-60',
            error && 'ring-1 ring-danger',
            className,
          )}
          {...props}
        />
        <div className="flex items-center justify-between">
          {error ? (
            <p id={`${fieldId}-error`} role="alert" className="text-xs text-danger">
              {error}
            </p>
          ) : helperText ? (
            <p id={`${fieldId}-helper`} className="text-xs text-text-muted">
              {helperText}
            </p>
          ) : (
            <span />
          )}
          {counter && <span className="text-xs text-text-muted">{counter}</span>}
        </div>
      </div>
    );
  },
);

Textarea.displayName = 'Textarea';
