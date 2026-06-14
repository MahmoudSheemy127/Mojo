// src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Opt a route out of the global JwtAuthGuard (login, signup, refresh, health, …). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
