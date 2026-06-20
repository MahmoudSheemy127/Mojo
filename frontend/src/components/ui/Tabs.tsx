// src/components/ui/Tabs.tsx
import { cn } from '@/utils/cn';

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  items: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  'aria-label'?: string;
}

/** Controlled tab switcher with minimal styling. */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  'aria-label': ariaLabel,
}: TabsProps<T>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex gap-1 rounded-card bg-bg-deepest p-1"
    >
      {items.map((item) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={selected}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex-1 rounded-card px-3 py-1.5 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              selected
                ? 'bg-bg-active text-text-normal'
                : 'text-text-muted hover:text-text-normal',
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
