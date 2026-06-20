// src/router/ProtectedRoute.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import { mockUser } from '@/mocks/handlers';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route element={<ProtectedRoute />}>
          <Route path="/c" element={<div>protected content</div>} />
        </Route>
        <Route path="/login" element={<div>login screen</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => useAuthStore.getState().clear());

  it('redirects unauthenticated users to /login', () => {
    renderAt('/c');
    expect(screen.getByText(/login screen/i)).toBeInTheDocument();
  });

  it('renders the outlet when authenticated', () => {
    useAuthStore.getState().setUser(mockUser, 'tok');
    renderAt('/c');
    expect(screen.getByText(/protected content/i)).toBeInTheDocument();
  });
});
