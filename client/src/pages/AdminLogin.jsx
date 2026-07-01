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
    <div className="min-h-[80vh] flex items-center justify-center px-4 bg-zinc-50 dark:bg-zinc-950 transition-colors">
      <div className="max-w-md w-full">
        <form onSubmit={handleSubmit(onSubmit)}>
          <Card className="border border-zinc-200/50 dark:border-zinc-800 shadow-xl bg-white dark:bg-zinc-950">
            <CardHeader className="text-center">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-950/30 text-purple-600 flex items-center justify-center mx-auto mb-4">
                <Lock className="w-5 h-5" />
              </div>
              <CardTitle className="text-2xl font-extrabold">Admin Dashboard Login</CardTitle>
              <CardDescription>
                Sign in with credentials to manage bookings, settings, and calendars.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-left">
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
                className="w-full flex items-center justify-center gap-2 mt-6"
              >
                {submitting ? 'Authenticating...' : 'Sign In To Panel'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
};
