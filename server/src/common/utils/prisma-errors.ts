// src/common/utils/prisma-errors.ts
import { Prisma } from '@prisma/client';

/**
 * Extract the column names involved in a unique-constraint violation (P2002).
 *
 * Prisma 7 with a driver adapter (we use `@prisma/adapter-pg`) reports the
 * columns under `meta.driverAdapterError.cause.constraint.fields` and no longer
 * populates the legacy `meta.target`. We read the new shape first, then fall
 * back to `meta.target` (array or string) so the helper works regardless of how
 * the error was produced (real DB vs. unit-test fixtures).
 */
export function uniqueConflictFields(e: Prisma.PrismaClientKnownRequestError): string[] {
  const meta = e.meta as
    | {
        target?: unknown;
        driverAdapterError?: { cause?: { constraint?: { fields?: unknown } } };
      }
    | undefined;

  const adapterFields = meta?.driverAdapterError?.cause?.constraint?.fields;
  if (Array.isArray(adapterFields)) return adapterFields.map(String);

  const target = meta?.target;
  if (Array.isArray(target)) return target.map(String);
  if (typeof target === 'string') return [target];

  return [];
}
