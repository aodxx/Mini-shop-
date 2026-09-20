import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parseEnv } from '../env.js';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

let database: Database | undefined;
let client: ReturnType<typeof postgres> | undefined;

export function getDatabase(): Database {
  if (!database) {
    const env = parseEnv();
    client = postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === 'test' ? 1 : 10,
      prepare: false,
    });
    database = drizzle(client, { schema });
  }

  return database;
}

export async function closeDatabase(): Promise<void> {
  if (client) {
    await client.end();
    client = undefined;
    database = undefined;
  }
}
