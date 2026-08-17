# Apex Arena — Multi-Tenant SaaS Indoor Sports Booking System

A premium, production-grade **Multi-Tenant SaaS Indoor Sports Booking System** built with **React 19 + Vite**, **Node.js + Express**, and **MySQL + Sequelize ORM**. Designed to provision and manage multiple isolated client tenants under a wildcard subdomain architecture (e.g., `*.daruntech.com`), with SMS OTP customer authentication, scheduling requests, custom pricing grids, and a master Super Admin Control Panel.

---

## 🏗️ SaaS Architecture & Multi-Tenancy

### 1. Dynamic Database Routing
* **Tenant Middleware**: Resolves the target tenant based on the hostname subdomain (production) or the `X-Tenant-Slug` header / `tenant` query param (local development).
* **Connection Pooling**: Dynamically instantiates and caches database connection instances using `getTenantConnection()`. Connections are established on-demand, preventing pre-allocation overhead.
* **Factory Model Compilation**: Models are defined using factories and compiled dynamically per request: `createModels(tenantDb)`.
* **Database Isolation**: Each tenant has a completely separate database (e.g. `db_apexarena`, `db_dbox`), ensuring absolute data isolation, compliance, and easier client migration/backups.

### 2. Session Isolation & Cross-Tenant Security
* **JWT Claims Scoping**: Tokens generated for both Admins and Users are stamped with a `tenant` slug claim.
* **Header Validation Middleware**: The backend verifies token claims `decoded.tenant === req.tenant.slug` on every route. A token from one tenant domain cannot be replayed or used on another.
* **Storage Namespacing**: Tokens in `localStorage` are stored under client-scoped keys (e.g., `adminToken_${tenantSlug}` and `userToken_${tenantSlug}`), isolating active dashboard sessions and preventing unintended auto-logins when testing different domains.

---

## ✨ Key Product Features

### 👑 Super Admin Control Panel (`/superadmin`)
* **Master Tenant Orchestration**: Super admins log in with master credentials (`superadmin` / `superadminpassword123`) to list, provision, suspend, or wipe tenant clients.
* **Instant Client Provisioning**: Provisions new database schemas, syncs Sequelize tables, and seeds initial parameters (branding, pricing, slot configurations, and custom admin credentials) in under 5 seconds.
* **Subscription & Lifecycle Management**:
  * Set precise expiry dates using a custom calendar picker or presets (1 Month, 3 Months, 6 Months, 1 Year, or Lifetime).
  * Automatically suspends client tenant sites and rejects bookings if their subscription deadline ends.
  * Received Payment tracker to easily mark accounts as paid on time.
* **SMS Credentials Manager**: Edit SSLWireless/BulkSMSBD API configurations directly via JSON schema properties inside the Super Admin dashboard.

### 🔒 Customer Portal & SMS OTP Authentication
* **Passwordless OTP Login**: Customers log in instantly by verifying a 6-digit OTP code sent via SMS.
* **Bangladesh SMS Gateways**: Integrated with local SMS gateways (SSLWireless) with an automated mock fallback for developer testing.
* **Customer Dashboard**: Users can check booking schedules, modify profiles, and track booking statuses.

### 🚨 Emergency Online Booking Pause & Maintenance Engine
* **Super Admin & Business Admin Control**: Both Super Admin (`SuperAdminDashboard.jsx`) and Venue Admins (`AdminSettings.jsx`) can temporarily pause online slot reservations instantly during emergencies, power outages, or facility maintenance.
* **Custom Alert Message & Auto-Resume Timer**: Admins can configure a custom highlighted banner message shown to customers and an optional datetime timer for automatic system reopening.
* **Customer Protection**: The public booking page (`Booking.jsx`) renders a glowing emergency alert box displaying the reason, contact phone number, and scheduled resume time while locking slot selection.

