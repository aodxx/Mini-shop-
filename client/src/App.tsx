import { useEffect, useState } from 'react';
import { getCurrentUser, loginWithLine, logoutFromLine, type AuthUser } from './auth';
import { createProduct, deactivateProduct, listProducts, type Product } from './products';
import './styles.css';

type HealthResponse = { status: string; service: string };
type AuthState = 'checking' | 'signed-out' | 'signing-in' | 'signed-in' | 'error';
const productManagers = new Set(['staff', 'manager', 'owner']);

function formatPrice(priceSatang: number) {
  return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' }).format(priceSatang / 100);
}

export default function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [authState, setAuthState] = useState<AuthState>('checking');
  const [authError, setAuthError] = useState<string | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');
  const [newProductCategory, setNewProductCategory] = useState('ทั่วไป');
  const [savingProduct, setSavingProduct] = useState(false);

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

  useEffect(() => {
    if (authState === 'checking' || authState === 'error') return;
    const includeInactive = Boolean(user && productManagers.has(user.role));
    void listProducts(includeInactive)
      .then(setProducts)
      .catch(() => setProductsError('โหลดรายการสินค้าไม่สำเร็จ'));
  }, [authState, user]);

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

  async function handleCreateProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingProduct(true);
    setProductsError(null);
    try {
      const product = await createProduct({
        name: newProductName,
        priceSatang: Math.round(Number(newProductPrice) * 100),
        category: newProductCategory,
      });
      setProducts((current) => [...current, product].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      setNewProductName('');
      setNewProductPrice('');
    } catch {
      setProductsError('บันทึกสินค้าไม่สำเร็จ');
    } finally {
      setSavingProduct(false);
    }
  }

  async function handleDeactivate(product: Product) {
    try {
      await deactivateProduct(product.id);
      setProducts((current) => current.filter((item) => item.id !== product.id));
    } catch {
      setProductsError('ปิดใช้งานสินค้าไม่สำเร็จ');
    }
  }

  const canManageProducts = Boolean(user && productManagers.has(user.role));

  return (
    <main className="shell">
      <section className="app-card" aria-labelledby="app-title">
        <header className="app-header">
          <div>
            <p className="eyebrow">PHASE 4 · PRODUCT MANAGEMENT</p>
            <h1 id="app-title">Mini Shop</h1>
            <p className="lead">เมนูอาหารและสินค้าสำหรับร้านของคุณ</p>
          </div>
          {user && <button className="text-button" type="button" onClick={handleLogout}>ออกจากระบบ</button>}
        </header>

        <div className={`status ${health ? 'status-ok' : healthError ? 'status-error' : 'status-pending'}`}>
          <span className="status-dot" aria-hidden="true" />
          {health ? `API พร้อมใช้งาน · ${health.service}` : healthError ?? 'กำลังตรวจสอบ API...'}
        </div>

        <div className="auth-panel" aria-live="polite">
          {authState === 'checking' && <p className="muted">กำลังตรวจสอบการเข้าสู่ระบบ...</p>}
          {authState === 'signed-out' && <button className="line-button" type="button" onClick={handleLogin}>เข้าสู่ระบบด้วย LINE</button>}
          {authState === 'signing-in' && <p className="muted">กำลังเชื่อมต่อกับ LINE...</p>}
          {authState === 'signed-in' && user && (
            <div className="profile-panel">
              {user.pictureUrl && <img className="avatar" src={user.pictureUrl} alt="" />}
              <div><strong>{user.displayName}</strong><p className="muted">สิทธิ์: {user.role}</p></div>
            </div>
          )}
          {authState === 'error' && <div className="auth-error"><p>{authError ?? 'เข้าสู่ระบบไม่สำเร็จ'}</p><button className="text-button" type="button" onClick={handleLogin}>ลองใหม่</button></div>}
        </div>

        <section className="products-section" aria-labelledby="products-title">
          <div className="section-heading"><div><p className="eyebrow">MENU</p><h2 id="products-title">รายการสินค้า</h2></div><span className="product-count">{products.length} รายการ</span></div>
          {productsError && <p className="auth-error">{productsError}</p>}
          {products.length === 0 && !productsError ? <p className="muted">ยังไม่มีสินค้าที่เปิดขาย</p> : (
            <div className="product-grid">
              {products.map((product) => (
                <article className={`product-card ${product.isActive ? '' : 'product-inactive'}`} key={product.id}>
                  {product.imageUrl && <img className="product-image" src={product.imageUrl} alt="" />}
                  <div className="product-info"><span className="product-category">{product.category}</span><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}<strong>{formatPrice(product.priceSatang)}</strong></div>
                  {canManageProducts && product.isActive && <button className="text-button product-action" type="button" onClick={() => handleDeactivate(product)}>ปิดขาย</button>}
                </article>
              ))}
            </div>
          )}
        </section>

        {canManageProducts && (
          <section className="manager-panel" aria-labelledby="manager-title">
            <p className="eyebrow">STAFF AREA</p><h2 id="manager-title">เพิ่มสินค้า</h2>
            <form className="product-form" onSubmit={handleCreateProduct}>
              <label>ชื่อสินค้า<input required value={newProductName} onChange={(event) => setNewProductName(event.target.value)} /></label>
              <label>ราคา (บาท)<input required min="0" step="0.01" type="number" value={newProductPrice} onChange={(event) => setNewProductPrice(event.target.value)} /></label>
              <label>หมวดหมู่<input required value={newProductCategory} onChange={(event) => setNewProductCategory(event.target.value)} /></label>
              <button className="line-button" disabled={savingProduct} type="submit">{savingProduct ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}</button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
