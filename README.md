# 🍜 ร้านอาหาร LINE Mini App

ระบบสั่งอาหารออนไลน์ผ่าน LINE สำหรับร้านอาหารขนาดเล็ก  
พัฒนาด้วย HTML/CSS/JavaScript + Google Apps Script + Google Sheets

**🌐 Live URL:** https://aod3826.github.io/Linemini-/  
**📱 LINE Mini App:** https://liff.line.me/YOUR_LIFF_ID

---

## 📋 สถานะการพัฒนา (Development Status)

| ฟีเจอร์ | สถานะ | หมายเหตุ |
|---------|--------|---------|
| หน้าหลัก + แสดงชื่อ LINE | ✅ เสร็จแล้ว | |
| เมนูอาหาร + Filter หมวดหมู่ | ✅ เสร็จแล้ว | |
| ตะกร้าสินค้า | ✅ เสร็จแล้ว | |
| หมายเหตุถึงร้าน | ✅ เสร็จแล้ว | |
| หน้าสรุปออเดอร์ | ✅ เสร็จแล้ว | |
| ชำระเงินสดที่ร้าน | ✅ เสร็จแล้ว | |
| ติดตามสถานะออเดอร์ | ✅ เสร็จแล้ว | |
| Admin Panel (หลังร้าน) | ✅ เสร็จแล้ว | |
| จอครัว (Kitchen Display) | ✅ เสร็จแล้ว | |
| รูปภาพเมนู | ⚠️ บางส่วน | มีโครงสร้างแล้ว รอใส่รูปใน Sheets |
| LINE Pay | 🔧 รอตั้งค่า | ต้องสมัคร LINE Pay Merchant |
| แจ้งเตือนร้านผ่าน LINE | 🔧 รอตั้งค่า | ต้องใส่ LINE_OWNER_USER_ID |

---

## 🏗️ สถาปัตยกรรมระบบ (Architecture)

```
ลูกค้าใน LINE
      ↓
LINE Mini App (LIFF ID: YOUR_LIFF_ID)
      ↓
Frontend — GitHub Pages (HTML/CSS/JS)
https://aod3826.github.io/Linemini-/
      ↓
Backend API — Google Apps Script
https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec
      ↓
Database — Google Sheets
(Menu / Orders / OrderItems / Customers / Logs)
      ↓
Image Storage — Google Drive
```

---

## 📁 โครงสร้างไฟล์ (File Structure)

```
Linemini-/
│
├── 📄 index.html            # หน้าหลัก — ทักทายลูกค้าด้วยชื่อ LINE
├── 📄 menu.html             # หน้าเมนูอาหาร — แสดง grid + filter หมวดหมู่
├── 📄 cart.html             # ตะกร้าสินค้า — เพิ่ม/ลด/ลบ + หมายเหตุ
├── 📄 checkout.html         # สรุปออเดอร์ — เลือกชำระ LINE Pay หรือเงินสด
├── 📄 order-status.html     # ติดตามสถานะออเดอร์ — stepper + auto-refresh
├── 📄 admin.html            # Admin Panel — ดูออเดอร์, เปลี่ยนสถานะ, toggle เมนู
├── 📄 kitchen.html          # จอครัว — แสดงออเดอร์ real-time, กด "เสร็จแล้ว"
│
├── 📁 css/
│   └── style.css            # Stylesheet หลักทั้งระบบ (LINE Green theme)
│
└── 📁 js/
    ├── app.js               # LIFF init, utilities, formatting, navigation
    ├── api.js               # API client — ติดต่อ Google Apps Script backend
    ├── cart.js              # Cart management — state, localStorage, คำนวณราคา
    └── menu.js              # Menu page logic — render, filter, add to cart
```

---

## 🖥️ Frontend — รายละเอียดแต่ละไฟล์

### `index.html` — หน้าหลัก
- แสดงชื่อลูกค้าจาก LINE Profile
- Banner โปรโมชั่น
- Quick links ไปหน้าเมนูและติดตามออเดอร์
- ข้อมูลร้าน (เวลาทำการ, ที่อยู่, วิธีชำระ)

### `menu.html` — หน้าเมนู
- โหลดเมนูจาก Google Sheets ผ่าน API
- แสดง Grid 2 คอลัมน์ พร้อมรูปภาพ
- Filter หมวดหมู่แบบ tab
- ปุ่ม + / − เพิ่มลดจำนวนในตะกร้า
- Cache เมนูใน localStorage 5 นาที (ลด API calls)
- แสดง skeleton loader ระหว่างโหลด

