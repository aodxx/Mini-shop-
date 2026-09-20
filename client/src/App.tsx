import { useEffect, useState } from 'react';
import { adjustProductStock, listAdminOrders, updateAdminOrderStatus } from './admin';
import { getCurrentUser, loginWithLine, logoutFromLine, type AuthUser } from './auth';
import { addProductToCart, clearCart, loadCart, updateCartQuantity, type CartItem } from './cart';
import { cancelOrder, createOrder, listOrders, startPayment, type Order } from './orders';
import { createProduct, deactivateProduct, listProducts, type Product } from './products';
import { loadDatabaseDiagnostics, type DatabaseDiagnostics } from './database';
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
  const [newProductStock, setNewProductStock] = useState('0');
  const [savingProduct, setSavingProduct] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [checkoutState, setCheckoutState] = useState<'idle' | 'submitting'>('idle');
  const [adminOrders, setAdminOrders] = useState<Order[]>([]);
  const [adminOrderStatus, setAdminOrderStatus] = useState('all');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminError, setAdminError] = useState<string | null>(null);
  const [stockDrafts, setStockDrafts] = useState<Record<string, string>>({});
  const [databaseDiagnostics, setDatabaseDiagnostics] = useState<DatabaseDiagnostics | null>(null);
  const [databaseLoading, setDatabaseLoading] = useState(false);
  const [databaseError, setDatabaseError] = useState<string | null>(null);
  const canManageProducts = Boolean(user && productManagers.has(user.role));

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
    setCart(loadCart());
    const payment = new URLSearchParams(window.location.search).get('payment');
    if (payment === 'success') setOrderError('ชำระเงินสำเร็จแล้ว');
    if (payment === 'failed') setOrderError('การชำระเงินไม่สำเร็จ กรุณาลองใหม่');
    if (payment) window.history.replaceState({}, '', window.location.pathname);
  }, []);

  useEffect(() => {
    if (authState === 'checking' || authState === 'error') return;
    const includeInactive = Boolean(user && productManagers.has(user.role));
    void listProducts(includeInactive)
      .then(setProducts)
      .catch(() => setProductsError('โหลดรายการสินค้าไม่สำเร็จ'));
  }, [authState, user]);

  useEffect(() => {
    if (authState !== 'signed-in') {
      setOrders([]);
      return;
    }
    void listOrders().then(setOrders).catch(() => setOrderError('โหลดประวัติออเดอร์ไม่สำเร็จ'));
  }, [authState]);

  useEffect(() => {
    if (!canManageProducts) {
      setAdminOrders([]);
      return;
    }
    void listAdminOrders(adminOrderStatus === 'all' ? undefined : adminOrderStatus, adminSearch)
      .then(setAdminOrders)
      .catch((error) => setAdminError(error instanceof Error ? error.message : 'โหลดข้อมูลหลังร้านไม่สำเร็จ'));
  }, [adminOrderStatus, adminSearch, canManageProducts]);

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
        stockQuantity: Math.max(0, Math.floor(Number(newProductStock))),
      });
      setProducts((current) => [...current, product].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));
      setNewProductName('');
      setNewProductPrice('');
      setNewProductStock('0');
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

  function handleAddToCart(product: Product) {
    setCart((current) => addProductToCart(current, product));
    setOrderError(null);
  }

  async function handleCheckout() {
    if (!user) {
      setAuthError('กรุณาเข้าสู่ระบบก่อนสั่งซื้อ');
      return;
    }
    setCheckoutState('submitting');
    setOrderError(null);
    try {
      const order = await createOrder(cart);
      clearCart();
      setCart([]);
      setOrders((current) => [order, ...current]);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'สร้างออเดอร์ไม่สำเร็จ');
    } finally {
      setCheckoutState('idle');
    }
  }

  async function handleCancelOrder(orderId: string) {
    try {
      await cancelOrder(orderId);
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, status: 'cancelled' } : order));
    } catch {
      setOrderError('ยกเลิกออเดอร์ไม่สำเร็จ');
    }
  }

  async function handleStartPayment(orderId: string) {
    try {
      const result = await startPayment(orderId);
      window.location.assign(result.paymentUrl);
    } catch (error) {
      setOrderError(error instanceof Error ? error.message : 'เริ่มการชำระเงินไม่สำเร็จ');
    }
  }

  async function handleAdminStatus(orderId: string, status: string) {
    try {
      const updated = await updateAdminOrderStatus(orderId, status);
      setAdminOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
      setOrders((current) => current.map((order) => order.id === updated.id ? updated : order));
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'เปลี่ยนสถานะออเดอร์ไม่สำเร็จ');
    }
  }

  async function handleStockAdjustment(product: Product) {
    const delta = Number(stockDrafts[product.id] ?? '');
    if (!Number.isInteger(delta) || delta === 0) {
      setAdminError('กรุณาระบุจำนวน stock เป็นจำนวนเต็มที่ไม่ใช่ศูนย์');
      return;
    }
    try {
      const updated = await adjustProductStock(product.id, delta);
      setProducts((current) => current.map((item) => item.id === updated.id ? updated : item));
      setStockDrafts((current) => ({ ...current, [product.id]: '' }));
      setAdminError(null);
    } catch (error) {
      setAdminError(error instanceof Error ? error.message : 'ปรับ stock ไม่สำเร็จ');
    }
  }

  async function handleDatabaseCheck() {
    setDatabaseLoading(true);
    setDatabaseError(null);
    try {
      setDatabaseDiagnostics(await loadDatabaseDiagnostics());
    } catch (error) {
      setDatabaseDiagnostics(null);
      setDatabaseError(error instanceof Error ? error.message : 'ตรวจสอบ Neon database ไม่สำเร็จ');
    } finally {
      setDatabaseLoading(false);
    }
  }

  return (
    <main className="shell">
      <section className="app-card" aria-labelledby="app-title">
        <header className="app-header">
          <div>
            <p className="eyebrow">MINI SHOP · ADMIN & ORDER OPERATIONS</p>
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
                  <div className="product-info"><span className="product-category">{product.category}</span><h3>{product.name}</h3>{product.description && <p>{product.description}</p>}<span className="stock-label">เหลือ {Math.max(0, product.stockQuantity - product.reservedQuantity)} ชิ้น</span><strong>{formatPrice(product.priceSatang)}</strong></div>
                  {product.isActive && <button className="cart-button" disabled={product.stockQuantity - product.reservedQuantity < 1} type="button" onClick={() => handleAddToCart(product)}>{product.stockQuantity - product.reservedQuantity > 0 ? 'เพิ่มลงตะกร้า' : 'สินค้าหมด'}</button>}
                  {canManageProducts && product.isActive && <button className="text-button product-action" type="button" onClick={() => handleDeactivate(product)}>ปิดขาย</button>}
                </article>
              ))}
            </div>
          )}
        </section>

        {cart.length > 0 && (
          <section className="cart-panel" aria-labelledby="cart-title">
            <div className="section-heading"><div><p className="eyebrow">CART</p><h2 id="cart-title">ตะกร้าสินค้า</h2></div><strong>{formatPrice(cart.reduce((total, item) => total + item.priceSatang * item.quantity, 0))}</strong></div>
            <div className="cart-list">
              {cart.map((item) => <div className="cart-row" key={item.productId}><span>{item.name}</span><div className="quantity-control"><button type="button" onClick={() => setCart((current) => updateCartQuantity(current, item.productId, item.quantity - 1))}>−</button><span>{item.quantity}</span><button type="button" onClick={() => setCart((current) => updateCartQuantity(current, item.productId, item.quantity + 1))}>+</button></div><strong>{formatPrice(item.priceSatang * item.quantity)}</strong></div>)}
            </div>
            <button className="line-button checkout-button" disabled={checkoutState === 'submitting'} type="button" onClick={handleCheckout}>{checkoutState === 'submitting' ? 'กำลังสร้างออเดอร์...' : user ? 'ยืนยันการสั่งซื้อ' : 'เข้าสู่ระบบเพื่อสั่งซื้อ'}</button>
          </section>
        )}

        {user && orders.length > 0 && (
          <section className="orders-section" aria-labelledby="orders-title">
            <div className="section-heading"><div><p className="eyebrow">ORDER HISTORY</p><h2 id="orders-title">ออเดอร์ของฉัน</h2></div></div>
            <div className="order-list">{orders.map((order) => <article className="order-row" key={order.id}><div><strong>{order.orderNumber}</strong><p className="muted">{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(' · ')}</p></div><div className="order-summary"><span className={`order-status order-${order.status}`}>{order.status}</span><strong>{formatPrice(order.totalSatang)}</strong>{order.paymentStatus !== 'paid' && order.status !== 'cancelled' && <button className="text-button" type="button" onClick={() => handleStartPayment(order.id)}>ชำระเงิน</button>}{order.status === 'pending' && <button className="text-button" type="button" onClick={() => handleCancelOrder(order.id)}>ยกเลิก</button>}</div></article>)}</div>
          </section>
        )}

        {canManageProducts && (
          <section className="admin-dashboard" aria-labelledby="admin-dashboard-title">
            <div className="section-heading"><div><p className="eyebrow">ADMIN DASHBOARD</p><h2 id="admin-dashboard-title">จัดการออเดอร์และสต็อก</h2></div><button className="text-button" type="button" onClick={() => void listAdminOrders(adminOrderStatus === 'all' ? undefined : adminOrderStatus, adminSearch).then(setAdminOrders)}>รีเฟรช</button></div>
            {adminError && <p className="auth-error">{adminError}</p>}
            <div className="database-test-panel">
              <div className="section-heading"><div><p className="eyebrow">NEON DATABASE TEST</p><h3>ทดสอบการเชื่อมต่อและข้อมูลผู้ใช้</h3><p className="muted">แสดงเฉพาะ id, display name, role และวันที่สร้าง โดยไม่ส่ง LINE user ID ไปที่ browser</p></div><button className="text-button" type="button" disabled={databaseLoading} onClick={() => void handleDatabaseCheck()}>{databaseLoading ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ Neon'}</button></div>
              {databaseError && <p className="auth-error">{databaseError}</p>}
              {databaseDiagnostics && <>
                <div className="database-status"><span className="status-dot" />เชื่อมต่อ PostgreSQL สำเร็จ · ตรวจเมื่อ {new Date(databaseDiagnostics.database.checkedAt).toLocaleString('th-TH')}</div>
                <div className="user-table-wrap"><table className="user-table"><thead><tr><th>ชื่อผู้ใช้</th><th>Role</th><th>สร้างเมื่อ</th></tr></thead><tbody>{databaseDiagnostics.users.map((databaseUser) => <tr key={databaseUser.id}><td>{databaseUser.displayName}</td><td><span className="order-status order-ready">{databaseUser.role}</span></td><td>{new Date(databaseUser.createdAt).toLocaleString('th-TH')}</td></tr>)}</tbody></table></div>
              </>}
            </div>
            <div className="admin-filters">
              <input aria-label="ค้นหาออเดอร์" placeholder="ค้นหาเลขออเดอร์" value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} />
              <select aria-label="กรองสถานะออเดอร์" value={adminOrderStatus} onChange={(event) => setAdminOrderStatus(event.target.value)}><option value="all">ทุกสถานะ</option><option value="pending">รอชำระเงิน</option><option value="paid">ชำระแล้ว</option><option value="cooking">กำลังทำ</option><option value="ready">พร้อมรับ</option><option value="completed">เสร็จสิ้น</option><option value="cancelled">ยกเลิก</option></select>
            </div>
            <div className="admin-orders">
              {adminOrders.length === 0 ? <p className="muted">ไม่พบออเดอร์</p> : adminOrders.map((order) => (
                <article className="admin-order-row" key={order.id}>
                  <div><strong>{order.orderNumber}</strong><p className="muted">{order.items.map((item) => `${item.productName} × ${item.quantity}`).join(' · ')}</p><span className="muted">ยอด {formatPrice(order.totalSatang)} · payment: {order.paymentStatus}</span></div>
                  <select aria-label={`สถานะ ${order.orderNumber}`} value={order.status} onChange={(event) => void handleAdminStatus(order.id, event.target.value)}><option value="pending">pending</option><option value="paid">paid</option><option value="cooking">cooking</option><option value="ready">ready</option><option value="completed">completed</option><option value="cancelled">cancelled</option></select>
                </article>
              ))}
            </div>
            <h3 className="admin-subtitle">สต็อกสินค้า</h3>
            <div className="stock-admin-list">{products.map((product) => (
              <div className="stock-admin-row" key={product.id}><div><strong>{product.name}</strong><span className="muted">คงเหลือ {product.stockQuantity} · จองแล้ว {product.reservedQuantity} · ขายได้ {Math.max(0, product.stockQuantity - product.reservedQuantity)}</span></div><div className="stock-controls"><input aria-label={`จำนวน stock ${product.name}`} type="number" step="1" placeholder="+/-" value={stockDrafts[product.id] ?? ''} onChange={(event) => setStockDrafts((current) => ({ ...current, [product.id]: event.target.value }))} /><button className="text-button" type="button" onClick={() => void handleStockAdjustment(product)}>ปรับ</button></div></div>
            ))}</div>
          </section>
        )}

        {orderError && <p className="auth-error order-error">{orderError}</p>}

        {canManageProducts && (
          <section className="manager-panel" aria-labelledby="manager-title">
            <p className="eyebrow">STAFF AREA</p><h2 id="manager-title">เพิ่มสินค้า</h2>
            <form className="product-form" onSubmit={handleCreateProduct}>
              <label>ชื่อสินค้า<input required value={newProductName} onChange={(event) => setNewProductName(event.target.value)} /></label>
              <label>ราคา (บาท)<input required min="0" step="0.01" type="number" value={newProductPrice} onChange={(event) => setNewProductPrice(event.target.value)} /></label>
              <label>หมวดหมู่<input required value={newProductCategory} onChange={(event) => setNewProductCategory(event.target.value)} /></label>
              <label>จำนวนสต็อก<input required min="0" step="1" type="number" value={newProductStock} onChange={(event) => setNewProductStock(event.target.value)} /></label>
              <button className="line-button" disabled={savingProduct} type="submit">{savingProduct ? 'กำลังบันทึก...' : 'เพิ่มสินค้า'}</button>
            </form>
          </section>
        )}
      </section>
    </main>
  );
}
