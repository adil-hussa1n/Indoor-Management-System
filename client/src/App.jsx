import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './components/ui/Toast';

import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Public Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Booking } from './pages/Booking';
import { Gallery } from './pages/Gallery';
import { Contact } from './pages/Contact';
import { NotFound } from './pages/NotFound';

// Admin Pages
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { AdminBookings } from './pages/AdminBookings';
import { AdminCalendar } from './pages/AdminCalendar';
import { AdminSlots } from './pages/AdminSlots';
import { AdminReviews } from './pages/AdminReviews';
import { AdminMessages } from './pages/AdminMessages';
import { AdminGallery } from './pages/AdminGallery';
import { AdminSettings } from './pages/AdminSettings';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SocketProvider>
          <ToastProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Routes */}
                <Route path="/" element={<PublicLayout />}>
                  <Route index element={<Home />} />
                  <Route path="about" element={<About />} />
                  <Route path="booking" element={<Booking />} />
                  <Route path="gallery" element={<Gallery />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="admin/login" element={<AdminLogin />} />
                  <Route path="404" element={<NotFound />} />
                  <Route path="*" element={<Navigate to="/404" replace />} />
                </Route>

                {/* Admin Dashboard Protected Routes */}
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Navigate to="/admin/dashboard" replace />} />
                  <Route path="dashboard" element={<AdminDashboard />} />
                  <Route path="bookings" element={<AdminBookings />} />
                  <Route path="calendar" element={<AdminCalendar />} />
                  <Route path="slots" element={<AdminSlots />} />
                  <Route path="reviews" element={<AdminReviews />} />
                  <Route path="messages" element={<AdminMessages />} />
                  <Route path="gallery" element={<AdminGallery />} />
                  <Route path="settings" element={<AdminSettings />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ToastProvider>
        </SocketProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
