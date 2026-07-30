import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, User } from 'lucide-react';
import { MASTER_API } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

export const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Set page title and favicon on mount
  React.useEffect(() => {
    document.title = 'Super Admin Console | Darun Tech Private Limited';
    
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    const originalFavicon = link.href;
    link.href = '/daruntech-logo.png';
    link.setAttribute('type', 'image/png');

    return () => {
      // Revert favicon on unmount
      link.href = originalFavicon;
    };
  }, []);

  // Redirect if already logged in as superadmin
  React.useEffect(() => {
    if (localStorage.getItem('superAdminToken')) {
      navigate('/superadmin/dashboard', { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('Both fields are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await MASTER_API.post('/login', { username, password });
      if (res.data.success) {
        localStorage.setItem('superAdminToken', res.data.token);
        toast.success('Super Admin Login Successful!');
        navigate('/superadmin/dashboard', { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors py-12">
      <div className="max-w-md w-full">
        <div className="glass-card hover-glow p-8 md:p-10 rounded-[2rem] shadow-xl border border-zinc-200/50 dark:border-zinc-800 flex flex-col gap-6 text-center bg-white/85 dark:bg-zinc-900/85 backdrop-blur-xl relative">
          <div className="absolute -inset-1 rounded-[2.1rem] bg-gradient-to-r from-purple-600/10 to-indigo-600/10 blur-xl opacity-75 -z-10" />
          
          <div className="space-y-2">
            <div className="mb-4 flex items-center justify-center">
              <img src="/daruntech-logo.png" alt="Darun Tech Logo" className="w-16 h-16 object-contain" />
            </div>
            <h1 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
              Super Admin Console
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed font-semibold">
              Controlled and Managed by <span className="font-bold text-purple-650 dark:text-purple-400">Darun Tech Private Limited</span>.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <Input
              label="Super Username"
              placeholder="Enter super username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
            <Input
              label="Master Password"
              placeholder="••••••••"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
            <Button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 mt-4 font-bold cursor-pointer animate-none"
            >
              {loading ? 'Authenticating...' : 'Enter Master Console'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
