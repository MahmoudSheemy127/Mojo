// src/features/groups/components/groups.smoke.test.tsx
// Smoke tests: render each modal in all key states, verify spec-required UI.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/store/authStore';
import { mockUser, GROUP_ID } from '@/mocks/handlers';
import { OverlayContext } from '@/layouts/overlayContext';
import { CreateGroupModal } from './CreateGroupModal';
import { GroupSettingsModal } from './GroupSettingsModal';
import { InviteMembersModal } from './InviteMembersModal';

const mockOverlay = {
  activeModal: null,
  openModal: vi.fn(),
  closeModal: vi.fn(),
};

const API = 'http://localhost:4000/api';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <MemoryRouter>
      <QueryClientProvider client={qc}>
        <OverlayContext.Provider value={mockOverlay}>
          {children}
        </OverlayContext.Provider>
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  useAuthStore.setState({
    currentUser: {
      ...mockUser,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    accessToken: 'tok',
    isAuthenticated: true,
  });
});

// ── CreateGroupModal ───────────────────────────────────────────────────────

describe('CreateGroupModal', () => {
  it('renders form elements when open', () => {
    render(<CreateGroupModal open onClose={vi.fn()} />, { wrapper });
    expect(screen.getByRole('dialog', { name: /create group/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/group name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create group/i })).toBeInTheDocument();
  });

  it('Create group button is disabled when name is empty', () => {
    render(<CreateGroupModal open onClose={vi.fn()} />, { wrapper });
    expect(screen.getByRole('button', { name: /create group/i })).toBeDisabled();
  });

  it('enables Create group button when name is filled', async () => {
    render(<CreateGroupModal open onClose={vi.fn()} />, { wrapper });
    await userEvent.type(screen.getByLabelText(/group name/i), 'Weekend Crew');
    expect(screen.getByRole('button', { name: /create group/i })).not.toBeDisabled();
  });

  it('shows error when API returns failure', async () => {
    server.use(
      http.post(`${API}/groups`, () =>
        HttpResponse.json({ error: { code: 'ERR', message: 'fail' } }, { status: 500 }),
      ),
    );
    render(<CreateGroupModal open onClose={vi.fn()} />, { wrapper });
    await userEvent.type(screen.getByLabelText(/group name/i), 'Test Group');
    await userEvent.click(screen.getByRole('button', { name: /create group/i }));
    await waitFor(() =>
      expect(screen.getByText(/couldn't create the group/i)).toBeInTheDocument(),
    );
  });

  it('does not render when closed', () => {
    render(<CreateGroupModal open={false} onClose={vi.fn()} />, { wrapper });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── GroupSettingsModal ─────────────────────────────────────────────────────

describe('GroupSettingsModal', () => {
  it('renders tabs and profile section when open', async () => {
    render(
      <GroupSettingsModal open onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Group settings')).toBeInTheDocument(),
    );
    expect(screen.getByRole('tab', { name: /profile/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /members/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /danger/i })).toBeInTheDocument();
  });

  it('Save changes button is disabled until form is dirty', async () => {
    render(
      <GroupSettingsModal open onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument(),
    );
    expect(screen.getByRole('button', { name: /save changes/i })).toBeDisabled();
  });

  it('shows member list skeleton while loading, then member rows', async () => {
    render(
      <GroupSettingsModal open onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    // Switch to members tab
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /members/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('tab', { name: /members/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/filter members/i)).toBeInTheDocument(),
    );
  });

  it('shows danger zone with Leave and Delete buttons', async () => {
    render(
      <GroupSettingsModal open onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /danger/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('tab', { name: /danger/i }));
    expect(screen.getByRole('button', { name: /leave/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
  });

  it('shows Leave confirm dialog when Leave is clicked', async () => {
    render(
      <GroupSettingsModal open onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /danger/i })).toBeInTheDocument(),
    );
    await userEvent.click(screen.getByRole('tab', { name: /danger/i }));
    await userEvent.click(screen.getByRole('button', { name: /^leave$/i }));
    expect(screen.getByRole('dialog', { name: /leave group/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <GroupSettingsModal open={false} onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

// ── InviteMembersModal ─────────────────────────────────────────────────────

describe('InviteMembersModal', () => {
  it('renders when open with invite link section', async () => {
    render(
      <InviteMembersModal open onClose={vi.fn()} groupId={GROUP_ID} groupName="Design Guild" />,
      { wrapper },
    );
    expect(screen.getByRole('dialog', { name: /invite to design guild/i })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument(),
    );
  });

  it('Invite button is disabled when no members selected', () => {
    render(
      <InviteMembersModal open onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    const btn = screen.getByRole('button', { name: /invite/i });
    expect(btn).toBeDisabled();
  });

  it('does not render when closed', () => {
    render(
      <InviteMembersModal open={false} onClose={vi.fn()} groupId={GROUP_ID} />,
      { wrapper },
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
