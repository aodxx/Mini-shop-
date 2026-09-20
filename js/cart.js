/**
 * cart.js - Shopping Cart (with Options support)
 */

const Cart = (() => {
  const STORAGE_KEY = 'restaurant_cart';
  // items: [{ menuId, name, price, imageUrl, qty, selectedOptions, extraPrice, optionsSummary }]
  let items = [];
  let listeners = [];

  function load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      items = saved ? JSON.parse(saved) : [];
    } catch { items = []; }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    listeners.forEach(fn => fn(items));
  }

  /**
   * เพิ่มสินค้า
   * ถ้ามี selectedOptions → เพิ่มเป็นรายการใหม่เสมอ (คนละตัวเลือก = คนละ row)
   * ถ้าไม่มี options → รวมกับของเดิมถ้ามีอยู่แล้ว
   */
  function addItem(menuItem, selectedOptions, extraPrice) {
    const hasOptions = selectedOptions && selectedOptions.length > 0;
    const unitPrice = Number(menuItem.price) + Number(extraPrice || 0);
    const optionsSummary = selectedOptions
      ? selectedOptions.map(o => o.choice_name).join(', ')
      : '';

    if (!hasOptions) {
      // ไม่มี options — รวม qty
      const existing = items.find(i => i.menuId === menuItem.id && !i.selectedOptions?.length);
      if (existing) { existing.qty += 1; save(); return; }
    }

    items.push({
      menuId:          menuItem.id,
      name:            menuItem.name,
      price:           unitPrice,
      basePrice:       Number(menuItem.price),
      extraPrice:      Number(extraPrice || 0),
      imageUrl:        menuItem.image_url || '',
      qty:             1,
      selectedOptions: selectedOptions || [],
      optionsSummary,
    });
    save();
  }

  function removeItem(menuId) {
    // ลดจำนวน item ล่าสุดของ menuId นั้น
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].menuId === menuId) {
        if (items[i].qty > 1) { items[i].qty -= 1; }
        else { items.splice(i, 1); }
        break;
      }
    }
    save();
  }

  function removeByIndex(idx) {
    items.splice(idx, 1);
    save();
  }

  function updateQty(idx, qty) {
    if (qty <= 0) { items.splice(idx, 1); }
    else { items[idx].qty = qty; }
    save();
  }

  function clear() { items = []; save(); }

  function getItems()        { return [...items]; }
  function getItemQty(menuId){ return items.filter(i=>i.menuId===menuId).reduce((s,i)=>s+i.qty,0); }
  function getTotal()        { return items.reduce((s,i)=>s+(i.price*i.qty),0); }
  function getCount()        { return items.reduce((s,i)=>s+i.qty,0); }
  function isEmpty()         { return items.length === 0; }

  function toOrderPayload(userId, customerName) {
    return {
      userId,
      customerName,
      items: items.map(i => ({
        menuId:          i.menuId,
        qty:             i.qty,
        selectedOptions: i.selectedOptions || [],
      }))
    };
  }

  function onChange(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter(l => l !== fn); };
  }

  load();
  return {
    addItem, removeItem, removeByIndex, updateQty, clear,
    getItems, getItemQty, getTotal, getCount, isEmpty,
    toOrderPayload, onChange
  };
})();
