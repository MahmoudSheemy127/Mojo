// src/common/utils/ulid.ts
// ULID helpers. Message.id is a ULID assigned in the app layer (prisma-schema-design.md
// note 3): lexicographically sortable, so it doubles as the keyset/reconnect cursor and
// removes the need for a separate sequence column.
import { decodeTime, ulid } from 'ulid';

/** Generate a fresh ULID — monotonic and lexicographically sortable. Used as Message.id. */
export function newUlid(): string {
  return ulid();
}

/**
 * Derive the contract's numeric `Message.sequence` from a ULID. The 48-bit millisecond
 * timestamp embedded in the ULID is monotonic with creation order, so it provides the
 * ordering value the API contract exposes while the canonical ordering key stays the id.
 */
export function ulidToSequence(id: string): number {
  return decodeTime(id);
}