### `cart.html` — ตะกร้าสินค้า
- แสดงรายการสินค้าในตะกร้า
- ปรับจำนวน / ลบรายการ
- กด 🗑️ เมื่อจำนวน = 1 เพื่อลบออก
- ช่องหมายเหตุถึงร้าน
- แถบสรุปราคา + ปุ่มไปชำระเงิน (รองรับ LINE browser nav bar)

### `checkout.html` — สรุปออเดอร์
- แสดงรายการและราคาสรุป
- **เลือกวิธีชำระเงิน 2 แบบ:**
  - 💚 LINE Pay — redirect ไปหน้าชำระเงิน
  - 💵 เงินสดที่ร้าน — สร้างออเดอร์และแสดง Order ID
- Popup ยืนยันพร้อม Order ID เมื่อเลือกชำระเงินสด

### `order-status.html` — ติดตามออเดอร์
- แสดงสถานะแบบ stepper (รอยืนยัน → ชำระแล้ว → กำลังทำ → พร้อมรับ)
- รองรับ LINE Pay callback (transactionId ใน URL)
- Auto-refresh ทุก 30 วินาที (หากยังไม่เสร็จ)

### `admin.html` — Admin Panel
- **Login ด้วย Admin Key** (ไม่ต้องมี Google account)
- แสดงสถิติวันนี้: จำนวนออเดอร์, ยอดขาย, กำลังทำ, เสร็จแล้ว
- Filter ดูออเดอร์ตามวันที่
- เปลี่ยนสถานะออเดอร์: pending → paid → cooking → done
- Toggle เปิด/ปิดเมนูแต่ละรายการ
- Auto-refresh ทุก 60 วินาที
- ลิงก์ไปจอครัว

### `kitchen.html` — จอครัว (Kitchen Display)
- **Login ด้วย Admin Key เดียวกัน**
- นาฬิกาแสดงเวลาปัจจุบัน
- แสดงออเดอร์ที่ต้องทำ (paid + cooking)
- ⚠️ แจ้งเตือนออเดอร์เร่งด่วน (รอเกิน 15 นาที)
- ปุ่ม "เริ่มทำ" และ "เสร็จแล้ว"
- Filter: กำลังทำ / ชำระแล้ว / ทั้งหมด
- Auto-refresh ทุก 20 วินาที

---

## 🔧 JavaScript Modules

### `js/app.js` — Core Application
```javascript
APP_CONFIG = {
  LIFF_ID: 'YOUR_LIFF_ID',
  GAS_BASE_URL: 'https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec',
  ADMIN_KEY: 'CHANGE_ME_ADMIN_KEY',
  LINE_PAY_ENV: 'sandbox',
}
```
- `LiffManager` — init LIFF, getProfile, getUserId, getDisplayName
- `Toast` — แสดง notification (success/error/info)
- `formatPrice()` — แปลงตัวเลขเป็นราคาไทย เช่น ฿60
- `formatTime()` / `formatDate()` — จัดรูปแบบวันเวลาภาษาไทย
- `updateCartBadges()` — อัปเดตตัวเลขบนไอคอนตะกร้า

### `js/api.js` — Backend Client
- ติดต่อ Google Apps Script ผ่าน fetch
- **สำคัญ:** ใช้ `redirect: 'follow'` และ `Content-Type: text/plain` เพื่อหลีกเลี่ยง CORS preflight
- Cache เมนูใน localStorage อัตโนมัติ
- Methods: `getMenu`, `createOrder`, `getOrder`, `createPayment`, `updatePaymentStatus`, `getOrders`, `updateOrderStatus`, `updateMenuStatus`, `getSalesReport`

### `js/cart.js` — Cart State
- เก็บ state ใน localStorage (key: `restaurant_cart`)
- Methods: `addItem`, `removeItem`, `deleteItem`, `clear`
- `toOrderPayload()` — แปลงตะกร้าเป็น format สำหรับส่ง API
- `onChange(fn)` — subscribe รับ event เมื่อตะกร้าเปลี่ยน

