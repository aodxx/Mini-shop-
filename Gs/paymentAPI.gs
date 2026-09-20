/**
 * paymentAPI.gs - LINE Pay Integration
 */

/**
 * Create LINE Pay payment request
 */
function createPayment(orderId) {
  if (!orderId) throw new Error('orderId is required');

  // Get order details
  const orderResult = getOrder(orderId);
  const order = orderResult.order;

  if (order.paymentStatus === 'paid') {
    throw new Error('Order already paid');
  }

  // Build LINE Pay request
  const isProduction = CONFIG.LINE_PAY_ENV === 'production';
  const apiUrl = isProduction
    ? 'https://api-pay.line.me/v3/payments/request'
    : 'https://sandbox-api-pay.line.me/v3/payments/request';

  const confirmUrl = `${CONFIG.FRONTEND_URL}/order-status.html?orderId=${orderId}`;
  const cancelUrl  = `${CONFIG.FRONTEND_URL}/cart.html`;

  const nonce = Utilities.getUuid();
  const body = JSON.stringify({
    amount: Math.round(order.totalPrice),
    currency: 'THB',
    orderId: orderId,
    packages: [{
      id: orderId,
      amount: Math.round(order.totalPrice),
      name: `ออเดอร์ #${orderId}`,
      products: order.items.map(item => ({
        name: item.menuName,
        quantity: item.quantity,
        price: Math.round(item.price),
      })),
    }],
    redirectUrls: {
      confirmUrl,
      cancelUrl,
    },
  });

  // Create HMAC signature
  const signature = createLinePaySignature(
    CONFIG.LINE_PAY_CHANNEL_SECRET,
    `/v3/payments/request`,
    body,
    nonce
  );

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': CONFIG.LINE_PAY_CHANNEL_ID,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature,
    },
    payload: body,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseData = JSON.parse(response.getContentText());

  if (responseData.returnCode !== '0000') {
    logError('createPayment', new Error(responseData.returnMessage), { orderId });
    throw new Error('LINE Pay error: ' + responseData.returnMessage);
  }

  const paymentUrl = responseData.info.paymentUrl.web;
  const transactionId = responseData.info.transactionId;

  // Store transactionId for later confirmation
  storeTransactionId(orderId, String(transactionId));

  logInfo('createPayment', `Payment created for order ${orderId}, tx: ${transactionId}`);

  return {
    success: true,
    orderId,
    paymentUrl,
    transactionId: String(transactionId),
  };
}

/**
 * Confirm payment after LINE Pay callback
 */
function updatePaymentStatus(orderId, transactionId) {
  if (!orderId) throw new Error('orderId is required');

  // 1. Confirm with LINE Pay API
  const isProduction = CONFIG.LINE_PAY_ENV === 'production';
  const apiUrl = isProduction
    ? `https://api-pay.line.me/v3/payments/${transactionId}/confirm`
    : `https://sandbox-api-pay.line.me/v3/payments/${transactionId}/confirm`;

  const orderResult = getOrder(orderId);
  const order = orderResult.order;

  if (order.paymentStatus === 'paid') {
    return { success: true, message: 'Already paid' };
  }

  const nonce = Utilities.getUuid();
  const body = JSON.stringify({
    amount: Math.round(order.totalPrice),
    currency: 'THB',
  });

  const signature = createLinePaySignature(
    CONFIG.LINE_PAY_CHANNEL_SECRET,
    `/v3/payments/${transactionId}/confirm`,
    body,
    nonce
  );

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-LINE-ChannelId': CONFIG.LINE_PAY_CHANNEL_ID,
      'X-LINE-Authorization-Nonce': nonce,
      'X-LINE-Authorization': signature,
    },
    payload: body,
    muteHttpExceptions: true,
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const responseData = JSON.parse(response.getContentText());

  if (responseData.returnCode !== '0000') {
    logError('confirmPayment', new Error(responseData.returnMessage), { orderId, transactionId });
    throw new Error('Payment confirmation failed: ' + responseData.returnMessage);
  }

  // 2. Update order payment status in sheet
  updateOrderPaymentStatus(orderId, 'paid');
  updateOrderStatusAdmin(CONFIG.ADMIN_KEY, orderId, 'paid');

  // 3. Notify restaurant
  notifyRestaurant(orderId, order);

  logInfo('updatePaymentStatus', `Payment confirmed for order ${orderId}`);

  return { success: true, orderId, status: 'paid' };
}

/**
 * Create LINE Pay HMAC-SHA256 signature
 */
function createLinePaySignature(secret, uri, body, nonce) {
  const message = secret + uri + body + nonce;
  const signature = Utilities.computeHmacSha256Signature(
    Utilities.newBlob(message).getBytes(),
    Utilities.newBlob(secret).getBytes()
  );
  return Utilities.base64Encode(signature);
}

/**
 * Store transaction ID in Orders sheet
 */
function storeTransactionId(orderId, transactionId) {
  const sheet = getSheet('Orders');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const orderIdIdx = headers.indexOf('order_id');

  // Add transaction_id column if not exists
  let txIdx = headers.indexOf('transaction_id');
  if (txIdx < 0) {
    txIdx = headers.length;
    sheet.getRange(1, txIdx + 1).setValue('transaction_id');
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderIdIdx]) === String(orderId)) {
      sheet.getRange(i + 1, txIdx + 1).setValue(transactionId);
      return;
    }
  }
}

/**
 * Update payment status column in Orders sheet
 */
function updateOrderPaymentStatus(orderId, paymentStatus) {
  const sheet = getSheet('Orders');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const orderIdIdx = headers.indexOf('order_id');
  const payStatusIdx = headers.indexOf('payment_status');

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderIdIdx]) === String(orderId)) {
      sheet.getRange(i + 1, payStatusIdx + 1).setValue(paymentStatus);
      return;
    }
  }
}
