/**
 * api.js - Frontend API Client for Restaurant LINE Mini App
 * Handles all communication with Google Apps Script backend
 * FIXED: Added redirect:'follow' and fixed headers for GAS compatibility
 */

const API = (() => {

  // ===== CONFIGURATION =====
  const CONFIG = {
    BASE_URL: 'https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec',
    CACHE_TTL: 5 * 60 * 1000, // 5 minutes
  };

  // ===== CACHE =====
  const cache = {
    get(key) {
      try {
        const item = JSON.parse(localStorage.getItem(`rapi_${key}`));
        if (!item) return null;
        if (Date.now() > item.expiry) {
          localStorage.removeItem(`rapi_${key}`);
          return null;
        }
        return item.data;
      } catch { return null; }
    },
    set(key, data, ttl = CONFIG.CACHE_TTL) {
      try {
        localStorage.setItem(`rapi_${key}`, JSON.stringify({
          data, expiry: Date.now() + ttl
        }));
      } catch { /* ignore storage errors */ }
    },
    clear(key) {
      localStorage.removeItem(`rapi_${key}`);
    }
  };

  // ===== CORE REQUEST =====
  async function request(params, options = {}) {
    const url = new URL(CONFIG.BASE_URL);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    const isPost = !!options.body;

    // ✅ FIX: GAS ต้องการ redirect:'follow' และ GET ไม่ควรส่ง Content-Type
    const fetchOptions = {
      method: isPost ? 'POST' : 'GET',
      redirect: 'follow', // ✅ สำคัญมาก — GAS redirect ก่อนตอบ
    };

    if (isPost) {
      fetchOptions.headers = { 'Content-Type': 'text/plain' }; // ✅ ใช้ text/plain แทน application/json เพื่อหลีกเลี่ยง CORS preflight
      fetchOptions.body = JSON.stringify(options.body);
    }

    try {
      const response = await fetch(url.toString(), fetchOptions);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    } catch (err) {
      console.error('API Error:', err);
      throw err;
    }
  }

  // ===== PUBLIC API METHODS =====

  async function getMenu(forceRefresh = false) {
    const cacheKey = 'menu';
    if (!forceRefresh) {
      const cached = cache.get(cacheKey);
      if (cached) return cached;
    }
    const data = await request({ action: 'getMenu' });
    cache.set(cacheKey, data);
    return data;
  }

  async function createOrder(orderData) {
    const data = await request(
      { action: 'createOrder' },
      { body: orderData }
    );
    cache.clear('menu');
    return data;
  }

  async function getOrder(orderId) {
    return request({ action: 'getOrder', orderId });
  }

  async function createPayment(orderId) {
    return request({ action: 'createPayment', orderId });
  }

  async function updatePaymentStatus(orderId, transactionId) {
    return request(
      { action: 'updatePaymentStatus' },
      { body: { orderId, transactionId } }
    );
  }

  async function getOrders(adminKey, date = '') {
    return request({ action: 'getOrders', adminKey, date });
  }

  async function updateOrderStatus(adminKey, orderId, status) {
    return request(
      { action: 'updateOrderStatus', adminKey },
      { body: { orderId, status } }
    );
  }

  async function updateMenuStatus(adminKey, menuId, status) {
    cache.clear('menu');
    return request(
      { action: 'updateMenuStatus', adminKey },
      { body: { menuId, status } }
    );
  }

  async function getSalesReport(adminKey) {
    return request({ action: 'getSalesReport', adminKey });
  }

  return {
    getMenu,
    createOrder,
    getOrder,
    createPayment,
    updatePaymentStatus,
    getOrders,
    updateOrderStatus,
    updateMenuStatus,
    getSalesReport,
    setBaseUrl(url) { CONFIG.BASE_URL = url; }
  };
})();
