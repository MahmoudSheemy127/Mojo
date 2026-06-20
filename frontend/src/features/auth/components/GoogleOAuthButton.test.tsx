// src/features/auth/components/GoogleOAuthButton.test.tsx
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GoogleOAuthButton } from './GoogleOAuthButton';

describe('GoogleOAuthButton', () => {
  const originalLocation = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it('redirects to the Google OAuth start URL on click', async () => {
    const user = userEvent.setup();
    render(<GoogleOAuthButton />);
    await user.click(screen.getByRole('button', { name: /continue with google/i }));
    expect(window.location.href).toBe('http://localhost:4000/api/auth/google');
  });
});