### 🏷️ Automatic Online & Admin Manual Discounts Engine
* **Automatic Date-Range Discounts**: Admins can set promotional discounts (`Percentage %` or `Fixed Amount ৳`) for specific dates or date ranges in `AdminSettings`. The system automatically detects and applies discounts on the online booking page (`Booking.jsx`) with live promo badges (`🎉 Promo Offer`).
* **Admin Manual Booking Discounts**: Admins can apply custom discounts (`Percentage %` or `Fixed Amount ৳`) at any time when creating manual reservations in `AdminBookings`, automatically recalculating net totals and settlement amounts.

### 📅 Reschedule Engine & Strict Duration Matching
* **Interactive Rescheduling**: Customers can request slot rescheduling directly from their dashboard with target date and target arena selection.
* **Strict Duration Matching**: Enforces strict slot count equality based on the original booking (e.g. 1 slot -> 1 slot, 2 slots -> 2 contiguous slots).
* **Live Slot Pricing Badges**: Real-time display of shift-based rates (`৳1,500`, `৳2,000`) and automatic price adjustment calculation (`+৳500 Additional Due` / `-৳500 Credit` / `No Change`).

### 💵 Investment & Expense Management Engine
* **Category Classification**: Admins can define custom categories for both **Investments** (e.g. Owner Capital, Partner Funding) and **Expenses** (e.g. Turf Maintenance, Electricity, Staff Salary).
* **Financial Transaction Logging**: Dedicated interface (`AdminFinances.jsx`) for recording investments and expenses with amounts (৳ BDT), dates, payment methods, title, voucher reference numbers, and notes.
* **Admin Dashboard Financial Overview**: Real-time integration into `AdminDashboard.jsx` featuring Total Investments, Total Expenses, Net Cashflow, and Net Operating Profit breakdown cards.

### 💵 Due Amount Settlement & Partial Payments
* **Admin Due Settlement (`💵 Pay Due`)**: Allows venue admins to record partial and full due payments on confirmed reservations directly from `AdminBookings`.
* **Custom Payment Methods**: Supports Cash, bKash, POS/Card, Bank Transfer, and Pay After Match.

### 🏟️ Multi-Ground / Multi-Arena Architecture & Filtering
* **Multiple Arenas per Business**: Businesses can set up multiple playing arenas (e.g. Futsal Pitch, Cricket Arena, Badminton Court) with individual sport badges and active/inactive toggles.
* **Multi-Ground Filters**: Interactive filter chips and dropdowns across **Admin Bookings**, **Admin Calendar**, and **Admin Dashboard** allowing admins to view aggregate stats per playing court.
* **Custom Display Ordering**: Admins can reorder grounds priority via `PATCH /api/v1/grounds/reorder` with Move Up (`↑`) and Move Down (`↓`) controls.
* **Smart Client Selection**:
  * **Single Arena**: Automatically skips the arena selection step on the client side for a seamless user checkout.
  * **Multiple Arenas**: Renders sleek, glassmorphic arena selector cards with dynamic step renumbering.

---

## 📂 Project Structure

```
Indoor-Management-System/
├── .env.example                    # Production env template (per-client config)
├── docker-compose.yml              # Docker Compose (development)
├── docker-compose.prod.yml         # Docker Compose (production — VPS deploy)
│
├── client/                         # Frontend — Vite + React 19
│   ├── Dockerfile                  # Multi-stage build (Node → Nginx)
│   ├── nginx.conf                  # Wildcard subdomain SPA routing + proxies
│   ├── src/
│   │   ├── components/             # Reusable UI (Card, Button, Input, Loader, Toast, Dialog)
│   │   ├── contexts/               # Global Contexts (AuthContext, UserAuthContext, SocketContext)
│   │   ├── layouts/                # App layouts (PublicLayout, AdminLayout)
│   │   ├── pages/                  # Route pages (Home, Booking, UserDashboard, AdminBookings, AdminCalendar, AdminDashboard, SuperAdminDashboard, AdminGrounds, AdminSettings, etc.)
│   │   ├── services/               # Axios setup & namespaced token storage (api.js)
│   │   ├── index.css               # Global styles & dark mode config
│   │   └── main.jsx                # React entry point
│   └── vite.config.js
│
├── server/                         # Backend — Node.js + Express + MySQL
│   ├── Dockerfile                  # Node.js production image
│   ├── utils/                      # test_api.js (Automated 65 API integration test suite)
│   ├── src/
│   │   ├── config/                 # master-db.js (master schema), sequelize.js (pool manager)
│   │   ├── models/                 # master/ (Tenant, SuperAdmin) & tenant models factory (Ground, Slot, Booking, etc.)
│   │   ├── repositories/           # Data access layers (Sequelize queries)
│   │   ├── controllers/            # Request handlers (auth, bookings, grounds, reviews, tenants)
│   │   ├── middlewares/            # tenant.js, auth.js, errorHandler.js, rateLimiter.js
│   │   └── routes/                 # Express routes (v1 endpoints & /api/master)
│   ├── server.js                   # Socket.IO & entry point
│   ├── app.js                      # Express configuration & middleware pipeline
│   └── .env.example                # Server environment template
│
└── indoor_management_system.postman_collection.json  # Multi-tenant API Postman collection
```

