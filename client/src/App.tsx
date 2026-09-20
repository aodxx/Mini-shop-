import { useEffect, useState } from 'react';
import './styles.css';

type HealthResponse = {
  status: string;
  service: string;
};

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

    fetch(`${apiUrl}/health`)
      .then(async (response) => {
        if (!response.ok) throw new Error(`API responded with ${response.status}`);
        return response.json() as Promise<HealthResponse>;
      })
      .then(setHealth)
      .catch(() => setError('เชื่อมต่อ API ไม่สำเร็จ กรุณาตรวจสอบว่า backend กำลังทำงาน'));
  }, []);

  return (
    <main className="shell">
      <section className="hero-card" aria-labelledby="app-title">
        <p className="eyebrow">PHASE 1 · FOUNDATION</p>
        <h1 id="app-title">Mini Shop</h1>
        <p className="lead">ระบบสั่งอาหารรุ่นใหม่กำลังเริ่มต้นจากโครงสร้าง React และ TypeScript</p>
        <div className={`status ${health ? 'status-ok' : error ? 'status-error' : 'status-pending'}`}>
          <span className="status-dot" aria-hidden="true" />
          {health ? `API พร้อมใช้งาน · ${health.service}` : error ?? 'กำลังตรวจสอบ API...'}
        </div>
      </section>
    </main>
  );
}
