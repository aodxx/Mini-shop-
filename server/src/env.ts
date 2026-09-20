import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgresql://')),
  SESSION_SECRET: z.string().min(32),
  CLIENT_ORIGIN: z.string().url(),
  LINE_CHANNEL_ID: z.string().min(1),
  LINE_PAY_ENV: z.enum(['sandbox', 'production']).optional(),
  LINE_PAY_CHANNEL_ID: z.string().optional(),
  LINE_PAY_CHANNEL_SECRET: z.string().optional(),
  LINE_PAY_MERCHANT_DEVICE_PROFILE_ID: z.string().optional(),
  PAYMENT_CALLBACK_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function parseEnv(input: NodeJS.ProcessEnv = process.env): AppEnv {
  return envSchema.parse(input);
}