### `js/menu.js` — Menu Page
- `init()` — โหลดเมนูจาก API, render skeleton, render cards
- `addToCart(menuId)` — เพิ่มสินค้า + อัปเดต UI
- `decrease(menuId)` — ลดจำนวน + อัปเดต UI
- `filterCategory(key)` — filter ตามหมวดหมู่

---

## ⚙️ Backend — Google Apps Script

**Web App URL:**
```
https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec
```

### API Endpoints (`?action=`)

| Action | Method | หน้าที่ |
|--------|--------|---------|
| `getMenu` | GET | ดึงเมนูที่ status = active |
| `createOrder` | POST | สร้างออเดอร์ใหม่ (คำนวณราคา server-side) |
| `getOrder` | GET | ดึงออเดอร์ตาม orderId |
| `createPayment` | GET | สร้าง LINE Pay request |
| `updatePaymentStatus` | POST | ยืนยันการชำระเงิน LINE Pay |
| `getOrders` | GET | ดึงออเดอร์ทั้งหมด (ต้องการ adminKey) |
| `updateOrderStatus` | POST | เปลี่ยนสถานะออเดอร์ (ต้องการ adminKey) |
| `updateMenuStatus` | POST | เปิด/ปิดเมนู (ต้องการ adminKey) |
| `getSalesReport` | GET | สรุปยอดขาย (ต้องการ adminKey) |

### Backend Files (ใน Apps Script)

| ไฟล์ | หน้าที่ |
|------|---------|
| `Code.gs` | Router หลัก, CONFIG, CORS headers |
| `menuAPI.gs` | getMenu, updateMenuStatus, getMenuItemById |
| `orderAPI.gs` | createOrder, getOrder, getOrders, updateOrderStatus |
| `paymentAPI.gs` | createPayment (LINE Pay), updatePaymentStatus, HMAC signature |
| `utils.gs` | getSheet, rowToObj, generateOrderId, logging, LINE Messaging API, setupSheets() |

---

## 🗄️ Database — Google Sheets

### Sheet: Menu
| คอลัมน์ | ประเภท | ตัวอย่าง |
|---------|--------|---------|
| id | number | 1 |
| name | string | ก๋วยเตี๋ยวหมู |
| description | string | น้ำใสหรือน้ำตก |
| price | number | 60 |
| image_url | string | https://drive.google.com/uc?id=... |
| category | string | ก๋วยเตี๋ยว |
| status | string | active / inactive |

### Sheet: Orders
| คอลัมน์ | ประเภท | ตัวอย่าง |
|---------|--------|---------|
| order_id | string | ORD-20250310-1234 |
| user_id | string | Uxxxxxxxxx (LINE User ID) |
| customer_name | string | อ๊อด#นิพนธ์ฟาร์ม |
| total_price | number | 120 |
| status | string | pending/paid/cooking/done |
| payment_status | string | unpaid/paid |
| created_at | datetime | 2025-03-10T19:26:00 |
| note | string | ไม่ใส่ผัก |
| transaction_id | string | LINE Pay transaction ID |

### Sheet: OrderItems
| คอลัมน์ | ประเภท |
|---------|--------|
| order_id | string |
| menu_id | string |
| menu_name | string |
| price | number |
| quantity | number |

### Sheet: Customers
| คอลัมน์ | ประเภท |
|---------|--------|
| user_id | string |
| display_name | string |
| last_order_time | datetime |

### Sheet: Logs
| คอลัมน์ | ประเภท |
|---------|--------|
| timestamp | datetime |
| level | INFO/ERROR |
| function | string |
| message | string |
| context | JSON string |

---

## 🔑 Configuration

### Frontend — `js/app.js`
```javascript
const APP_CONFIG = {
  LIFF_ID: 'YOUR_LIFF_ID',
  GAS_BASE_URL: 'https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec',
  ADMIN_KEY: 'CHANGE_ME_ADMIN_KEY',        // ⚠️ ควรเปลี่ยนให้ซับซ้อนขึ้นก่อน production
  LINE_PAY_ENV: 'sandbox',      // เปลี่ยนเป็น 'production' เมื่อพร้อม
};
```

