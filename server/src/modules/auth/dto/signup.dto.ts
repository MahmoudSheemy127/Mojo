// src/modules/auth/dto/signup.dto.ts
import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const SignupSchema = z.object({
  username: z
    .string()
    .min(3)
    .max(32)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores'),
  email: z.email(),
  password: z.string().min(8),
  acceptedTerms: z.literal(true),
});

export class SignupDto extends createZodDto(SignupSchema) {}
