import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAdminBookings, useCreateManualBooking, useUpdateBookingStatus, useDeleteBooking, useAdminSettings, useAvailableSlots, useUpdateBooking, usePublicGrounds } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { DatePicker } from '../components/ui/DatePicker';
import { Dialog } from '../components/ui/Dialog';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { useSocket } from '../contexts/SocketContext';
import { Search, Plus, Trash2, Edit3, ArrowLeft, ArrowRight, UserCheck, Clock, RefreshCw, Layers } from 'lucide-react';

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


const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export const AdminBookings = () => {
  const toast = useToast();
  const socket = useSocket();

  // Navigation & Filters
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [groundFilter, setGroundFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: settings } = useAdminSettings();
  const { data: bookingData, isLoading, refetch } = useAdminBookings({
    page,
    limit: 10,
    search,
    status: statusFilter,
    sport: sportFilter,
    groundId: groundFilter || undefined,
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
  const updateBookingMutation = useUpdateBooking();

  // Booking Edit states
  const [editingBooking, setEditingBooking] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  // Refund Modal states
  const [refundingBooking, setRefundingBooking] = useState(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [isRefunding, setIsRefunding] = useState(false);

  // Settle Due State & Handlers
  const [settleBooking, setSettleBooking] = useState(null);
  const [settleAmount, setSettleAmount] = useState('');
  const [settleMethod, setSettleMethod] = useState('Cash');
  const [settleTrxId, setSettleTrxId] = useState('');
  const [isSettling, setIsSettling] = useState(false);

  const handleOpenRefundModal = (booking) => {
    setRefundingBooking(booking);
    setRefundAmount(booking.paidAmount || booking.price || 0);
    setRefundReason('Slot cancellation requested by customer');
  };

  const handleExecuteRefund = async () => {
    if (!refundingBooking) return;
    setIsRefunding(true);
    try {
      const apiModule = await import('../services/api');
      const API = apiModule.default;
      const res = await API.post(`/bookings/${refundingBooking._id}/refund`, {
        refundAmount,
        refundReason,
      });
      if (res.data.success) {
        toast.success(res.data.message || 'Refund processed successfully');
        setRefundingBooking(null);
        refetch();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setIsRefunding(false);
    }
  };

  const handleOpenSettleModal = (booking) => {
    const calculatedDue = booking.dueAmount !== undefined
      ? Number(booking.dueAmount)
      : Math.max(0, Number(booking.price || 0) - Number(booking.paidAmount || 0));
    setSettleBooking(booking);
    setSettleAmount(calculatedDue > 0 ? calculatedDue.toString() : '');
    setSettleMethod('Cash');
    setSettleTrxId('');
  };

  const handleExecuteSettleDue = () => {
    if (!settleBooking) return;
    const amountToCollect = Number(settleAmount);
    if (!amountToCollect || amountToCollect <= 0) {
      toast.error('Please enter a valid amount to collect.');
      return;
    }

    const currentPaid = Number(settleBooking.paidAmount || 0);
    const totalPrice = Number(settleBooking.price || 0);
    const newPaidAmount = currentPaid + amountToCollect;
    const newDueAmount = Math.max(0, totalPrice - newPaidAmount);
    const newPaymentStatus = newDueAmount <= 0 ? 'paid' : 'partial';

    setIsSettling(true);
    updateBookingMutation.mutate(
      {
        id: settleBooking._id,
        data: {
          paidAmount: newPaidAmount,
          dueAmount: newDueAmount,
          paymentStatus: newPaymentStatus,
          paymentMethod: settleMethod,
          transactionId: settleTrxId || settleBooking.transactionId,
        },
      },
      {
        onSuccess: () => {
          toast.success(`Successfully collected ৳${amountToCollect} due payment!`);
          setSettleBooking(null);
          setIsSettling(false);
          refetch();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Failed to collect due payment.');
          setIsSettling(false);
        },
      }
    );
  };

  const [selectedSlots, setSelectedSlots] = useState([]);

  const { register, handleSubmit, control, formState: { errors }, reset, watch, setValue } = useForm({
    resolver: zodResolver(manualBookingSchema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      sport: 'Football',
      bookingDate: getLocalDateString(),
      startTime: '',
      endTime: '',
      duration: 0,
      players: 10,
      notes: '',
    },
  });

  const { data: grounds } = usePublicGrounds();
  const [selectedGroundId, setSelectedGroundId] = useState('');
  const [editGroundId, setEditGroundId] = useState('');

  // Auto-select first active ground for manual booking
  useEffect(() => {
    if (grounds && grounds.length > 0 && !selectedGroundId) {
      const active = grounds.filter(g => g.isActive);
      if (active.length > 0) {
        setSelectedGroundId(active[0].id.toString());
      }
    }
  }, [grounds, selectedGroundId]);

  const selectedDate = watch('bookingDate');
  const activeGroundForSlots = isEditModalOpen ? (editGroundId || selectedGroundId) : selectedGroundId;
  const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useAvailableSlots(selectedDate, activeGroundForSlots);

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

  const [manualPaymentMethod, setManualPaymentMethod] = useState('Cash');
  const [manualPaymentStatus, setManualPaymentStatus] = useState('paid');
  const [manualPaidAmount, setManualPaidAmount] = useState('');
  const [manualTransactionId, setManualTransactionId] = useState('');

  // Admin Manual Discount states
  const [manualDiscountType, setManualDiscountType] = useState('none');
  const [manualDiscountValue, setManualDiscountValue] = useState('');

  const defaultMethods = ['Cash', 'bKash Personal / Manual', 'POS / Card', 'Bank Transfer', 'Pay After Match'];
  const availableMethods = settings?.paymentConfig?.customPaymentMethods || defaultMethods;
  const methodOptions = availableMethods.map(m => ({ value: m, label: m }));

  const manualSubtotal = selectedSlots.reduce((sum, s) => sum + Number(s.price || 1500), 0);
  const manualDiscountAmount = React.useMemo(() => {
    if (manualDiscountType === 'none' || !manualDiscountValue || manualSubtotal <= 0) return 0;
    const val = Number(manualDiscountValue) || 0;
    if (manualDiscountType === 'percentage') {
      return Math.round((manualSubtotal * val) / 100);
    } else {
      return Math.min(manualSubtotal, val);
    }
  }, [manualDiscountType, manualDiscountValue, manualSubtotal]);

  const manualFinalPrice = Math.max(0, manualSubtotal - manualDiscountAmount);

  // Auto-update paid amount when selected slots or discount changes
  useEffect(() => {
    if (selectedSlots.length > 0 && manualPaymentStatus === 'paid') {
      setManualPaidAmount(manualFinalPrice.toString());
    }
  }, [selectedSlots, manualFinalPrice, manualPaymentStatus]);

  const handleCreateManual = (data) => {
    if (selectedSlots.length === 0) {
      toast.error('Please select at least one time slot.');
      return;
    }
    const payload = {
      ...data,
      groundId: selectedGroundId ? Number(selectedGroundId) : undefined,
      price: manualFinalPrice,
      paymentMethod: manualPaymentMethod,
      paymentStatus: manualPaymentStatus,
      paidAmount: manualPaidAmount !== '' ? Number(manualPaidAmount) : undefined,
      transactionId: manualTransactionId,
      notes: manualDiscountAmount > 0
        ? `[Manual Discount: ${manualDiscountType === 'percentage' ? `${manualDiscountValue}%` : `৳${manualDiscountValue}`} (-৳${manualDiscountAmount})] ${data.notes || ''}`.trim()
        : data.notes,
    };
    createManualBookingMutation.mutate(payload, {
      onSuccess: () => {
        toast.success('Manual booking added successfully!');
        setIsModalOpen(false);
        reset();
        setSelectedSlots([]);
        setManualPaymentMethod('Cash');
        setManualPaymentStatus('paid');
        setManualPaidAmount('');
        setManualTransactionId('');
        setManualDiscountType('none');
        setManualDiscountValue('');
        refetch();
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Double booking collision detected.');
      },
    });
  };

  const handleEditClick = (booking) => {
    setEditingBooking(booking);
    setEditGroundId(booking.groundId ? booking.groundId.toString() : (grounds?.[0]?.id?.toString() || ''));
    setValue('customerName', booking.customerName);
    setValue('phone', booking.phone);
    setValue('email', booking.email || '');
    setValue('sport', booking.sport);
    setValue('bookingDate', booking.bookingDate);
    setValue('startTime', booking.startTime);
    setValue('endTime', booking.endTime);
    setValue('duration', booking.duration);
    setValue('players', booking.players);
    setValue('notes', booking.notes || '');

    // Clear slots so that new selection handles slot highlights if they want to reschedule
    setSelectedSlots([]);
    setIsEditModalOpen(true);
  };

  const handleUpdateBookingSubmit = (data) => {
    // If they picked new slots, use them. Otherwise, keep the original time slots.
    const payload = { ...data };
    payload.groundId = editGroundId ? Number(editGroundId) : undefined;

    if (selectedSlots.length > 0) {
      payload.startTime = selectedSlots[0].startTime;
      payload.endTime = selectedSlots[selectedSlots.length - 1].endTime;
      payload.duration = selectedSlots.length;
      // Recalculate price if new slots were selected
      const newPrice = selectedSlots.reduce((sum, s) => sum + Number(s.price || 1500), 0);
      payload.price = newPrice;
    }

    updateBookingMutation.mutate(
      { id: editingBooking._id, data: payload },
      {
        onSuccess: () => {
          toast.success('Booking updated successfully!');
          setIsEditModalOpen(false);
          setEditingBooking(null);
          setSelectedSlots([]);
          refetch();
        },
        onError: (err) => {
          toast.error(err.response?.data?.message || 'Failed to update booking.');
        },
      }
    );
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
      {/* Bookings Content */}
      <>
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

            {/* Arena / Ground Filter */}
            {grounds && grounds.length > 0 && (
              <select
                value={groundFilter}
                onChange={(e) => { setGroundFilter(e.target.value); setPage(1); }}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-2 focus:ring-purple-650"
              >
                <option value="">All Arenas / Grounds</option>
                {grounds.map(g => (
                  <option key={g.id} value={g.id}>{g.name} ({g.sport || 'Sports'})</option>
                ))}
              </select>
            )}
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
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                  {bookingData?.bookings?.map((b) => (
                    <tr key={b._id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                      <td className="py-3.5 px-4 font-bold text-purple-650">{b.bookingId}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-zinc-800 dark:text-zinc-200">{b.customerName}</span>
                          {b.hasSuspiciousHistory && (
                            <span
                              className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse cursor-help"
                              title={`Warning: Suspicious History! ${b.suspiciousReason}`}
                            >
                              ⚠️ Suspicious
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-450">{b.phone} | {b.email || 'No email'}</div>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-zinc-655 dark:text-zinc-355">{b.sport}</td>
                      <td className="py-3.5 px-4">
                        <div className="text-zinc-855 dark:text-zinc-200 font-semibold">{new Date(b.bookingDate).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
                        <div className="text-xs text-zinc-500">{format12Hour(b.startTime)} - {format12Hour(b.endTime)} ({b.duration} hr)</div>
                      </td>
                      <td className="py-3.5 px-4 font-extrabold text-zinc-855 dark:text-zinc-100">৳{b.price}</td>
                      <td className="py-3.5 px-4">
                        <div className="flex flex-col gap-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-black uppercase w-fit ${b.paymentStatus === 'paid'
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : b.paymentStatus === 'partial'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                                : b.paymentStatus === 'refunded'
                                  ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                  : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}>
                            💳 {b.paymentStatus || 'unpaid'}
                          </span>
                          <span className="text-[10px] font-mono text-zinc-500">
                            Paid: ৳{b.paidAmount || 0} {b.dueAmount > 0 ? `| Due: ৳${b.dueAmount}` : ''}
                          </span>
                          {b.transactionId && (
                            <span className="text-[10px] font-mono text-purple-600 dark:text-purple-400 font-bold truncate max-w-[120px]">
                              Gateway: {b.paymentGateway || 'online'} ({b.transactionId})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${b.status === 'Confirmed'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400'
                            : b.status === 'Pending'
                              ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400'
                              : b.status === 'Completed'
                                ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/30 dark:text-blue-400'
                                : 'bg-rose-100 text-rose-800 dark:bg-rose-955/30 dark:text-rose-400'
                          }`}>
                          {b.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 flex items-center justify-center gap-2">
                        <select
                          value={b.status}
                          onChange={(e) => handleStatusChange(b._id, e.target.value)}
                          className={`text-xs px-3 py-1.5 border rounded-full font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 cursor-pointer shadow-sm ${b.status === 'Confirmed'
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

                        {/* Settle / Collect Due Button */}
                        {(b.dueAmount > 0 || (b.paymentStatus !== 'paid' && (b.price - (b.paidAmount || 0)) > 0)) && b.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleOpenSettleModal(b)}
                            className="px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm border border-emerald-500/20"
                            title="Collect / Settle Due Amount"
                          >
                            💵 Pay Due
                          </button>
                        )}

                        {/* Refund Button for paid/partially paid bookings */}
                        {(b.paymentStatus === 'paid' || b.paymentStatus === 'partial' || (b.paidAmount > 0)) && b.status !== 'Cancelled' && (
                          <button
                            type="button"
                            onClick={() => handleOpenRefundModal(b)}
                            className="px-2.5 py-1.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 hover:bg-purple-500/20 text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                            title="Process Refund & Cancel"
                          >
                            💸 Refund
                          </button>
                        )}

                        <button
                          onClick={() => handleEditClick(b)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-purple-650 hover:bg-purple-50 dark:hover:bg-purple-955/30 transition-all duration-200 cursor-pointer"
                          title="Edit booking"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(b._id)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-955/30 transition-all duration-200 cursor-pointer"
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
      </>

      {/* Manual Booking Dialog */}
      <Dialog
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Create Manual Admin Booking"
        className="max-w-5xl"
      >
        <form onSubmit={handleSubmit(handleCreateManual)} className="space-y-6 pt-2 text-left">

          {/* Subheader Banner */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/5 to-transparent border border-purple-500/10 flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <span className="text-[10px] font-black uppercase tracking-wider text-purple-600 dark:text-purple-400">
                ⚡ Admin Operations
              </span>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
                Record offline customer reservations, cash payments, or phone bookings.
              </p>
            </div>
            {selectedSlots.length > 0 && (
              <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-xs font-mono">
                {selectedSlots.length} slot(s) selected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

            {/* Left Column: Customer & Playing Arena */}
            <div className="space-y-5">

              {/* Card 1: Customer Information */}
              <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3.5">
                <h4 className="text-xs font-black uppercase text-purple-650 dark:text-purple-400 tracking-wider flex items-center gap-2 border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  👤 Customer Information
                </h4>
                <Input
                  label="Customer Name"
                  placeholder="ADIL HUSSAIN"
                  error={errors.customerName?.message}
                  {...register('customerName')}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Phone Number"
                    placeholder="01711223344"
                    error={errors.phone?.message}
                    {...register('phone')}
                  />
                  <Input
                    label="Email (Optional)"
                    placeholder="adil@gmail.com"
                    error={errors.email?.message}
                    {...register('email')}
                  />
                </div>
              </div>

              {/* Card 2: Arena & Sport Selection */}
              <div className="p-4 rounded-2xl bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200/80 dark:border-zinc-800 space-y-3.5">
                <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2 border-b border-zinc-200/60 dark:border-zinc-800 pb-2">
                  🏟️ Arena & Match Details
                </h4>

                {grounds && grounds.length > 0 && (
                  <Select
                    label="Select Playing Arena"
                    value={selectedGroundId}
                    onChange={(e) => {
                      setSelectedGroundId(e.target.value);
                      setSelectedSlots([]);
                      const gObj = grounds.find(g => g.id.toString() === e.target.value);
                      if (gObj?.sport) {
                        setValue('sport', gObj.sport);
                      }
                    }}
                    options={grounds.map(g => ({
                      value: g.id.toString(),
                      label: `${g.name} (${g.sport || 'Sports'})`,
                    }))}
                  />
                )}

                <div className="grid grid-cols-2 gap-3">
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

            </div>

            {/* Right Column: Schedule & Payment Record */}
            <div className="space-y-5">

              {/* Card 3: Date & Time Slots Selection */}
              <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 dark:border-purple-900/20 space-y-3.5">
                <h4 className="text-xs font-black uppercase text-purple-600 dark:text-purple-400 tracking-wider flex items-center justify-between border-b border-purple-500/10 pb-2">
                  <span className="flex items-center gap-2">📅 Schedule Selection</span>
                  <button
                    type="button"
                    onClick={() => refetchSlots()}
                    className="text-[11px] font-bold text-purple-650 dark:text-purple-400 hover:underline flex items-center gap-1 cursor-pointer"
                    title="Refresh slots"
                  >
                    <RefreshCw className="w-3 h-3" /> Refresh
                  </button>
                </h4>

                <Controller
                  name="bookingDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Select Booking Date"
                      value={field.value}
                      onChange={field.onChange}
                      error={errors.bookingDate?.message}
                      className="w-full"
                    />
                  )}
                />

                {/* Slots Selection Box */}
                <div>
                  <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider block mb-2">
                    Choose Time Slots
                  </label>
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto custom-scrollbar pr-1">
                      {slotData.slots.map((slot) => {
                        const isSelected = selectedSlots.some((s) => s.id === slot.id);
                        return (
                          <button
                            key={slot.id}
                            type="button"
                            onClick={() => handleSlotClick(slot)}
                            className={`p-2 rounded-xl border text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center gap-1 select-none cursor-pointer ${!slot.isAvailable
                                ? 'bg-rose-50/20 dark:bg-rose-955/5 border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-500 opacity-60 cursor-not-allowed'
                                : isSelected
                                  ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/20'
                                  : 'bg-white hover:bg-zinc-50 dark:bg-zinc-950 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400'
                              }`}
                            disabled={!slot.isAvailable}
                          >
                            <span className="font-extrabold text-[11px]">{format12Hour(slot.startTime)}</span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${!slot.isAvailable
                                  ? 'bg-rose-100/50 dark:bg-rose-950/30 text-rose-600'
                                  : isSelected
                                    ? 'bg-purple-500/30 text-white'
                                    : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400'
                                }`}>
                                {slot.isAvailable ? (slot.rateType === 'night' ? 'Night' : 'Day') : 'Booked'}
                              </span>
                              {slot.isAvailable && slot.price && (
                                <span className={`text-[9px] font-extrabold font-mono ${isSelected ? 'text-white' : 'text-purple-650 dark:text-purple-400'}`}>
                                  ৳{slot.price}
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Schedule Summary Box */}
                <div className="bg-purple-500/10 dark:bg-purple-950/30 border border-purple-500/20 rounded-xl p-3 flex justify-between items-center text-xs">
                  <span className="font-semibold text-zinc-500 dark:text-zinc-400">Schedule & Price:</span>
                  <div className="flex items-center gap-3">
                    <span className="font-extrabold text-xs text-purple-650 dark:text-purple-300">
                      {selectedSlots.length > 0
                        ? `${format12Hour(selectedSlots[0].startTime)} - ${format12Hour(selectedSlots[selectedSlots.length - 1].endTime)} (${watch('duration')} hr)`
                        : 'No Slots Selected'}
                    </span>
                    {selectedSlots.length > 0 && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs">
                        Total: ৳{selectedSlots.reduce((sum, s) => sum + Number(s.price || 1500), 0)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Card 4: Payment & Settlement Record */}
              <div className="p-4 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 dark:border-emerald-900/20 space-y-3.5">
                <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2 border-b border-emerald-500/10 pb-2">
                  💳 Payment Record & Settlement
                </h4>

                {/* Admin Manual Discount Section */}
                <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                      🏷️ Apply Manual Admin Discount (Anytime)
                    </label>
                    {manualDiscountAmount > 0 && (
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                        Discount: -৳{manualDiscountAmount}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Select
                      label="Discount Type"
                      value={manualDiscountType}
                      onChange={(e) => setManualDiscountType(e.target.value)}
                      options={[
                        { value: 'none', label: 'No Discount' },
                        { value: 'percentage', label: 'Percentage (%)' },
                        { value: 'fixed', label: 'Fixed Amount (৳ BDT)' },
                      ]}
                    />
                    {manualDiscountType !== 'none' && (
                      <Input
                        label={manualDiscountType === 'percentage' ? 'Discount Percentage (%)' : 'Discount Amount (৳)'}
                        type="number"
                        placeholder={manualDiscountType === 'percentage' ? 'e.g. 10' : 'e.g. 300'}
                        value={manualDiscountValue}
                        onChange={(e) => setManualDiscountValue(e.target.value)}
                      />
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Payment Method"
                    value={manualPaymentMethod}
                    onChange={(e) => setManualPaymentMethod(e.target.value)}
                    options={methodOptions}
                  />
                  <Select
                    label="Payment Status"
                    value={manualPaymentStatus}
                    onChange={(e) => setManualPaymentStatus(e.target.value)}
                    options={[
                      { value: 'paid', label: 'Paid in Full' },
                      { value: 'partial', label: 'Partial Deposit' },
                      { value: 'unpaid', label: 'Unpaid (Pay After Match)' },
                    ]}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="Paid Amount (৳)"
                    type="number"
                    placeholder="e.g. 2000"
                    value={manualPaidAmount}
                    onChange={(e) => setManualPaidAmount(e.target.value)}
                  />
                  <Input
                    label="Transaction ID / Ref (Optional)"
                    placeholder="e.g. CASH_101 or bKash TrxID"
                    value={manualTransactionId}
                    onChange={(e) => setManualTransactionId(e.target.value)}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* Sticky Footer Bar */}
          <div className="border-t border-zinc-150 dark:border-zinc-800 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="text-xs text-zinc-500">
              {selectedSlots.length > 0 ? (
                <span className="font-bold text-zinc-700 dark:text-zinc-300">
                  Ready to confirm {selectedSlots.length} court slot(s).
                </span>
              ) : (
                <span className="text-amber-600 dark:text-amber-400 font-medium">
                  ⚠️ Select at least one time slot to enable confirmation.
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 sm:flex-initial font-bold text-xs py-2.5 px-5"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 sm:flex-initial bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-3 px-8 rounded-2xl shadow-md shadow-purple-500/20"
                disabled={createManualBookingMutation.isPending || selectedSlots.length === 0}
              >
                {createManualBookingMutation.isPending ? 'Saving Entry...' : 'Confirm Manual Entry ⚡'}
              </Button>
            </div>
          </div>

        </form>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog
        isOpen={isEditModalOpen}
        onClose={() => { setIsEditModalOpen(false); setEditingBooking(null); }}
        title="Modify Booking Details"
        className="max-w-4xl"
      >
        <form onSubmit={handleSubmit(handleUpdateBookingSubmit)} className="space-y-6 pt-4 text-left">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            {/* Left Column: Customer Info */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-100 dark:border-zinc-900 pb-2">
                👤 Customer Information
              </h4>
              <Input
                label="Customer Name"
                placeholder="ADIL HUSSAIN"
                error={errors.customerName?.message}
                {...register('customerName')}
              />
              <Input
                label="Phone Number"
                placeholder="01711223344"
                error={errors.phone?.message}
                {...register('phone')}
              />
              <Input
                label="Email Address (Optional)"
                placeholder="adil@gmail.com"
                error={errors.email?.message}
                {...register('email')}
              />
              {grounds && grounds.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-650" /> Playing Arena / Court
                  </label>
                  <select
                    value={editGroundId}
                    onChange={(e) => {
                      setEditGroundId(e.target.value);
                      setSelectedSlots([]);
                    }}
                    className="w-full px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-purple-650"
                  >
                    {grounds.map((g) => (
                      <option key={g.id} value={g.id.toString()}>
                        {g.name} ({g.sport || 'Sports'})
                      </option>
                    ))}
                  </select>
                </div>
              )}

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
              <Input
                label="Notes / Comments"
                placeholder="Any special requests"
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

                <div className="text-[10px] text-zinc-400 dark:text-zinc-500 mb-2 italic">
                  💡 Leave slots empty to keep the original schedule ({editingBooking?.startTime && format12Hour(editingBooking.startTime)} - {editingBooking?.endTime && format12Hour(editingBooking.endTime)}).
                </div>

                {slotsLoading ? (
                  <Loader className="py-6" />
                ) : slotData?.isBlocked ? (
                  <div className="text-center py-4 text-xs font-bold text-rose-500 border border-rose-100 dark:border-rose-955/20 bg-rose-50/20 rounded-xl">
                    ⚠️ Closed on this date ({slotData.reason})
                  </div>
                ) : !slotData?.slots?.length ? (
                  <div className="text-center py-4 text-xs font-semibold text-zinc-455 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
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
                          className={`p-2 rounded-xl border text-xs font-bold transition-all duration-200 flex flex-col items-center justify-center gap-1 select-none cursor-pointer ${!slot.isAvailable
                              ? 'bg-rose-50/20 dark:bg-rose-955/5 border-rose-100 dark:border-rose-900/30 text-rose-700 dark:text-rose-500 opacity-60 cursor-not-allowed'
                              : isSelected
                                ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/20'
                                : 'bg-white hover:bg-zinc-50 dark:bg-zinc-955 dark:hover:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-655 dark:text-zinc-400'
                            }`}
                          disabled={!slot.isAvailable}
                        >
                          <span className="font-extrabold text-[11px]">{format12Hour(slot.startTime)}</span>
                          <div className="flex items-center gap-1">
                            <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${!slot.isAvailable
                                ? 'bg-rose-100/50 dark:bg-rose-950/30 text-rose-600'
                                : isSelected
                                  ? 'bg-purple-500/30 text-white'
                                  : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400'
                              }`}>
                              {slot.isAvailable ? (slot.rateType === 'night' ? 'Night' : 'Day') : 'Booked'}
                            </span>
                            {slot.isAvailable && slot.price && (
                              <span className={`text-[9px] font-mono font-black ${isSelected ? 'text-amber-300' : 'text-purple-650 dark:text-purple-400'}`}>
                                ৳{slot.price}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Schedule Summary */}
              <div className="bg-purple-500/5 dark:bg-purple-950/10 border border-purple-500/10 dark:border-purple-900/20 rounded-2xl p-4 flex justify-between items-center text-xs">
                <span className="font-semibold text-zinc-500">Selected Schedule:</span>
                <span className="font-extrabold text-sm text-purple-650 dark:text-purple-400 font-mono">
                  {selectedSlots.length > 0
                    ? `${format12Hour(selectedSlots[0].startTime)} - ${format12Hour(selectedSlots[selectedSlots.length - 1].endTime)} (৳${selectedSlots.reduce((sum, s) => sum + Number(s.price || 1500), 0)})`
                    : `${editingBooking?.startTime ? format12Hour(editingBooking.startTime) : ''} - ${editingBooking?.endTime ? format12Hour(editingBooking.endTime) : ''} (Original)`}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-150 dark:border-zinc-800/80 pt-4 flex justify-end">
            <Button type="submit" className="w-full sm:w-auto px-8 py-3 font-bold" disabled={updateBookingMutation.isPending}>
              {updateBookingMutation.isPending ? 'Saving Changes...' : 'Save Booking Modifications'}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* Issue Refund & Cancel Booking Dialog */}
      {refundingBooking && (
        <Dialog
          isOpen={!!refundingBooking}
          onClose={() => setRefundingBooking(null)}
          title={`💸 Issue Refund & Cancel Booking #${refundingBooking.bookingId}`}
          className="max-w-md"
        >
          <div className="space-y-4 pt-4 text-left">
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer Name:</span>
                <span className="text-zinc-900 dark:text-white font-bold">{refundingBooking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Price:</span>
                <span className="text-zinc-900 dark:text-white font-mono font-bold">৳{refundingBooking.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Paid Online:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">৳{refundingBooking.paidAmount || 0}</span>
              </div>
              {refundingBooking.transactionId && (
                <div className="flex justify-between">
                  <span className="text-zinc-500">Gateway / TrxID:</span>
                  <span className="text-purple-600 dark:text-purple-400 font-mono font-bold">{refundingBooking.paymentGateway || 'bKash'} ({refundingBooking.transactionId})</span>
                </div>
              )}
            </div>

            <Input
              label="Refund Amount (৳)"
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="e.g. 2000"
            />

            <Input
              label="Refund Reason / Notes"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="e.g. Customer cancelled slot 24h prior"
            />

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setRefundingBooking(null)}
                className="flex-1 font-bold"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleExecuteRefund}
                disabled={isRefunding}
                className="flex-1 bg-purple-650 hover:bg-purple-700 text-white font-bold"
              >
                {isRefunding ? 'Processing...' : 'Confirm & Process Refund'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Settle / Collect Due Amount Dialog */}
      {settleBooking && (
        <Dialog
          isOpen={!!settleBooking}
          onClose={() => setSettleBooking(null)}
          title={`💵 Collect Due Payment - #${settleBooking.bookingId}`}
          className="max-w-md"
        >
          <div className="space-y-4 pt-4 text-left">
            <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-2 text-xs font-semibold">
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer Name:</span>
                <span className="text-zinc-900 dark:text-white font-bold">{settleBooking.customerName} ({settleBooking.phone})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Total Price:</span>
                <span className="text-zinc-900 dark:text-white font-mono font-bold">৳{settleBooking.price}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Paid So Far:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">৳{settleBooking.paidAmount || 0}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-emerald-500/20">
                <span className="text-rose-600 dark:text-rose-400 font-bold uppercase tracking-wider">Current Due Amount:</span>
                <span className="text-rose-600 dark:text-rose-400 font-mono font-black text-sm">
                  ৳{settleBooking.dueAmount !== undefined ? settleBooking.dueAmount : Math.max(0, settleBooking.price - (settleBooking.paidAmount || 0))}
                </span>
              </div>
            </div>

            <Select
              label="Payment Method Received"
              value={settleMethod}
              onChange={(e) => setSettleMethod(e.target.value)}
              options={methodOptions}
            />

            <Input
              label="Collecting Amount (৳)"
              type="number"
              value={settleAmount}
              onChange={(e) => setSettleAmount(e.target.value)}
              placeholder="e.g. 500"
            />

            <Input
              label="Transaction ID / Ref (Optional)"
              value={settleTrxId}
              onChange={(e) => setSettleTrxId(e.target.value)}
              placeholder="e.g. CASH_SETTLE_101 or bKash TrxID"
            />

            <div className="pt-2 flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSettleBooking(null)}
                className="flex-1 font-bold text-xs py-2.5"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleExecuteSettleDue}
                disabled={isSettling || !settleAmount || Number(settleAmount) <= 0}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 rounded-xl shadow-md shadow-emerald-500/20"
              >
                {isSettling ? 'Processing...' : 'Confirm & Collect 💵'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};
