import axios from 'axios';

const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : '/api/v1'),
  headers: {
    'Content-Type': 'application/json',
  },
});

export const MASTER_API = axios.create({
  baseURL: (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5000/api/v1' : '/api/v1')).replace('/api/v1', '/api/master'),
  headers: {
    'Content-Type': 'application/json',
  },
});

MASTER_API.interceptors.request.use(
  (config) => {
    const superAdminToken = localStorage.getItem('superAdminToken');
    if (superAdminToken) {
      config.headers.Authorization = `Bearer ${superAdminToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

MASTER_API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('superAdminToken');
    }
    return Promise.reject(error);
  }
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

    const urlParams = new URLSearchParams(window.location.search);
    const queryTenant = urlParams.get('tenant');
    
    if (queryTenant) {
      tenantSlug = queryTenant;
      // Save to both session (tab-isolated) and local (persistence fallback)
      sessionStorage.setItem('current_tenant_slug', queryTenant);
      localStorage.setItem('current_tenant_slug', queryTenant);
    } else if (extractedSubdomain) {
      tenantSlug = extractedSubdomain;
      sessionStorage.setItem('current_tenant_slug', extractedSubdomain);
      localStorage.setItem('current_tenant_slug', extractedSubdomain);
    } else {
      // Try tab-isolated session storage first
      const sessionTenant = sessionStorage.getItem('current_tenant_slug');
      if (sessionTenant) {
        tenantSlug = sessionTenant;
      } else {
        // Fall back to local storage
        const savedTenant = localStorage.getItem('current_tenant_slug');
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
  return tenantSlug;
};

// Inject token and tenant slug into headers
API.interceptors.request.use(
  (config) => {
    // 1. Inject Tenant Slug
    const tenantSlug = getTenantSlug();

    if (tenantSlug) {
      config.headers['X-Tenant-Slug'] = tenantSlug;
    }

    // 2. Inject Authorization token — pick the right token based on endpoint
    const adminToken = localStorage.getItem(`adminToken_${tenantSlug}`);
    const userToken = localStorage.getItem(`userToken_${tenantSlug}`);

    // User-facing endpoints must use the user token
    const url = config.url || '';
    const isUserEndpoint =
      url.startsWith('/user/') ||
      (url.startsWith('/booking-requests/') && (url.endsWith('/change') || url.endsWith('/cancel'))) ||
      url === '/booking';

    if (isUserEndpoint && userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
    } else if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor for token expiry
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
      console.warn('Unauthorized request - Token expired or invalid');
      const tenantSlug = getTenantSlug();
      const url = error.config?.url || '';
      const isUserEndpoint =
        url.startsWith('/user/') ||
        (url.startsWith('/booking-requests/') && (url.endsWith('/change') || url.endsWith('/cancel'))) ||
        url === '/booking';

      if (isUserEndpoint) {
        // Only remove user token on user endpoint 401
        localStorage.removeItem(`userToken_${tenantSlug}`);
        if (userLogoutCallback) {
          userLogoutCallback();
        }
      } else {
        // Only remove admin token on admin endpoint 401
        localStorage.removeItem(`adminToken_${tenantSlug}`);
        if (adminLogoutCallback) {
          adminLogoutCallback();
        }
      }
    }
    return Promise.reject(error);
  }
);

export default API;
