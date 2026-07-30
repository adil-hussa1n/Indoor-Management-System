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
    const urlParams = new URLSearchParams(window.location.search);
    const queryTenant = urlParams.get('tenant');
    if (queryTenant) {
      tenantSlug = queryTenant;
      // Save to both session (tab-isolated) and local (persistence fallback)
      sessionStorage.setItem('current_tenant_slug', queryTenant);
      localStorage.setItem('current_tenant_slug', queryTenant);
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

    // 2. Inject Authorization token (Admin or User) scoped to active tenant
    const adminToken = localStorage.getItem(`adminToken_${tenantSlug}`);
    const userToken = localStorage.getItem(`userToken_${tenantSlug}`);
    if (adminToken) {
      config.headers.Authorization = `Bearer ${adminToken}`;
    } else if (userToken) {
      config.headers.Authorization = `Bearer ${userToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Global response interceptor for token expiry
let logoutCallback = null;

export const registerLogoutCallback = (cb) => {
  logoutCallback = cb;
};

API.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request - Token expired or invalid');
      const tenantSlug = getTenantSlug();
      localStorage.removeItem('superAdminToken');
      localStorage.removeItem(`adminToken_${tenantSlug}`);
      localStorage.removeItem(`userToken_${tenantSlug}`);
      if (logoutCallback) {
        logoutCallback();
      }
    }
    return Promise.reject(error);
  }
);

export default API;
