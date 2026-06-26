// src/components/shared/ToastViewport.test.tsx
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastViewport } from './ToastViewport';
import { useToastStore } from '@/hooks/useToast';

describe('ToastViewport', () => {
  beforeEach(() => useToastStore.getState().clear());
  afterEach(() => vi.useRealTimers());

  it('renders nothing when there are no toasts', () => {
    const { container } = render(<ToastViewport />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders queued toasts', () => {
    render(<ToastViewport />);
    act(() => void useToastStore.getState().push('Profile updated', 'success'));
    expect(screen.getByText('Profile updated')).toBeInTheDocument();
  });

  it('dismisses a toast on click', async () => {
    const user = userEvent.setup();
    render(<ToastViewport />);
    act(() => void useToastStore.getState().push('Bye', 'info'));
    await user.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(screen.queryByText('Bye')).not.toBeInTheDocument();
  });

  it('auto-dismisses after the timeout', () => {
    vi.useFakeTimers();
    render(<ToastViewport />);
    act(() => void useToastStore.getState().push('Temp', 'info'));
    expect(screen.getByText('Temp')).toBeInTheDocument();
    void act(() => vi.advanceTimersByTime(4000));
    expect(screen.queryByText('Temp')).not.toBeInTheDocument();
  });
});
