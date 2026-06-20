// src/modules/users/dto/search-users.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

/**
 * GET /users/search (FR-05). `q` is a required partial username (min 1 char);
 * `cursor`/`limit` are the shared keyset-pagination params (users.openapi.yaml).
 */
export const SearchUsersSchema = z.object({
  q: z.string().min(1),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export class SearchUsersDto extends createZodDto(SearchUsersSchema) {}
