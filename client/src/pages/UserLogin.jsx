import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Phone, ShieldCheck, ArrowRight, RefreshCw, KeyRound, Sparkles } from 'lucide-react';
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
    <div className="min-h-screen relative flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors py-12 overflow-hidden">
      {/* Background Glowing Blobs */}
      <div className="absolute w-80 h-80 rounded-full bg-violet-650/10 dark:bg-violet-600/5 blur-3xl top-1/4 -left-10 animate-pulse [animation-duration:8s]" />
      <div className="absolute w-96 h-96 rounded-full bg-indigo-650/10 dark:bg-indigo-600/5 blur-3xl bottom-1/4 -right-10 animate-pulse [animation-duration:12s]" />

      <div className="max-w-md w-full relative z-10">
        <div className="backdrop-blur-md bg-white/70 dark:bg-zinc-900/70 border border-white/20 dark:border-zinc-800 shadow-2xl p-8 md:p-10 rounded-3xl flex flex-col gap-6 text-center transition-all duration-300">
          <div className="space-y-2">
            <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/10 to-indigo-500/10 dark:from-violet-500/20 dark:to-indigo-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center mx-auto mb-3 shadow-inner group">
              {/* Outer pulsing ring */}
              <div className="absolute inset-0 rounded-2xl bg-violet-500/20 dark:bg-violet-500/30 scale-100 group-hover:scale-110 transition-all duration-300 animate-ping [animation-duration:3s]" />
              {step === 1 ? (
                <Phone className="w-6 h-6 relative z-10 transition-transform group-hover:scale-110 duration-300" />
              ) : (
                <KeyRound className="w-6 h-6 relative z-10 transition-transform group-hover:scale-110 duration-300" />
              )}
            </div>
            <h1 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center justify-center gap-1.5">
              {step === 1 ? 'Customer Login' : 'OTP Verification'}
              <Sparkles className="w-5 h-5 text-indigo-550 dark:text-indigo-400 animate-pulse" />
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-405 max-w-xs mx-auto leading-relaxed font-semibold">
              {step === 1
                ? 'Sign in or register instantly using your phone number with a secure OTP.'
                : `We've sent a 6-digit code to ${phone}. Enter it below.`}
            </p>
          </div>

          {step === 1 ? (
            <form onSubmit={handleSendOtp} className="space-y-4 text-left animate-fade-in">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Phone Number</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400 dark:text-zinc-500">
                    <span className="text-sm font-extrabold">+88</span>
                  </div>
                  <input
                    type="tel"
                    placeholder="01711223344"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full pl-14 pr-4 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-zinc-650 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-medium transition-all"
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 font-extrabold py-3 bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-700 hover:to-indigo-755 text-white border-none shadow-md hover:shadow-lg transition-all duration-300"
              >
                {loading ? 'Sending OTP...' : 'Send Verification Code'}
                <ArrowRight className="w-4.5 h-4.5" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-5 text-left animate-fade-in">
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300">6-Digit Verification Code</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="------"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    disabled={loading}
                    required
                    className="w-full text-center text-2xl tracking-[1em] pl-[0.5em] py-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 font-extrabold font-mono transition-all"
                  />
                </div>
              </div>

              {devOtp && (
                <div className="p-3 bg-violet-500/5 dark:bg-violet-500/10 text-violet-600 dark:text-violet-400 text-xs rounded-xl border border-violet-550/20 dark:border-violet-500/20 text-center font-mono animate-fade-in shadow-inner">
                  [DEV MODE] Auto-OTP: <strong className="bg-violet-555/10 px-1.5 py-0.5 rounded text-sm select-all">{devOtp}</strong>
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 mt-4 font-extrabold py-3 bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-700 hover:to-indigo-755 text-white border-none shadow-md hover:shadow-lg transition-all duration-300"
              >
                {loading ? 'Verifying...' : 'Verify & Sign In'}
                <ShieldCheck className="w-4.5 h-4.5" />
              </Button>

              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={loading}
                className="w-full text-center text-xs text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 font-bold transition-colors flex items-center justify-center gap-1.5 mt-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 animate-spin-hover" />
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
