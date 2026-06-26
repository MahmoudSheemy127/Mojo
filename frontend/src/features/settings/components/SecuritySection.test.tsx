// src/features/settings/components/SecuritySection.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SecuritySection } from './SecuritySection';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from '@/mocks/handlers';

describe('SecuritySection', () => {
  beforeEach(() => useAuthStore.getState().setUser(mockUser, 'tok'));

  it('shows the reset target email', () => {
    renderWithProviders(<SecuritySection />);
    expect(screen.getByText(/alice@example.com/)).toBeInTheDocument();
  });

  it('sends the reset email and shows a confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SecuritySection />);
    await user.click(
      screen.getByRole('button', { name: /send password reset email/i }),
    );
    expect(await screen.findByText(/check your inbox/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /email sent/i })).toBeDisabled();
  });
});
