import 'dotenv/config';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import { parseEnv } from '../env.js';

const env = parseEnv();
const client = postgres(env.DATABASE_URL, { max: 1, prepare: false });

try {
  await migrate(drizzle(client), { migrationsFolder: './drizzle/migrations' });
  console.log('Database migrations applied');
} finally {
  await client.end();
}
