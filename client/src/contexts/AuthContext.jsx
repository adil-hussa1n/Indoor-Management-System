import React, { createContext, useContext, useState, useEffect } from 'react';
import API, { registerAdminLogoutCallback, getTenantSlug } from '../services/api';

const AuthContext = createContext(null);

const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

export const AuthProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getStorageKey = () => `adminToken_${getTenantSlug()}`;

  const logout = () => {
    localStorage.removeItem(getStorageKey());
    setIsAdmin(false);
    setAdminUser(null);
  };

  const fetchAdminDetails = async () => {
    try {
      const res = await API.get('/auth/me');
      if (res.data.success) {
        setAdminUser(res.data.admin);
      }
    } catch (err) {
      console.warn('Failed to fetch admin profile:', err);
    }
  };

  useEffect(() => {
    registerAdminLogoutCallback(logout);
    const checkAuth = async () => {
      const token = localStorage.getItem(getStorageKey());
      if (token) {
        const decoded = parseJwt(token);
        if (decoded && decoded.exp * 1000 > Date.now()) {
          setIsAdmin(true);
          await fetchAdminDetails();

          const timeRemaining = decoded.exp * 1000 - Date.now();
          const timer = setTimeout(() => {
            console.log('Token expired. Logging out.');
            logout();
          }, timeRemaining);

          setLoading(false);
          return () => clearTimeout(timer);
        } else {
          logout();
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (username, password) => {
    try {
      const response = await API.post('/auth/login', { username, password });
      if (response.data.success) {
        localStorage.setItem(getStorageKey(), response.data.token);
        setIsAdmin(true);
        if (response.data.admin) {
          setAdminUser(response.data.admin);
        } else {
          await fetchAdminDetails();
        }
        return { success: true };
      }
      return { success: false, message: response.data.message || 'Login failed' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid username or password',
      };
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, adminUser, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
