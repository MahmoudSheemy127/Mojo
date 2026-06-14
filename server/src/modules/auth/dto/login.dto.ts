// src/modules/auth/dto/login.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const LoginSchema = z.object({
  identifier: z.string().min(1), // username OR email
  password: z.string().min(1),
});

export class LoginDto extends createZodDto(LoginSchema) {}
