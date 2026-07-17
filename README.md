# Apex Arena — Indoor Sports Booking System

A premium, production-ready **Full-Stack Indoor Sports Booking System** built with **React 19 + Vite**, **Node.js + Express**, and **MySQL + Sequelize ORM**. Designed for a single-court indoor arena with dynamic scheduling, shift-based pricing (BDT ৳), real-time WebSocket sync via Socket.IO, and a comprehensive admin management panel.

---

## ✨ Key Features

### 🏗️ Architecture & Database
- **MySQL + Sequelize ORM**: Fully relational database with foreign keys, indexes, and constraints.
- **Repository-Service-Controller Pattern**: Clean separation of concerns — repositories handle Sequelize queries, controllers handle request orchestration.
- **Optimistic Locking**: Prevents concurrent admin edits on Bookings and Settings via a `version` column.
- **Soft Deletes**: Bookings and Reviews use `paranoid` mode (recoverable deletions).
- **UUID Public IDs**: Bookings, Reviews, and Gallery items expose UUIDs instead of auto-increment IDs for security.
- **Database Indexes**: Optimized queries on `bookingDate`, `startTime`, `status`, and `phone`.
- **Unique Constraints**: Prevents duplicate slot configurations at the database level.
- **Booking Status History**: Full audit trail of every status transition (Pending → Confirmed → Completed).
- **Audit Log Table**: Tracks admin actions like booking edits, settings changes, and gallery deletions.
- **Slot Locking**: Temporary database locks to prevent double-booking during concurrent reservations.
- **Transactions**: All critical booking operations use `sequelize.transaction()` for atomicity.

### 🎨 Liquid Glass & Premium Aesthetics
- **Core Glassmorphism System**: Frosted backdrop blurs (`.glass-card`), soft lighting borders (`.glow-effect`), and hover transformations.
- **Theme Filtering**: Google Maps preview cards with liquid glass transparent border design and dark-theme inversion filters.
- **Responsive Layout**: All dashboard metrics, calendars, and booking tables have horizontal-scroll prevention wrappers for mobile/tablet viewports.
- **Scroll Restoration**: Automatic scroll-to-top on route transitions via a custom `ScrollToTop` hook.
- **Admin Login Isolation**: `/admin/login` renders without the public navbar/footer for a clean login experience.
- **Custom Confirm Dialogs**: Default browser alert pop-ups (`window.confirm`) are replaced with animated custom dialog modals built with Framer Motion, matching the glassmorphic theme.
- **Zero-Flicker Settings Caching**: Syncs branding configuration (logo, colors, business name) to `localStorage` on initial fetch to ensure zero layout-flashing of defaults on page reloads.

### 🔌 Real-time Syncing & Push Notifications
- **Broadcasting Socket Events**: Emits WebSocket alerts (`slot-status-changed`, `settings-updated`, `gallery-updated`) for instant frontend sync.
- **Admin Inbox Push Notifications**: Listeners in `AdminLayout` intercept `new-booking`, `new-message`, `new-review` triggers to show toast pop-ups.
- **Sidebar Alert Badges**: Red pulsing notification badges next to Bookings, Messages, or Reviews tabs — auto-clear when navigated to.

### 🖼️ Hero Banner Multi-Media Support
- **Image / Video / 360° Panorama**: Admin can set the hero banner as static image, looping video (autoplay, muted), or interactive 360° panorama (Pannellum).
- **Media Type Selector**: Dropdown in Admin Settings to choose between 🖼️ Image, 🎬 Video, and 🌐 360° Panorama.
- **Auto-Rotate Toggle**: Continuous panoramic rotation toggle for 360° mode.
- **Large File Support**: Cloudinary uploads with `resource_type: 'auto'` and 20MB limit for video.

### 📸 360° Gallery & Virtual Tour
- **Pannellum Panorama Viewer**: Pinned 360° photos/videos at the top of the public Gallery.
- **Auto-Rotation & Video Autoplay**: Configurable via `is365`, `mediaType`, and `autoPlay360` in Admin Media Dashboard.

### ⏰ Shift-Based Rates & Formatting
- **6-Tier Pricing**: Day and Night shift rates for Weekdays, Weekends, and Holidays.
- **12-Hour AM/PM Dropdowns**: Replaced typed slot strings with a robust dropdown selection system for creating slots.
- **Interactive Manual Booking**: Added an interactive slots availability grid selector inside the manual booking dialog. Admins can view available/booked slots in real-time, and clicking contiguous slots automatically calculates scheduling details.
- **BDT Currency**: All prices formatted in Bangladesh Taka (৳/BDT).

### ⭐ Public Review Submission
- **"Write a Review" Modal**: Interactive modal with star rating selector, name field, and comment textarea on the homepage.
- **Admin Moderation**: Reviews are saved as `isApproved: false` and await admin approval before public display.
- **Featured Reviews**: Admin can mark reviews as featured to display them in the testimonials carousel.

