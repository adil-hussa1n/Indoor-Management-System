# 🌐 SaaS Subdomain & DNS Configuration Guide

This guide explains how to configure your DNS registrar and VPS hosting server to support dynamic subdomains for the multi-tenant SaaS booking platform.

---

## 🛠️ Step 1: DNS Panel Setup (Domain Registrar)

Login to your domain provider (e.g. Cloudflare, Namecheap, GoDaddy) and add **two A records** pointing to your VPS server's public IP address:

| Record Type | Host / Name | Value (Points To) | TTL | Description |
| :--- | :--- | :--- | :--- | :--- |
| **A** | `indoormanagement` | `YOUR_VPS_IP` | Automatic / 1 Hour | Routes `indoormanagement.daruntech.com` (Super Admin Console) to your VPS. |
| **A** | `*` | `YOUR_VPS_IP` | Automatic / 1 Hour | **Wildcard Record**: Routes any client subdomain (e.g. `dboxindoor.daruntech.com`) to your VPS. |

> [!NOTE]
> The **wildcard (`*`)** record acts as a catch-all. It redirects any subdomain request to your VPS, where the server then dynamically parses the business name from the domain header.

---

## 💻 Step 2: How the VPS Routes Incoming Requests

When a client or browser visits your site, the request travels through this architecture:

```
[Customer Browser]
      │
      ▼ (Requests: dboxindoor.daruntech.com)
┌───────────┐
│ VPS IP    │  ◄── Traffic arrives at your VPS server (Port 80/443)
└─────┬─────┘
      │
      ▼
┌───────────┐
│ Nginx     │  ◄── Nginx inspects Host header ("dboxindoor.daruntech.com")
└─────┬─────┘
      │
      ▼ (Proxies the request to the React/Node container)
┌───────────────────────────────────────────────┐
│ React Frontend & Node.js Backend Application  │
└──────────────────────┬────────────────────────┘
                       │
                       ├─► Subdomain is "indoormanagement"?
                       │   └─► YES: Render Super Admin Panel
                       │
                       └─► Subdomain is "dboxindoor"?
                           └─► YES: Switch Sequelize connection to "db_dboxindoor"
                                    and render dboxindoor's customized booking page!
```

---

## ⚙️ Step 3: Nginx Server Block Configuration

To make sure Nginx accepts the wildcard requests and forwards the proper domain context to the Node/React application, update your site's Nginx configuration (usually located in `/etc/nginx/sites-available/default` or inside your docker Nginx context):

```nginx
server {
    listen 80;
    
    # Accept traffic for both the super admin subdomain AND all wildcard client subdomains
    server_name indoormanagement.daruntech.com *.daruntech.com;

    location / {
        proxy_pass http://localhost:5173; # Proxy to client port (Vite/production build port)
        
        # CRITICAL: Forward the exact host domain header to the client/server container
        proxy_set_header Host $host;      
        
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> [!IMPORTANT]
> The line **`proxy_set_header Host $host;`** is critical. If omitted, Nginx will replace the host header with `localhost`, causing the application to fail to resolve the tenant name.

---

## 🚀 Step 4: Provisioning a New Business

Once steps 1-3 are completed, follow this workflow to spawn new client venues:

1.  **Access Super Admin Panel**: Go to `http://indoormanagement.daruntech.com/superadmin/login` and log in.
2.  **Add Business**: Click **"Provision New Client"**. Enter your details (e.g. business name `D-Box Indoor`, subdomain slug `dboxindoor`, set credentials).
3.  **Deploy**: The platform instantly initializes their isolated database, seeds slots, and sets up settings.
4.  **Live Access**:
    *   **Customer Booking Site**: `http://dboxindoor.daruntech.com`
    *   **Venue Admin Site**: `http://dboxindoor.daruntech.com/admin/login`
