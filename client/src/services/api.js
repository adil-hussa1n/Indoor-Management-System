import axios from 'axios';

// withCredentials: true — auth is carried in an httpOnly cookie set by the
// server (see server/src/utils/authCookie.js), never read/written by this
// client. Matches the business_backend/restaurant_backend frontend convention.
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : '/api/v1'),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export const MASTER_API = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : '/api/v1')).replace('/api/v1', '/api/master'),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

MASTER_API.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);

// Helper to extract the active tenant slug
export const getTenantSlug = () => {
  let tenantSlug = import.meta.env.VITE_TENANT_SLUG;
  
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    
    // Check if we are on a client subdomain
    // Exclude localhost, 127.0.0.1, and indoormanagement (Super Admin console)
    const parts = hostname.split('.');
    let extractedSubdomain = null;
    if (parts.length >= 3 && hostname !== 'indoormanagement.daruntech.com') {
      extractedSubdomain = parts[0];
    }

    const cleanSlug = (s) => {
      if (!s) return null;
      return s.split('/')[0].split('?')[0].trim();
    };

    const urlParams = new URLSearchParams(window.location.search);
    const queryTenant = cleanSlug(urlParams.get('tenant'));
    
    if (queryTenant) {
      tenantSlug = queryTenant;
      // Save to both session (tab-isolated) and local (persistence fallback)
      sessionStorage.setItem('current_tenant_slug', queryTenant);
      localStorage.setItem('current_tenant_slug', queryTenant);
    } else if (extractedSubdomain) {
      const cleanSub = cleanSlug(extractedSubdomain);
      tenantSlug = cleanSub;
      sessionStorage.setItem('current_tenant_slug', cleanSub);
      localStorage.setItem('current_tenant_slug', cleanSub);
    } else {
      // Try tab-isolated session storage first
      const sessionTenant = cleanSlug(sessionStorage.getItem('current_tenant_slug'));
      if (sessionTenant) {
        tenantSlug = sessionTenant;
      } else {
        // Fall back to local storage
        const savedTenant = cleanSlug(localStorage.getItem('current_tenant_slug'));
        if (savedTenant) {
          tenantSlug = savedTenant;
          sessionStorage.setItem('current_tenant_slug', savedTenant); // elevate to session
        }
      }
    }
  }

  if (!tenantSlug) {
    tenantSlug = 'apexarena';
  }
  return tenantSlug.split('/')[0].split('?')[0].trim();
};

// Inject tenant slug — still consumed pre-auth (login, public storefront
// routes) by businessContext.js; ignored once a cookie carries a valid
// JWT (see constitution Principle V / businessContext.js).
API.interceptors.request.use(
  (config) => {
    const tenantSlug = getTenantSlug();
    if (tenantSlug) {
      config.headers['X-Tenant-Slug'] = tenantSlug;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor for auth expiry — no client-held token to
// clear (it lives in an httpOnly cookie the server controls), so this only
// notifies the relevant auth context to update its state/redirect.
let adminLogoutCallback = null;
let userLogoutCallback = null;

export const registerAdminLogoutCallback = (cb) => {
  adminLogoutCallback = cb;
};

export const registerUserLogoutCallback = (cb) => {
  userLogoutCallback = cb;
};

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request - session expired or invalid');
      const url = error.config?.url || '';
      const isUserEndpoint =
        url.startsWith('/user/') ||
        (url.startsWith('/booking-requests/') && (url.endsWith('/change') || url.endsWith('/cancel'))) ||
        url === '/booking';

      if (isUserEndpoint) {
        if (userLogoutCallback) userLogoutCallback();
      } else {
        if (adminLogoutCallback) adminLogoutCallback();
      }
    }
    return Promise.reject(error);
  }
);

export { API };
export default API;