### Backend — `Code.gs`
```javascript
const CONFIG = {
  SHEET_ID: '...',                      // Google Spreadsheet ID
  ADMIN_KEY: 'CHANGE_ME_ADMIN_KEY',                // ต้องตรงกับ frontend
  LINE_CHANNEL_ACCESS_TOKEN: '...',     // จาก LINE Messaging API
  LINE_OWNER_USER_ID: '...',            // LINE UID เจ้าของร้าน ⚠️ ยังไม่ได้ใส่
  LINE_PAY_CHANNEL_ID: '...',           // ⚠️ ยังไม่ได้ใส่
  LINE_PAY_CHANNEL_SECRET: '...',       // ⚠️ ยังไม่ได้ใส่
  LINE_PAY_ENV: 'sandbox',
  FRONTEND_URL: 'https://aod3826.github.io/Linemini-',
};
```

---

## 🚦 Order Status Flow

```
pending ──→ paid ──→ cooking ──→ done
  ↑            ↑         ↑          ↑
ลูกค้าสั่ง   ชำระแล้ว  ครัวรับงาน   เสร็จแล้ว
(เงินสด/Pay) (LINE Pay  (Admin/       (Kitchen
              callback)  Kitchen)      Display)
```

---

## 🛠️ การพัฒนาต่อ (Next Steps)

### ⚠️ สิ่งที่ต้องทำก่อน Production

1. **เปลี่ยน ADMIN_KEY** ให้ซับซ้อนขึ้น (ทั้งใน `app.js` และ `Code.gs`)
2. **ใส่ LINE_OWNER_USER_ID** ใน `Code.gs` เพื่อรับแจ้งเตือนออเดอร์ใหม่
3. **สมัคร LINE Pay Merchant** และใส่ Channel ID + Secret
4. **ใส่รูปภาพเมนู** ใน Google Drive แล้วใส่ URL ใน Sheet Menu
5. **แก้ข้อมูลร้าน** ใน `index.html` (ชื่อร้าน, เวลา, ที่อยู่)

### 💡 ฟีเจอร์ที่สามารถพัฒนาเพิ่มได้

- [ ] ระบบ QR Code สำหรับแต่ละโต๊ะ
- [ ] ประวัติการสั่งซื้อของลูกค้า
- [ ] ระบบโปรโมชั่น/คูปอง
- [ ] รายงานยอดขายรายเดือน
- [ ] แจ้งเตือนลูกค้าผ่าน LINE เมื่ออาหารพร้อม (ต้องใส่ LINE_OWNER_USER_ID ก่อน)
- [ ] ระบบรีวิวอาหาร
- [ ] Export รายงานเป็น Excel

---

## 🐛 การ Debug

### เมนูไม่โหลด
เปิด URL นี้ในเบราว์เซอร์ตรวจสอบ Backend:
```
https://script.google.com/macros/s/YOUR_GOOGLE_APPS_SCRIPT_DEPLOYMENT_ID/exec?action=getMenu
```
ต้องได้ `{"success":true,"items":[...]}`

### ดู Error Log
เปิด Google Sheets → Sheet **Logs** จะมีบันทึก error ทั้งหมด

### ทดสอบ Admin
```
https://aod3826.github.io/Linemini-/admin.html
Admin Key: CHANGE_ME_ADMIN_KEY
```

### ทดสอบจอครัว
```
https://aod3826.github.io/Linemini-/kitchen.html
Admin Key: CHANGE_ME_ADMIN_KEY
```

---

## 📦 Deploy

### Frontend (GitHub Pages)
```
Branch: main
Path: / (root)
URL: https://aod3826.github.io/Linemini-/
```
แก้ไขไฟล์ → commit → รอ ~2 นาที → auto deploy

### Backend (Google Apps Script)
แก้ไขโค้ด → Deploy → Manage deployments → Edit → **New version** → Deploy  
⚠️ ต้องสร้าง New version ทุกครั้ง URL จึงจะอัปเดต

---

## 📞 Tech Stack Summary

| Layer | Technology | Cost |
|-------|-----------|------|
| Frontend Hosting | GitHub Pages | ฟรี |
| Backend | Google Apps Script | ฟรี |
| Database | Google Sheets | ฟรี |
| Image Storage | Google Drive | ฟรี |
| Authentication | LINE LIFF | ฟรี |
| Notifications | LINE Messaging API | ฟรี (500 push/เดือน) |
| Payment | LINE Pay | Transaction fee |

**ค่าใช้จ่ายรวม: ฟรี** สำหรับร้านขนาดเล็ก 20-30 ออเดอร์/วัน ✅

---

*Last updated: มีนาคม 2025*  
*Developed with ❤️ using LINE LIFF + Google Apps Script*
