// src/components/shared/ConnectionStatusBanner.tsx
import { cn } from '@/utils/cn';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

interface ConnectionStatusBannerProps {
  status?: ConnectionStatus | undefined;
  className?: string | undefined;
}

/**
 * Slim banner shown across the top of the middle region when the realtime
 * connection drops. Renders nothing while connected. Status is a prop for now;
 * it will read socketStore once the realtime layer is wired.
 */
export function ConnectionStatusBanner({
  status = 'connected',
  className,
}: ConnectionStatusBannerProps) {
  if (status === 'connected') return null;

  return (
    <div
      role="status"
      className={cn(
        'w-full bg-idle/20 px-4 py-1.5 text-center text-xs font-medium text-idle',
        className,
      )}
    >
      {status === 'reconnecting'
        ? 'Reconnecting…'
        : 'Disconnected — history is read-only.'}
    </div>
  );
}
