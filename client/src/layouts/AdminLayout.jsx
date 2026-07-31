import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useAdminSettings } from '../hooks/useApi';
import { useSocket } from '../contexts/SocketContext';
import { useToast } from '../components/ui/Toast';
import {
  LayoutDashboard,
  CalendarDays,
  Clock,
  Images,
  MessageSquare,
  Settings as SettingsIcon,
  LogOut,
  Menu,
  X,
  Sparkles,
  Inbox,
  UserCheck,
  DollarSign,
  Sun,
  Moon,
  ChevronRight,
  WifiOff,
  ShieldAlert,
} from 'lucide-react';
import { Loader } from '../components/ui/Loader';

export const AdminLayout = () => {
  const { isAdmin, logout, loading } = useAuth();
  const { data: settings, isError, error, refetch } = useAdminSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const socket = useSocket();
  const toast = useToast();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });

  const [cachedSettings] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('cached_settings') || 'null');
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (settings) {
      localStorage.setItem('cached_settings', JSON.stringify(settings));
    }
  }, [settings]);

  useEffect(() => {
    if (settings && settings.enableDarkMode === false) {
      setDarkMode(false);
    }
  }, [settings]);

  const [alerts, setAlerts] = useState({
    bookings: false,
    reviews: false,
    messages: false,
    requests: false,
  });

  const notificationAudioRef = useRef(null);
  const suspiciousAudioRef = useRef(null);

  useEffect(() => {
    notificationAudioRef.current = new Audio('/notification.mp3');
    notificationAudioRef.current.preload = 'auto';

    suspiciousAudioRef.current = new Audio('/suspicious.mp3');
    suspiciousAudioRef.current.preload = 'auto';
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const activeSettings = settings || cachedSettings;
    if (activeSettings) {
      const currentSeoTitle = activeSettings.seo?.title;
      const defaultSeoTitles = [
        'Apex Indoor Sports Booking',
        'Apex Arena',
        'Indoor Sports Arena — Book Your Court'
      ];
      let baseTitle = 'Apex Arena';
      
      if (currentSeoTitle && !defaultSeoTitles.includes(currentSeoTitle)) {
        baseTitle = currentSeoTitle;
      } else {
        baseTitle = activeSettings.businessName || 'Apex Arena';
      }
      
      document.title = `Admin | ${baseTitle}`;
      
      if (activeSettings.theme === 'green') {
        document.documentElement.classList.add('theme-green');
      } else {
        document.documentElement.classList.remove('theme-green');
      }

      if (activeSettings.logo) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = activeSettings.logo;
        
        // Dynamically update link type attribute based on the image format
        if (activeSettings.logo.startsWith('data:image/svg+xml') || activeSettings.logo.endsWith('.svg')) {
          link.setAttribute('type', 'image/svg+xml');
        } else if (activeSettings.logo.startsWith('data:image/png') || activeSettings.logo.endsWith('.png')) {
          link.setAttribute('type', 'image/png');
        } else if (activeSettings.logo.startsWith('data:image/jpeg') || activeSettings.logo.endsWith('.jpg') || activeSettings.logo.endsWith('.jpeg')) {
          link.setAttribute('type', 'image/jpeg');
        } else {
          link.removeAttribute('type'); // Let browser infer
        }
      }
    }
  }, [settings, cachedSettings]);

  // Protect route
  useEffect(() => {
    if (!loading && !isAdmin) {
      navigate('/admin/login');
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    if (socket) {
      const playNotificationSound = (type = 'default') => {
        try {
          // Tab coordination: check if another tab played an alert in the last 800ms to avoid echo
          const lastPlayed = localStorage.getItem('last_played_alert_time');
          const now = Date.now();
          if (lastPlayed && now - parseInt(lastPlayed, 10) < 800) {
            console.log('Skipping audio playback on this tab to prevent echo');
            return;
          }
          localStorage.setItem('last_played_alert_time', now.toString());

          const baseAudio = type === 'suspicious' ? suspiciousAudioRef.current : notificationAudioRef.current;
          if (baseAudio) {
            const clonedAudio = baseAudio.cloneNode(true);
            clonedAudio.play().catch((err) => console.warn('Audio play blocked:', err));
          }
        } catch (error) {
          console.warn('Audio play failed:', error);
        }
      };

      const handleNewBooking = (booking) => {
        setAlerts((prev) => ({ ...prev, bookings: true }));
        toast.info(`🔔 New Booking! ID: ${booking.bookingId} by ${booking.customerName}`);
        playNotificationSound('default');
      };
      const handleNewMessage = (msg) => {
        setAlerts((prev) => ({ ...prev, messages: true }));
        toast.info(`✉️ New Message from ${msg.name}`);
        playNotificationSound('default');
      };
      const handleNewReview = (rev) => {
        setAlerts((prev) => ({ ...prev, reviews: true }));
        toast.info(`⭐ New Review Submitted (${rev.rating} stars)`);
        playNotificationSound('default');
      };

      const handleNewRequest = (data) => {
        setAlerts((prev) => ({ ...prev, requests: true }));
        toast.info('🔔 New Customer Booking Request Received!');
        if (data && data.isSuspicious) {
          return; // Skip playing the standard sound to avoid playing both at once
        }
        playNotificationSound('warning');
      };

      const handleSuspiciousActivity = (data) => {
        toast.error(`⚠️ Suspicious Activity! User ${data.userName} (${data.phone}) flagged: ${data.reason}`);
        playNotificationSound('suspicious');
      };
 
      socket.on('new-booking', handleNewBooking);
      socket.on('new-message', handleNewMessage);
      socket.on('new-review', handleNewReview);
      socket.on('new-booking-request', handleNewRequest);
      socket.on('suspicious-user-activity', handleSuspiciousActivity);
 
      return () => {
        socket.off('new-booking', handleNewBooking);
        socket.off('new-message', handleNewMessage);
        socket.off('new-review', handleNewReview);
        socket.off('new-booking-request', handleNewRequest);
        socket.off('suspicious-user-activity', handleSuspiciousActivity);
      };
    }
  }, [socket, toast]);

  useEffect(() => {
    if (location.pathname === '/admin/bookings') {
      setAlerts((prev) => ({ ...prev, bookings: false }));
    }
    if (location.pathname === '/admin/reviews') {
      setAlerts((prev) => ({ ...prev, reviews: false }));
    }
    if (location.pathname === '/admin/messages') {
      setAlerts((prev) => ({ ...prev, messages: false }));
    }
    if (location.pathname === '/admin/requests') {
      setAlerts((prev) => ({ ...prev, requests: false }));
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <Loader size="large" />
      </div>
    );
  }

  if (isError && error?.response?.status !== 401) {
    const status = error?.response?.status;
    const errorMessage = error?.response?.data?.message || error?.message || 'An unexpected error occurred.';
    
    let errorTitle = 'Arena Offline';
    let errorDescription = 'We are having trouble connecting to the arena servers. Please check your connection or try again.';
    let errorIcon = <WifiOff className="w-12 h-12 text-rose-500 animate-pulse" />;
    let showRetry = true;
    let showSuperAdminLink = false;

    if (status === 404) {
      errorTitle = 'Arena Not Found';
      errorDescription = errorMessage;
      errorIcon = <ShieldAlert className="w-12 h-12 text-amber-500" />;
      showRetry = false;
    } else if (status === 403) {
      errorTitle = 'Arena Suspended';
      errorDescription = errorMessage;
      errorIcon = <ShieldAlert className="w-12 h-12 text-rose-500" />;
      showRetry = false;
      showSuperAdminLink = true;
    }

    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 px-6 text-center transition-colors duration-500">
        <div className="relative max-w-md w-full p-8 rounded-[2rem] border border-zinc-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-xl shadow-2xl flex flex-col items-center gap-6">
          <div className="absolute -inset-1 rounded-[2.1rem] bg-gradient-to-r from-purple-600/10 to-indigo-600/10 blur-xl opacity-75 -z-10" />
          
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800/50 rounded-2xl">
            {errorIcon}
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
              {errorTitle}
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
              {errorDescription}
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full mt-2">
            {showRetry && (
              <button
                onClick={() => refetch()}
                className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-750 text-white font-bold text-sm shadow-lg shadow-purple-500/25 transition-all cursor-pointer border-0"
              >
                Try Again
              </button>
            )}
            
            {showSuperAdminLink && (
              <Link
                to="/superadmin/login"
                className="w-full py-3 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 hover:bg-zinc-850 dark:hover:bg-zinc-100 font-bold text-sm transition-all shadow-md flex items-center justify-center"
              >
                Super Admin Login
              </Link>
            )}

            <button
              onClick={() => {
                localStorage.removeItem('current_tenant_slug');
                sessionStorage.removeItem('current_tenant_slug');
                window.location.href = '/';
              }}
              className="w-full py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-900/50 font-bold text-sm transition-all flex items-center justify-center cursor-pointer bg-transparent"
            >
              Reset Tenant
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  const menuItems = [
    { name: 'Dashboard', path: '/admin/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
    { name: 'Bookings', path: '/admin/bookings', icon: <UserCheck className="w-5 h-5" />, hasAlert: alerts.bookings },
    { name: 'Calendar', path: '/admin/calendar', icon: <CalendarDays className="w-5 h-5" /> },
    { name: 'Slots', path: '/admin/slots', icon: <Clock className="w-5 h-5" /> },
    { name: 'Requests', path: '/admin/requests', icon: <Inbox className="w-5 h-5" />, hasAlert: alerts.requests },
    { name: 'Blacklist', path: '/admin/blacklist', icon: <ShieldAlert className="w-5 h-5" /> },
    { name: 'Reviews', path: '/admin/reviews', icon: <Sparkles className="w-5 h-5" />, hasAlert: alerts.reviews },
    { name: 'Messages', path: '/admin/messages', icon: <MessageSquare className="w-5 h-5" />, hasAlert: alerts.messages },
    { name: 'Gallery', path: '/admin/gallery', icon: <Images className="w-5 h-5" /> },
    { name: 'Settings', path: '/admin/settings', icon: <SettingsIcon className="w-5 h-5" /> },
  ];

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen flex bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* Sidebar for Desktop */}
      <aside className="hidden lg:flex flex-col w-64 h-screen sticky top-0 border-r border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-zinc-100 dark:border-zinc-900">
          {(settings?.logo || cachedSettings?.logo) ? (
            <img src={settings?.logo || cachedSettings?.logo} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-sm">
              {(settings?.businessName || cachedSettings?.businessName || 'A')[0].toUpperCase()}
            </div>
          )}
          <span className="font-extrabold text-md tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent uppercase">
            Admin Console
          </span>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              className={`flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 ${
                isActive(item.path)
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-105/10 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <div className="flex items-center gap-3">
                {item.icon}
                {item.name}
                {item.hasAlert && (
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                )}
              </div>
              <ChevronRight className={`w-4 h-4 opacity-50 ${isActive(item.path) ? 'block' : 'hidden'}`} />
            </Link>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-100 dark:border-zinc-900 space-y-3">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
          <div className="pt-2 border-t border-zinc-100/50 dark:border-zinc-900/50 text-center">
            <a href="https://daruntech.com" target="_blank" rel="noopener noreferrer" className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500/80 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">
              System by Darun Tech
            </a>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 border-b border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-950 px-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            {/* Sidebar toggle button (Mobile Only) */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-extrabold text-lg text-zinc-900 dark:text-white hidden sm:block">
              {menuItems.find((item) => isActive(item.path))?.name || 'Admin'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {/* Dark Mode Toggle */}
            {settings?.enableDarkMode !== false && (
              <button
                onClick={() => setDarkMode(!darkMode)}
                className="p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-150 transition-colors cursor-pointer bg-white dark:bg-zinc-900"
              >
                {darkMode ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
              </button>
            )}

            {/* View Website Link */}
            <Link
              to="/"
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:text-purple-600 dark:hover:text-purple-450 hover:border-purple-300 dark:hover:border-purple-900 transition-colors"
            >
              View Site
            </Link>
          </div>
        </header>

        {/* Inner Content */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto custom-scrollbar">
          <Outlet />
        </main>
      </div>

      {/* Mobile Sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            onClick={() => setSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <div className="relative w-64 bg-white dark:bg-zinc-950 flex flex-col z-10 border-r border-zinc-200/50 dark:border-zinc-900">
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-100 dark:border-zinc-900">
              <div className="flex items-center gap-2">
                {settings?.logo ? (
                  <img src={settings.logo} alt="Logo" className="w-6 h-6 object-contain rounded-lg" />
                ) : (
                  <div className="w-6 h-6 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold text-xs">
                    A
                  </div>
                )}
                <span className="font-extrabold text-md tracking-wider bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent uppercase">
                  Admin Console
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-650 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1">
              {menuItems.map((item) => (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive(item.path)
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'text-zinc-600 dark:text-zinc-450 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {item.icon}
                    {item.name}
                    {item.hasAlert && (
                      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                    )}
                  </div>
                </Link>
              ))}
            </nav>

            <div className="p-4 border-t border-zinc-150 dark:border-zinc-900">
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-sm font-semibold text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all cursor-pointer"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
