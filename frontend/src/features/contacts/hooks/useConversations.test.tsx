// src/features/contacts/hooks/useConversations.test.tsx
import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { renderWithProviders } from '@/test/render';
import { useConversations } from './useConversations';
import { server } from '@/mocks/server';
import { mockDmConversation, mockGroupConversation } from '@/mocks/handlers';

const API = 'http://localhost:4000/api';

function ConversationList() {
  const { data, isLoading, isError } = useConversations();
  if (isLoading) return <div>loading</div>;
  if (isError) return <div>error</div>;
  return (
    <ul>
      {(data ?? []).map((c) => (
        <li key={c.id}>{c.type === 'dm' ? c.otherUser.displayName : c.name}</li>
      ))}
    </ul>
  );
}

describe('useConversations', () => {
  it('returns the conversation list on success', async () => {
    renderWithProviders(<ConversationList />, { route: '/c' });
    expect(screen.getByText('loading')).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText(mockDmConversation.otherUser.displayName),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText(mockGroupConversation.name)).toBeInTheDocument();
  });

  it('exposes isError when the request fails', async () => {
    server.use(
      http.get(`${API}/conversations`, () =>
        HttpResponse.json(
          { error: { code: 'SERVER_ERROR', message: 'oops' } },
          { status: 500 },
        ),
      ),
    );
    renderWithProviders(<ConversationList />, { route: '/c' });
    await waitFor(() => expect(screen.getByText('error')).toBeInTheDocument());
  });
});
