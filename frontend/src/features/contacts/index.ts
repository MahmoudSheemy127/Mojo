// src/features/contacts/index.ts
// Public surface of the contacts feature.
export { ChatList } from './components/ChatList';
export { FindFriendsModal } from './components/FindFriendsModal';
export { useContacts, friendsKey } from './hooks/useContacts';
export { useUserSearch } from './hooks/useUserSearch';
export { useSendFriendRequest, useAcceptFriendRequest, useDeclineFriendRequest } from './hooks/useFriendRequest';
export { useRemoveFriend } from './hooks/useRemoveFriend';
export { useBlockUser } from './hooks/useBlockUser';
export { conversationsKey, useConversations, useOpenDm } from './hooks/useConversations';
