/**
 * orderAPI.gs - Order Management (with Options + Notifications + Delivery)
 */

function createOrder(body) {
  const { userId, customerName, items, note, paymentMethod, deliveryType, deliveryLat, deliveryLng, deliveryAddress, deliveryDistanceKm, deliveryFee } = body;
  
  if (!userId) throw new Error('userId is required');
  if (!items || !Array.isArray(items) || items.length === 0)
    throw new Error('items array is required');

  let totalPrice = 0;
  const validatedItems = [];

  for (const item of items) {
    const menuItem = getMenuItemById(item.menuId);
    if (!menuItem) throw new Error('Invalid menu item: ' + item.menuId);
    if (menuItem.status === 'inactive') throw new Error('Menu item unavailable: ' + menuItem.name);
    if (!item.qty || item.qty < 1) throw new Error('Invalid qty for: ' + menuItem.name);

    const qty = parseInt(item.qty);
    const basePrice = Number(menuItem.price);

    const { extraPrice, optionsSummary } = validateAndPriceOptions(
      item.menuId,
      item.selectedOptions || []
    );

    const unitPrice = basePrice + extraPrice;
    totalPrice += unitPrice * qty;
    
    validatedItems.push({
      menuId:          String(menuItem.id),
      menuName:        menuItem.name,
      price:           unitPrice,
      basePrice:       basePrice,
      extraPrice:      extraPrice,
      quantity:        qty,
      optionsSummary:  optionsSummary,
      selectedOptions: item.selectedOptions || [],
    });
  }
  
  // เพิ่มค่าจัดส่งถ้ามี
  const finalTotal = totalPrice + (deliveryFee ? Number(deliveryFee) : 0);

  const orderId = generateOrderId();
  const now = new Date();

  // บันทึก Orders - เพิ่มฟิลด์จัดส่ง
  const ordersSheet = getSheet('Orders');
  let orderRow = [
    orderId, userId, customerName || 'Guest',
    finalTotal, 'pending', 'unpaid',
    now.toISOString(), note || '',
  ];
  
  // เพิ่มข้อมูลจัดส่งถ้าเป็น delivery
  if (deliveryType === 'delivery') {
    orderRow.push(deliveryLat || '');
    orderRow.push(deliveryLng || '');
    orderRow.push(deliveryAddress || '');
    orderRow.push(deliveryDistanceKm || 0);
    orderRow.push(deliveryFee || 0);
  } else {
    orderRow.push('pickup'); // lat
    orderRow.push(''); // lng
    orderRow.push(''); // address
    orderRow.push(0); // distance
    orderRow.push(0); // fee
  }
  
  ordersSheet.appendRow(orderRow);

  // บันทึก OrderItems
  const itemsSheet = getSheet('OrderItems');
  for (const item of validatedItems) {
    itemsSheet.appendRow([
      orderId, item.menuId, item.menuName,
      item.price, item.quantity, item.optionsSummary,
    ]);
  }

  upsertCustomer(userId, customerName, now);
  logInfo('createOrder', `Order ${orderId} created for ${userId}, type: ${deliveryType || 'pickup'}`);

  // ✅ แจ้งกลุ่มครัวทันทีถ้าเป็นเงินสด (LINE Pay จะแจ้งหลังชำระสำเร็จ)
  const pm = paymentMethod || '';
  if (pm !== 'linepay') {
    notifyRestaurant(orderId, {
      customerName: customerName || 'Guest',
      totalPrice: finalTotal,
      paymentMethod: pm,
      note: note || '',
      items: validatedItems,
      deliveryType: deliveryType || 'pickup',
      deliveryLat, deliveryLng, deliveryAddress, deliveryDistanceKm, deliveryFee
    });
  }

  return { success: true, orderId, totalPrice: finalTotal };
}

function getOrder(orderId) {
  if (!orderId) throw new Error('orderId is required');

  const ordersSheet = getSheet('Orders');
  const rows = ordersSheet.getDataRange().getValues();
  const headers = rows[0];
  let order = null;

  for (let i = 1; i < rows.length; i++) {
    const row = rowToObj(headers, rows[i]);
    if (String(row.order_id) === String(orderId)) {
      order = {
        orderId:       String(row.order_id),
        userId:        row.user_id,
        customerName:  row.customer_name,
        totalPrice:    Number(row.total_price),
        status:        row.status,
        paymentStatus: row.payment_status,
        createdAt:     row.created_at,
        note:          row.note || '',
        deliveryType:  row.delivery_type || 'pickup',
        deliveryLat:   row.delivery_lat,
        deliveryLng:   row.delivery_lng,
        deliveryAddress: row.delivery_address,
        deliveryDistanceKm: row.delivery_distance_km,
        deliveryFee:   row.delivery_fee,
      };
      break;
    }
  }
  if (!order) throw new Error('Order not found: ' + orderId);

  const itemsSheet = getSheet('OrderItems');
  const itemRows = itemsSheet.getDataRange().getValues();
  const itemHeaders = itemRows[0];
  order.items = [];

  for (let i = 1; i < itemRows.length; i++) {
    const item = rowToObj(itemHeaders, itemRows[i]);
    if (String(item.order_id) === String(orderId)) {
      order.items.push({
        menuId:         item.menu_id,
        menuName:       item.menu_name,
        price:          Number(item.price),
        quantity:       Number(item.quantity),
        optionsSummary: item.options_summary || '',
      });
    }
  }
  return { success: true, order };
}

