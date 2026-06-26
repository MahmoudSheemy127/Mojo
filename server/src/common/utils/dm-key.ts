// src/common/utils/dm-key.ts
// Canonical DM key: a sorted "<userA>:<userB>" string identifying the single DM between
// a pair of users regardless of who opened it. Stored in Conversation.dmKey (@unique) to
// enforce "one DM per pair" at the database layer (prisma-schema-design.md note 4). It is
// null for group conversations.

/** Build the canonical, order-independent DM key for two user ids. */
export function canonicalDmKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}
