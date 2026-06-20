// src/features/auth/components/LoginForm.tsx
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { useLogin } from '../hooks/useLogin';
import { loginSchema } from '../schemas';
import { parseLoginError } from '../errors';

interface LoginFormProps {
  onSwitchToSignup: () => void;
  onForgotPassword?: () => void;
  /** Pre-set banner (e.g. from ?error=oauth_failed). */
  externalError?: string;
}

export function LoginForm({
  onSwitchToSignup,
  onForgotPassword,
  externalError,
}: LoginFormProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | undefined>();

  const mutation = useLogin();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBanner(undefined);
    setFieldErrors({});

    const parsed = loginSchema.safeParse({ identifier, password });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    mutation.mutate(parsed.data, {
      onError: (error) => setBanner(parseLoginError(error).banner),
    });
  };

  const activeBanner = banner ?? externalError;

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {activeBanner && (
        <div role="alert" className="rounded-card bg-danger/15 px-3 py-2 text-sm text-danger">
          {activeBanner}
        </div>
      )}

      <Input
        label="Username or email"
        name="identifier"
        autoComplete="username"
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
        error={fieldErrors.identifier}
        disabled={mutation.isPending}
      />

      <Input
        label="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        disabled={mutation.isPending}
        trailing={
          <IconButton
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            onClick={() => setShowPassword((v) => !v)}
            tabIndex={-1}
          >
            {showPassword ? '🙈' : '👁'}
          </IconButton>
        }
      />

      <button
        type="button"
        onClick={onForgotPassword}
        className="self-start text-sm text-accent hover:underline"
      >
        Forgot password?
      </button>

      <Button type="submit" fullWidth isLoading={mutation.isPending}>
        Log in
      </Button>

      <p className="text-center text-sm text-text-muted">
        Don&apos;t have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToSignup}
          className="font-medium text-accent hover:underline"
        >
          Sign up
        </button>
      </p>
    </form>
  );
}
