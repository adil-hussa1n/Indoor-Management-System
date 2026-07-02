# Apex Arena - Indoor Sports Booking System

A premium, production-ready MERN Stack Indoor Sports Booking System designed for a single playground/court. Features dynamic week-wise schedules, holiday/date overrides, automated pricing calculations formatted in Bangladesh Taka (৳/BDT), real-time slot state changes using Socket.IO, and a comprehensive admin management panel.

---

## ✨ Key Features & Recent Updates

### 1. 🎨 Liquid Glass & Premium Aesthetics
- **Core Glassmorphism System**: Implemented frosted backdrop blurs (`.glass-card`), soft lighting borders (`.glow-effect`), and hover transformations.
- **Theme Filtering**: Configured Google Maps iframe preview cards with a liquid glass transparent border design and dark-theme inversion filters (`grayscale` and `invert` modifiers).
- **Responsive Layout Overhaul**: All dashboard metrics, calendar listings, slot shifts, and booking tables have horizontal-scroll prevention wrappers to support mobile and tablet viewports.
- **Scroll Restoration**: Implemented automatic window scroll-to-top behavior upon route transitions via a custom `ScrollToTop` React hook component.
- **Admin Login Isolation**: The `/admin/login` route renders without the public navbar and footer for a clean, distraction-free login experience.

### 2. 🔌 Real-time Syncing & Push Notification Alerts
- **Broadcasting Socket Events**: Emits instant WebSocket alerts (`slot-status-changed`, `settings-updated`, `gallery-updated`) to synchronize frontend components without page reload delays.
- **Admin Inbox Push Notifications**: Listeners in `AdminLayout` intercept incoming `new-booking`, `new-message`, and `new-review` socket triggers to play toast pop-ups.
- **Sidebar Glowing Alert Badges**: Renders a red pulsing alert notification badge next to Bookings, Messages, or Reviews tabs to notify online admins immediately. Badges auto-clear when navigating to the relevant page.

### 3. 🖼️ Hero Banner Multi-Media Support
- **Image / Video / 360° Panorama**: Admin can set the hero banner as a static image, a looping background video (autoplay, muted), or an interactive 360° panorama powered by Pannellum.
- **Media Type Selector**: Admin Settings provides a dropdown to choose between 🖼️ Image, 🎬 Video, and 🌐 360° Panorama modes.
- **Auto-Rotate Toggle**: When 360° mode is selected, an auto-rotate toggle switch enables continuous panoramic rotation on the homepage.
- **Video & Large File Support**: Cloudinary uploads use `resource_type: 'auto'` with a 20MB file size limit to support video uploads.

### 4. 📸 360° Gallery Panorama Virtual Tour Player
- **Pannellum Panorama Viewer**: Pinned 360° photos and videos to the top of the public Gallery using the official CDN Hosted Pannellum iframe viewer.
- **Auto-Rotation & Video Autoplay**: Support is provided for `is360`, `mediaType`, and `autoPlay360` database options configurable in the Admin Media Dashboard.

### 5. ⏰ Shift-Based Rates & Local Dhaka Formatting
- **6-Tier Pricing Scheme**: Supports Day and Night shift rates for Weekdays, Weekends, and Holidays.
- **12-Hour Time Display**: Formats all slot listings, calendars, and receipt booking tables in the local 12-hour AM/PM Dhaka time zone format.
- **BDT Currency**: Set all currency formats to Bangladesh Taka (৳/BDT) and converted revenue metrics labels to "Sales".

---

## 📂 Project Structure

```
Indoor-Management-System/
├── client/                     # Frontend Vite + React 19 App
│   ├── src/
│   │   ├── components/         # Reusable UI components (Card, Button, Input, Loader, Toast)
│   │   ├── contexts/           # Global Contexts (AuthContext, SocketContext)
│   │   ├── hooks/              # Custom Hooks & API Queries (TanStack Query / useApi.js)
│   │   ├── layouts/            # Application layouts (PublicLayout, AdminLayout)
│   │   ├── pages/              # Routing pages (Home, Booking, Gallery, Admin Dashboard, etc.)
│   │   ├── services/           # Services (Axios setup / api.js)
│   │   ├── index.css           # Tailwind CSS base styles & custom dark mode configurations
│   │   └── main.jsx            # React app entry point
│   ├── tailwind.config.js      # Tailwind configurations
│   └── vite.config.js          # Vite configuration
│
└── server/                     # Backend Node.js + Express API
    ├── config/                 # Configurations (db.js, socket.js)
    ├── controllers/            # Controller layer (auth, booking, slot, settings, gallery, review, contact)
    ├── middleware/             # Middlewares (auth validation, error handling, rate limiter)
    ├── models/                 # Mongoose schemas (Admin, Booking, Slot, Settings, Gallery, Review, Message)
    ├── routes/                 # Express REST endpoint maps
    ├── utils/                  # Utility functions (seeder.js, validators)
    ├── server.js               # Application entry point & Socket server configuration
    ├── app.js                  # Express app setup (security, CORS, rate limits, static folders)
    └── .env                    # Environment configurations
```