function getOrdersAdmin(adminKey, date) {
  requireAdmin(adminKey);

  const ordersSheet = getSheet('Orders');
  const rows = ordersSheet.getDataRange().getValues();
  const headers = rows[0];
  let orders = [];
  const filterDate = date || getTodayString();

  for (let i = 1; i < rows.length; i++) {
    const row = rowToObj(headers, rows[i]);
    const orderDate = row.created_at
      ? new Date(row.created_at).toISOString().slice(0, 10) : '';
    if (!date || orderDate === filterDate) {
      orders.push({
        orderId:       String(row.order_id),
        userId:        row.user_id,
        customerName:  row.customer_name,
        totalPrice:    Number(row.total_price),
        status:        row.status,
        paymentStatus: row.payment_status,
        createdAt:     row.created_at,
        note:          row.note || '',
        cancelReason:  row.cancel_reason || '',
        deliveryType:  row.delivery_type || 'pickup',
        deliveryLat:   row.delivery_lat,
        deliveryLng:   row.delivery_lng,
        deliveryAddress: row.delivery_address,
        deliveryDistanceKm: row.delivery_distance_km,
        deliveryFee:   row.delivery_fee,
      });
    }
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const itemsSheet = getSheet('OrderItems');
  const itemRows = itemsSheet.getDataRange().getValues();
  const itemHeaders = itemRows[0];
  const itemsMap = {};

  for (let i = 1; i < itemRows.length; i++) {
    const item = rowToObj(itemHeaders, itemRows[i]);
    const oid = String(item.order_id);
    if (!itemsMap[oid]) itemsMap[oid] = [];
    itemsMap[oid].push({
      menuName:       item.menu_name,
      price:          Number(item.price),
      quantity:       Number(item.quantity),
      optionsSummary: item.options_summary || '',
    });
  }

  orders = orders.map(o => ({ ...o, items: itemsMap[o.orderId] || [] }));

  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'paid')
    .reduce((sum, o) => sum + o.totalPrice, 0);

  return {
    success: true, orders,
    stats: { totalOrders: orders.length, totalRevenue, date: filterDate }
  };
}

function updateOrderStatusAdmin(adminKey, orderId, status, body) {
  requireAdmin(adminKey);

  const validStatuses = ['pending', 'paid', 'cooking', 'done', 'cancelled'];
  if (!validStatuses.includes(status)) throw new Error('Invalid status: ' + status);

  const sheet = getSheet('Orders');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const orderIdIdx = headers.indexOf('order_id');
  const statusIdx  = headers.indexOf('status');

  let cancelReasonIdx = headers.indexOf('cancel_reason');
  if (cancelReasonIdx < 0 && status === 'cancelled') {
    cancelReasonIdx = headers.length;
    sheet.getRange(1, cancelReasonIdx + 1).setValue('cancel_reason');
  }

  for (let i = 1; i < rows.length; i++) {
    if (String(rows[i][orderIdIdx]) === String(orderId)) {
      sheet.getRange(i + 1, statusIdx + 1).setValue(status);

      // ✅ แจ้งลูกค้าเมื่ออาหารพร้อม
      if (status === 'done') {
        const order = rowToObj(headers, rows[i]);
        notifyCustomerDone(order.user_id, orderId);
      }

      // ✅ แจ้งลูกค้าเมื่อเริ่มทำ
      if (status === 'cooking') {
        const order = rowToObj(headers, rows[i]);
        notifyCustomerCooking(order.user_id, orderId);
      }

      // ✅ แจ้งลูกค้าเมื่อยกเลิก
      if (status === 'cancelled' && cancelReasonIdx >= 0) {
        const reason = body && body.reason ? body.reason : 'ยกเลิกโดยร้าน';
        sheet.getRange(i + 1, cancelReasonIdx + 1).setValue(reason);
        const order = rowToObj(headers, rows[i]);
        notifyCustomerCancelled(order.user_id, orderId, reason);
      }

      logInfo('updateOrderStatus', `Order ${orderId} -> ${status}`);
      return { success: true, orderId, status };
    }
  }
  throw new Error('Order not found: ' + orderId);
}

function getSalesReport(adminKey) {
  requireAdmin(adminKey);
  const result = getOrdersAdmin(adminKey, getTodayString());
  return {
    success: true,
    date:          result.stats.date,
    totalOrders:   result.stats.totalOrders,
    totalRevenue:  result.stats.totalRevenue,
    paidOrders:    result.orders.filter(o => o.paymentStatus === 'paid').length,
    pendingOrders: result.orders.filter(o => o.status === 'pending').length,
    cookingOrders: result.orders.filter(o => o.status === 'cooking').length,
    doneOrders:    result.orders.filter(o => o.status === 'done').length,
  };
}

function upsertCustomer(userId, displayName, time) {
  const sheet = getSheet('Customers');
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const userIdIdx = headers.indexOf('user_id');
  for (let i = 1; i < rows.length; i++) {
    if (rows[i][userIdIdx] === userId) {
      const nameIdx = headers.indexOf('display_name');
      const timeIdx = headers.indexOf('last_order_time');
      if (nameIdx >= 0) sheet.getRange(i+1, nameIdx+1).setValue(displayName);
      if (timeIdx >= 0) sheet.getRange(i+1, timeIdx+1).setValue(time.toISOString());
      return;
    }
  }
  sheet.appendRow([userId, displayName || '', time.toISOString()]);
}

function getTodayString() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
