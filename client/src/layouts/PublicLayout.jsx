import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Menu, X, Calendar, Info, Phone, Image as ImageIcon, ShieldAlert } from 'lucide-react';
import { usePublicSettings } from '../hooks/useApi';
import { useSocket } from '../contexts/SocketContext';

export const PublicLayout = () => {
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('theme') === 'dark';
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showPreloader, setShowPreloader] = useState(true);
  const location = useLocation();
  const { data: settings, isLoading, refetch } = usePublicSettings();

  useEffect(() => {
    if (settings && settings.enableDarkMode === false) {
      setDarkMode(false);
    }
  }, [settings]);
  const socket = useSocket();

  useEffect(() => {
    if (socket) {
      const handleSettingsUpdate = () => {
        console.log('Realtime settings update received');
        refetch();
      };
      socket.on('settings-updated', handleSettingsUpdate);
      return () => {
        socket.off('settings-updated', handleSettingsUpdate);
      };
    }
  }, [socket, refetch]);

  useEffect(() => {
    if (!isLoading) {
      const timer = setTimeout(() => {
        setShowPreloader(false);
      }, 1500); // 1.5 seconds minimum load view
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

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
    if (settings) {
      const currentSeoTitle = settings.seo?.title;
      const defaultSeoTitles = ['Apex Indoor Sports Booking', 'Apex Arena'];
      
      if (currentSeoTitle && !defaultSeoTitles.includes(currentSeoTitle)) {
        document.title = currentSeoTitle;
      } else {
        document.title = settings.businessName || 'Apex Arena';
      }
      
      if (settings.theme === 'green') {
        document.documentElement.classList.add('theme-green');
      } else {
        document.documentElement.classList.remove('theme-green');
      }

      if (settings.logo) {
        let link = document.querySelector("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.getElementsByTagName('head')[0].appendChild(link);
        }
        link.href = settings.logo;
        
        // Dynamically update link type attribute based on the image format
        if (settings.logo.startsWith('data:image/svg+xml') || settings.logo.endsWith('.svg')) {
          link.setAttribute('type', 'image/svg+xml');
        } else if (settings.logo.startsWith('data:image/png') || settings.logo.endsWith('.png')) {
          link.setAttribute('type', 'image/png');
        } else if (settings.logo.startsWith('data:image/jpeg') || settings.logo.endsWith('.jpg') || settings.logo.endsWith('.jpeg')) {
          link.setAttribute('type', 'image/jpeg');
        } else {
          link.removeAttribute('type'); // Let browser infer
        }
      }
    }
  }, [settings]);

  const navLinks = [
    { name: 'Home', path: '/', icon: <Info className="w-4 h-4" /> },
    { name: 'About', path: '/about', icon: <Info className="w-4 h-4" /> },
    { name: 'Book Court', path: '/booking', icon: <Calendar className="w-4 h-4" /> },
    { name: 'Gallery', path: '/gallery', icon: <ImageIcon className="w-4 h-4" /> },
    { name: 'Contact', path: '/contact', icon: <Phone className="w-4 h-4" /> },
  ];

  const isActive = (path) => location.pathname === path;

  if (isLoading || showPreloader) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors duration-500">
        <div className="relative flex flex-col items-center gap-8 max-w-md px-6 text-center">
          {/* Outer glowing background orbits */}
          <div className="absolute w-36 h-36 bg-purple-500/10 dark:bg-purple-650/10 blur-2xl rounded-full animate-pulse" />
          
          {/* Logo container with dual gradient borders */}
          <div className="relative flex items-center justify-center">
            {/* Spinning gradient border */}
            <div className="w-24 h-24 rounded-3xl border-2 border-transparent border-t-purple-600 border-r-indigo-500 animate-spin absolute" />
            <div className="w-24 h-24 rounded-3xl border-2 border-transparent border-b-purple-400 border-l-indigo-300 animate-spin absolute [animation-duration:3s]" />
            
            {/* Main glassmorphic logo box */}
            <div className="w-20 h-20 rounded-2xl bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/50 dark:border-zinc-800 backdrop-blur-md flex items-center justify-center shadow-2xl relative z-10 scale-[0.97]">
              {settings?.logo ? (
                <img src={settings.logo} alt="Loading..." className="w-14 h-14 object-contain rounded-lg animate-pulse" />
              ) : (
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-650 to-indigo-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-inner animate-pulse">
                  A
                </div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {/* Dynamic business name with premium gradient */}
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-purple-650 via-violet-500 to-indigo-650 bg-clip-text text-transparent animate-pulse">
              {settings?.businessName || 'Apex Arena'}
            </h2>
            
            {/* Sleek progress bar */}
            <div className="w-48 bg-zinc-200 dark:bg-zinc-800 rounded-full h-1 mx-auto overflow-hidden relative">
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 h-1 rounded-full absolute left-0 top-0 w-full animate-loading-bar" />
            </div>
            
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mt-2">
              Preparing Your Arena
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isAdminLogin = location.pathname === '/admin/login';
  if (isAdminLogin) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-zinc-50 dark:bg-zinc-950 transition-colors duration-300">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-200/50 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {settings?.logo ? (
              <img src={settings.logo} alt="Logo" className="w-9 h-9 object-contain rounded-lg" />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-purple-500/20">
                A
              </div>
            )}
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">
              {settings?.businessName || 'Apex Arena'}
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200 ${
                  isActive(link.path)
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    : 'text-zinc-600 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Header Actions */}
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

            {/* Admin Dashboard shortcut */}
            <Link
              to="/admin"
              className="hidden sm:flex items-center gap-1.5 px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800/80 text-xs font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-150 transition-all bg-white dark:bg-zinc-900"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              Admin
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 text-zinc-600 dark:text-zinc-400 cursor-pointer bg-white dark:bg-zinc-900"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-4 pt-2 pb-4 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  isActive(link.path)
                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                    : 'text-zinc-600 dark:text-zinc-350 hover:bg-zinc-100 dark:hover:bg-zinc-900'
                }`}
              >
                {link.name}
              </Link>
            ))}
            <Link
              to="/admin"
              onClick={() => setMobileMenuOpen(false)}
              className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-150 border-t border-zinc-100 dark:border-zinc-900 mt-2"
            >
              <ShieldAlert className="w-4.5 h-4.5" />
              Admin Dashboard
            </Link>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-200/50 dark:border-zinc-900 bg-white dark:bg-zinc-950 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              {settings?.logo ? (
                <img src={settings.logo} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center text-white font-bold">
                  A
                </div>
              )}
              <span className="font-extrabold text-lg text-zinc-900 dark:text-white">
                {settings?.businessName || 'Apex Arena'}
              </span>
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {settings?.seo?.description || 'Your premium single-playground arena. Book and play effortlessly.'}
            </p>
          </div>

          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-4 uppercase tracking-wider">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm">
              {navLinks.map((link) => (
                <li key={link.name}>
                  <Link to={link.path} className="text-zinc-500 hover:text-purple-600 dark:text-zinc-400 dark:hover:text-purple-400 transition-colors">
                    {link.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-bold text-zinc-900 dark:text-white text-sm mb-4 uppercase tracking-wider">
              Contact & Hours
            </h4>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">
              Email: {settings?.contactEmail}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
              Phone: {settings?.contactPhone}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Weekdays: {settings?.businessHours?.weekday || '08:00 - 22:00'}
            </p>
            <p className="text-xs text-zinc-400 dark:text-zinc-500">
              Weekends: {settings?.businessHours?.weekend || '09:00 - 23:00'}
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto border-t border-zinc-150 dark:border-zinc-900 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-zinc-400 dark:text-zinc-500">
            &copy; {new Date().getFullYear()} {settings?.businessName || 'Apex Arena'}. All rights reserved.
          </p>
          <div className="flex gap-4 text-xs text-zinc-400 dark:text-zinc-500">
            <Link to="/about" className="hover:underline">Rules & Regulations</Link>
            <span>&bull;</span>
            <Link to="/contact" className="hover:underline">Support</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};
