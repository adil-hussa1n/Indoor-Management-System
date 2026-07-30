import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, ShieldCheck, ArrowRight, RefreshCw, KeyRound } from 'lucide-react';
import { useUserAuth } from '../contexts/UserAuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

export const UserLogin = () => {
  const { sendOtp, verifyOtp, isAuthenticated } = useUserAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState(1); // 1 = input phone, 2 = verify OTP
  const [loading, setLoading] = useState(false);
  const [devOtp, setDevOtp] = useState('');

  // Redirect if already logged in
  React.useEffect(() => {
    if (isAuthenticated) {
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, location]);

  const handleSendOtp = async (e) => {
    e.preventDefault();
    if (!phone || phone.length < 9) {
      toast.error('Please enter a valid phone number.');
      return;
    }

    setLoading(true);
    const res = await sendOtp(phone);
    setLoading(false);

    if (res.success) {
      toast.success(res.message);
      setStep(2);
      if (res.devOtp) {
        setDevOtp(res.devOtp);
      }
    } else {
      toast.error(res.message);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    if (!code || code.length !== 6) {
      toast.error('Please enter the 6-digit OTP code.');
      return;
    }

    setLoading(true);
    const res = await verifyOtp(phone, code);
    setLoading(false);

    if (res.success) {
      toast.success('Login successful!');
      const from = location.state?.from?.pathname || '/dashboard';
      navigate(from, { replace: true });
    } else {
      toast.error(res.message);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors py-12">
      <div className="max-w-md w-full">
        <div className="glass-card hover-glow p-8 md:p-10 rounded-3xl shadow-xl border border-zinc-200/50 dark:border-zinc-800 flex flex-col gap-6 text-center">
          <div className="space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-violet-500/10 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
              {step === 1 ? <Phone className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
            </div>
            <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">
              {step === 1 ? 'Customer Login' : 'Enter OTP Verification'}
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
              {step === 1
                ? 'Sign in or register instantly using your phone number with a secure OTP.'
                : `We've sent a 6-digit code to ${phone}. Enter it below.`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4 text-left">
              <Input
                label="Phone Number"
                placeholder="e.g. 01712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
                required
              />
              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 font-bold"
              >
                {loading ? 'Sending OTP...' : 'Send Verification Code'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4 text-left">
              <Input
                label="6-Digit Verification Code"
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                required
              />

              {devOtp && (
                <div className="p-3 bg-violet-550/10 dark:bg-violet-500/10 text-violet-650 dark:text-violet-400 text-xs rounded-xl border border-violet-500/25 text-center font-mono">
                  [DEV MODE] Auto-OTP: <strong>{devOtp}</strong>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 font-bold"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
                <ShieldCheck className="w-4 h-4" />
              </Button>

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 font-medium transition-colors flex items-center justify-center gap-1.5 mt-2"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Change Phone Number
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserLogin;
