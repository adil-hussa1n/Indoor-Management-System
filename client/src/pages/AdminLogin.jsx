import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Mail, ArrowRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

export const AdminLogin = () => {
  const { login, sendOtp, verifyOtp, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [authMode, setAuthMode] = useState('otp'); // 'otp' | 'password'
  const [step, setStep] = useState(1); // 1 = Enter Email/User, 2 = Enter OTP
  const [usernameOrEmail, setUsernameOrEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (!loading && isAdmin) {
      const search = window.location.search;
      navigate(`/admin/dashboard${search}`);
    }
  }, [isAdmin, loading, navigate]);

  useEffect(() => {
    let interval = null;
    if (timer > 0) {
      interval = setInterval(() => setTimer((t) => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Handle Password Login
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    if (!usernameOrEmail || !password) {
      toast.error('Both username/email and password are required.');
      return;
    }

    setSubmitting(true);
    const result = await login(usernameOrEmail, password);
    setSubmitting(false);

    if (result.success) {
      toast.success('Admin login successful!');
      const search = window.location.search;
      navigate(`/admin/dashboard${search}`);
    } else {
      toast.error(result.message);
    }
  };

  // Handle Send Gmail OTP
  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    if (!usernameOrEmail.trim()) {
      toast.error('Please enter your registered Gmail address or Staff Username.');
      return;
    }

    setSubmitting(true);
    const res = await sendOtp(usernameOrEmail.trim());
    setSubmitting(false);

    if (res.success) {
      toast.success(res.message || 'OTP code sent to your Gmail!');
      setStep(2);
      setTimer(60);
    } else {
      toast.error(res.message || 'Failed to send OTP code.');
    }
  };

  // Handle Verify Gmail OTP
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      toast.error('Please enter the 6-digit OTP code sent to your Gmail.');
      return;
    }

    setSubmitting(true);
    const res = await verifyOtp(usernameOrEmail.trim(), otpCode.trim());
    setSubmitting(false);

    if (res.success) {
      toast.success('Gmail OTP Verified! Accessing Admin Dashboard...');
      const search = window.location.search;
      navigate(`/admin/dashboard${search}`);
    } else {
      toast.error(res.message || 'Invalid or expired OTP code.');
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors animate-fade-in py-12">
      <div className="max-w-md w-full">
        <div className="glass-card hover-glow p-8 md:p-10 rounded-3xl shadow-xl border border-zinc-200/50 dark:border-zinc-800 flex flex-col gap-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-650 dark:text-purple-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Admin & Staff Dashboard</h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed font-semibold">
              Sign in with your Gmail OTP or credentials to manage bookings, settings, and calendars.
            </p>
          </div>

          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1.5 rounded-2xl bg-zinc-100 dark:bg-zinc-850/80 border border-zinc-200/80 dark:border-zinc-800 text-xs font-bold">
            <button
              type="button"
              onClick={() => {
                setAuthMode('otp');
                setStep(1);
              }}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'otp'
                  ? 'bg-purple-650 text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Mail className="w-3.5 h-3.5" /> Gmail OTP
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('password')}
              className={`py-2 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                authMode === 'password'
                  ? 'bg-purple-650 text-white shadow-md'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" /> Password
            </button>
          </div>

          {/* Mode 1: Gmail OTP Form */}
          {authMode === 'otp' && (
            <div className="space-y-4 text-left">
              {step === 1 ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <Input
                    label="Gmail Address or Staff Username"
                    placeholder="e.g. manager@venue.com or staff_user"
                    value={usernameOrEmail}
                    onChange={(e) => setUsernameOrEmail(e.target.value)}
                    disabled={submitting}
                    required
                  />
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 mt-4 font-bold cursor-pointer"
                  >
                    {submitting ? 'Sending OTP to Gmail...' : 'Send Verification OTP'}
                    <Mail className="w-4 h-4" />
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs text-purple-700 dark:text-purple-300 font-medium text-center">
                    📧 Verification code sent to your registered Gmail address!
                  </div>

                  <Input
                    label="6-Digit OTP Verification Code"
                    placeholder="Enter 6-digit code (e.g. 591024)"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    disabled={submitting}
                    maxLength={6}
                    required
                    className="text-center font-mono text-lg tracking-widest"
                  />

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full flex items-center justify-center gap-2 mt-4 font-bold cursor-pointer"
                  >
                    {submitting ? 'Verifying Code...' : 'Verify & Sign In To Panel'}
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
                        disabled={submitting}
                        className="text-purple-650 dark:text-purple-400 font-bold hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <RefreshCw className="w-3 h-3" /> Resend OTP
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Mode 2: Password Form */}
          {authMode === 'password' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-4 text-left">
              <Input
                label="Username or Gmail"
                placeholder="Enter admin username or email"
                value={usernameOrEmail}
                onChange={(e) => setUsernameOrEmail(e.target.value)}
                disabled={submitting}
                required
              />

              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                required
              />

              <Button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 mt-6 font-bold cursor-pointer"
              >
                {submitting ? 'Authenticating...' : 'Sign In To Panel'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;
