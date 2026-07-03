import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Calendar as CalendarIcon, Clock, Users, ArrowRight, ShieldCheck, Sparkles, Receipt, RefreshCw } from 'lucide-react';
import { useAvailableSlots, useCreateBooking, usePublicSettings } from '../hooks/useApi';
import { useSocket } from '../contexts/SocketContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';

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

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const bookingFormSchema = z.object({
  customerName: z.string().min(2, 'Full Name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  sport: z.string().min(1, 'Please select a sport'),
  players: z.coerce.number().min(1, 'At least 1 player is required'),
  notes: z.string().optional(),
});

export const Booking = () => {
  const toast = useToast();
  const socket = useSocket();
  const { data: settings } = usePublicSettings();

  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  const [selectedSlots, setSelectedSlots] = useState([]);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Fetch available slots for selected date
  const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useAvailableSlots(selectedDate);
  const createBookingMutation = useCreateBooking();

  // Listen to Socket.io for immediate slot updates
  useEffect(() => {
    if (socket) {
      const handleSlotChange = (data) => {
        if (data.date === selectedDate) {
          console.log('Realtime update: Slots changed for', selectedDate);
          refetchSlots();
        }
      };
      socket.on('slot-status-changed', handleSlotChange);
      return () => {
        socket.off('slot-status-changed', handleSlotChange);
      };
    }
  }, [socket, selectedDate, refetchSlots]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      customerName: '',
      phone: '',
      email: '',
      sport: 'Football',
      players: 10,
      notes: '',
    },
  });

  // Calculate pricing based on selected slots shifts
  const calculateEstimatedTotal = () => {
    if (!settings || selectedSlots.length === 0) return 0;
    const dateObj = new Date(selectedDate);
    const day = dateObj.getUTCDay();
    let dayType = 'weekday';
    if (settings.holidays && settings.holidays.includes(selectedDate)) {
      dayType = 'holiday';
    } else if (settings.weekendDays && settings.weekendDays.includes(day)) {
      dayType = 'weekend';
    }

    let total = 0;
    for (const slot of selectedSlots) {
      const rateType = slot.rateType || 'day';
      const pricing = settings.pricing || {};
      if (dayType === 'holiday') {
        total += rateType === 'night' ? (pricing.holidayNight || 1500) : (pricing.holidayDay || 1500);
      } else if (dayType === 'weekend') {
        total += rateType === 'night' ? (pricing.weekendNight || 1500) : (pricing.weekendDay || 1500);
      } else {
        total += rateType === 'night' ? (pricing.weekdayNight || 1500) : (pricing.weekdayDay || 1500);
      }
    }
    return total;
  };

  const duration = selectedSlots.length;
  const totalPrice = calculateEstimatedTotal();

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
    setSelectedSlots([]);
  };

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
    } else {
      setSelectedSlots([slot]);
      toast.info('Selected slots must be contiguous.');
    }
  };

  const onSubmit = async (formData) => {
    if (selectedSlots.length === 0) {
      toast.error('Please select at least one time slot.');
      return;
    }

    const sorted = [...selectedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const startTime = sorted[0].startTime;
    const endTime = sorted[sorted.length - 1].endTime;

    const bookingPayload = {
      ...formData,
      bookingDate: selectedDate,
      startTime,
      endTime,
      duration,
    };

    createBookingMutation.mutate(bookingPayload, {
      onSuccess: (data) => {
        toast.success('Court successfully booked!');
        setConfirmedBooking(data);
        reset();
        setSelectedSlots([]);
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Double booking detected. Try another slot.');
      },
    });
  };

  if (confirmedBooking) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-2">
          Booking Confirmed!
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mb-8">
          Thank you for reserving {settings?.businessName || 'Apex Arena'}. Show this ID at check-in.
        </p>

        <Card className="mb-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800">
          <CardContent className="space-y-4 pt-6">
            <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <span className="text-zinc-500 text-sm">Booking ID</span>
              <span className="font-bold text-purple-600 dark:text-purple-400 tracking-wider">
                {confirmedBooking.bookingId}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Player Name</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {confirmedBooking.customerName}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Sport</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {confirmedBooking.sport}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Date</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {formatDateDMY(confirmedBooking.bookingDate)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-550">Time Selected</span>
              <span className="font-semibold text-zinc-805 dark:text-zinc-200">
                {format12Hour(confirmedBooking.startTime)} - {format12Hour(confirmedBooking.endTime)} ({confirmedBooking.duration} hr)
              </span>
            </div>
            <div className="flex justify-between items-center border-t border-zinc-150 dark:border-zinc-800 pt-3">
              <span className="text-zinc-500 font-bold text-sm">Total Price</span>
              <span className="font-extrabold text-lg text-zinc-900 dark:text-white">
                ৳{confirmedBooking.price}
              </span>
            </div>
          </CardContent>
        </Card>

        {settings?.rules && settings.rules.length > 0 && (
          <Card className="mb-8 text-left bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800">
            <CardHeader className="pb-2 pt-5">
              <CardTitle className="text-xs font-bold text-zinc-900 dark:text-white uppercase tracking-wider">
                Court Rules & Regulations
              </CardTitle>
            </CardHeader>
            <CardContent className="pb-5">
              <ul className="space-y-2.5">
                {settings.rules.map((rule, idx) => (
                  <li key={idx} className="flex gap-2.5 text-xs text-zinc-650 dark:text-zinc-450">
                    <span className="font-extrabold text-purple-650 shrink-0">{idx + 1}.</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Button onClick={() => setConfirmedBooking(null)} className="w-full">
          Book Another Court Session
        </Button>
      </div>
    );
  }

  const sportOptions = settings?.availableSports?.map((s) => ({ value: s, label: s })) || [
    { value: 'Football', label: 'Football' },
    { value: 'Futsal', label: 'Futsal' },
    { value: 'Basketball', label: 'Basketball' },
    { value: 'Badminton', label: 'Badminton' },
    { value: 'Volleyball', label: 'Volleyball' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-left animate-fade-in">
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2 text-center">
        Reserve The <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Court</span>
      </h1>
      <p className="text-zinc-550 dark:text-zinc-400 mb-12 text-center max-w-md mx-auto text-sm">
        Select a date, pick an available slot, and finalize your booking. Real-time updates prevent double-bookings instantly.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Calendar & Time Slots */}
        <div className="lg:col-span-7 space-y-6">
          <div className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
            <div>
              <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
                1. Select Booking Date
              </h3>
              <p className="text-xs text-zinc-400 mt-1">We offer daily scheduling slots.</p>
            </div>
            <Input
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={selectedDate}
              onChange={handleDateChange}
              className="w-full"
            />
          </div>

          <div className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  2. Select Start Time & Duration
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Pick from active available slots.</p>
              </div>
              <button
                onClick={() => refetchSlots()}
                className="p-2 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                title="Refresh slots"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div>
              {slotsLoading ? (
                <Loader className="py-8" />
              ) : slotData?.isBlocked ? (
                <div className="p-8 text-center text-rose-500 border border-rose-200/50 bg-rose-50/50 rounded-xl font-bold">
                  ⚠️ {settings?.businessName || 'Apex Arena'} is Closed today ({slotData.reason})
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Time Slots Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {slotData?.slots?.map((slot) => {
                      const isSelected = selectedSlots.some((s) => s.id === slot.id);
                      return (
                        <div
                          key={slot.id}
                          onClick={() => handleSlotClick(slot)}
                          className={`p-4 rounded-xl border font-bold text-sm transition-all duration-200 flex flex-col items-center justify-center gap-1.5 select-none ${
                            !slot.isAvailable
                              ? 'bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/30 text-rose-800 dark:text-rose-455 cursor-not-allowed opacity-80'
                              : isSelected
                              ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/25 cursor-pointer active:scale-[0.98]'
                              : 'bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-350 cursor-pointer active:scale-[0.98]'
                          }`}
                        >
                          <span className="text-base font-extrabold">{format12Hour(slot.startTime)}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                            !slot.isAvailable
                              ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                              : isSelected
                              ? 'bg-purple-500/30 text-white'
                              : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400'
                          }`}>
                            {slot.isAvailable ? `${slot.rateType === 'night' ? 'Night Shift' : 'Day Shift'}` : 'Booked'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Booking Form & Summary */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                  3. Contact Information
                </h3>
                <p className="text-xs text-zinc-400 mt-1">Fill in customer details.</p>
              </div>
              <div className="space-y-4">
                <Input
                  label="Full Name"
                  placeholder="e.g. John Doe"
                  error={errors.customerName?.message}
                  {...register('customerName')}
                />
                <Input
                  label="Phone Number"
                  placeholder="e.g. 555-0199"
                  error={errors.phone?.message}
                  {...register('phone')}
                />
                <Input
                  label="Email (Optional)"
                  placeholder="e.g. john@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                />
                <div className="grid grid-cols-2 gap-4">
                  <Select
                    label="Select Sport"
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
                  label="Booking Notes"
                  placeholder="e.g. requests for bibs, specific balls..."
                  error={errors.notes?.message}
                  {...register('notes')}
                />
              </div>
            </div>

            {/* Booking Summary */}
            <div className="glass-card p-6 rounded-2xl shadow-sm border-t-4 border-t-purple-650 space-y-4">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
                <h3 className="text-md font-bold text-zinc-850 dark:text-zinc-200">Booking Summary</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Date Selected</span>
                  <span className="font-semibold text-zinc-850 dark:text-zinc-205">{formatDateDMY(selectedDate)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Time Slots</span>
                  <span className="font-bold text-purple-650 dark:text-purple-400">
                    {selectedSlots.length > 0
                      ? `${format12Hour(selectedSlots[0].startTime)} - ${format12Hour(selectedSlots[selectedSlots.length - 1].endTime)} (${duration} hr)`
                      : 'None Selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Rate Details</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    Shift-Based Rates
                  </span>
                </div>
                <div className="flex justify-between border-t-2 border-dashed border-zinc-200 dark:border-zinc-800 pt-3 text-base">
                  <span className="font-extrabold text-zinc-900 dark:text-white">Estimated Total</span>
                  <span className="font-extrabold text-2xl text-purple-655 dark:text-purple-400">৳{totalPrice}</span>
                </div>
              </div>
              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={createBookingMutation.isPending || selectedSlots.length === 0}
                  className="w-full font-bold"
                >
                  {createBookingMutation.isPending ? 'Processing Booking...' : 'Submit Booking Reservation'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
