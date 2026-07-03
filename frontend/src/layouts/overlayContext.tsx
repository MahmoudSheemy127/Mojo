// src/layouts/overlayContext.tsx
//
// Local, presentational coordination for the homepage overlay layer: which
// modal is open (one at a time). This is intentionally component-local React
// context, NOT a Zustand store — it will be replaced by uiStore when the state
// layer lands.

import { createContext, useContext } from 'react';

export type ModalType =
  | 'find-friends'
  | 'create-group'
  | 'invite-members'
  | 'group-settings';

export interface OverlayContextValue {
  activeModal: ModalType | null;
  /** Pass optional groupId when opening group-scoped modals. */
  openModal: (type: ModalType, groupId?: string) => void;
  closeModal: () => void;
}

export const OverlayContext = createContext<OverlayContextValue | null>(null);

/** Access the homepage overlay controller. Must be used under AppLayout. */
export function useOverlay(): OverlayContextValue {
  const ctx = useContext(OverlayContext);
  if (!ctx) {
    throw new Error('useOverlay must be used within AppLayout');
  }
  return ctx;
}
