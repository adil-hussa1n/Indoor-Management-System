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

### 📅 Booking Modification & Cancellation Requests
* **Rescheduling (Change) Requests**: Users can request a time/date change directly from their dashboard, specifying a reason.
* **Cancellation Requests**: Users can request to cancel their slot.
* **Admin Review Queue**: Admins receive real-time Socket.IO alerts and can approve or reject requests in a dedicated tab. Approved requests automatically perform transaction-safe database updates and log status transitions.

### ⏰ Shift-Based Rates & Contiguous Booking Grid
* **6-Tier Pricing Grid**: Day/Night shift rates for Weekdays, Weekends, and Holidays.
* **Manual Booking Selector**: Admins can book slots through an interactive visual grid, clicking contiguous blocks to auto-calculate slot totals.
* **Audit Trail**: Every booking edit, cancellation, or settings change is recorded in an `AuditLog` table.

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
│   │   ├── pages/                  # Route pages (Home, Booking, UserDashboard, SuperAdminDashboard, etc.)
│   │   ├── services/               # Axios setup & namespaced token storage (api.js)
│   │   ├── index.css               # Global styles & dark mode config
│   │   └── main.jsx                # React entry point
│   └── vite.config.js
│
├── server/                         # Backend — Node.js + Express + MySQL
│   ├── Dockerfile                  # Node.js production image
│   ├── src/
│   │   ├── config/                 # master-db.js (master schema), sequelize.js (pool manager)
│   │   ├── models/                 # master/ (Tenant, SuperAdmin) & tenant models factory
│   │   ├── repositories/           # Data access layers (Sequelize queries)
│   │   ├── controllers/            # Request handlers (auth, bookings, reviews, tenants)
│   │   ├── middlewares/            # tenant.js, auth.js, errorHandler.js, rateLimiter.js
│   │   └── routes/                 # Express routes (v1 endpoints & /api/master)
│   ├── server.js                   # Socket.IO & entry point
│   ├── app.js                      # Express configuration & middleware pipeline
│   └── .env.example                # Server environment template
│
└── indoor_management_system.postman_collection.json  # Multi-tenant API collection
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

### 📅 Booking requests (`/api/v1`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/v1/booking-requests/:bookingId/change` | Customer | Request rescheduling |
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

### 2. Configure Environment variables
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
You can verify the backend multi-tenant route configurations, tenant isolation logic, and customer OTP cycles using the automated test suite:
```bash
cd server
npm run test:api
```

### 📬 Manual Testing (Postman)
An interactive Postman Collection is included in the project root:
- File: [indoor_management_system.postman_collection.json](file:///f:/GITHUB/indoor%20ms/Indoor-Management-System/indoor_management_system.postman_collection.json)
- **How to Use**:
  1. Open Postman and import the collection.
  2. Configure `{{baseUrl}}` to `http://localhost:5000/api/v1` and `{{masterUrl}}` to `http://localhost:5000/api/master`.
  3. Ensure `{{tenantSlug}}` is set (e.g. `dbox` or `apexarena`).
  4. Perform **Super Admin Login** first to verify operations, then **Admin Login** to retrieve admin permissions. All tokens are captured automatically and saved as collection variables.

---

## 🚀 Deployment (Wildcard Nginx VPS Setup)

Deploying a multi-tenant platform requires wildcard subdomain mapping. Configure your DNS provider with a wildcard record `*.daruntech.com` pointing to your VPS IP address, then build the stack using Docker Compose.

```bash
# 1. Clone on VPS
cd /opt
git clone https://github.com/adil-hussa1n/Indoor-Management-System.git
cd Indoor-Management-System

# 2. Deploy with Docker Compose
docker compose -f docker-compose.prod.yml up -d --build
```
The reverse proxy automatically captures request subdomains, routes traffic to the React SPA, proxies websocket connections, and routes API requests to the multi-tenant Node server.
