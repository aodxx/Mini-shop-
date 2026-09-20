import { eq } from 'drizzle-orm';
import type { Database } from '../db/client.js';
import { users, type User } from '../db/schema.js';

export type UserRole = User['role'];

export type LineUserInput = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
};

export type AuthenticatedUser = {
  id: string;
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: UserRole;
};

export interface UserRepository {
  upsertFromLine(input: LineUserInput): Promise<AuthenticatedUser>;
  findByLineUserId(lineUserId: string): Promise<AuthenticatedUser | null>;
}

function toAuthenticatedUser(user: User): AuthenticatedUser {
  if (!user.lineUserId) throw new Error('Persisted user is missing line_user_id');

  return {
    id: user.id,
    lineUserId: user.lineUserId,
    displayName: user.displayName,
    ...(user.pictureUrl ? { pictureUrl: user.pictureUrl } : {}),
    role: user.role,
  };
}

export function createUserRepository(db: Database): UserRepository {
  return {
    async upsertFromLine(input) {
      const [user] = await db
        .insert(users)
        .values({
          lineUserId: input.lineUserId,
          displayName: input.displayName,
          ...(input.pictureUrl ? { pictureUrl: input.pictureUrl } : {}),
        })
        .onConflictDoUpdate({
          target: users.lineUserId,
          set: {
            displayName: input.displayName,
            pictureUrl: input.pictureUrl ?? null,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (!user) throw new Error('Unable to persist user');
      return toAuthenticatedUser(user);
    },

    async findByLineUserId(lineUserId) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.lineUserId, lineUserId))
        .limit(1);

      return user ? toAuthenticatedUser(user) : null;
    },
  };
}