### 🔒 Security & Rate Limiting
- **Per-Route Rate Limits**: `POST /booking` (10/min), `POST /login` (5/min), `POST /contact` (20/hr).
- **Helmet Security Headers**: Full HTTP security headers via `helmet`.
- **CORS Whitelist**: Origin-based CORS restrictions with credential support.
- **JWT Authentication**: Token-based admin authentication with configurable expiry.

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
│   ├── nginx.conf                  # SPA routing + API/WebSocket reverse proxy
│   ├── .dockerignore
│   ├── src/
│   │   ├── components/             # Reusable UI (Card, Button, Input, Loader, Toast)
│   │   ├── contexts/               # Global Contexts (AuthContext, SocketContext)
│   │   ├── hooks/                  # Custom Hooks & API Queries (TanStack Query / useApi.js)
│   │   ├── layouts/                # App layouts (PublicLayout, AdminLayout)
│   │   ├── pages/                  # Route pages (Home, Booking, Gallery, Admin Dashboard, etc.)
│   │   ├── services/               # Axios setup (api.js)
│   │   ├── index.css               # Global styles & dark mode config
│   │   └── main.jsx                # React entry point
│   └── vite.config.js
│
├── server/                         # Backend — Node.js + Express + MySQL
│   ├── Dockerfile                  # Node.js production image
│   ├── .dockerignore
│   ├── src/
│   │   ├── config/                 # sequelize.js (instance), db.js (connect + sync)
│   │   ├── models/                 # Sequelize models (Admin, Booking, Slot, Settings, etc.)
│   │   ├── repositories/           # Data access layer (Sequelize queries)
│   │   ├── controllers/            # Request handlers (business logic)
│   │   ├── middlewares/            # auth.js, errorHandler.js, rateLimiter.js
│   │   ├── routes/                 # health.route.js
│   │   └── utils/                  # cloudinary.js
│   ├── routes/                     # Express REST endpoint routes
│   ├── validators/                 # Zod validation schemas
│   ├── utils/                      # seeder.js
│   ├── server.js                   # Entry point & Socket.IO server
│   ├── app.js                      # Express app (security, CORS, rate limits)
│   └── .env.example                # Server environment template
│
└── indoor_management_system.postman_collection.json  # API testing collection
```

---

## ⚡ API Endpoint Reference

All endpoints are prefixed with `/api/v1`.

### Authentication (`/auth`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/auth/login` | Public | Admin login, returns JWT token |
| GET | `/auth/me` | Admin | Get current admin profile |

### Court Slots (`/available-slots`, `/slots`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/available-slots?date=YYYY-MM-DD` | Public | Query bookable slots for a date |
| GET | `/slots` | Admin | List all slot configurations |
| POST | `/slots` | Admin | Create a new slot |
| PATCH | `/slots/:id` | Admin | Update slot (toggle active, modify times) |
| DELETE | `/slots/:id` | Admin | Delete a slot |

### Bookings & Dashboard (`/booking`, `/bookings`, `/dashboard`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/booking` | Public | Customer booking request |
| GET | `/dashboard` | Admin | Dashboard stats, peak slots, occupancy |
| GET | `/bookings` | Admin | List all bookings (search, filter, date range) |
| POST | `/bookings` | Admin | Create manual booking (auto-confirmed) |
| GET | `/bookings/:id` | Admin | View booking details |
| PATCH | `/bookings/:id` | Admin | Update booking details |
| PATCH | `/booking-status/:id` | Admin | Change booking status |
| DELETE | `/bookings/:id` | Admin | Soft-delete booking |

### Settings (`/settings`, `/info`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/info` | Public | Public-facing business info, rates, hero config |
| GET | `/settings` | Admin | Full settings configuration |
| PATCH | `/settings` | Admin | Update settings (supports logo/banner uploads) |

### Gallery (`/gallery`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/gallery` | Public | Fetch all gallery images |
| POST | `/gallery` | Admin | Upload image (Cloudinary or base64 fallback) |
| POST | `/gallery/reorder` | Admin | Reorder gallery items |
| DELETE | `/gallery/:id` | Admin | Delete image |

### Reviews & Contact (`/reviews`, `/contact`, `/messages`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/reviews` | Public | Fetch approved reviews |
| POST | `/reviews` | Public | Submit a review (pending approval) |
| GET | `/reviews/all` | Admin | View all reviews |
| PATCH | `/reviews/:id` | Admin | Approve/feature a review |
| DELETE | `/reviews/:id` | Admin | Soft-delete review |
| POST | `/contact` | Public | Submit contact message |
| GET | `/messages` | Admin | Fetch contact messages |
| PATCH | `/messages/:id` | Admin | Update read/reply status |
| DELETE | `/messages/:id` | Admin | Delete message |

### Health (`/health`)
| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| GET | `/health` | Public | Server status + MySQL connection check |

---

## 🛠️ Quick Start (Local Development)

### Prerequisites
- **Node.js** v18+ and **npm**
- **MySQL** 8.0+ (running locally or via Docker)

