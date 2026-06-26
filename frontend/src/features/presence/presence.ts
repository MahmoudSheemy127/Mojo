// src/features/presence/presence.ts
// Maps between the contract's presence enum (online | away | dnd | offline) and
// the UI presence vocabulary used by PresenceDot/PresenceSelector, which spells
// "away" as "idle". Centralised so the boundary conversion lives in one place.
import type { Presence as ApiPresence, SettablePresence } from '@/types/api';
import type { Presence as UiPresence } from '@/types/entities';

export function toUiPresence(presence: ApiPresence): UiPresence {
  return presence === 'away' ? 'idle' : presence;
}

/**
 * Converts a UI presence choice to the settable contract status. Returns `null`
 * for 'offline' (Invisible), which the contract sets only on socket disconnect
 * and rejects on PATCH /users/me/presence.
 */
export function toSettableStatus(presence: UiPresence): SettablePresence | null {
  switch (presence) {
    case 'idle':
      return 'away';
    case 'online':
      return 'online';
    case 'dnd':
      return 'dnd';
    case 'offline':
      return null;
  }
}
