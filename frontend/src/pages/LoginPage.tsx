// src/pages/LoginPage.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import AuthLayout from '@/layouts/AuthLayout';
import { Tabs } from '@/components/ui/Tabs';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { SignupForm } from '@/features/auth/components/SignupForm';
import { GoogleOAuthButton } from '@/features/auth/components/GoogleOAuthButton';

type Mode = 'login' | 'signup';

const TAB_ITEMS = [
  { value: 'login' as const, label: 'Log in' },
  { value: 'signup' as const, label: 'Sign up' },
];

export default function LoginPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<Mode>(
    location.pathname === '/signup' ? 'signup' : 'login',
  );

  // Keep the active tab in sync with the route (/login vs /signup).
  useEffect(() => {
    setMode(location.pathname === '/signup' ? 'signup' : 'login');
  }, [location.pathname]);

  const switchMode = (next: Mode) => {
    setMode(next);
    void navigate(next === 'signup' ? '/signup' : '/login', { replace: true });
  };

  const oauthError =
    searchParams.get('error') === 'oauth_failed'
      ? "Google sign-in didn't complete. Please try again."
      : undefined;

  return (
    <AuthLayout>
      <div className="flex flex-col gap-5">
        <Tabs
          items={TAB_ITEMS}
          value={mode}
          onChange={switchMode}
          aria-label="Authentication mode"
        />

        <GoogleOAuthButton />

        <div className="flex items-center gap-3 text-xs uppercase text-text-muted">
          <span className="h-px flex-1 bg-bg-active" />
          or
          <span className="h-px flex-1 bg-bg-active" />
        </div>

        {mode === 'login' ? (
          <LoginForm
            onSwitchToSignup={() => switchMode('signup')}
            {...(oauthError ? { externalError: oauthError } : {})}
          />
        ) : (
          <SignupForm onSwitchToLogin={() => switchMode('login')} />
        )}
      </div>
    </AuthLayout>
  );
}
