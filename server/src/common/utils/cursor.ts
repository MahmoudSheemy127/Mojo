// src/common/utils/cursor.ts
// Opaque keyset-pagination cursors. We encode the ordering key(s) of the last row
// of a page as base64url JSON so the client can ask for "everything after this row"
// without exposing offsets. Decoding is defensive: a malformed cursor yields null
// and the caller treats it as "start from the beginning" rather than throwing.

/** Encode an arbitrary ordering key into an opaque cursor string. */
export function encodeCursor<T extends object>(key: T): string {
  return Buffer.from(JSON.stringify(key), 'utf8').toString('base64url');
}

/** Decode an opaque cursor back into its ordering key, or null if malformed/absent. */
export function decodeCursor<T>(cursor: string | undefined | null): T | null {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as T;
  } catch {
    return null;
  }
}
