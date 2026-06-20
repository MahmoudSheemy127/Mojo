import '@testing-library/jest-dom';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { server } from './mocks/server';
import { useAuthStore } from './store/authStore';

// MSW lifecycle — all REST calls are mocked at unit/component level (G3).
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  useAuthStore.getState().clear();
  if (typeof localStorage !== 'undefined') localStorage.clear();
});
afterAll(() => server.close());
