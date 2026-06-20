// src/features/presence/components/PresenceSelector.tsx
import { useState } from 'react';
import type { Presence } from '@/types/entities';
import { PresenceDot } from '@/components/shared/PresenceDot';
import { cn } from '@/utils/cn';

interface PresenceSelectorProps {
  value?: Presence | undefined;
  onChange?: ((presence: Presence) => void) | undefined;
}

const OPTIONS: { value: Presence; label: string }[] = [
  { value: 'online', label: 'Online' },
  { value: 'idle', label: 'Away' },
  { value: 'dnd', label: 'Do Not Disturb' },
  { value: 'offline', label: 'Invisible' },
];

/** Status picker for the profile popover. Selection is local until the presence
 *  mutation is wired. */
export function PresenceSelector({
  value = 'online',
  onChange,
}: PresenceSelectorProps) {
  const [selected, setSelected] = useState<Presence>(value);

  return (
    <ul role="listbox" aria-label="Set your status" className="flex flex-col">
      {OPTIONS.map((opt) => {
        const active = opt.value === selected;
        return (
          <li key={opt.value}>
            <button
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                setSelected(opt.value);
                onChange?.(opt.value);
              }}
              className={cn(
                'flex w-full items-center gap-2 rounded-card px-2 py-1.5 text-left text-sm transition-colors hover:bg-bg-hover',
                active ? 'text-text-normal' : 'text-text-muted',
              )}
            >
              <PresenceDot presence={opt.value} size="sm" />
              {opt.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
