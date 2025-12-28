import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, 'BOT_TOKEN is required'),
  ADMIN_IDS: z.string().transform((val) =>
    val.split(',').map((id) => parseInt(id.trim(), 10)).filter((id) => !isNaN(id))
  ),
  DATA_DIR: z.string().default('./data'),
  WHITELIST_MODE: z.enum(['allow', 'deny']).default('allow'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.format());
  process.exit(1);
}

export const env = parsed.data;
