import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, ShieldCheck, RefreshCw, KeyRound } from 'lucide-react';
import { MASTER_API } from '../services/api';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

export const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1); // 1 = Enter Email/User, 2 = Enter 6-digit OTP
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [devOtp, setDevOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
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
      link.href = originalFavicon;
    };
  }, []);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Handler for Sending Gmail OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!usernameOrEmail.trim()) {
      toast.error('Please enter your registered Gmail or Super Username.');
      return;
    }

    setLoading(true);
    try {
      const res = await MASTER_API.post('/send-otp', { usernameOrEmail: usernameOrEmail.trim() });
      if (res.data.success) {
        toast.success(res.data.message || 'OTP code sent to your Gmail!');
        if (res.data.devOtp) setDevOtp(res.data.devOtp);
        setStep(2);
        setTimer(60);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send OTP code. Please check details.');
    } finally {
      setLoading(false);
    }
  };

  // Handler for Verifying Gmail OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error('Please enter the 6-digit OTP code sent to your Gmail.');
      return;
    }

    setLoading(true);
    try {
      const res = await MASTER_API.post('/verify-otp', {
        usernameOrEmail: usernameOrEmail.trim(),
        otp: otpCode.trim(),
      });
      if (res.data.success) {
        toast.success('Gmail OTP Verified! Accessing Master Console...');
        navigate('/superadmin/dashboard', { replace: true });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid or expired OTP code.');
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
              Managed by <span className="font-bold text-purple-650 dark:text-purple-400">Darun Tech Private Limited</span>.
            </p>
          </div>

          <div className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-xs">
            <Mail className="w-3.5 h-3.5" /> Passwordless Gmail OTP Login
          </div>

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4 text-left">
              <Input
                label="Gmail Address or Super Username"
                placeholder="e.g. superadmin or admin@daruntech.com"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                disabled={loading}
                required
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 font-bold cursor-pointer"
              >
                {loading ? 'Sending OTP to Gmail...' : 'Send Verification OTP'}
                <Mail className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
              <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 font-medium text-center space-y-1">
                <div>📧 Verification code sent to your registered Gmail!</div>
                {devOtp && (
                  <div className="font-mono font-bold text-purple-650 dark:text-purple-400 text-xs pt-1">
                    Dev Mock OTP: <span className="underline">{devOtp}</span> (or 123456)
                  </div>
                )}
              </div>

              <Input
                label="6-Digit OTP Verification Code"
                placeholder="Enter 6-digit code (e.g. 849201)"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                disabled={loading}
                maxLength={6}
                required
                className="text-center font-mono text-lg tracking-widest"
              />

              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 font-bold cursor-pointer"
              >
                {loading ? 'Verifying Code...' : 'Verify OTP & Enter Console'}
                <ShieldCheck className="w-4 h-4" />
              </Button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer font-semibold underline"
                >
                  ← Change Email
                </button>
                {timer > 0 ? (
                  <span className="text-zinc-400 font-medium">Resend in {timer}s</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-purple-650 dark:text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Resend OTP
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default SuperAdminLogin;
