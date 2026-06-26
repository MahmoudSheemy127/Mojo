// src/features/contacts/components/FindFriendsModal.tsx
import { useEffect, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { ModalHeader } from '@/components/ui/ModalHeader';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { Button } from '@/components/ui/Button';
import { useUserSearch } from '../hooks/useUserSearch';
import { useSendFriendRequest } from '../hooks/useFriendRequest';
import { UserSearchResultRow } from './UserSearchResultRow';

interface FindFriendsModalProps {
  open: boolean;
  onClose: () => void;
}

/** Global user-search modal (FR-05). Searches all users by username. */
export function FindFriendsModal({ open, onClose }: FindFriendsModalProps) {
  const [inputValue, setInputValue] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce: wait 300ms after the user stops typing before firing the query.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedQuery(inputValue.trim()), 300);
    return () => clearTimeout(id);
  }, [inputValue]);

  const { data: results, isLoading, isError, refetch } = useUserSearch(debouncedQuery);
  const sendRequest = useSendFriendRequest();

  // Track which user ids have had a request sent in this session.
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());

  const handleAdd = (userId: string) => {
    sendRequest.mutate(userId, {
      onSuccess: () => setSentIds((prev) => new Set(prev).add(userId)),
    });
  };

  // Reset state when the modal closes.
  useEffect(() => {
    if (!open) {
      setInputValue('');
      setDebouncedQuery('');
      setSentIds(new Set());
    }
  }, [open]);

  return (
    <Modal open={open} onClose={onClose} aria-label="Find friends">
      <ModalHeader title="Find friends" onClose={onClose} />
      <div className="flex flex-col gap-3 p-4">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Search by username…"
          aria-label="Search users"
          trailing={isLoading ? <Spinner className="text-text-muted" /> : undefined}
        />

        {debouncedQuery === '' ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Start typing to find people by username.
          </p>
        ) : isError ? (
          <div className="flex flex-col items-center gap-2 py-8">
            <p className="text-sm text-text-muted">Something went wrong.</p>
            <Button size="sm" variant="secondary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner label="Searching…" />
          </div>
        ) : !results || results.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            No users found for &ldquo;{debouncedQuery}&rdquo;.
          </p>
        ) : (
          <ul className="max-h-72 overflow-y-auto">
            {results.map((item) => {
              const optimisticRelationship = sentIds.has(item.user.id)
                ? ('request_sent' as const)
                : item.relationship;
              return (
                <UserSearchResultRow
                  key={item.user.id}
                  user={item.user}
                  relationship={optimisticRelationship}
                  isSending={
                    sendRequest.isPending &&
                    sendRequest.variables === item.user.id
                  }
                  onAdd={() => handleAdd(item.user.id)}
                />
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
