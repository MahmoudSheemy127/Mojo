// src/common/dto/pagination.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/** Shared keyset-pagination query params (docs/api/README.md §Pagination). */
export const PaginationSchema = z.object({
  cursor: z.string().optional(),
  // `limit` arrives as a query string; coerce, clamp to [1, 100], default 30.
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export type PaginationQuery = z.infer<typeof PaginationSchema>;

export class PaginationDto extends createZodDto(PaginationSchema) {}
