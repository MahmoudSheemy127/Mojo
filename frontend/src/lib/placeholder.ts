// src/lib/placeholder.ts
//
// TEMPORARY static fixtures for the UI skeleton so populated states are
// viewable without a data layer. Delete this module once TanStack Query +
// feature api.ts files are wired; components currently import from here.

import type {
  ConversationSummary,
  GroupMember,
  Message,
  Notification,
  User,
} from '@/types/entities';

export const currentUser: User = {
  id: 'me',
  username: 'mojo_dev',
  displayName: 'Mojo Dev',
  presence: 'online',
  bio: 'Building Mojo.',
};

export const friends: User[] = [
  { id: 'u1', username: 'aria', displayName: 'Aria Chen', presence: 'online' },
  { id: 'u2', username: 'ben', displayName: 'Ben Okafor', presence: 'idle' },
  { id: 'u3', username: 'cleo', displayName: 'Cleo Marsh', presence: 'dnd' },
  { id: 'u4', username: 'dev', displayName: 'Dev Patel', presence: 'offline' },
  { id: 'u5', username: 'esme', displayName: 'Esme Ford', presence: 'online' },
];

export const groups: ConversationSummary[] = [
  {
    id: 'g1',
    type: 'group',
    name: 'Design Guild',
    lastMessagePreview: 'Ben: shipping the new tokens',
    lastMessageAt: '10m',
    unreadCount: 3,
  },
  {
    id: 'g2',
    type: 'group',
    name: 'Weekend Crew',
    lastMessagePreview: 'You: see you Saturday',
    lastMessageAt: '2h',
  },
];

export const conversations: ConversationSummary[] = [
  {
    id: 'c-aria',
    type: 'dm',
    name: 'Aria Chen',
    presence: 'online',
    lastMessagePreview: 'typing…',
    lastMessageAt: 'now',
    unreadCount: 2,
    typing: true,
  },
  {
    id: 'c-ben',
    type: 'dm',
    name: 'Ben Okafor',
    presence: 'idle',
    lastMessagePreview: 'You: sounds good 👍',
    lastMessageAt: '5m',
  },
  ...groups,
  {
    id: 'c-cleo',
    type: 'dm',
    name: 'Cleo Marsh',
    presence: 'dnd',
    lastMessagePreview: 'Let me check and get back to you',
    lastMessageAt: '1d',
  },
];

export const messages: Message[] = [
  {
    id: 'm1',
    authorId: 'u1',
    authorName: 'Aria Chen',
    body: 'Hey! Did you get a chance to look at the mockups?',
    sentAt: '10:02',
    sentAtIso: '2026-06-19T10:02:00Z',
  },
  {
    id: 'm2',
    authorId: 'u1',
    authorName: 'Aria Chen',
    body: 'No rush — whenever you have a moment.',
    sentAt: '10:02',
    sentAtIso: '2026-06-19T10:02:30Z',
  },
  {
    id: 'm3',
    authorId: 'me',
    authorName: 'Mojo Dev',
    body: 'Just opened them, looking great so far!',
    sentAt: '10:05',
    sentAtIso: '2026-06-19T10:05:00Z',
    own: true,
    status: 'read',
  },
  {
    id: 'm4',
    authorId: 'me',
    authorName: 'Mojo Dev',
    body: 'This message was deleted',
    sentAt: '10:06',
    own: true,
    deleted: true,
  },
  {
    id: 'm5',
    authorId: 'me',
    authorName: 'Mojo Dev',
    body: 'Sending you a few notes now.',
    sentAt: '10:07',
    own: true,
    status: 'sending',
  },
];

export const groupMembers: GroupMember[] = [
  { id: 'gm0', user: currentUser, role: 'admin' },
  { id: 'gm1', user: friends[0]!, role: 'admin' },
  { id: 'gm2', user: friends[1]!, role: 'member' },
  { id: 'gm3', user: friends[2]!, role: 'member' },
];

export const notifications: Notification[] = [
  {
    id: 'n1',
    kind: 'friend-request',
    actor: friends[4]!,
    text: 'Esme Ford wants to add you',
    createdAt: '2m',
    unread: true,
  },
  {
    id: 'n2',
    kind: 'group-invite',
    actor: friends[0]!,
    text: 'Aria Chen invited you to Design Guild',
    createdAt: '1h',
    unread: true,
    groupName: 'Design Guild',
  },
  {
    id: 'n3',
    kind: 'join-request',
    actor: friends[1]!,
    text: 'Ben Okafor wants to join Weekend Crew',
    createdAt: '3h',
    groupName: 'Weekend Crew',
  },
  {
    id: 'n4',
    kind: 'generic',
    actor: friends[2]!,
    text: 'Cleo Marsh accepted your friend request',
    createdAt: '1d',
  },
];
