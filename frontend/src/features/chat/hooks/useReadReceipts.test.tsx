// src/features/chat/hooks/useReadReceipts.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useReadReceipts } from './useReadReceipts';
import type { Message } from '@/types/entities';

// Use vi.hoisted so the mock object is available before vi.mock hoisting
const mockSocket = vi.hoisted(() => ({
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  connected: false,
}));

vi.mock('@/hooks/useSocket', () => ({ socket: mockSocket }));
vi.mock('@/features/chat/api', () => ({
  markConversationRead: vi.fn().mockResolvedValue(undefined),
  fetchMessages: vi.fn(),
  sendMessage: vi.fn(),
  deleteMessage: vi.fn(),
  getConversation: vi.fn(),
  fetchConversations: vi.fn(),
  openDm: vi.fn(),
}));

const CONV_ID = 'conv-1';

const makeMessage = (
  id: string,
  own: boolean,
  deleted = false,
): Message => ({
  id,
  authorId: own ? 'me' : 'other',
  authorName: own ? 'Alice' : 'Aria',
  body: 'Hello',
  sentAt: '10:00',
  own,
  deleted,
  status: own ? 'sent' : undefined,
});

describe('useReadReceipts', () => {
  it('emits message:read for the last non-own non-deleted message', () => {
    mockSocket.emit.mockClear();
    const messages: Message[] = [
      makeMessage('m1', false),
      makeMessage('m2', true),
      makeMessage('m3', false),
    ];

    renderHook(() => useReadReceipts(CONV_ID, messages));

    expect(mockSocket.emit).toHaveBeenCalledWith('message:read', {
      conversationId: CONV_ID,
      lastReadMessageId: 'm3',
    });
  });

  it('does not emit if all messages are own', () => {
    mockSocket.emit.mockClear();
    const messages: Message[] = [makeMessage('m1', true), makeMessage('m2', true)];
    renderHook(() => useReadReceipts(CONV_ID, messages));
    expect(mockSocket.emit).not.toHaveBeenCalled();
  });

  it('skips deleted messages when finding last readable', () => {
    mockSocket.emit.mockClear();
    const messages: Message[] = [
      makeMessage('m1', false),
      makeMessage('m2', false, true), // deleted
    ];

    renderHook(() => useReadReceipts(CONV_ID, messages));

    expect(mockSocket.emit).toHaveBeenCalledWith('message:read', {
      conversationId: CONV_ID,
      lastReadMessageId: 'm1',
    });
  });
});
