import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { AuthProvider } from './contexts/AuthContext';
import { UserAuthProvider } from './contexts/UserAuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { ToastProvider } from './components/ui/Toast';
import { ConfirmProvider } from './contexts/ConfirmContext';

import { PublicLayout } from './layouts/PublicLayout';
import { AdminLayout } from './layouts/AdminLayout';

// Public Pages
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Booking } from './pages/Booking';
import { BookingSuccess } from './pages/BookingSuccess';
import { Gallery } from './pages/Gallery';
import { Contact } from './pages/Contact';
import { UserLogin } from './pages/UserLogin';
import { UserDashboard } from './pages/UserDashboard';
import { SuperAdminLogin } from './pages/SuperAdminLogin';
import { SuperAdminDashboard } from './pages/SuperAdminDashboard';
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
import { AdminBlacklist } from './pages/AdminBlacklist';
import { AdminRequests } from './pages/AdminRequests';
import { AdminGrounds } from './pages/AdminGrounds';
import { ScrollToTop } from './components/ScrollToTop';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function TenantUrlSanitizer() {
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const rawTenant = urlParams.get('tenant');
      if (rawTenant && rawTenant.includes('/')) {
        const parts = rawTenant.split('/');
        const cleanTenant = parts[0];
        const subPath = parts.slice(1).join('/');
        sessionStorage.setItem('current_tenant_slug', cleanTenant);
        localStorage.setItem('current_tenant_slug', cleanTenant);
        window.location.replace(`/${subPath}?tenant=${cleanTenant}`);
      }
    }
  }, []);
  return null;
}

function AdminIndexRedirect() {
  const location = useLocation();
  return <Navigate to={`/admin/dashboard${location.search}`} replace />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <UserAuthProvider>
          <SocketProvider>
            <ToastProvider>
              <ConfirmProvider>
                <BrowserRouter>
                  <TenantUrlSanitizer />
                  <ScrollToTop />
                  <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<PublicLayout />}>
                      <Route index element={<Home />} />
                      <Route path="about" element={<About />} />
                      <Route path="booking" element={<Booking />} />
                      <Route path="booking/success" element={<BookingSuccess />} />
                      <Route path="gallery" element={<Gallery />} />
                      <Route path="contact" element={<Contact />} />
                      <Route path="login" element={<UserLogin />} />
                      <Route path="dashboard" element={<UserDashboard />} />
                      <Route path="admin/login" element={<AdminLogin />} />
                      <Route path="404" element={<NotFound />} />
                      <Route path="*" element={<Navigate to="/404" replace />} />
                    </Route>

                    {/* Admin Dashboard Protected Routes */}
                    <Route path="/admin" element={<AdminLayout />}>
                      <Route index element={<AdminIndexRedirect />} />
                      <Route path="dashboard" element={<AdminDashboard />} />
                      <Route path="bookings" element={<AdminBookings />} />
                      <Route path="calendar" element={<AdminCalendar />} />
                      <Route path="slots" element={<AdminSlots />} />
                      <Route path="grounds" element={<AdminGrounds />} />
                      <Route path="reviews" element={<AdminReviews />} />
                      <Route path="messages" element={<AdminMessages />} />
                      <Route path="gallery" element={<AdminGallery />} />
                      <Route path="settings" element={<AdminSettings />} />
                      <Route path="blacklist" element={<AdminBlacklist />} />
                      <Route path="requests" element={<AdminRequests />} />
                    </Route>

                    {/* Super Admin Console Routes */}
                    <Route path="/superadmin/login" element={<SuperAdminLogin />} />
                    <Route path="/superadmin/dashboard" element={<SuperAdminDashboard />} />
                  </Routes>
                </BrowserRouter>
              </ConfirmProvider>
            </ToastProvider>
          </SocketProvider>
        </UserAuthProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
