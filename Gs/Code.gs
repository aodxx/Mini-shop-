/**
 * Code.gs - Main Entry Point for Restaurant Backend
 * Google Apps Script Web App
 * Deploy as: Execute as Me, Anyone can access
 */

// ===== CONFIGURATION =====
const CONFIG = {
  SHEET_ID:                  'YOUR_GOOGLE_SHEET_ID',
  ADMIN_KEY:                 'CHANGE_ME_ADMIN_KEY',
  LINE_CHANNEL_ACCESS_TOKEN: 'YOUR_LINE_CHANNEL_ACCESS_TOKEN',
  LINE_OWNER_USER_ID:        'YOUR_LINE_USER_OR_GROUP_ID',
  LINE_GROUP_ID:             'YOUR_LINE_USER_OR_GROUP_ID',
  LINE_PAY_CHANNEL_ID:       '',   // ยังไม่ใช้งาน — จะเพิ่มทีหลังเมื่อสมัคร LINE Pay
  LINE_PAY_CHANNEL_SECRET:   '',   // ยังไม่ใช้งาน
  LINE_PAY_ENV:              'sandbox',
  FRONTEND_URL:              'https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY',
};

// ===== CORS HEADERS =====
function setCorsHeaders(output) {
  return output;
}

// ===== MAIN ROUTER =====
function doGet(e) {
  const params = e.parameter;
  const action = params.action;
  try {
    let result;
    switch (action) {
      case 'getMenu':           result = getMenu(); break;
      case 'getOrder':          result = getOrder(params.orderId); break;
      case 'createPayment':     result = createPayment(params.orderId); break;
      case 'getOrders':         result = getOrdersAdmin(params.adminKey, params.date); break;
      case 'updateOrderStatus': result = updateOrderStatusAdmin(params.adminKey, params.orderId, params.status); break;
      case 'getSalesReport':    result = getSalesReport(params.adminKey); break;
      case 'quickDone':         result = quickDone(params.adminKey, params.orderId); break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return setCorsHeaders(
      ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
    );
  } catch (err) {
    logError('doGet', err, params);
    return setCorsHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
}

function doPost(e) {
  const params = e.parameter;
  const action = params.action;
  let body = {};
  try {
    if (e.postData && e.postData.contents) body = JSON.parse(e.postData.contents);
  } catch (err) {
    return setCorsHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: 'Invalid JSON body' }))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
  try {
    let result;
    switch (action) {
      case 'createOrder':         result = createOrder(body); break;
      case 'updatePaymentStatus': result = updatePaymentStatus(body.orderId, body.transactionId); break;
      case 'updateOrderStatus':   result = updateOrderStatusAdmin(params.adminKey, body.orderId, body.status); break;
      case 'updateMenuStatus':    result = updateMenuStatusAdmin(params.adminKey, body.menuId, body.status); break;
      default: result = { error: 'Unknown action: ' + action };
    }
    return setCorsHeaders(
      ContentService.createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON)
    );
  } catch (err) {
    logError('doPost', err, { action, body });
    return setCorsHeaders(
      ContentService.createTextOutput(JSON.stringify({ error: err.message }))
        .setMimeType(ContentService.MimeType.JSON)
    );
  }
}

function doOptions(e) {
  return setCorsHeaders(
    ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT)
  );
}

function requireAdmin(adminKey) {
  if (adminKey !== CONFIG.ADMIN_KEY) throw new Error('Unauthorized: Invalid admin key');
}

/**
 * ปุ่ม "✅ ทำเสร็จแล้ว" จาก Flex Message กลุ่มครัว
 */
function quickDone(adminKey, orderId) {
  requireAdmin(adminKey);
  updateOrderStatusAdmin(adminKey, orderId, 'done');
  return { success: true, message: `✅ ออเดอร์ #${orderId} เสร็จแล้ว! แจ้งลูกค้าแล้ว` };
}
