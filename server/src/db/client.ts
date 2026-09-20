import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { parseEnv } from '../env.js';
import * as schema from './schema.js';

export type Database = PostgresJsDatabase<typeof schema>;

let database: Database | undefined;

export function getDatabase(): Database {
  if (!database) {
    const env = parseEnv();
    const client = postgres(env.DATABASE_URL, {
      max: env.NODE_ENV === 'test' ? 1 : 10,
      prepare: false,
    });
    database = drizzle(client, { schema });
  }

  return database;
}
