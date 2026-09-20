/**
 * menu.js - Menu Page Logic with Options Popup
 */

const MenuPage = (() => {
  let allItems = [];
  let currentCategory = 'all';

  // ===== SKELETON =====
  function renderSkeletons(count = 6) {
    return Array(count).fill(0).map(() => `
      <div class="skeleton-card">
        <div class="skeleton skeleton-img"></div>
        <div class="skeleton skeleton-text"></div>
        <div class="skeleton skeleton-text short"></div>
        <div class="skeleton skeleton-price"></div>
      </div>`).join('');
  }

  // ===== RENDER MENU CARD =====
  function renderMenuCard(item) {
    const qty = Cart.getItemQty(item.id);
    const hasImage = item.image_url && item.image_url.length > 0;
    const hasOptions = item.optionGroups && item.optionGroups.length > 0;

    return `
      <div class="menu-card" data-id="${item.id}">
        <div class="menu-card-img-wrap">
          ${hasImage
            ? `<img src="${item.image_url}" alt="${item.name}" loading="lazy" onerror="handleImgError(this)">`
            : ''}
          <div class="menu-card-img-placeholder" style="${hasImage ? 'display:none' : ''}">🍽️</div>
          ${hasOptions ? `<div class="option-badge">เลือกได้</div>` : ''}
        </div>
        <div class="menu-card-body">
          <div class="menu-card-name">${item.name}</div>
          ${item.description ? `<div class="menu-card-desc">${item.description}</div>` : ''}
          <div class="menu-card-footer">
            <div class="menu-card-price">${formatPrice(item.price)}</div>
            <div class="cart-control">
              <button class="btn-add-cart ${qty > 0 && !hasOptions ? 'hidden' : ''}"
                onclick="MenuPage.handleAdd('${item.id}')">+</button>
              <div class="item-counter ${qty > 0 && !hasOptions ? 'show' : ''}">
                <button class="counter-btn counter-minus"
                  onclick="MenuPage.decrease('${item.id}')">−</button>
                <span class="counter-qty" id="qty-${item.id}">${qty}</span>
                <button class="counter-btn counter-plus"
                  onclick="MenuPage.handleAdd('${item.id}')">+</button>
              </div>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ===== CATEGORIES =====
  function renderCategories(items) {
    const container = document.getElementById('category-tabs');
    if (!container) return;
    const categories = ['ทั้งหมด', ...new Set(items.map(i => i.category).filter(Boolean))];
    container.innerHTML = categories.map((cat, idx) => {
      const key = idx === 0 ? 'all' : cat;
      return `<button class="tab-btn ${currentCategory === key ? 'active' : ''}"
        onclick="MenuPage.filterCategory('${key}', this)">${cat}</button>`;
    }).join('');
  }

  function renderMenuGrid(items) {
    const container = document.getElementById('menu-grid');
    if (!container) return;
    const filtered = currentCategory === 'all'
      ? items : items.filter(i => i.category === currentCategory);
    if (filtered.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--color-gray-500);">ไม่มีเมนูในหมวดนี้</div>`;
      return;
    }
    container.innerHTML = filtered.map(renderMenuCard).join('');
  }

  // ===== HANDLE ADD =====
  function handleAdd(menuId) {
    const item = allItems.find(i => i.id === menuId);
    if (!item) return;

    if (item.optionGroups && item.optionGroups.length > 0) {
      // เปิด popup เลือก options
      OptionsPopup.open(item, (selectedOptions, extraPrice) => {
        Cart.addItem(item, selectedOptions, extraPrice);
        updateOrderBar();
        Toast.success(`เพิ่ม ${item.name} แล้ว 🎉`);
        // ไม่ต้อง updateCardUI เพราะมี options ทุกครั้งต้องเลือกใหม่
      });
    } else {
      Cart.addItem(item, [], 0);
      updateCardUI(menuId);
      updateOrderBar();
      Toast.success(`เพิ่ม ${item.name} แล้ว 🎉`);
    }
  }

  function decrease(menuId) {
    Cart.removeItem(menuId);
    updateCardUI(menuId);
    updateOrderBar();
  }

  function updateCardUI(menuId) {
    const item = allItems.find(i => i.id === menuId);
    if (!item) return;
    const hasOptions = item.optionGroups && item.optionGroups.length > 0;
    if (hasOptions) return; // เมนูมี options ไม่ต้อง toggle counter

    const qty = Cart.getItemQty(menuId);
    const card = document.querySelector(`.menu-card[data-id="${menuId}"]`);
    if (!card) return;
    const addBtn = card.querySelector('.btn-add-cart');
    const counter = card.querySelector('.item-counter');
    const qtyEl = card.querySelector('.counter-qty');
    if (qty === 0) {
      addBtn?.classList.remove('hidden');
      counter?.classList.remove('show');
    } else {
      addBtn?.classList.add('hidden');
      counter?.classList.add('show');
      if (qtyEl) qtyEl.textContent = qty;
    }
  }

  function updateOrderBar() {
    const bar = document.getElementById('order-bar');
    if (!bar) return;
    const count = Cart.getCount();
    const total = Cart.getTotal();
    if (count === 0) { bar.classList.remove('show'); return; }
    bar.classList.add('show');
    const countEl = bar.querySelector('.bar-count');
    const totalEl = bar.querySelector('.bar-total');
    if (countEl) countEl.textContent = `${count} รายการ`;
    if (totalEl) totalEl.textContent = formatPrice(total);
  }

  function filterCategory(key, btn) {
    currentCategory = key;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderMenuGrid(allItems);
  }

  async function init() {
    const grid = document.getElementById('menu-grid');
    if (!grid) return;
    grid.innerHTML = renderSkeletons();
    try {
      const result = await API.getMenu();
      allItems = result.items || [];
      renderCategories(allItems);
      renderMenuGrid(allItems);
      updateOrderBar();
      Cart.onChange(() => {
        allItems.forEach(item => updateCardUI(item.id));
        updateOrderBar();
      });
    } catch (err) {
      grid.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:40px;">
          <div style="font-size:48px;margin-bottom:12px;">😓</div>
          <div style="font-weight:700;margin-bottom:8px;">โหลดเมนูไม่สำเร็จ</div>
          <button class="btn btn-primary mt-16" style="max-width:180px"
            onclick="MenuPage.init()">ลองใหม่</button>
        </div>`;
    }
  }

  return { init, handleAdd, decrease, filterCategory };
})();

// ===== OPTIONS POPUP =====
const OptionsPopup = (() => {
  let currentItem = null;
  let onConfirm   = null;
  let selections  = {};

  function open(item, callback) {
    currentItem = item;
    onConfirm   = callback;
    selections  = {};

    // ตั้งค่า default
    item.optionGroups.forEach(group => {
      const def = group.choices.find(c => c.is_default) || group.choices[0];
      if (def) selections[group.group_key] = {
        choice_name: def.choice_name,
        choice_extra_price: Number(def.choice_extra_price) || 0,
      };
    });

    renderPopup();
    document.getElementById('options-overlay').classList.add('show');
  }

  // ✅ renderPopup ไม่รับ argument — ใช้ currentItem และ selections ที่เก็บไว้
  function renderPopup() {
    if (!currentItem) return;
    const extra      = calcExtra();
    const totalPrice = currentItem.price + extra;

    document.getElementById('options-item-name').textContent  = currentItem.name;
    document.getElementById('options-base-price').textContent = formatPrice(currentItem.price);

    const groupsHtml = currentItem.optionGroups.map(group => {
      const selectedChoice = selections[group.group_key];
      return `
        <div class="option-group">
          <div class="option-group-title">
            ${group.group_name}
            ${group.required ? '<span class="required-badge">จำเป็น</span>' : ''}
          </div>
          <div class="option-choices">
            ${group.choices.map(choice => {
              const isSelected = selectedChoice?.choice_name === choice.choice_name;
              const extraLabel = choice.choice_extra_price > 0
                ? `<span class="extra-price">+${choice.choice_extra_price}</span>` : '';
              return `
                <div class="option-choice ${isSelected ? 'selected' : ''}"
                  data-group="${group.group_key}"
                  data-choice="${encodeURIComponent(choice.choice_name)}"
                  data-extra="${choice.choice_extra_price || 0}">
                  <div class="choice-radio ${isSelected ? 'active' : ''}"></div>
                  <span class="choice-name">${choice.choice_name}</span>
                  ${extraLabel}
                </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    document.getElementById('options-groups').innerHTML = groupsHtml;

    // อัปเดตปุ่ม
    const btn = document.getElementById('options-confirm-btn');
    if (btn) btn.textContent = `เพิ่มใส่ตะกร้า — ${formatPrice(totalPrice)}`;

    // ✅ ผูก event ใหม่ทุกครั้งหลัง render
    document.querySelectorAll('#options-groups .option-choice').forEach(el => {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        const gk    = this.getAttribute('data-group');
        const name  = decodeURIComponent(this.getAttribute('data-choice'));
        const extra = Number(this.getAttribute('data-extra')) || 0;
        // ✅ อัปเดต selections โดยตรง ไม่สร้างใหม่
        selections[gk] = { choice_name: name, choice_extra_price: extra };
        renderPopup(); // re-render เฉพาะ popup
      });
    });
  }

  function calcExtra() {
    return Object.values(selections).reduce((s, c) => s + (Number(c.choice_extra_price) || 0), 0);
  }

  function confirm() {
    if (!currentItem) return;

    const missing = currentItem.optionGroups
      .filter(g => g.required && !selections[g.group_key])
      .map(g => g.group_name);

    if (missing.length > 0) {
      Toast.error(`กรุณาเลือก: ${missing.join(', ')}`);
      return;
    }

    // ✅ เก็บข้อมูลก่อน close
    const selectedOptions = Object.entries(selections).map(([group_key, sel]) => ({
      group_key,
      choice_name:        sel.choice_name,
      choice_extra_price: sel.choice_extra_price,
    }));
    const extraPrice  = calcExtra();
    const cb          = onConfirm; // เก็บ callback ก่อน

    close(); // close แล้ว currentItem และ onConfirm จะเป็น null

    if (cb) cb(selectedOptions, extraPrice); // ✅ เรียก callback หลัง close
  }

  function close() {
    const overlay = document.getElementById('options-overlay');
    if (overlay) overlay.classList.remove('show');
    currentItem = null;
    onConfirm   = null;
    selections  = {};
  }

  return { open, confirm, close };
})();

document.addEventListener('DOMContentLoaded', MenuPage.init);
