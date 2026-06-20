// src/features/auth/errors.ts
import { AxiosError } from 'axios';
import type { ApiError } from '@/types/api';

export interface AuthErrorInfo {
  /** Banner-level message (auth failure, rate limit, generic). */
  banner?: string;
  /** Field-level errors keyed by form field (e.g. username taken). */
  fields?: Partial<Record<string, string>>;
}

function getApiError(error: unknown): ApiError['error'] | undefined {
  if (error instanceof AxiosError) {
    const data = error.response?.data as ApiError | undefined;
    return data?.error;
  }
  return undefined;
}

function status(error: unknown): number | undefined {
  return error instanceof AxiosError ? error.response?.status : undefined;
}

/** Maps a login failure to banner text (never reveals which field was wrong). */
export function parseLoginError(error: unknown): AuthErrorInfo {
  switch (status(error)) {
    case 401:
      return { banner: 'Incorrect username or password.' };
    case 429:
      return { banner: 'Too many attempts. Please try again later.' };
    default:
      return { banner: 'Something went wrong. Please try again.' };
  }
}

/** Maps a signup failure to field errors (taken username/email) or a banner. */
export function parseSignupError(error: unknown): AuthErrorInfo {
  if (status(error) === 409) {
    const code = getApiError(error)?.code;
    if (code === 'USERNAME_TAKEN') {
      return { fields: { username: 'Username is taken' } };
    }
    if (code === 'EMAIL_TAKEN') {
      return { fields: { email: 'Email is already registered' } };
    }
    return { banner: 'That account already exists.' };
  }
  if (status(error) === 429) {
    return { banner: 'Too many attempts. Please try again later.' };
  }
  return { banner: 'Something went wrong. Please try again.' };
}
