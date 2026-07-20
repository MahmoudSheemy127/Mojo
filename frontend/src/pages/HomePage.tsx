// src/pages/HomePage.tsx
import { useParams } from 'react-router-dom';
import { ChatWindow } from '@/features/chat';
import { Button } from '@/components/ui/Button';
import { useOverlay } from '@/layouts/overlayContext';

/** Middle region: a conversation when one is selected, else the empty state. */
export default function HomePage() {
  const { conversationId } = useParams();


  if (conversationId) {
    console.log('Rendering ChatWindoww for conversationId:', conversationId);
    return <ChatWindow conversationId={conversationId} />;
  }

  return <HomeEmptyState />;
}

function HomeEmptyState() {
  const { openModal } = useOverlay();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-bg-chat px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-avatar bg-bg-active text-3xl">
        💬
      </div>
      <p className="max-w-sm text-sm text-text-muted">
        Select a conversation or find friends to start chatting.
      </p>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => openModal('find-friends')}>
          Find friends
        </Button>
        <Button variant="secondary" onClick={() => openModal('create-group')}>
          Create group
        </Button>
      </div>
    </div>
  );
}
