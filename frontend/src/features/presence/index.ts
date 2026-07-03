// src/features/presence/index.ts
// Public surface of the presence feature.
export { PresenceSelector } from './components/PresenceSelector';
export { useUpdatePresence } from './hooks/useUpdatePresence';
export { usePresenceFeed } from './hooks/usePresenceFeed';
export { usePresence } from './hooks/usePresence';
export { toUiPresence, toSettableStatus } from './presence';
