/**
 * app.js - Main Application Entry Point
 * Handles LINE LIFF initialization and shared utilities
 */

// ===== CONFIG =====
// Replace these with your actual values
const APP_CONFIG = {
  LIFF_ID: 'YOUR_LIFF_ID',                // From LINE Developers Console
 GAS_BASE_URL: 'https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec',
  ADMIN_KEY:    'CHANGE_ME_ADMIN_KEY',      // Change to a random string
  LINE_PAY_ENV: 'sandbox',                 // 'sandbox' or 'production'
};

// ===== LINE LIFF =====
const LiffManager = (() => {
  let profile = null;
  let initialized = false;

  async function init() {
    if (initialized) return;

    try {
      await liff.init({ liffId: APP_CONFIG.LIFF_ID });
      initialized = true;

      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }

      profile = await liff.getProfile();
    } catch (err) {
      console.error('LIFF init error:', err);
      // Fallback for non-LINE browser during development
      profile = {
        userId: 'dev_user_001',
        displayName: 'Test User',
        pictureUrl: ''
      };
    }
  }

  function getProfile() { return profile; }
  function getUserId() { return profile?.userId || 'unknown'; }
  function getDisplayName() { return profile?.displayName || 'Guest'; }

  function closeWindow() {
    if (liff.isInClient()) liff.closeWindow();
  }

  return { init, getProfile, getUserId, getDisplayName, closeWindow };
})();

// ===== TOAST NOTIFICATIONS =====
const Toast = (() => {
  let el = null;
  let timer = null;

  function getEl() {
    if (!el) {
      el = document.createElement('div');
      el.className = 'toast';
      document.body.appendChild(el);
    }
    return el;
  }

  function show(message, type = 'default', duration = 2500) {
    const toast = getEl();
    toast.textContent = message;
    toast.className = `toast ${type}`;

    clearTimeout(timer);
    setTimeout(() => toast.classList.add('show'), 10);
    timer = setTimeout(() => toast.classList.remove('show'), duration);
  }

  return {
    success: (msg) => show(msg, 'success'),
    error: (msg) => show(msg, 'error', 3500),
    info: (msg) => show(msg, 'default'),
  };
})();

// ===== LOADING =====
function showLoading(show) {
  const el = document.getElementById('loading-screen');
  if (el) el.style.display = show ? 'flex' : 'none';
}

// ===== FORMATTING =====
function formatPrice(amount) {
  return `฿${Number(amount).toLocaleString('th-TH')}`;
}

function formatTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}

function timeAgo(dateString) {
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60) return `${diff} วินาที`;
  if (diff < 3600) return `${Math.floor(diff / 60)} นาที`;
  return `${Math.floor(diff / 3600)} ชั่วโมง`;
}

// ===== NAVIGATION =====
function navigateTo(page, params = {}) {
  const query = new URLSearchParams(params).toString();
  const url = `${page}${query ? '?' + query : ''}`;
  window.location.href = url;
}

function getParam(key) {
  return new URLSearchParams(window.location.search).get(key);
}

// ===== CART BADGE UPDATER =====
function updateCartBadges() {
  const count = Cart.getCount();
  document.querySelectorAll('.cart-badge, .nav-cart-badge').forEach(el => {
    el.textContent = count;
    el.classList.toggle('show', count > 0);
  });
}

// Listen to cart changes globally
Cart.onChange(updateCartBadges);

// ===== IMAGE FALLBACK =====
function handleImgError(img) {
  img.style.display = 'none';
  const placeholder = img.parentElement.querySelector('.menu-card-img-placeholder');
  if (placeholder) placeholder.style.display = 'flex';
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', async () => {
  // Set GAS URL
  if (typeof API !== 'undefined') {
    API.setBaseUrl(APP_CONFIG.GAS_BASE_URL);
  }

  // Initialize cart badges
  updateCartBadges();

  // Highlight active nav item
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(item => {
    const href = item.getAttribute('data-page');
    if (href && currentPage === href) item.classList.add('active');
  });
});
