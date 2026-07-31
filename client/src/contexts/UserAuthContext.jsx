import React, { createContext, useContext, useState, useEffect } from 'react';
import API, { registerUserLogoutCallback, getTenantSlug } from '../services/api';

const UserAuthContext = createContext(null);

export const UserAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const getStorageKey = () => `userToken_${getTenantSlug()}`;

  const logout = () => {
    localStorage.removeItem(getStorageKey());
    setUser(null);
  };

  // Check auth status on mount
  useEffect(() => {
    registerUserLogoutCallback(logout);
    const checkUserAuth = async () => {
      const token = localStorage.getItem(getStorageKey());
      if (token) {
        try {
          const res = await API.get('/user/me');
          if (res.data.success) {
            setUser(res.data.user);
          } else {
            localStorage.removeItem(getStorageKey());
          }
        } catch (e) {
          localStorage.removeItem(getStorageKey());
        }
      }
      setLoading(false);
    };

    checkUserAuth();
  }, []);

  const sendOtp = async (phone) => {
    try {
      const res = await API.post('/user/send-otp', { phone });
      return { success: true, message: res.data.message, devOtp: res.data.devOtp };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to send OTP. Please try again.',
      };
    }
  };

  const verifyOtp = async (phone, code) => {
    try {
      const res = await API.post('/user/verify-otp', { phone, code });
      if (res.data.success) {
        localStorage.setItem(getStorageKey(), res.data.token);
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: 'Invalid OTP code.' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Verification failed.',
      };
    }
  };

  const updateProfile = async (name, email) => {
    try {
      const res = await API.patch('/user/me', { name, email });
      if (res.data.success) {
        setUser(res.data.user);
        return { success: true };
      }
      return { success: false, message: 'Failed to update profile.' };
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || 'Profile update failed.',
      };
    }
  };

  return (
    <UserAuthContext.Provider
      value={{
        user,
        loading,
        sendOtp,
        verifyOtp,
        updateProfile,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </UserAuthContext.Provider>
  );
};

export const useUserAuth = () => useContext(UserAuthContext);
export default UserAuthContext;
