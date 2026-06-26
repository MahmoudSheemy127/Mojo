// src/hooks/useToast.ts
import { useMemo } from 'react';
import { create } from 'zustand';
import type { ToastVariant } from '@/components/ui/Toast';

export interface ToastItem {
  id: string;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, variant?: ToastVariant) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

let counter = 0;
const nextId = () => `toast-${(counter += 1)}`;

/** Global toast queue. The provider that renders it is `ToastViewport`. */
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (message, variant = 'info') => {
    const id = nextId();
    set((state) => ({ toasts: [...state.toasts, { id, message, variant }] }));
    return id;
  },
  dismiss: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  clear: () => set({ toasts: [] }),
}));

export interface ToastApi {
  toast: (message: string, variant?: ToastVariant) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  dismiss: (id: string) => void;
}

/** Trigger toast notifications from anywhere in the tree. */
export function useToast(): ToastApi {
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);

  return useMemo(
    () => ({
      toast: (message, variant) => void push(message, variant),
      success: (message) => void push(message, 'success'),
      error: (message) => void push(message, 'error'),
      info: (message) => void push(message, 'info'),
      dismiss,
    }),
    [push, dismiss],
  );
}
