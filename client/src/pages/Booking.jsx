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
      sport: 'Futsal',
      players: 10,
      notes: '',
    },
  });

  // Calculate pricing based on date type (Weekend/Weekday/Holiday)
  const getHourlyRate = () => {
    if (!settings) return 1500;
    const dateObj = new Date(selectedDate);
    
    // Check Holiday
    if (settings.holidays && settings.holidays.includes(selectedDate)) {
      return settings.pricing.holidayRate;
    }
    
    // Check Weekend (Sat=6, Sun=0)
    const day = dateObj.getUTCDay();
    if (day === 0 || day === 6) {
      return settings.pricing.weekendRate;
    }
    
    return settings.pricing.hourlyRate;
  };

  const duration = selectedSlots.length;
  const hourlyRate = getHourlyRate();
  const totalPrice = hourlyRate * duration;

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
          Thank you for reserving Apex Court. Show this ID at check-in.
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
                {new Date(confirmedBooking.bookingDate).toLocaleDateString('en-BD')}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Time Selected</span>
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                {confirmedBooking.startTime} - {confirmedBooking.endTime} ({confirmedBooking.duration} hr)
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

        <Button onClick={() => setConfirmedBooking(null)} className="w-full">
          Book Another Court Session
        </Button>
      </div>
    );
  }

  const sportOptions = settings?.availableSports?.map((s) => ({ value: s, label: s })) || [
    { value: 'Futsal', label: 'Futsal' },
    { value: 'Basketball', label: 'Basketball' },
    { value: 'Badminton', label: 'Badminton' },
    { value: 'Volleyball', label: 'Volleyball' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 text-left">
      <h1 className="text-4xl font-extrabold tracking-tight text-zinc-900 dark:text-white mb-2 text-center">
        Reserve The <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Court</span>
      </h1>
      <p className="text-zinc-550 dark:text-zinc-400 mb-12 text-center max-w-md mx-auto text-sm">
        Select a date, pick an available slot, and finalize your booking. Real-time updates prevent double-bookings instantly.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Calendar & Time Slots */}
        <div className="lg:col-span-7 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="w-5 h-5 text-purple-600" />
                1. Select Booking Date
              </CardTitle>
              <CardDescription>We offer daily scheduling slots.</CardDescription>
            </CardHeader>
            <CardContent>
              <Input
                type="date"
                min={new Date().toISOString().split('T')[0]}
                value={selectedDate}
                onChange={handleDateChange}
                className="w-full"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-indigo-600" />
                  2. Select Start Time & Duration
                </CardTitle>
                <CardDescription>Pick from active available slots.</CardDescription>
              </div>
              <button
                onClick={() => refetchSlots()}
                className="p-2 text-zinc-400 hover:text-zinc-650 cursor-pointer"
                title="Refresh slots"
              >
                <RefreshCw className="w-4 h-4 animate-spin-slow" />
              </button>
            </CardHeader>
            <CardContent>
              {slotsLoading ? (
                <Loader className="py-8" />
              ) : slotData?.isBlocked ? (
                <div className="p-8 text-center text-rose-500 border border-rose-200/50 bg-rose-50/50 rounded-xl font-bold">
                  ⚠️ Apex Arena is Closed today ({slotData.reason})
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Duration Slider */}
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold text-zinc-500 uppercase">Duration (Hours)</label>
                    <div className="flex items-center gap-4">
                      <input
                        type="range"
                        min="1"
                        max="4"
                        value={duration}
                        onChange={(e) => {
                          setDuration(Number(e.target.value));
                          setSelectedSlot(null); // Reset selection
                        }}
                        className="w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-purple-650"
                      />
                      <span className="font-extrabold text-lg text-purple-650 min-w-16 text-right">
                        {duration} hr{duration > 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-6">
                    {/* Status Legend */}
                    <div className="flex gap-4 text-xs font-semibold mb-4">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                        <span className="text-zinc-600 dark:text-zinc-400">Available</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                        <span className="text-zinc-600 dark:text-zinc-400">Booked / Occupied</span>
                      </div>
                    </div>

                    {/* Time Slots Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {slotData?.slots?.map((slot) => {
                        const isSelected = selectedSlots.some((s) => s.id === slot.id);
                        return (
                          <div
                            key={slot.id}
                            onClick={() => handleSlotClick(slot)}
                            className={`p-4 rounded-xl border font-semibold text-sm transition-all duration-200 flex flex-col items-center justify-center gap-1.5 select-none ${
                              !slot.isAvailable
                                ? 'bg-rose-50/50 dark:bg-rose-950/5 border-rose-100 dark:border-rose-955/30 text-rose-800 dark:text-rose-400 cursor-not-allowed opacity-80'
                                : isSelected
                                ? 'bg-purple-600 border-purple-600 text-white shadow-md shadow-purple-500/25 cursor-pointer active:scale-[0.98]'
                                : 'bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800/80 text-zinc-700 dark:text-zinc-350 cursor-pointer active:scale-[0.98]'
                            }`}
                          >
                            <span className="text-base font-extrabold">{slot.startTime}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider font-bold ${
                              !slot.isAvailable
                                ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-455'
                                : isSelected
                                ? 'bg-purple-500/30 text-white'
                                : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400'
                            }`}>
                              {slot.isAvailable ? 'Available' : 'Booked'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Booking Form & Summary */}
        <div className="lg:col-span-5 space-y-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-pink-500" />
                  3. Contact Information
                </CardTitle>
                <CardDescription>Fill in customer details.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
              </CardContent>
            </Card>

            {/* Booking Summary */}
            <Card className="border-t-4 border-t-purple-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-md">
                  <Receipt className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                  Booking Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-zinc-550">Date Selected</span>
                  <span className="font-semibold">{selectedDate}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-550">Time Slots</span>
                  <span className="font-semibold text-purple-650">
                    {selectedSlots.length > 0
                      ? `${selectedSlots[0].startTime} - ${selectedSlots[selectedSlots.length - 1].endTime} (${duration} hr)`
                      : 'None Selected'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-550">Rate Tier</span>
                  <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                    ৳{hourlyRate}/hour
                  </span>
                </div>
                <div className="flex justify-between border-t border-zinc-150 dark:border-zinc-800 pt-3 text-base">
                  <span className="font-extrabold text-zinc-900 dark:text-white">Estimated Total</span>
                  <span className="font-extrabold text-xl text-purple-650">৳{totalPrice}</span>
                </div>
              </CardContent>
              <CardContent className="pt-0">
                <Button
                  type="submit"
                  disabled={createBookingMutation.isPending || selectedSlots.length === 0}
                  className="w-full"
                >
                  {createBookingMutation.isPending ? 'Processing Booking...' : 'Submit Booking Reservation'}
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  );
};
