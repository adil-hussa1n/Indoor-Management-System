import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, User, ArrowRight, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

const loginFormSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const AdminLogin = () => {
  const { login, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && isAdmin) {
      navigate('/admin/dashboard');
    }
  }, [isAdmin, loading, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      username: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setSubmitting(true);
    const result = await login(data.username, data.password);
    setSubmitting(false);

    if (result.success) {
      toast.success('Admin login successful!');
      navigate('/admin/dashboard');
    } else {
      toast.error(result.message);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors animate-fade-in">
      <div className="max-w-md w-full">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="glass-card hover-glow p-8 md:p-10 rounded-3xl shadow-xl border border-zinc-200/50 dark:border-zinc-800 flex flex-col gap-6">
            <div className="text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 dark:bg-purple-500/20 text-purple-650 dark:text-purple-400 flex items-center justify-center mx-auto mb-2 shadow-inner">
                <Lock className="w-5 h-5" />
              </div>
              <h1 className="text-2xl font-extrabold text-zinc-900 dark:text-white">Admin Dashboard</h1>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                Sign in with credentials to manage bookings, settings, and calendars.
              </p>
            </div>
            <div className="space-y-4 text-left">
              <Input
                label="Username"
                placeholder="Enter admin username"
                error={errors.username?.message}
                {...register('username')}
              />

              <Input
                label="Password"
                type="password"
                placeholder="Enter password"
                error={errors.password?.message}
                {...register('password')}
              />

              <Button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 mt-6 font-bold"
              >
                {submitting ? 'Authenticating...' : 'Sign In To Panel'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