---

## ⚡ API Endpoint Reference

### 🌐 Super Admin Operations (`/api/master`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/master/login` | Public | Super Admin login, returns JWT token |
| GET | `/api/master/tenants` | SuperAdmin | List all client tenants |
| POST | `/api/master/tenants` | SuperAdmin | Provision a new tenant database & administrator |
| GET | `/api/master/tenants/:id` | SuperAdmin | Get detailed tenant configurations |
| PATCH | `/api/master/tenants/:id` | SuperAdmin | Update tenant status, custom domain, SMS credentials, or subscription date |
| DELETE | `/api/master/tenants/:id` | SuperAdmin | Deprovision & completely wipe a tenant database |

### 🔒 Customer OTP Auth & Portal (`/api/v1/user`)
*Must include `X-Tenant-Slug` header in development*
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/user/send-otp` | Public | Send 6-digit verification code via SMS |
| POST | `/api/v1/user/verify-otp` | Public | Verify OTP and return customer session token |
| GET | `/api/v1/user/me` | Customer | Fetch current customer profile |
| PATCH | `/api/v1/user/me` | Customer | Update profile name and email |
| GET | `/api/v1/user/my-bookings` | Customer | Retrieve all booking records for the customer |

### 🏟️ Grounds & Arenas Management (`/api/v1/grounds`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/api/v1/grounds` | Public | Fetch all active grounds/arenas sorted by display order |
| POST | `/api/v1/grounds` | Admin | Create a new ground/arena |
| PATCH | `/api/v1/grounds/:id` | Admin | Update ground properties (name, sport, description, status) |
| PATCH | `/api/v1/grounds/reorder` | Admin | Update display sequence order of grounds |
| DELETE | `/api/v1/grounds/:id` | Admin | Delete a ground (prevented if active bookings exist) |

### 📅 Booking Requests & Status (`/api/v1`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/booking-requests/:bookingId/change` | Customer | Request rescheduling with target arena & slots |
| POST | `/api/v1/booking-requests/:bookingId/cancel` | Customer | Request cancellation |
| GET | `/api/v1/booking-requests` | Admin | List all requests |
| PATCH | `/api/v1/booking-requests/:id` | Admin | Approve or reject a request |

---

## 🛠️ Quick Start (Local Development)

### 1. Clone & Install
```bash
git clone https://github.com/adil-hussa1n/Indoor-Management-System.git
cd Indoor-Management-System

# Install backend dependencies
cd server && npm install

# Install frontend dependencies
cd ../client && npm install
```

### 2. Configure Environment Variables
Set up your server configuration file in `server/.env` using the template:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=indoor_sports_master_db
DB_USER=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_secret_key
CLIENT_URL=http://localhost:5173
```

### 3. Build & Seed Master Database
Log into your local MySQL CLI and create the master registry schema:
```sql
CREATE DATABASE indoor_sports_master_db;
```
Now run the seeder inside the server folder to construct the tenants list registry, seed default tables, and configure `superadmin`:
```bash
cd server
npm run seed
```

### 4. Run Development Servers
```bash
# Terminal 1: Backend
cd server && npm run dev

