import { useEffect, useState } from 'react';
import { getCurrentUser, loginWithLine, logoutFromLine, type AuthUser } from './auth';
import './styles.css';

type HealthResponse = {
  status: string;
  service: string;
};

type AuthState = 'checking' | 'signed-out' | 'signing-in' | 'signed-in' | 'error';

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
    let active = true;

    void Promise.all([
      fetch(`${apiUrl}/health`)
        .then(async (response) => {
          if (!response.ok) throw new Error(`API responded with ${response.status}`);
          return response.json() as Promise<HealthResponse>;
        })
        .then((result) => { if (active) setHealth(result); })
        .catch(() => { if (active) setHealthError('เชื่อมต่อ API ไม่สำเร็จ'); }),
      getCurrentUser()
        .then((currentUser) => {
          if (active) {
            setUser(currentUser);
            setAuthState(currentUser ? 'signed-in' : 'signed-out');
          }
        })
        .catch(() => {
          if (active) {
            setAuthState('error');
            setAuthError('ตรวจสอบ session ไม่สำเร็จ');
          }
        }),
    ]);

    return () => { active = false; };
  }, []);

  async function handleLogin() {
    setAuthState('signing-in');
    setAuthError(null);
    try {
      setUser(await loginWithLine());
      setAuthState('signed-in');
    } catch (error) {
      if (error instanceof Error && error.message === 'LINE login redirect started') return;
      setAuthState('error');
      setAuthError(error instanceof Error ? error.message : 'เข้าสู่ระบบไม่สำเร็จ');
    }
  }

  async function handleLogout() {
    setAuthError(null);
    try {
      await logoutFromLine();
      setUser(null);
      setAuthState('signed-out');
    } catch {
      setAuthState('error');
      setAuthError('ออกจากระบบไม่สำเร็จ');
    }
  }

  return (
    <main className="shell">
      <section className="hero-card" aria-labelledby="app-title">
        <p className="eyebrow">PHASE 2 · LINE AUTHENTICATION</p>
        <h1 id="app-title">Mini Shop</h1>
        <p className="lead">เข้าสู่ระบบด้วย LINE เพื่อสั่งอาหารและติดตามออเดอร์ของคุณ</p>

        <div className={`status ${health ? 'status-ok' : healthError ? 'status-error' : 'status-pending'}`}>
          <span className="status-dot" aria-hidden="true" />
          {health ? `API พร้อมใช้งาน · ${health.service}` : healthError ?? 'กำลังตรวจสอบ API...'}
        </div>

        <div className="auth-panel" aria-live="polite">
          {authState === 'checking' && <p className="muted">กำลังตรวจสอบการเข้าสู่ระบบ...</p>}
          {authState === 'signed-out' && (
            <button className="line-button" type="button" onClick={handleLogin}>
              เข้าสู่ระบบด้วย LINE
            </button>
          )}
          {authState === 'signing-in' && <p className="muted">กำลังเชื่อมต่อกับ LINE...</p>}
          {authState === 'signed-in' && user && (
            <div className="profile-panel">
              {user.pictureUrl && <img className="avatar" src={user.pictureUrl} alt="" />}
              <div>
                <strong>{user.displayName}</strong>
                <p className="muted">เข้าสู่ระบบแล้ว</p>
              </div>
              <button className="text-button" type="button" onClick={handleLogout}>ออกจากระบบ</button>
            </div>
          )}
          {(authState === 'error' || authError) && (
            <div className="auth-error">
              <p>{authError ?? 'เข้าสู่ระบบไม่สำเร็จ'}</p>
              <button className="text-button" type="button" onClick={handleLogin}>ลองใหม่</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
