/**
 * menuAPI.gs - Menu Management + Options
 */

/**
 * Get all active menu items พร้อม options
 */
function getMenu() {
  const sheet = getSheet('Menu');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const items = [];

  for (let i = 1; i < rows.length; i++) {
    const item = rowToObj(headers, rows[i]);
    if (item.status === 'active' || item.status === '') {
      items.push({
        id: String(item.id),
        name: item.name,
        description: item.description || '',
        price: Number(item.price),
        image_url: item.image_url || '',
        category: item.category || 'ทั่วไป',
        status: item.status || 'active',
      });
    }
  }

  // ดึง options ทั้งหมดมาแนบกับแต่ละเมนู
  const allOptions = getMenuOptionsMap();
  items.forEach(item => {
    item.optionGroups = allOptions[item.id] || [];
  });

  return { success: true, items };
}

/**
 * ดึง MenuOptions จาก Sheet แล้วจัดกลุ่มตาม menu_id
 * Return: { "1": [ {group_key, group_name, required, choices:[...]} ] }
 */
function getMenuOptionsMap() {
  let sheet;
  try { sheet = getSheet('MenuOptions'); }
  catch(e) { return {}; } // ถ้าไม่มี sheet ยังทำงานได้ปกติ

  const rows = sheet.getDataRange().getValues();
  if (rows.length < 2) return {};
  const headers = rows[0];
  const map = {}; // menuId -> { groupKey -> group }

  for (let i = 1; i < rows.length; i++) {
    const r = rowToObj(headers, rows[i]);
    if (!r.menu_ids || !r.choice_name) continue;

    // menu_ids อาจเป็น "1,2,3" หรือ "1"
    const menuIds = String(r.menu_ids).split(',').map(s => s.trim()).filter(Boolean);

    menuIds.forEach(menuId => {
      if (!map[menuId]) map[menuId] = {};
      const gk = r.group_key;
      if (!map[menuId][gk]) {
        map[menuId][gk] = {
          group_key:  gk,
          group_name: r.group_name,
          required:   String(r.required).toUpperCase() === 'TRUE',
          choices: [],
        };
      }
      map[menuId][gk].choices.push({
        choice_name:        r.choice_name,
        choice_extra_price: Number(r.choice_extra_price) || 0,
        is_default:         String(r.is_default).toUpperCase() === 'TRUE',
      });
    });
  }

  // แปลงเป็น array ของ groups
  const result = {};
  Object.keys(map).forEach(menuId => {
    result[menuId] = Object.values(map[menuId]);
  });
  return result;
}

/**
 * ตรวจสอบ options ที่ส่งมา และคำนวณราคาเพิ่ม (server-side)
 * Return: { extraPrice, optionsSummary }
 */
function validateAndPriceOptions(menuId, selectedOptions) {
  if (!selectedOptions || !Array.isArray(selectedOptions) || selectedOptions.length === 0) {
    return { extraPrice: 0, optionsSummary: '' };
  }

  let sheet;
  try { sheet = getSheet('MenuOptions'); }
  catch(e) { return { extraPrice: 0, optionsSummary: '' }; }

  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  let extraPrice = 0;
  const summaryParts = [];

  for (const sel of selectedOptions) {
    // หาแถวที่ตรงกับ group_key + choice_name + menu_id
    for (let i = 1; i < rows.length; i++) {
      const r = rowToObj(headers, rows[i]);
      const menuIds = String(r.menu_ids).split(',').map(s => s.trim());
      if (menuIds.includes(String(menuId)) &&
          r.group_key === sel.group_key &&
          r.choice_name === sel.choice_name) {
        extraPrice += Number(r.choice_extra_price) || 0;
        summaryParts.push(sel.choice_name);
        break;
      }
    }
  }

  return { extraPrice, optionsSummary: summaryParts.join(', ') };
}

/**
 * Update menu item status (Admin)
 */
function updateMenuStatusAdmin(adminKey, menuId, status) {
  requireAdmin(adminKey);
  if (!['active', 'inactive'].includes(status)) {
    throw new Error('Invalid status. Must be active or inactive');
  }
  const sheet = getSheet('Menu');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idColIdx = headers.indexOf('id');
  const statusColIdx = headers.indexOf('status');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idColIdx]) === String(menuId)) {
      sheet.getRange(i + 1, statusColIdx + 1).setValue(status);
      return { success: true, menuId, status };
    }
  }
  throw new Error('Menu item not found: ' + menuId);
}

/**
 * Get menu item by ID (internal use)
 */
function getMenuItemById(menuId) {
  const sheet = getSheet('Menu');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const idColIdx = headers.indexOf('id');
  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][idColIdx]) === String(menuId)) {
      return rowToObj(headers, rows[i]);
    }
  }
  return null;
}
