import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAdminBookings, useCreateManualBooking, useUpdateBookingStatus, useDeleteBooking, useAdminSettings, useAvailableSlots } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { DatePicker } from '../components/ui/DatePicker';
import { Dialog } from '../components/ui/Dialog';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { useSocket } from '../contexts/SocketContext';
import { Search, Plus, Trash2, Edit3, ArrowLeft, ArrowRight, UserCheck, Clock, RefreshCw } from 'lucide-react';

const format12Hour = (time24) => {
  if (!time24) return '';
  const [hourStr, minStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  const displayHour = String(hour).padStart(2, '0');
  return `${displayHour}:${minStr} ${ampm}`;
};

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

  const [selectedSlots, setSelectedSlots] = useState([]);

  const { register, handleSubmit, control, formState: { errors }, reset, watch, setValue } = useForm({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      sport: 'Futsal',
      bookingDate: new Date().toISOString().split('T')[0],
      startTime: '',
      endTime: '',
      duration: 0,
      players: 10,
      notes: '',
    },
  });

  const selectedDate = watch('bookingDate');
  const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useAvailableSlots(selectedDate);

  // Clear slot selection when date changes
  useEffect(() => {
    setSelectedSlots([]);
    setValue('startTime', '');
    setValue('endTime', '');
    setValue('duration', 0);
  }, [selectedDate, setValue]);

  const handleSlotClick = (slot) => {
    if (!slot.isAvailable) return;
    const exists = selectedSlots.some((s) => s.id === slot.id);
    let newSelection = [];
    if (exists) {
      newSelection = selectedSlots.filter((s) => s.id !== slot.id);
    } else {
      newSelection = [...selectedSlots, slot];
    }
    newSelection.sort((a, b) => a.startTime.localeCompare(b.startTime));

    let isContiguous = true;
    for (let i = 0; i < newSelection.length - 1; i++) {
      if (newSelection[i].endTime !== newSelection[i + 1].startTime) {
        isContiguous = false;
        break;
      }
    }

    if (isContiguous) {
      setSelectedSlots(newSelection);
      if (newSelection.length > 0) {
        setValue('startTime', newSelection[0].startTime);
        setValue('endTime', newSelection[newSelection.length - 1].endTime);
        setValue('duration', newSelection.length);
      } else {
        setValue('startTime', '');
        setValue('endTime', '');
        setValue('duration', 0);
      }
    } else {
      setSelectedSlots([slot]);
      setValue('startTime', slot.startTime);
      setValue('endTime', slot.endTime);
      setValue('duration', 1);
      toast.info('Selected slots must be contiguous.');
    }
  };

  const handleCreateManual = (data) => {
    if (selectedSlots.length === 0) {
      toast.error('Please select at least one time slot.');
      return;
    }
    createManualBookingMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Manual booking added successfully!');
        setIsModalOpen(false);
        reset();
        setSelectedSlots([]);
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

  const handleDelete = async (id) => {
    const isConfirmed = await confirm({
      title: 'Delete Booking?',
      message: 'Are you sure you want to delete this booking permanently?',
      confirmText: 'Delete Booking',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
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
    <div className="space-y-6 text-left animate-fade-in">
      {/* Header filter bar */}
      <div className="glass-card p-6 rounded-3xl shadow-sm flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Search name, phone, ref..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-650"
          />
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-655"
          >
            <option value="">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Confirmed">Confirmed</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
          <DatePicker
            value={dateFilter}
            onChange={(val) => { setDateFilter(val); setPage(1); }}
            className="w-48"
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

        <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 font-bold shadow-md shadow-purple-500/10">
          <Plus className="w-4 h-4" /> Add Manual Booking
        </Button>
      </div>

      {isLoading ? (
        <Loader size="large" className="py-20" />
      ) : (
        <div className="glass-card rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 overflow-hidden">
          <div className="p-6 overflow-x-auto custom-scrollbar">
            <table className="w-full text-sm text-left border-collapse min-w-[800px]">
              <thead>
                <tr className="border-b border-zinc-150 dark:border-zinc-800 text-zinc-500 uppercase tracking-wider text-xs font-extrabold">
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
                      <div className="font-bold text-zinc-800 dark:text-zinc-200">{b.customerName}</div>
                      <div className="text-xs text-zinc-450">{b.phone} | {b.email || 'No email'}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-zinc-650 dark:text-zinc-350">{b.sport}</td>
                    <td className="py-3.5 px-4">
                      <div className="text-zinc-855 dark:text-zinc-200 font-semibold">{new Date(b.bookingDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                      <div className="text-xs text-zinc-500">{format12Hour(b.startTime)} - {format12Hour(b.endTime)} ({b.duration} hr)</div>
                    </td>
                    <td className="py-3.5 px-4 font-extrabold text-zinc-855 dark:text-zinc-100">৳{b.price}</td>
                    <td className="py-3.5 px-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        b.status === 'Confirmed'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                          : b.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                          : b.status === 'Completed'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                          : 'bg-zinc-100 text-zinc-850 dark:bg-zinc-900 dark:text-zinc-400'
                      }`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 flex items-center justify-center gap-2">
                      <select
                        value={b.status}
                        onChange={(e) => handleStatusChange(b._id, e.target.value)}
                        className={`text-xs px-3 py-1.5 border rounded-full font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 cursor-pointer shadow-sm ${
                          b.status === 'Confirmed'
                            ? 'border-emerald-250 text-emerald-700 bg-emerald-50/30 dark:border-emerald-900/40 dark:text-emerald-400 dark:bg-emerald-950/20'
                            : b.status === 'Pending'
                            ? 'border-amber-250 text-amber-700 bg-amber-50/30 dark:border-amber-900/40 dark:text-amber-455 dark:bg-amber-950/20'
                            : b.status === 'Completed'
                            ? 'border-blue-250 text-blue-700 bg-blue-50/30 dark:border-blue-900/40 dark:text-blue-400 dark:bg-blue-950/20'
                            : 'border-zinc-200 text-zinc-500 bg-zinc-50/30 dark:border-zinc-800 dark:text-zinc-400 dark:bg-zinc-900/20'
                        }`}
                      >
                        <option value="Pending">Pending</option>
                        <option value="Confirmed">Confirmed</option>
                        <option value="Completed">Completed</option>
                        <option value="Cancelled">Cancelled</option>
                      </select>
                      <button
                        onClick={() => handleDelete(b._id)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all duration-200 cursor-pointer"
                        title="Delete booking"
                      >
                        <Trash2 className="w-4 h-4" />
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
                    className="p-2 text-xs font-bold"
                  >
                    <ArrowLeft className="w-4 h-4" /> Previous
                  </Button>
                  <Button
                    variant="outline"
                    disabled={page >= bookingData.pagination.totalPages}
                    onClick={() => setPage(p => p + 1)}
                    className="p-2 text-xs font-bold"
                  >
                    Next <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Manual Booking Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Manual Admin Booking"
        className="max-w-4xl"
      >
        <form onSubmit={handleSubmit(handleCreateManual)} className="space-y-6 pt-4 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column: Customer Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-900 pb-2">
                👤 Customer Information
              </h4>
              <Input
                label="Customer Name"
                placeholder="John Doe"
                error={errors.customerName?.message}
                {...register('customerName')}
              />
              <Input
                label="Phone Number"
                placeholder="e.g. +88017..."
                error={errors.phone?.message}
                {...register('phone')}
              />
              <Input
                label="Email (Optional)"
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
                  label="Player Count"
                  type="number"
                  error={errors.players?.message}
                  {...register('players')}
                />
              </div>
              <Input
                label="Internal Booking Notes (Optional)"
                placeholder="e.g. VIP client, offline cash paid..."
                error={errors.notes?.message}
                {...register('notes')}
              />
            </div>

            {/* Right Column: Slot Selection */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-900 pb-2">
                📅 Slot Selection
              </h4>
              
              <Controller
                name="bookingDate"
                control={control}
                render={({ field }) => (
                  <DatePicker
                    label="Select Date"
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.bookingDate?.message}
                    className="w-full"
                  />
                )}
              />

              {/* Slots Selection Box */}
              <div className="bg-zinc-50/50 dark:bg-zinc-900/10 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" /> Choose Time Slots
                  </span>
                  <button
                    type="button"
                    onClick={() => refetchSlots()}
                    className="p-1 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                    title="Refresh slots"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {slotsLoading ? (
                  <Loader className="py-6" />
                ) : slotData?.isBlocked ? (
                  <div className="text-center py-4 text-xs font-bold text-rose-500 border border-rose-100 dark:border-rose-955/20 bg-rose-50/20 rounded-xl">
                    ⚠️ Closed on this date ({slotData.reason})
                  </div>
                ) : !slotData?.slots?.length ? (
                  <div className="text-center py-4 text-xs font-semibold text-zinc-450 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
                    No slots configured for this date.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar pr-1">
                    {slotData.slots.map((slot) => {
                      const isSelected = selectedSlots.some((s) => s.id === slot.id);
                      return (
                        <button
                          key={slot.id}
                          type="button"
                          onClick={() => handleSlotClick(slot)}
                          className={`p-2 rounded-xl border text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center gap-1 select-none cursor-pointer ${
                            !slot.isAvailable
                              ? 'bg-rose-50/20 dark:bg-rose-955/5 border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-500 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/20'
                              : 'bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400'
                          }`}
                          disabled={!slot.isAvailable}
                        >
                          <span className="font-extrabold text-[11px]">{format12Hour(slot.startTime)}</span>
                          <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                            !slot.isAvailable
                              ? 'bg-rose-100/50 dark:bg-rose-950/30 text-rose-600'
                              : isSelected
                              ? 'bg-purple-500/30 text-white'
                              : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400'
                          }`}>
                            {slot.isAvailable ? (slot.rateType === 'night' ? 'Night' : 'Day') : 'Booked'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Schedule Summary */}
              <div className="bg-purple-500/5 dark:bg-purple-950/10 border border-purple-500/10 dark:border-purple-900/20 rounded-2xl p-4 flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-500">Selected Schedule:</span>
                <span className="font-extrabold text-sm text-purple-650 dark:text-purple-400">
                  {selectedSlots.length > 0
                    ? `${format12Hour(selectedSlots[0].startTime)} - ${format12Hour(selectedSlots[selectedSlots.length - 1].endTime)} (${watch('duration')} hr)`
                    : 'No Slots Selected'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-4 flex justify-end">
            <Button type="submit" className="w-full sm:w-auto px-8 py-3 font-bold" disabled={createManualBookingMutation.isPending}>
              {createManualBookingMutation.isPending ? 'Saving Booking...' : 'Confirm Manual Entry'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
};
