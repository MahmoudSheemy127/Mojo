// src/features/auth/components/SignupForm.tsx
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { IconButton } from '@/components/ui/IconButton';
import { useSignup } from '../hooks/useSignup';
import { signupSchema } from '../schemas';
import { parseSignupError } from '../errors';

interface SignupFormProps {
  onSwitchToLogin: () => void;
}

function passwordStrength(password: string): string {
  if (password.length === 0) return '';
  if (password.length < 8) return 'Too short — use at least 8 characters';
  const variety =
    Number(/[a-z]/.test(password)) +
    Number(/[A-Z]/.test(password)) +
    Number(/\d/.test(password)) +
    Number(/[^A-Za-z0-9]/.test(password));
  if (variety >= 3) return 'Strong password';
  return 'Add upper, lower, numbers or symbols for a stronger password';
}

export function SignupForm({ onSwitchToLogin }: SignupFormProps) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | undefined>();

  const mutation = useSignup();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setBanner(undefined);
    setFieldErrors({});

    const parsed = signupSchema.safeParse({
      username,
      email,
      password,
      confirmPassword,
      acceptedTerms,
    });
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (typeof key === 'string' && !errs[key]) errs[key] = issue.message;
      }
      setFieldErrors(errs);
      return;
    }

    mutation.mutate(
      {
        username: parsed.data.username,
        email: parsed.data.email,
        password: parsed.data.password,
        acceptedTerms: parsed.data.acceptedTerms,
      },
      {
        onError: (error) => {
          const info = parseSignupError(error);
          if (info.fields) setFieldErrors(info.fields as Record<string, string>);
          if (info.banner) setBanner(info.banner);
        },
      },
    );
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      {banner && (
        <div role="alert" className="rounded-card bg-danger/15 px-3 py-2 text-sm text-danger">
          {banner}
        </div>
      )}

      <Input
        label="Username"
        name="username"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        error={fieldErrors.username}
        helperText="3–32 characters: letters, numbers, underscores"
        disabled={mutation.isPending}
      />

      <Input
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        error={fieldErrors.email}
        disabled={mutation.isPending}
      />

      <Input
        label="Password"
        name="password"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        error={fieldErrors.password}
        helperText={passwordStrength(password) || undefined}
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

      <Input
        label="Confirm password"
        name="confirmPassword"
        type={showPassword ? 'text' : 'password'}
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        error={fieldErrors.confirmPassword}
        disabled={mutation.isPending}
      />

      <label className="flex items-start gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          name="acceptedTerms"
          checked={acceptedTerms}
          onChange={(e) => setAcceptedTerms(e.target.checked)}
          disabled={mutation.isPending}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span>
          I agree to the{' '}
          <a href="/terms" className="text-accent hover:underline">
            Terms of Service
          </a>{' '}
          and{' '}
          <a href="/privacy" className="text-accent hover:underline">
            Privacy Policy
          </a>
          .
        </span>
      </label>
      {fieldErrors.acceptedTerms && (
        <p role="alert" className="-mt-2 text-xs text-danger">
          {fieldErrors.acceptedTerms}
        </p>
      )}

      <Button type="submit" fullWidth isLoading={mutation.isPending}>
        Create account
      </Button>

      <p className="text-center text-sm text-text-muted">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-accent hover:underline"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
