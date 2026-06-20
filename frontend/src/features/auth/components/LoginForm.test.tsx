// src/features/auth/components/LoginForm.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginForm } from './LoginForm';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/authStore';

describe('LoginForm', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('renders default fields and the forgot-password link', () => {
    renderWithProviders(<LoginForm onSwitchToSignup={() => {}} />);
    expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forgot password/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm onSwitchToSignup={() => {}} />);
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/enter your username or email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
  });

  it('toggles password visibility', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm onSwitchToSignup={() => {}} />);
    const pwd = screen.getByLabelText(/^password$/i);
    expect(pwd).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: /show password/i }));
    expect(pwd).toHaveAttribute('type', 'text');
  });

  it('authenticates on valid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm onSwitchToSignup={() => {}} />);
    await user.type(screen.getByLabelText(/username or email/i), 'alice');
    await user.type(screen.getByLabelText(/^password$/i), 'correct-horse');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    await waitFor(() =>
      expect(useAuthStore.getState().isAuthenticated).toBe(true),
    );
  });

  it('shows a generic banner on bad credentials (401)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm onSwitchToSignup={() => {}} />);
    await user.type(screen.getByLabelText(/username or email/i), 'alice');
    await user.type(screen.getByLabelText(/^password$/i), 'wrong');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/incorrect username or password/i)).toBeInTheDocument();
  });

  it('shows a rate-limit banner (429)', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginForm onSwitchToSignup={() => {}} />);
    await user.type(screen.getByLabelText(/username or email/i), 'ratelimited');
    await user.type(screen.getByLabelText(/^password$/i), 'whatever');
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/too many attempts/i)).toBeInTheDocument();
  });

  it('renders an external (OAuth) error banner', () => {
    renderWithProviders(
      <LoginForm onSwitchToSignup={() => {}} externalError="oauth boom" />,
    );
    expect(screen.getByText('oauth boom')).toBeInTheDocument();
  });

  it('invokes switch + forgot callbacks', async () => {
    const user = userEvent.setup();
    const onSwitch = vi.fn();
    const onForgot = vi.fn();
    renderWithProviders(
      <LoginForm onSwitchToSignup={onSwitch} onForgotPassword={onForgot} />,
    );
    await user.click(screen.getByRole('button', { name: /sign up/i }));
    await user.click(screen.getByRole('button', { name: /forgot password/i }));
    expect(onSwitch).toHaveBeenCalledOnce();
    expect(onForgot).toHaveBeenCalledOnce();
  });
});
