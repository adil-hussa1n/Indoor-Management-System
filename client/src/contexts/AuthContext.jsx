import React, { createContext, useContext, useState, useEffect } from 'react';
import API, { registerLogoutCallback } from '../services/api';

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
  const [loading, setLoading] = useState(true);

  const logout = () => {
    localStorage.removeItem('adminToken');
    setIsAdmin(false);
  };

  useEffect(() => {
    registerLogoutCallback(logout);
    const checkAuth = async () => {
      const token = localStorage.getItem('adminToken');
      if (token) {
        // Inspect JWT payload expiration
        const decoded = parseJwt(token);
        if (decoded && decoded.exp * 1000 > Date.now()) {
          setIsAdmin(true);

          // Setup timeout for auto-logout
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
        localStorage.setItem('adminToken', response.data.token);
        setIsAdmin(true);
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
    <AuthContext.Provider value={{ isAdmin, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
