import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAdminBookings, useCreateManualBooking, useUpdateBookingStatus, useDeleteBooking, useAdminSettings } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useSocket } from '../contexts/SocketContext';
import { Search, Plus, Trash2, Edit3, ArrowLeft, ArrowRight, UserCheck } from 'lucide-react';

const manualBookingSchema = z.object({
  customerName: z.string().min(2, 'Name is required'),
  phone: z.string().min(7, 'Phone number is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  sport: z.string().min(1, 'Sport is required'),
  bookingDate: z.string().refine((val) => !isNaN(Date.parse(val)), { message: 'Invalid date' }),
  startTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Format HH:MM'),
  endTime: z.string().regex(/^([0-9]|0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/, 'Format HH:MM'),
  duration: z.coerce.number().min(1),
  players: z.coerce.number().min(1),
  notes: z.string().optional(),
});

export const AdminBookings = () => {
  const toast = useToast();
  const socket = useSocket();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: settings } = useAdminSettings();
  const { data: bookingData, isLoading, refetch } = useAdminBookings({
    page,
    limit: 10,
    search,
    status: statusFilter,
    sport: sportFilter,
    startDate: dateFilter,
    endDate: dateFilter,
  });

  useEffect(() => {
    if (socket) {
      const handleRealtimeUpdate = () => {
        console.log('Realtime update: Refreshing bookings...');
        refetch();
      };
      socket.on('slot-status-changed', handleRealtimeUpdate);
      return () => {
        socket.off('slot-status-changed', handleRealtimeUpdate);
      };
    }
  }, [socket, refetch]);

  const createManualBookingMutation = useCreateManualBooking();
  const updateStatusMutation = useUpdateBookingStatus();
  const deleteBookingMutation = useDeleteBooking();

  const { register, handleSubmit, formState: { errors }, reset } = useForm({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      sport: 'Futsal',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: '09:00',
      endTime: '10:00',
      duration: 1,
      players: 10,
      notes: '',
    },
  });

  const handleCreateManual = (data) => {
    createManualBookingMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Manual booking added successfully!');
        setIsModalOpen(false);
        reset();
        refetch();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Double booking collision detected.');
      },
    });
  };

  const handleStatusChange = (id, newStatus) => {
    updateStatusMutation.mutate(
      { id, status: newStatus },
      {
        onSuccess: () => {
          toast.success(`Status updated to ${newStatus}`);
          refetch();
        },
        onError: () => toast.error('Failed to update status'),
      }
    );
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this booking permanently?')) {
      deleteBookingMutation.mutate(id, {
        onSuccess: () => {
          toast.success('Booking deleted');
          refetch();
        },
        onError: () => toast.error('Deletion failed'),
      });
    }
  };

  const sportOptions = settings?.availableSports?.map(s => ({ value: s, label: s })) || [
    { value: 'Futsal', label: 'Futsal' },
    { value: 'Basketball', label: 'Basketball' },
    { value: 'Badminton', label: 'Badminton' },
    { value: 'Volleyball', label: 'Volleyball' },
  ];

  return (
    <div className="space-y-6 text-left">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, phone, ref..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => { setDateFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
          {dateFilter && (
            <button
              onClick={() => { setDateFilter(''); setPage(1); }}
              className="text-xs text-rose-500 font-bold hover:underline whitespace-nowrap"
            >
              Clear Date
            </button>
          )}
        </div>

        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Manual Booking
        </Button>
      </div>

      {isLoading ? (
        <Loader size="large" className="py-20" />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto pt-6">
            <table className="w-full text-sm text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-550 uppercase tracking-wider text-xs font-bold">
                  <th className="py-3 px-4">Ref ID</th>
                  <th className="py-3 px-4">Customer</th>
                  <th className="py-3 px-4">Sport</th>
                  <th className="py-3 px-4">Schedule</th>
                  <th className="py-3 px-4">Price</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {bookingData?.bookings?.map((b) => (
                  <tr key={b._id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                    <td className="py-3.5 px-4 font-bold text-purple-650">{b.bookingId}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-105">{b.customerName}</div>
                      <div className="text-xs text-zinc-500">{b.phone} | {b.email || 'No email'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-medium">{b.sport}</td>
                    <td className="py-3.5 px-4">
                      <div className="font-semibold">{new Date(b.bookingDate).toLocaleDateString('en-BD')}</div>
                      <div className="text-xs text-zinc-550">{b.startTime} - {b.endTime} ({b.duration} hr)</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold">৳{b.price}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        b.status === 'Confirmed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30'
                          : b.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30'
                          : b.status === 'Completed'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30'
                          : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 flex items-center justify-center gap-2">
                      <select
                        value={b.status}
                        onChange={(e) => handleStatusChange(b._id, e.target.value)}
                        className="text-xs px-2 py-1 border border-zinc-200 dark:border-zinc-800 rounded bg-white dark:bg-zinc-950 focus:outline-none"
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <button
                        onClick={() => handleDelete(b._id)}
                        className="p-1.5 text-zinc-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {bookingData?.pagination && (
              <div className="mt-6 flex items-center justify-between border-t border-zinc-150 dark:border-zinc-800 pt-4">
                <span className="text-xs text-zinc-500">
                  Showing page {bookingData.pagination.page} of {bookingData.pagination.totalPages}
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage(p => p - 1)}
                    className="p-2"
                  >
                    <ArrowLeft className="w-4 h-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= bookingData.pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Manual Booking Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Manual Admin Booking"
      >
        <form onSubmit={handleSubmit(handleCreateManual)} className="space-y-4 pt-4 text-left">
          <Input
            label="Customer Name"
            placeholder="John Doe"
            error={errors.customerName?.message}
            {...register('customerName')}
          />
          <Input
            label="Phone"
            placeholder="555-0199"
            error={errors.phone?.message}
            {...register('phone')}
          />
          <Input
            label="Email"
            placeholder="john@example.com"
            error={errors.email?.message}
            {...register('email')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Sport"
              options={sportOptions}
              error={errors.sport?.message}
              {...register('sport')}
            />
            <Input
              label="Players"
              type="number"
              error={errors.players?.message}
              {...register('players')}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Date"
              type="date"
              error={errors.bookingDate?.message}
              {...register('bookingDate')}
            />
            <Input
              label="Start (HH:MM)"
              placeholder="09:00"
              error={errors.startTime?.message}
              {...register('startTime')}
            />
            <Input
              label="End (HH:MM)"
              placeholder="10:00"
              error={errors.endTime?.message}
              {...register('endTime')}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Duration (Hours)"
              type="number"
              error={errors.duration?.message}
              {...register('duration')}
            />
            <Input
              label="Booking Notes"
              placeholder="Admin manual entry..."
              error={errors.notes?.message}
              {...register('notes')}
            />
          </div>

          <Button type="submit" className="w-full mt-4">
            Confirm Manual Entry
          </Button>
        </form>
      </Dialog>
    </div>
  );
};
