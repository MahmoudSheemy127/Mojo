// src/config/configuration.ts
// Typed config factory consumed via ConfigService. Values are already validated
// by env.validation.ts before this runs, so the non-null assertions are safe.

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  webOrigin: string;
  cookie: {
    domain: string;
  };
  jwt: {
    accessSecret: string;
    accessTtl: number; // seconds
    refreshSecret: string;
    refreshTtl: number; // seconds
  };
  google: {
    clientId: string;
    clientSecret: string;
    callbackUrl: string;
  };
}

export const configuration = (): AppConfig => ({
  nodeEnv: (process.env.NODE_ENV as AppConfig['nodeEnv']) ?? 'development',
  port: parseInt(process.env.PORT ?? '4000', 10),
  webOrigin: process.env.WEB_ORIGIN as string,
  cookie: {
    domain: process.env.COOKIE_DOMAIN as string,
  },
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET as string,
    accessTtl: parseInt(process.env.JWT_ACCESS_TTL ?? '900', 10),
    refreshSecret: process.env.JWT_REFRESH_SECRET as string,
    refreshTtl: parseInt(process.env.JWT_REFRESH_TTL ?? '2592000', 10),
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? '',
  },
});
