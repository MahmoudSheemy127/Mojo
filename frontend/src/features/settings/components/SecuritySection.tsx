// src/features/settings/components/SecuritySection.tsx
import { Button } from '@/components/ui/Button';
import { useMe } from '../hooks/useMe';
import { useRequestPasswordReset } from '../hooks/useChangePassword';

/**
 * Account security (FR-04). The contract exposes only the emailed reset flow, so
 * "change password" is performed by sending the same reset link used at login.
 */
export function SecuritySection() {
  const { data: me } = useMe();
  const reset = useRequestPasswordReset();
  const email = me?.email;

  return (
    <section aria-labelledby="security-heading" className="flex flex-col gap-3">
      <div>
        <h2
          id="security-heading"
          className="text-base font-semibold text-text-normal"
        >
          Password
        </h2>
        <p className="mt-1 text-sm text-text-muted">
          We&apos;ll email a secure link
          {email ? (
            <>
              {' '}
              to <span className="text-text-normal">{email}</span>
            </>
          ) : null}{' '}
          so you can set a new password.
        </p>
      </div>

      <div>
        <Button
          variant="secondary"
          onClick={() => email && reset.mutate(email)}
          isLoading={reset.isPending}
          disabled={!email || reset.isSuccess}
        >
          {reset.isSuccess ? 'Email sent' : 'Send password reset email'}
        </Button>
      </div>

      {reset.isSuccess && (
        <p role="status" className="text-sm text-online">
          Check your inbox for a link to reset your password.
        </p>
      )}
    </section>
  );
}
