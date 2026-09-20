/**
 * utils.gs - Utilities + LINE Flex Message Notifications
 */

// ===== SHEET HELPERS =====
function getSheet(name) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error(`Sheet "${name}" not found`);
  return sheet;
}

function rowToObj(headers, row) {
  const obj = {};
  headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ''; });
  return obj;
}

function generateOrderId() {
  const date = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd');
  return `ORD-${date}-${Math.floor(1000 + Math.random() * 9000)}`;
}

// ===== LOGGING =====
function logInfo(fn, message) {
  console.log(`[INFO][${fn}] ${message}`);
  try { getSheet('Logs').appendRow([new Date().toISOString(), 'INFO', fn, message]); } catch {}
}

function logError(fn, err, context) {
  const msg = err?.message || String(err);
  console.error(`[ERROR][${fn}] ${msg}`, context || '');
  try { getSheet('Logs').appendRow([new Date().toISOString(), 'ERROR', fn, msg, JSON.stringify(context||{})]); } catch {}
}

// ===== CORE LINE SEND =====
function sendLineMessages(to, messages) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !to) return;
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CONFIG.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    payload: JSON.stringify({ to, messages }),
    muteHttpExceptions: true,
  };
  try {
    const res = UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', options);
    if (res.getResponseCode() !== 200) {
      logError('sendLineMessages', new Error(res.getContentText()), { to });
    }
  } catch (err) {
    logError('sendLineMessages', err, { to });
  }
}

// ===== HELPERS =====
function thaiTime() {
  return Utilities.formatDate(new Date(), 'Asia/Bangkok', 'HH:mm น.');
}

function paymentLabel(method) {
  return method === 'linepay' ? '💚 LINE Pay' : '💵 เงินสดที่ร้าน';
}

function getGasUrl() {
  return ScriptApp.getService().getUrl();
}

