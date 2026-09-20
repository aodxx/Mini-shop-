import liff from '@line/liff';

export type AuthUser = {
  lineUserId: string;
  displayName: string;
  pictureUrl?: string;
  role: 'customer';
};

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error ?? `Request failed with ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export async function initializeLiff(): Promise<void> {
  const liffId = import.meta.env.VITE_LIFF_ID;
  if (!liffId) throw new Error('VITE_LIFF_ID is not configured');

  await liff.init({ liffId });
}

export async function loginWithLine(): Promise<AuthUser> {
  await initializeLiff();

  if (!liff.isLoggedIn()) {
    liff.login({ redirectUri: window.location.href });
    throw new Error('LINE login redirect started');
  }

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error('LINE ID token is unavailable');

  const response = await fetch(`${apiUrl}/api/auth/line`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  return (await parseResponse<{ user: AuthUser }>(response)).user;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const response = await fetch(`${apiUrl}/api/auth/me`, {
    credentials: 'include',
  });

  if (response.status === 401) return null;
  return (await parseResponse<{ user: AuthUser }>(response)).user;
}

export async function logoutFromLine(): Promise<void> {
  await parseResponse(await fetch(`${apiUrl}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
  }));

  if (liff.isLoggedIn()) liff.logout();
}
