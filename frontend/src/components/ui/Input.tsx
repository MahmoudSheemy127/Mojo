// src/components/ui/Input.tsx
import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string | undefined;
  error?: string | undefined;
  helperText?: string | undefined;
  /** Rendered inside the field on the trailing edge (e.g. show/hide toggle). */
  trailing?: ReactNode | undefined;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, trailing, className, id, ...props }, ref) => {
    const reactId = useId();
    const inputId = id ?? reactId;
    const describedById = error
      ? `${inputId}-error`
      : helperText
        ? `${inputId}-helper`
        : undefined;

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wide text-text-muted"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedById}
            className={cn(
              'h-10 w-full rounded-card bg-bg-deepest px-3 text-sm text-text-normal',
              'placeholder:text-text-muted',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:cursor-not-allowed disabled:opacity-60',
              error && 'ring-1 ring-danger',
              trailing && 'pr-10',
              className,
            )}
            {...props}
          />
          {trailing && (
            <div className="absolute inset-y-0 right-1 flex items-center">
              {trailing}
            </div>
          )}
        </div>
        {error ? (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-danger">
            {error}
          </p>
        ) : helperText ? (
          <p id={`${inputId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  },
);

Input.displayName = 'Input';