// ============================================================
//  🔔 NOTIFY RESTAURANT — Flex Message เข้ากลุ่มครัว
// ============================================================
function notifyRestaurant(orderId, order) {
  const groupId = CONFIG.LINE_GROUP_ID;
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !groupId) return;

  const items = (order.items || []);
  const itemRows = items.map(i => {
    const opt = i.optionsSummary ? `  (${i.optionsSummary})` : '';
    return {
      type: 'box', layout: 'horizontal', spacing: 'sm',
      contents: [
        { type: 'text', text: `• ${i.menuName}${opt}`, size: 'sm', color: '#333333', flex: 3, wrap: true },
        { type: 'text', text: `× ${i.quantity}`, size: 'sm', color: '#555555', flex: 1, align: 'end' },
      ]
    };
  });

  const adminUrl = `${CONFIG.FRONTEND_URL}/admin.html`;
  const doneUrl  = `${getGasUrl()}?action=quickDone&adminKey=${CONFIG.ADMIN_KEY}&orderId=${orderId}`;
  
  // เพิ่มข้อมูลจัดส่งถ้ามี
  const isDelivery = order.deliveryType === 'delivery';
  let deliveryInfo = [];
  if (isDelivery && order.deliveryLat && order.deliveryLng) {
    const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLat},${order.deliveryLng}`;
    deliveryInfo = [
      { type: 'separator', color: '#F5E6C8' },
      {
        type: 'box', layout: 'horizontal', spacing: 'sm',
        contents: [
          { type: 'text', text: '🛵', size: 'sm', flex: 0 },
          { type: 'text', text: 'จัดส่งถึงที่', weight: 'bold', size: 'md', color: '#D97706', flex: 1 },
        ]
      },
      {
        type: 'box', layout: 'horizontal', spacing: 'xs', margin: 'sm',
        contents: [
          { type: 'text', text: '📍', size: 'sm', flex: 0 },
          { type: 'text', text: `ละติจูด: ${order.deliveryLat}`, size: 'xs', color: '#555555', flex: 1, wrap: true },
        ]
      },
      {
        type: 'box', layout: 'horizontal', spacing: 'xs',
        contents: [
          { type: 'text', text: '📍', size: 'sm', flex: 0 },
          { type: 'text', text: `ลองจิจูด: ${order.deliveryLng}`, size: 'xs', color: '#555555', flex: 1, wrap: true },
        ]
      },
      ...(order.deliveryDistanceKm ? [{
        type: 'box', layout: 'horizontal', spacing: 'xs', margin: 'sm',
        contents: [
          { type: 'text', text: '📏', size: 'sm', flex: 0 },
          { type: 'text', text: `ระยะทาง: ${order.deliveryDistanceKm} กม.`, size: 'xs', color: '#555555', flex: 1 },
        ]
      }] : []),
      ...(order.deliveryFee ? [{
        type: 'box', layout: 'horizontal', spacing: 'xs',
        contents: [
          { type: 'text', text: '💰', size: 'sm', flex: 0 },
          { type: 'text', text: `ค่าจัดส่ง: ฿${order.deliveryFee}`, size: 'xs', color: '#D97706', flex: 1, weight: 'bold' },
        ]
      }] : []),
      {
        type: 'button', style: 'primary', color: '#3B82F6', height: 'sm', margin: 'sm',
        action: { type: 'uri', label: '🗺️ นำทาง Google Maps', uri: mapsUrl }
      },
    ];
  }

  const flex = {
    type: 'flex',
    altText: `🔔 ออเดอร์ใหม่! #${orderId} — ${order.customerName}` + (isDelivery ? ' (จัดส่ง)' : ''),
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: isDelivery ? '#D97706' : '#D4860A',
        contents: [
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: isDelivery ? '🛵 ออเดอร์จัดส่ง!' : '🔔 ออเดอร์ใหม่!', weight: 'bold', size: 'lg', color: '#FFFFFF', flex: 1 },
              { type: 'text', text: thaiTime(), size: 'sm', color: 'rgba(255,255,255,0.8)', align: 'end', flex: 0 },
            ]
          },
          { type: 'text', text: `#${orderId}`, size: 'sm', color: 'rgba(255,255,255,0.7)', margin: 'xs' },
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          // ชื่อลูกค้า
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: '👤', size: 'sm', flex: 0 },
              { type: 'text', text: order.customerName || 'Guest', weight: 'bold', size: 'md', color: '#1A0A00', flex: 1 },
            ]
          },
          { type: 'separator', color: '#F5E6C8' },
          // รายการอาหาร
          { type: 'text', text: 'รายการอาหาร', size: 'xs', color: '#888888', weight: 'bold' },
          ...itemRows,
          { type: 'separator', color: '#F5E6C8' },
          // หมายเหตุ (ถ้ามี)
          ...(order.note ? [{
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: '📝', size: 'sm', flex: 0 },
              { type: 'text', text: order.note, size: 'sm', color: '#C0392B', flex: 1, wrap: true },
            ]
          }] : []),
          // ข้อมูลจัดส่ง (ถ้ามี)
          ...deliveryInfo,
          { type: 'separator', color: '#F5E6C8' },
          // วิธีชำระ + ยอดเงิน
          {
            type: 'box', layout: 'horizontal', spacing: 'sm',
            contents: [
              { type: 'text', text: paymentLabel(order.paymentMethod), size: 'sm', color: '#555555', flex: 1 },
              { type: 'text', text: `฿${Number(order.totalPrice).toLocaleString()}`, weight: 'bold', size: 'lg', color: '#D4860A', flex: 0 },
            ]
          },
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '12px',
        contents: [
          {
            type: 'button', style: 'primary', color: '#1A0A00', height: 'sm',
            action: { type: 'uri', label: '🔧 เปิดหน้าจัดการ', uri: adminUrl }
          },
          {
            type: 'button', style: 'primary', color: '#06C755', height: 'sm',
            action: { type: 'uri', label: '✅ ทำเสร็จแล้ว', uri: doneUrl }
          },
        ]
      }
    }
  };

  sendLineMessages(groupId, [flex]);
  logInfo('notifyRestaurant', `Flex sent to group for order ${orderId}`);
}