# Terminal 2: Frontend
cd client && npm run dev
```

### 🧪 Automated Integration Tests
You can verify backend multi-tenant route configurations, tenant isolation logic, Grounds CRUD, discounts, emergency maintenance modes, Investment & Expense APIs, and customer OTP cycles using the automated test suite (65 tests):
```bash
cd server
npm run test:api
```

### 📬 Manual Testing (Postman)
An interactive Postman Collection is included in the project root:
- File: [indoor_management_system.postman_collection.json](file:///f:/GITHUB/indoor%20ms/Indoor-Management-System/indoor_management_system.postman_collection.json)
- **Included Request Folders**:
  1. **Super Admin Operations**: Master tenant login, list tenants, provision tenant, update settings, wipe tenant.
  2. **Authentication (Admin)**: Admin login, token storage in `{{adminToken}}`.
  3. **Customer OTP Authentication**: Send OTP, verify OTP, token storage in `{{userToken}}`.
  4. **Grounds & Arenas Management**: Get grounds, create ground, update ground, reorder grounds, delete ground.
  5. **Slots Management**: View available slots, create slot, update slot, delete slot.
  6. **Bookings & Reservations**: Public booking creation, admin bookings, change status, soft delete.
  7. **Booking Change & Cancel Requests**: Submit change/cancel request, list requests, approve/reject request.
  8. **Reviews, Contact Messages & Public Info**: Public settings, submit review, approve review, send message.
- **How to Use**:
  1. Open Postman and import [indoor_management_system.postman_collection.json](file:///f:/GITHUB/indoor%20ms/Indoor-Management-System/indoor_management_system.postman_collection.json).
  2. Configure `{{baseUrl}}` to `http://localhost:5000/api/v1` and `{{masterUrl}}` to `http://localhost:5000/api/master`.
  3. Ensure `{{tenantSlug}}` is set (e.g. `dbox` or `apexarena`).
  4. Execute **Super Admin Login** or **Admin Login** to automatically populate `{{superAdminToken}}` and `{{adminToken}}`.

---

## 🛡️ Security Hardening

The platform features production-grade security architecture protecting against common API and database vulnerabilities:
- **Strict JWT Secret Guard**: The server enforces validation on the `JWT_SECRET` variable during startup and terminates immediately if it is missing or weak, preventing token forgeability.
- **Short-Lived User Sessions**: Customer authentication tokens expire in `30d` instead of remaining valid indefinitely.
- **SMS Rate Limiting**: The system prevents SMS dispatch abuse using an `otpLimiter` (max 5 requests per 15 mins) and guess attempts using `otpVerifyLimiter` (max 10 attempts per 15 mins).
- **SQL Injection Prevention**: Double database name checks validation (`/^[a-z0-9_]+$/`) on client registration paths prevents arbitrary SQL injection in dynamic database creation commands.
- **Stored XSS Sanitization**: User inputs on bookings, reviews, and contact messages are stripped of HTML tags before database persistence using a lightweight sanitizer.

---

## 🚀 Deployment (Wildcard Nginx VPS Setup)

Deploying a multi-tenant platform requires wildcard subdomain mapping. Configure your DNS provider with a wildcard record `*.daruntech.com` pointing to your VPS IP address, then build the stack using Docker Compose.

The database service uses the `mysql-init/init.sql` initialization script to automatically bootstrap both the `indoor_sports_db` and the `indoor_master_db` databases on startup.

```bash
# 1. Clone on VPS
cd /opt
git clone https://github.com/adil-hussa1n/Indoor-Management-System.git
cd Indoor-Management-System

# 2. Deploy with Docker Compose
docker compose -f docker-compose.prod.yml up -d --build
```
The reverse proxy automatically captures request subdomains, routes traffic to the React SPA, proxies websocket connections, and routes API requests to the multi-tenant Node server.
