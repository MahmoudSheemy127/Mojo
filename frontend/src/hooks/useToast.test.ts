// src/hooks/useToast.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToast, useToastStore } from './useToast';

describe('useToast', () => {
  beforeEach(() => useToastStore.getState().clear());

  it('pushes toasts with the requested variant', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.success('Saved'));
    act(() => result.current.error('Boom'));

    const toasts = useToastStore.getState().toasts;
    expect(toasts).toHaveLength(2);
    expect(toasts[0]).toMatchObject({ message: 'Saved', variant: 'success' });
    expect(toasts[1]).toMatchObject({ message: 'Boom', variant: 'error' });
  });

  it('defaults to the info variant', () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.toast('Heads up'));
    expect(useToastStore.getState().toasts[0]?.variant).toBe('info');
  });

  it('dismisses a toast by id', () => {
    const id = useToastStore.getState().push('temp', 'info');
    expect(useToastStore.getState().toasts).toHaveLength(1);
    act(() => useToastStore.getState().dismiss(id));
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });
});
