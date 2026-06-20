// src/pages/LoginPage.test.tsx
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import LoginPage from './LoginPage';
import { renderWithProviders } from '@/test/render';

describe('LoginPage', () => {
  it('defaults to the login tab on /login', () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    expect(screen.getByRole('tab', { name: /log in/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
  });

  it('opens the signup tab on /signup', () => {
    renderWithProviders(<LoginPage />, { route: '/signup' });
    expect(screen.getByRole('tab', { name: /sign up/i })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('switches from login to signup via the tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, { route: '/login' });
    await user.click(screen.getByRole('tab', { name: /sign up/i }));
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('shows the OAuth-failed banner from the query string', () => {
    renderWithProviders(<LoginPage />, { route: '/login?error=oauth_failed' });
    expect(screen.getByText(/google sign-in didn't complete/i)).toBeInTheDocument();
  });

  it('renders the Google button and an "or" divider', () => {
    renderWithProviders(<LoginPage />, { route: '/login' });
    expect(
      screen.getByRole('button', { name: /continue with google/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/^or$/i)).toBeInTheDocument();
  });
});
