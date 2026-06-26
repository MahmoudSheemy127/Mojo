// src/store/uiStore.ts
import { create } from 'zustand';

interface UiStore {
  activeConversationId: string | null;
  setActiveConversation: (id: string | null) => void;
  sidebarTab: 'chats' | 'friends';
  setSidebarTab: (tab: 'chats' | 'friends') => void;
}

export const useUiStore = create<UiStore>((set) => ({
  activeConversationId: null,
  setActiveConversation: (id) => set({ activeConversationId: id }),
  sidebarTab: 'chats',
  setSidebarTab: (tab) => set({ sidebarTab: tab }),
}));
