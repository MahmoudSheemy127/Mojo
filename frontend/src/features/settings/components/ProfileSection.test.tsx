// src/features/settings/components/ProfileSection.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProfileSection } from './ProfileSection';
import { renderWithProviders } from '@/test/render';
import { useAuthStore } from '@/store/authStore';
import { useToastStore } from '@/hooks/useToast';
import { mockUser } from '@/mocks/handlers';
import { server } from '@/mocks/server';

const API = 'http://localhost:4000/api';

function seedUser(overrides = {}) {
  useAuthStore.getState().setUser({ ...mockUser, ...overrides }, 'tok');
}

describe('ProfileSection', () => {
  beforeEach(() => {
    useToastStore.getState().clear();
    seedUser();
  });

  it('seeds fields from the current profile', () => {
    renderWithProviders(<ProfileSection />);
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Alice');
    expect(screen.getByLabelText(/username/i)).toHaveValue('@alice');
  });

  it('disables Save until a field changes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);
    const save = screen.getByRole('button', { name: /save changes/i });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText(/display name/i), '!');
    expect(save).toBeEnabled();
    expect(screen.getByText(/unsaved changes/i)).toBeInTheDocument();
  });

  it('shows a validation error for an over-long bio', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);
    fireEvent.change(screen.getByLabelText(/bio/i), {
      target: { value: 'x'.repeat(191) },
    });
    await user.click(screen.getByRole('button', { name: /save changes/i }));
    expect(await screen.findByText(/at most 190 characters/i)).toBeInTheDocument();
  });

  it('saves a valid profile change and toasts success', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);
    const name = screen.getByLabelText(/display name/i);
    await user.clear(name);
    await user.type(name, 'Alice B');
    await user.click(screen.getByRole('button', { name: /save changes/i }));

    await waitFor(() =>
      expect(
        useToastStore.getState().toasts.some((t) => t.variant === 'success'),
      ).toBe(true),
    );
  });

  it('rejects an invalid avatar file type', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);
    const input = screen.getByLabelText(/upload avatar/i);
    await user.upload(
      input,
      new File(['x'], 'doc.pdf', { type: 'application/pdf' }),
    );
    expect(await screen.findByText(/PNG, JPEG/i)).toBeInTheDocument();
  });

  it('uploads a valid avatar file', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);
    const input = screen.getByLabelText(/upload avatar/i);
    await user.upload(input, new File(['x'], 'a.png', { type: 'image/png' }));
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((t) => /avatar updated/i.test(t.message)),
      ).toBe(true),
    );
  });

  it('removes the avatar when one is set', async () => {
    const withAvatar = { ...mockUser, avatarUrl: 'https://cdn.example.com/me.png' };
    server.use(http.get(`${API}/users/me`, () => HttpResponse.json(withAvatar)));
    seedUser({ avatarUrl: withAvatar.avatarUrl });
    const user = userEvent.setup();
    renderWithProviders(<ProfileSection />);
    await user.click(screen.getByRole('button', { name: /^remove$/i }));
    await waitFor(() =>
      expect(
        useToastStore
          .getState()
          .toasts.some((t) => /avatar removed/i.test(t.message)),
      ).toBe(true),
    );
  });
});
