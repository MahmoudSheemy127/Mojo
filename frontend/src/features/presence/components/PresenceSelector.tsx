// src/features/presence/components/PresenceSelector.tsx
import type { Presence } from '@/types/entities';
import { PresenceDot } from '@/components/shared/PresenceDot';
import { Spinner } from '@/components/ui/Spinner';
import { cn } from '@/utils/cn';

interface PresenceSelectorProps {
  /** Current status (UI vocabulary: online | idle | dnd | offline). */
  value?: Presence | undefined;
  /** Called with the chosen status. Controlled — the parent owns the value. */
  onSelect?: ((presence: Presence) => void) | undefined;
  /** The status currently being persisted; shows a brief pending spinner. */
  pendingValue?: Presence | undefined;
}

const OPTIONS: { value: Presence; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'idle', label: 'Away' },
  { value: 'dnd', label: 'Do Not Disturb' },
  { value: 'offline', label: 'Invisible' },
];

/**
 * Status picker for the profile popover (FR-10). Controlled: the active status
 * comes from `value`; selecting one calls `onSelect`. While a change is in
 * flight, the target option shows a pending spinner.
 */
export function PresenceSelector({
  value = 'online',
  onSelect,
  pendingValue,
}: PresenceSelectorProps) {
  return (
    <ul role="listbox" aria-label="Set your status" className="flex flex-col">
      {OPTIONS.map((opt) => {
        const active = opt.value === value;
        const pending = opt.value === pendingValue;
        return (
          <li key={opt.value}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              disabled={pending}
              onClick={() => onSelect?.(opt.value)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-card px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover',
                'disabled:cursor-default',
                active ? 'text-text-normal' : 'text-text-muted',
              )}
            >
              <span className="flex items-center gap-2">
                <PresenceDot presence={opt.value} size="sm" />
                {opt.label}
              </span>
              {pending && <Spinner className="h-3 w-3" label="Updating status" />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
