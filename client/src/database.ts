export type DatabaseUser = {
  id: string;
  displayName: string;
  role: 'customer' | 'staff' | 'manager' | 'owner';
  createdAt: string;
};

export type DatabaseDiagnostics = {
  database: {
    status: 'connected';
    provider: 'postgresql';
    checkedAt: string;
  };
  users: DatabaseUser[];
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export async function loadDatabaseDiagnostics(): Promise<DatabaseDiagnostics> {
  const response = await fetch(`${apiUrl}/api/admin/database`, { credentials: 'include' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Database check failed with ${response.status}`);
  }
  return response.json() as Promise<DatabaseDiagnostics>;
}
