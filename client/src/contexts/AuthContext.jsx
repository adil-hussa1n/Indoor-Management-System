import React, { createContext, useContext, useState, useEffect } from 'react';
import API, { registerAdminLogoutCallback } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminUser, setAdminUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    API.post('/auth/logout').catch(() => {});
    setIsAdmin(false);
    setAdminUser(null);
  };

  const fetchAdminDetails = async () => {
    try {
      const res = await API.get('/auth/me');
      if (res.data.success) {
        setAdminUser(res.data.admin);
        setIsAdmin(true);
        return true;
      }
    } catch (err) {
      setIsAdmin(false);
      setAdminUser(null);
    }
    return false;
  };

  useEffect(() => {
    registerAdminLogoutCallback(() => {
      setIsAdmin(false);
      setAdminUser(null);
    });
    // No client-held token to inspect — the httpOnly cookie (if any) is
    // sent automatically, so hydrate session state from the server.
    fetchAdminDetails().finally(() => setLoading(false));
  }, []);

  const login = async (username, password) => {
    try {
      const response = await API.post('/auth/login', { username, password });
      if (response.data.success) {
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

  const sendOtp = async (usernameOrEmail) => {
    try {
      const response = await API.post('/auth/send-otp', { usernameOrEmail });
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send OTP code. Please try again.',
      };
    }
  };

  const verifyOtp = async (usernameOrEmail, otp) => {
    try {
      const response = await API.post('/auth/verify-otp', { usernameOrEmail, otp });
      if (response.data.success) {
        setIsAdmin(true);
        if (response.data.admin) {
          setAdminUser(response.data.admin);
        } else {
          await fetchAdminDetails();
        }
        return { success: true };
      }
      return { success: false, message: response.data.message || 'OTP verification failed' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Invalid or expired OTP code',
      };
    }
  };

  return (
    <AuthContext.Provider value={{ isAdmin, adminUser, login, sendOtp, verifyOtp, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
