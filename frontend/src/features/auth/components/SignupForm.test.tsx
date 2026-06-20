// src/features/auth/components/SignupForm.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SignupForm } from './SignupForm';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/authStore';

async function fillValid(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/^username$/i), 'alice_1');
  await user.type(screen.getByLabelText(/^email$/i), 'alice@example.com');
  await user.type(screen.getByLabelText(/^password$/i), 'longenough');
  await user.type(screen.getByLabelText(/confirm password/i), 'longenough');
  await user.click(screen.getByRole('checkbox'));
}

describe('SignupForm', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('renders all fields', () => {
    renderWithProviders(<SignupForm onSwitchToLogin={() => {}} />);
    expect(screen.getByLabelText(/^username$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('rejects an invalid username', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm onSwitchToLogin={() => {}} />);
    await user.type(screen.getByLabelText(/^username$/i), 'bad name');
    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough');
    await user.type(screen.getByLabelText(/confirm password/i), 'longenough');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/only letters, numbers/i)).toBeInTheDocument();
  });

  it('flags mismatched passwords', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm onSwitchToLogin={() => {}} />);
    await user.type(screen.getByLabelText(/^username$/i), 'alice_1');
    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough');
    await user.type(screen.getByLabelText(/confirm password/i), 'different1');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/passwords don't match/i)).toBeInTheDocument();
  });

  it('requires accepting the terms', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm onSwitchToLogin={() => {}} />);
    await user.type(screen.getByLabelText(/^username$/i), 'alice_1');
    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough');
    await user.type(screen.getByLabelText(/confirm password/i), 'longenough');
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/must accept the terms/i)).toBeInTheDocument();
  });

  it('surfaces a taken username (409) as a field error', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm onSwitchToLogin={() => {}} />);
    await user.clear(screen.getByLabelText(/^username$/i));
    await user.type(screen.getByLabelText(/^username$/i), 'taken');
    await user.type(screen.getByLabelText(/^email$/i), 'a@b.com');
    await user.type(screen.getByLabelText(/^password$/i), 'longenough');
    await user.type(screen.getByLabelText(/confirm password/i), 'longenough');
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: /create account/i }));
    expect(await screen.findByText(/username is taken/i)).toBeInTheDocument();
  });

  it('creates an account on valid input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SignupForm onSwitchToLogin={() => {}} />);
    await fillValid(user);
    await user.click(screen.getByRole('button', { name: /create account/i }));
    await waitFor(() => expect(useAuthStore.getState().isAuthenticated).toBe(true));
  });
});
