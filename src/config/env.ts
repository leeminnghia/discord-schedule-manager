import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_GUILD_ID: z.string().optional(),
  OWNER_USER_ID: z.string().optional(),
  DATABASE_URL: z.string().default('file:./dev.db'),
  DEFAULT_TIMEZONE: z.string().default('Asia/Ho_Chi_Minh'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  DEFAULT_BUFFER_MINUTES: z.coerce.number().default(10),
  MISSED_REMINDER_THRESHOLD_MINUTES: z.coerce.number().default(15),
});

export type EnvConfig = z.infer<typeof envSchema>;

let envConfig: EnvConfig;

try {
  envConfig = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    const missing = error.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join(', ');
    console.error(`❌ [Config Error] Invalid environment variables: ${missing}`);
    if (process.env.NODE_ENV === 'test') {
      envConfig = {
        DISCORD_TOKEN: 'dummy_token_for_test',
        DISCORD_CLIENT_ID: 'dummy_client_id_for_test',
        DISCORD_GUILD_ID: 'dummy_guild_id_for_test',
        OWNER_USER_ID: 'dummy_owner_id_for_test',
        DATABASE_URL: 'file:./test.db',
        DEFAULT_TIMEZONE: 'Asia/Ho_Chi_Minh',
        NODE_ENV: 'test',
        PORT: 3000,
        LOG_LEVEL: 'error',
        DEFAULT_BUFFER_MINUTES: 10,
        MISSED_REMINDER_THRESHOLD_MINUTES: 15,
      };
    } else {
      process.exit(1);
    }
  } else {
    throw error;
  }
}

export const env = envConfig;