### 1. Clone & Install
```bash
git clone https://github.com/adil-hussa1n/Indoor-Management-System.git
cd Indoor-Management-System

# Install server dependencies
cd server && npm install

# Install client dependencies
cd ../client && npm install
```

### 2. Configure Environment
```bash
# Copy .env.example and fill in your MySQL credentials
cp server/.env.example server/.env
```

Key variables:
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=indoor_sports_db
DB_USER=root
DB_PASSWORD=your_mysql_password
JWT_SECRET=your_strong_secret_key
CLIENT_URL=http://localhost:5173
```

### 3. Create the Database
```sql
CREATE DATABASE indoor_sports_db;
```

### 4. Seed the Database
```bash
cd server
npm run seed
```
This creates all tables automatically and populates admin credentials, default slots, settings, and mock data.

> **Default admin credentials**: `admin` / `adminpassword123`

### 5. Start Development Servers
```bash
# Terminal 1 — Backend (port 5000)
cd server && npm run dev

# Terminal 2 — Frontend (port 5173)
cd client && npm run dev
```

### 6. Docker Compose (Optional)
```bash
# Development (exposes all ports for debugging)
docker-compose up --build

# Production (secured, Nginx reverse proxy)
docker compose -f docker-compose.prod.yml up -d --build
```

### 🧪 Automated API Testing
Verify all server endpoints, authentication logic, slot availability algorithms, and edge-case exceptions using the native test suite.
```bash
cd server
npm run test:api
```
This runs a zero-dependency test runner confirming health status, database operations, manual overrides, token expiry handling, and review moderation.

### 📬 Manual Testing (Postman)
An interactive Postman Collection is included in the project root:
- File: [indoor_management_system.postman_collection.json](file:///f:/GITHUB/indoor%20ms/Indoor-Management-System/indoor_management_system.postman_collection.json)
- **How to Use**:
  1. Open Postman and click **Import** in the top-left corner.
  2. Drag and drop this collection file.
  3. Configure the environment variable `{{baseUrl}}` to `http://localhost:5000/api/v1`.
  4. Run the **Admin Login** query first — it will automatically capture and save the bearer token to your collection variables to authenticate all other admin endpoints automatically.

---

## 🚀 Deployment (Docker on VPS)

This project is designed as a **multi-client product** — deploy to any VPS (Hostinger, DigitalOcean, AWS EC2, etc.) with a single command.

### Architecture
```
Client (Browser)
    │
    ▼ port 80
┌───────────────────────┐
│  Nginx (client)       │
│  - Serves React app   │
│  - Proxies /api → :5000
│  - Proxies /socket.io │
└──────────┬────────────┘
           │ internal Docker network
    ┌──────┴──────┐
    ▼             ▼
┌────────┐   ┌────────┐
│ Node.js│   │ MySQL  │
│ :5000  │──▶│ :3306  │
└────────┘   └────────┘
```

> **Security**: MySQL is only accessible within the Docker network — **not exposed to the internet**.

### Quick Deploy (5 Steps)

```bash
# 1. SSH into your VPS
ssh root@YOUR_VPS_IP

# 2. Install Docker
curl -fsSL https://get.docker.com | sh

# 3. Clone the repo
cd /opt
git clone https://github.com/adil-hussa1n/Indoor-Management-System.git
cd Indoor-Management-System

# 4. Configure environment
cp .env.example .env          # Edit with your DB password, JWT secret
cp server/.env.example server/.env  # Edit with production values

# 5. Build & Deploy
docker compose -f docker-compose.prod.yml up -d --build
```

Visit `http://YOUR_VPS_IP` — done!

### Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `APP_PORT` | `.env` | Port to expose (default: 80) |
| `DB_PASSWORD` | `.env` + `server/.env` | MySQL root password (must match!) |
| `DB_NAME` | `.env` + `server/.env` | Database name (default: indoor_sports_db) |
| `NODE_ENV` | `server/.env` | Must be `production` |
| `JWT_SECRET` | `server/.env` | Generate with `openssl rand -hex 64` |
| `CLIENT_URL` | `server/.env` | Your domain URL (for CORS) |
| `CLOUDINARY_*` | `server/.env` | Image upload credentials |

### Updating a Deployment

```bash
cd /opt/Indoor-Management-System
git pull origin main
docker compose -f docker-compose.prod.yml up -d --build
```

### Adding SSL (Optional)

Point your domain's A record to the VPS IP, then:
```bash
apt install certbot -y
certbot --standalone -d yourdomain.com
```

---

## 📄 Tech Stack

| Layer | Technology |
|-------|-----------| 
| Frontend | React 19, Vite, TanStack Query, Framer Motion, Lucide Icons, Tailwind CSS |
| Backend | Node.js, Express.js, Socket.IO, Zod, Helmet, Morgan |
| Database | MySQL 8.0, Sequelize ORM |
| Auth | JWT (jsonwebtoken), bcryptjs |
| Media | Cloudinary (with base64 local fallback), Pannellum (360° viewer) |
| DevOps | Docker Compose, Nginx, Nodemon, ESLint |