// ============================================================
//  📱 NOTIFY CUSTOMER — อาหารพร้อม
// ============================================================
function notifyCustomerDone(userId, orderId) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !userId) return;

  const orderResult = getOrder(orderId);
  const order = orderResult.order;
  const statusUrl = `${CONFIG.FRONTEND_URL}/order-status.html?orderId=${orderId}`;

  const itemRows = (order.items || []).map(i => ({
    type: 'box', layout: 'horizontal', spacing: 'sm',
    contents: [
      { type: 'text', text: `🍽️ ${i.menuName}${i.optionsSummary ? ' ('+i.optionsSummary+')' : ''}`, size: 'sm', color: '#333333', flex: 3, wrap: true },
      { type: 'text', text: `× ${i.quantity}`, size: 'sm', color: '#555555', flex: 1, align: 'end' },
    ]
  }));

  const flex = {
    type: 'flex',
    altText: `✅ อาหารของคุณพร้อมแล้ว! ออเดอร์ #${orderId}`,
    contents: {
      type: 'bubble',
      header: {
        type: 'box', layout: 'vertical', paddingAll: '16px',
        backgroundColor: '#06C755',
        contents: [
          { type: 'text', text: '✅ อาหารพร้อมแล้ว!', weight: 'bold', size: 'xl', color: '#FFFFFF' },
          { type: 'text', text: `ออเดอร์ #${orderId}`, size: 'sm', color: 'rgba(255,255,255,0.8)', margin: 'xs' },
        ]
      },
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
        contents: [
          { type: 'text', text: 'กรุณามารับอาหารได้เลยครับ/ค่ะ 🙏', size: 'sm', color: '#333333', wrap: true },
          { type: 'separator', color: '#E8F9EE' },
          { type: 'text', text: 'รายการอาหาร', size: 'xs', color: '#888888', weight: 'bold' },
          ...itemRows,
          { type: 'separator', color: '#E8F9EE' },
          {
            type: 'box', layout: 'horizontal',
            contents: [
              { type: 'text', text: 'ยอดรวม', size: 'sm', color: '#555555', flex: 1 },
              { type: 'text', text: `฿${Number(order.totalPrice).toLocaleString()}`, weight: 'bold', size: 'lg', color: '#048A3A', flex: 0 },
            ]
          },
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{
          type: 'button', style: 'primary', color: '#06C755', height: 'sm',
          action: { type: 'uri', label: '📋 ดูรายละเอียดออเดอร์', uri: statusUrl }
        }]
      }
    }
  };

  sendLineMessages(userId, [flex]);
  logInfo('notifyCustomerDone', `Done Flex sent to ${userId} for order ${orderId}`);
}

// ============================================================
//  📱 NOTIFY CUSTOMER — กำลังทำอาหาร
// ============================================================
function notifyCustomerCooking(userId, orderId) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !userId) return;

  const statusUrl = `${CONFIG.FRONTEND_URL}/order-status.html?orderId=${orderId}`;

  const flex = {
    type: 'flex',
    altText: `👨‍🍳 รับออเดอร์แล้ว! กำลังทำ #${orderId}`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '20px',
        contents: [
          { type: 'text', text: '👨‍🍳', size: '3xl', align: 'center' },
          { type: 'text', text: 'รับออเดอร์แล้ว!', weight: 'bold', size: 'xl', align: 'center', color: '#D4860A' },
          { type: 'text', text: 'กำลังทำอาหารสำหรับคุณแล้ว', size: 'sm', align: 'center', color: '#555555', wrap: true },
          { type: 'text', text: `ออเดอร์ #${orderId}`, size: 'xs', align: 'center', color: '#AAAAAA', margin: 'sm' },
        ]
      },
      footer: {
        type: 'box', layout: 'vertical', paddingAll: '12px',
        contents: [{
          type: 'button', style: 'secondary', height: 'sm',
          action: { type: 'uri', label: '📋 ติดตามสถานะ', uri: statusUrl }
        }]
      }
    }
  };

  sendLineMessages(userId, [flex]);
  logInfo('notifyCustomerCooking', `Cooking Flex sent to ${userId}`);
}

// ============================================================
//  ❌ NOTIFY CUSTOMER — ยกเลิกออเดอร์
// ============================================================
function notifyCustomerCancelled(userId, orderId, reason) {
  if (!CONFIG.LINE_CHANNEL_ACCESS_TOKEN || !userId) return;

  const flex = {
    type: 'flex',
    altText: `❌ ออเดอร์ #${orderId} ถูกยกเลิก`,
    contents: {
      type: 'bubble',
      body: {
        type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '20px',
        contents: [
          { type: 'text', text: '❌', size: '3xl', align: 'center' },
          { type: 'text', text: 'ออเดอร์ถูกยกเลิก', weight: 'bold', size: 'xl', align: 'center', color: '#C0392B' },
          { type: 'text', text: `ออเดอร์ #${orderId}`, size: 'sm', align: 'center', color: '#AAAAAA' },
          { type: 'separator', margin: 'md' },
          {
            type: 'box', layout: 'horizontal', margin: 'md',
            contents: [
              { type: 'text', text: 'เหตุผล:', size: 'sm', color: '#555555', flex: 0 },
              { type: 'text', text: reason, size: 'sm', color: '#C0392B', flex: 1, margin: 'sm', wrap: true },
            ]
          },
          { type: 'text', text: 'ขออภัยในความไม่สะดวกครับ/ค่ะ', size: 'xs', align: 'center', color: '#AAAAAA', margin: 'md' },
        ]
      }
    }
  };

  sendLineMessages(userId, [flex]);
  logInfo('notifyCustomerCancelled', `Cancel Flex sent to ${userId}`);
}