---

## ⚡ API Endpoint Reference

All endpoints are prefixed with `/api/v1`.

### 1. Authentication (`/auth`)
* `POST /auth/login` - Authenticate admin credentials and retrieve JWT token.
* `POST /auth/logout` - Clear session.

### 2. Available Court Slots (`/available-slots`)
* `GET /available-slots?date=YYYY-MM-DD` - Query bookable slots for a date. Resolves dynamically through:
  1. Special date override slots.
  2. Weekday-specific overrides.
  3. Daily default slot configurations.

### 3. Bookings & Dashboard (`/bookings`, `/booking` & `/dashboard`)
* `POST /booking` - Customer court booking reservation request.
* `GET /dashboard` - Admin fetch dashboard overview, peak slots, and occupancy rates (supports custom date filters).
* `GET /bookings` - Admin list all bookings (supports search, status, sport, and date range query parameters).
* `POST /bookings` - Admin add manual booking (auto-confirmed).
* `GET /bookings/:id` - Admin view specific booking details.
* `PATCH /bookings/:id` - Admin update booking details.
* `PATCH /booking-status/:id` - Admin change booking status (`Pending`, `Confirmed`, `Completed`, `Cancelled`).
* `DELETE /bookings/:id` - Admin delete booking records.

### 4. Slot Management (`/slots`)
* `GET /slots` - Fetch all slot configurations.
* `POST /slots` - Create a slot.
* `PATCH /slots/:id` - Update slot (toggle `isActive`, modify times, weekly days, or date parameters).
* `DELETE /slots/:id` - Delete a slot.

### 5. Settings Management (`/settings` & `/info`)
* `GET /info` - Public-facing settings details (business metadata, logo, banner, rates).
* `GET /settings` - Admin settings configuration fetch.
* `PATCH /settings` - Admin update configurations (supports Logo and Banner file uploads).

### 6. Media Gallery (`/gallery`)
* `GET /gallery` - Fetch all gallery images.
* `POST /gallery` - Admin upload image (saves to Cloudinary or base64 fallback).
* `POST /gallery/reorder` - Admin update ordering sequence of media assets.
* `DELETE /gallery/:id` - Admin delete image from database and Cloudinary storage.

### 7. Reviews & Messages
* `POST /reviews` - Customer submit feedback rating.
* `GET /reviews` - Fetch approved customer reviews.
* `GET /reviews/all` - Admin view all reviews.
* `PATCH /reviews/:id` - Admin approve / hide review.
* `DELETE /reviews/:id` - Admin delete feedback review database record.
* `POST /contact` - Customer submit contact message.
* `GET /messages` - Admin fetch contact messages.
* `PATCH /messages/:id` - Admin update inquiry read/unread or reply status.
* `DELETE /messages/:id` - Admin delete message database record.

---

## 🚀 Deployment Instructions

### 1. Deploying the Backend on Render
[Render](https://render.com/) is ideal for hosting Node.js/Express web services.

1. **Create an account** on Render and connect your GitHub repository.
2. Click **New +** -> **Web Service**.
3. Choose your repository.
4. Configure the Web Service:
   * **Name**: `indoor-sports-booking-api`
   * **Language**: `Node`
   * **Build Command**: `npm install` (inside the `server/` directory)
   * **Start Command**: `node server.js`
5. Set the Root Directory to `server`.
6. Add your Environment Variables in the **Environment** tab:
   * `PORT` = `10000` (Render allocates this automatically, but standardise if needed)
   * `NODE_ENV` = `production`
   * `MONGO_URI` = `mongodb+srv://...` (your MongoDB Atlas connection string)
   * `JWT_SECRET` = `your_strong_secret`
   * `CLIENT_URL` = `https://your-frontend.vercel.app` (your Vercel URL, set after deploying frontend)
   * `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (obtained from Cloudinary dashboard)
7. Click **Deploy Web Service**. Render will output a URL (e.g., `https://indoor-sports-booking-api.onrender.com`).

---

### 2. Deploying the Frontend on Vercel
[Vercel](https://vercel.com/) provides premium, high-speed CDN hosting for React/Vite builds.

1. Create a free account on Vercel and connect your GitHub repository.
2. Click **Add New** -> **Project**.
3. Select your repository.
4. Configure Project settings:
   * **Framework Preset**: `Vite`
   * **Root Directory**: `client`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
5. Open the **Environment Variables** block and add:
   * `VITE_API_URL` = `https://indoor-sports-booking-api.onrender.com/api/v1` (the Render URL pointing to your backend API)
6. Click **Deploy**. Vercel will output your production-ready public URL.
7. *Note*: Make sure to copy your Vercel URL back to your Render environment configurations under `CLIENT_URL` to enable secure CORS requests!
