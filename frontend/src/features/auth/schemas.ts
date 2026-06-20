// src/features/auth/schemas.ts
import { z } from 'zod';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;

// Mirrors docs/contract/auth.openapi.yaml constraints exactly.
export const loginSchema = z.object({
  identifier: z.string().min(1, 'Enter your username or email'),
  password: z.string().min(1, 'Enter your password'),
});

export const signupSchema = z
  .object({
    username: z
      .string()
      .min(3, 'Username must be at least 3 characters')
      .max(32, 'Username must be at most 32 characters')
      .regex(USERNAME_RE, 'Use only letters, numbers, and underscores'),
    email: z.string().email('Enter a valid email'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    acceptedTerms: z.literal(true, {
      message: 'You must accept the Terms to continue',
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type SignupFormValues = z.infer<typeof signupSchema>;
