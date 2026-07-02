import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Phone, MapPin, Send, MessageCircle } from 'lucide-react';
import { usePublicSettings, useSubmitContact } from '../hooks/useApi';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { useToast } from '../components/ui/Toast';

const contactFormSchema = z.object({
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export const Contact = () => {
  const toast = useToast();
  const { data: settings } = usePublicSettings();
  const submitContactMutation = useSubmitContact();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: '',
      email: '',
      phone: '',
      message: '',
    },
  });

  const onSubmit = (formData) => {
    submitContactMutation.mutate(formData, {
      onSuccess: (data) => {
        toast.success(data.message || 'Message sent successfully!');
        reset();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Failed to send message. Try again later.');
      },
    });
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-left animate-fade-in">
      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-6 text-center">
        Contact <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Us</span>
      </h1>
      
      <p className="text-lg text-zinc-650 dark:text-zinc-400 mb-12 text-center max-w-2xl mx-auto leading-relaxed">
        Have questions about rental packages, tournaments, or corporate reservations? Drop us a line below.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Contact details */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card p-6 rounded-2xl shadow-sm space-y-6">
            <div>
              <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Business Information</h3>
              <p className="text-xs text-zinc-400 mt-1">Reach out to us directly.</p>
            </div>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 dark:bg-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Email Support</h4>
                  <p className="text-zinc-800 dark:text-zinc-200 font-semibold">{settings?.contactEmail}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
                  <Phone className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Phone Hotline</h4>
                  <p className="text-zinc-800 dark:text-zinc-200 font-semibold">{settings?.contactPhone}</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-pink-500/10 dark:bg-pink-500/20 flex items-center justify-center text-pink-650 dark:text-pink-400 flex-shrink-0">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-xs text-zinc-400 uppercase tracking-wider">Arena Location</h4>
                  <p className="text-zinc-800 dark:text-zinc-200 font-semibold leading-relaxed">
                    {settings?.contactAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {settings?.socialLinks?.whatsapp && (
            <div className="glass-card hover-glow p-6 rounded-2xl border border-emerald-250/20 bg-emerald-50/5 dark:bg-emerald-950/5 flex flex-col items-center text-center gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
                <MessageCircle className="w-6 h-6 fill-white text-emerald-500" />
              </div>
              <div>
                <h4 className="font-bold text-md text-zinc-900 dark:text-white">Quick Chat on WhatsApp</h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-xs leading-relaxed">
                  Need instant answers? Text our manager directly on WhatsApp.
                </p>
              </div>
              <a
                href={settings.socialLinks.whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full"
              >
                <Button variant="secondary" className="w-full border-emerald-300 dark:border-emerald-950 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 transition-all font-bold">
                  Start WhatsApp Chat
                </Button>
              </a>
            </div>
          )}
        </div>

        {/* Right Column: Contact form */}
        <div className="lg:col-span-7">
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="glass-card p-8 rounded-2xl shadow-sm space-y-6">
              <div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Send Us a Message</h3>
                <p className="text-xs text-zinc-400 mt-1">Fill out the contact sheet.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    placeholder="e.g. John Doe"
                    error={errors.name?.message}
                    {...register('name')}
                  />
                  <Input
                    label="Email Address"
                    placeholder="e.g. john@example.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>
                <Input
                  label="Phone (Optional)"
                  placeholder="e.g. 555-0199"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                    Your Message
                  </label>
                  <textarea
                    rows="5"
                    placeholder="Type your message details here..."
                    className={`w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all ${
                      errors.message ? 'border-red-500 focus:ring-red-500/20' : ''
                    }`}
                    {...register('message')}
                  />
                  {errors.message && (
                    <span className="text-xs text-red-500 mt-0.5">{errors.message.message}</span>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={submitContactMutation.isPending}
                  className="w-full pt-3 pb-3 font-bold"
                >
                  {submitContactMutation.isPending ? 'Sending Message...' : 'Send Message'}
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