// ===== SETUP HELPERS =====
function setupSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  createSheetIfNotExists(ss, 'Menu',       ['id','name','description','price','image_url','category','status']);
  createSheetIfNotExists(ss, 'Orders',     ['order_id','user_id','customer_name','total_price','status','payment_status','created_at','note','transaction_id','delivery_type','delivery_lat','delivery_lng','delivery_address','delivery_distance_km','delivery_fee']);
  createSheetIfNotExists(ss, 'OrderItems', ['order_id','menu_id','menu_name','price','quantity','options_summary']);
  createSheetIfNotExists(ss, 'Customers',  ['user_id','display_name','last_order_time']);
  createSheetIfNotExists(ss, 'Logs',       ['timestamp','level','function','message','context']);
  Logger.log('✅ All sheets created!');
}

function createSheetIfNotExists(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length).setBackground('#06C755').setFontColor('#FFFFFF').setFontWeight('bold');
  }
  return sheet;
}

function seedSampleMenu() {
  const sheet = getSheet('Menu');
  const items = [
    [1,'ก๋วยเตี๋ยวหมู','น้ำใสหรือน้ำตก',60,'','ก๋วยเตี๋ยว','active'],
    [2,'ก๋วยเตี๋ยวเนื้อ','น้ำใสเนื้อตุ๋น',70,'','ก๋วยเตี๋ยว','active'],
    [3,'ข้าวหมูแดง','ราดซอส',60,'','ข้าว','active'],
    [4,'ข้าวหมูกรอบ','กับน้ำจิ้ม',60,'','ข้าว','active'],
    [5,'ผัดไทยกุ้งสด','ไข่ใส่ถั่วงอก',80,'','อาหารจานเดียว','active'],
    [6,'ข้าวผัดหมู','ไข่ดาว',70,'','ข้าว','active'],
    [7,'ต้มยำกุ้ง','น้ำข้น รสจัด',120,'','อาหารจานเดียว','active'],
    [8,'แกงเขียวหวานไก่','ใส่มะเขือ',90,'','อาหารจานเดียว','active'],
    [9,'ผัดกะเพราหมูสับ','ไข่ดาว',70,'','ข้าว','active'],
    [10,'ผัดกะเพราไก่','ไข่ดาว',70,'','ข้าว','active'],
    [11,'น้ำเปล่า','600ml',10,'','เครื่องดื่ม','active'],
    [12,'น้ำส้มคั้น','สดคั้น',35,'','เครื่องดื่ม','active'],
    [13,'ชาเย็น','หวาน',30,'','เครื่องดื่ม','active'],
    [14,'กาแฟเย็น','สด',35,'','เครื่องดื่ม','active'],
    [15,'น้ำแข็ง','ถุง',5,'','เครื่องดื่ม','active'],
  ];
  items.forEach(r => sheet.appendRow(r));
  Logger.log('✅ Menu seeded!');
}

function setupMenuOptions() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  createSheetIfNotExists(ss, 'MenuOptions', ['option_id','menu_ids','group_name','group_key','required','choice_name','choice_extra_price','is_default']);
  Logger.log('✅ MenuOptions ready!');
}

function seedMenuOptions() {
  const sheet = getSheet('MenuOptions');
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  const data = [
    ['OPT001','1,2','เลือกเส้น','noodle_type','TRUE','เส้นเล็ก','0','TRUE'],
    ['OPT002','1,2','เลือกเส้น','noodle_type','TRUE','เส้นใหญ่','0','FALSE'],
    ['OPT003','1,2','เลือกเส้น','noodle_type','TRUE','หมี่เหลือง','0','FALSE'],
    ['OPT004','1','น้ำซุป','soup_type','TRUE','น้ำใส','0','TRUE'],
    ['OPT005','1','น้ำซุป','soup_type','TRUE','ต้มยำ','0','FALSE'],
    ['OPT006','9,10','เลือกเนื้อ','meat_type','TRUE','หมูสับ','0','TRUE'],
    ['OPT007','9,10','เลือกเนื้อ','meat_type','TRUE','หมูกรอบ','0','FALSE'],
    ['OPT008','9,10','เลือกไข่','egg_type','TRUE','ไข่ดาว','5','TRUE'],
    ['OPT009','9,10','เลือกไข่','egg_type','TRUE','ไข่เจียว','5','FALSE'],
    ['OPT010','9,10','เลือกไข่','egg_type','TRUE','ไม่เอาไข่','0','FALSE'],
  ];
  data.forEach(r => sheet.appendRow(r));
  Logger.log('✅ MenuOptions seeded!');
}
