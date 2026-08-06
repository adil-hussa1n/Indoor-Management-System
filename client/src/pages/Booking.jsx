import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate } from 'react-router-dom';
import { Calendar as CalendarIcon, Clock, Users, ArrowRight, ShieldCheck, Sparkles, Receipt, RefreshCw, Ban, Layers, Trophy, CheckCircle2 } from 'lucide-react';
import { useAvailableSlots, useCreateBooking, usePublicSettings, useGrounds, useCalendarAvailability } from '../hooks/useApi';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useSocket } from '../contexts/SocketContext';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Input, Select } from '../components/ui/Input';
import { DatePicker } from '../components/ui/DatePicker';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { Dialog } from '../components/ui/Dialog';
import API from '../services/api';

const format12Hour = (time24) => {
  if (!time24) return '';
  if (time24 === '24:00') return '12:00 AM';
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
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatPhoneDisplay = (phone) => {
  if (!phone) return '';
  let cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.startsWith('880')) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('88')) {
    cleaned = cleaned.substring(2);
  }
  if (!cleaned.startsWith('0')) {
    cleaned = '0' + cleaned;
  }
  return `+88 ${cleaned}`;
};

const bookingFormSchema = z.object({
  customerName: z.string().min(2, 'Full Name is required'),
  phone: z.string().min(7, 'Valid phone number is required'),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  players: z.coerce.number().min(1, 'At least 1 player is required'),
  notes: z.string().optional(),
});

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const date = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${date}`;
};

export const Booking = () => {
  const toast = useToast();
  const socket = useSocket();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useUserAuth();
  const { data: settings } = usePublicSettings();
  const { data: grounds } = useGrounds();

  const [selectedGroundId, setSelectedGroundId] = useState('');
  
  const [selectedDate, setSelectedDate] = useState(() => {
    return getLocalDateString();
  });

  const [selectedSlots, setSelectedSlots] = useState([]);
  const [confirmedBooking, setConfirmedBooking] = useState(null);

  // Online Payment System States
  const [pendingPaymentData, setPendingPaymentData] = useState(null);
  const [selectedGateway, setSelectedGateway] = useState('bkash');
  const [bkashNumber, setBkashNumber] = useState('');
  const [bkashTrxId, setBkashTrxId] = useState('');
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false);

  // Check URL query parameters for returning SSLCommerz payment callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const bId = urlParams.get('bookingId');
    if (bId) {
      API.get(`/bookings/${bId}`)
        .then((res) => {
          if (res.data.success && res.data.booking) {
            setConfirmedBooking(res.data.booking);
            toast.success('Online Payment Verified! Booking Confirmed.');
          }
        })
        .catch(() => {});
    }
  }, []);

  const handleInitiateBkashMerchantPayment = async () => {
    setIsVerifyingPayment(true);
    try {
      const res = await API.post('/payment/initiate', {
        bookingId: pendingPaymentData.booking.id,
        gateway: 'bkash',
      });
      if (res.data.success && res.data.gatewayUrl) {
        window.location.href = res.data.gatewayUrl;
      } else {
        toast.error('Failed to connect to bKash Merchant Gateway.');
      }
    } catch (err) {
      toast.error('Failed to initiate bKash Merchant payment.');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  const handleSSLCommerzPayment = async () => {
    setIsVerifyingPayment(true);
    try {
      const res = await API.post('/payment/initiate', {
        bookingId: pendingPaymentData.booking.id,
        gateway: 'sslcommerz',
      });
      if (res.data.success && res.data.gatewayUrl) {
        window.location.href = res.data.gatewayUrl;
      }
    } catch (err) {
      toast.error('Failed to initiate SSLCommerz payment portal.');
    } finally {
      setIsVerifyingPayment(false);
    }
  };

  // Auto-resolve first active ground ID when grounds load
  useEffect(() => {
    if (grounds && grounds.length > 0) {
      const active = grounds.filter(g => g.isActive);
      if (active.length > 0 && !selectedGroundId) {
        setSelectedGroundId(active[0].id.toString());
      } else if (!selectedGroundId) {
        setSelectedGroundId(grounds[0].id.toString());
      }
    } else if (!selectedGroundId) {
      // Default fallback ground ID to prevent blank page
      setSelectedGroundId('1');
    }
  }, [grounds, selectedGroundId]);

  const [hasAutoJumped, setHasAutoJumped] = useState(false);

  // Reset auto-jump flag when selected ground changes
  useEffect(() => {
    setHasAutoJumped(false);
  }, [selectedGroundId]);

  // Fetch calendar availability for month to discover next available dates
  const dateParts = selectedDate ? selectedDate.split('-') : [];
  const currentYear = dateParts[0] ? Number(dateParts[0]) : new Date().getFullYear();
  const currentMonth = dateParts[1] ? Number(dateParts[1]) : new Date().getMonth() + 1;
  const { data: availability } = useCalendarAvailability(currentYear, currentMonth, selectedGroundId);

  // Fetch available slots for selected date & ground
  const { data: slotData, isLoading: slotsLoading, refetch: refetchSlots } = useAvailableSlots(selectedDate, selectedGroundId);
  const createBookingMutation = useCreateBooking();

  // Auto-jump to first date with available slots if current selectedDate has no open slots
  useEffect(() => {
    if (!slotsLoading && slotData && availability && selectedGroundId && !hasAutoJumped) {
      const activeAvailableSlots = slotData.slots?.filter(s => s.isAvailable) || [];
      
      if (slotData.isBlocked || activeAvailableSlots.length === 0) {
        const todayStr = getLocalDateString();
        const availableDates = Object.keys(availability)
          .filter(dStr => dStr >= todayStr && (availability[dStr] === 'green' || availability[dStr] === 'yellow'))
          .sort();

        if (availableDates.length > 0 && availableDates[0] !== selectedDate) {
          const nextDate = availableDates[0];
          setSelectedDate(nextDate);
          setHasAutoJumped(true);
          toast.info(`Today is fully booked. Auto-selected next available date (${formatDateDMY(nextDate)}).`);
        }
      }
    }
  }, [slotData, slotsLoading, availability, selectedGroundId, selectedDate, hasAutoJumped]);

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
      players: 10,
      notes: '',
    },
  });

  // Auto-fill user profile details if logged in
  useEffect(() => {
    if (user) {
      reset({
        customerName: user.name || '',
        phone: formatPhoneDisplay(user.phone || ''),
        email: user.email || '',
        players: 10,
        notes: '',
      });
    }
  }, [user, reset]);

  // Active automatic online discount for selected date
  const activeDiscountRule = React.useMemo(() => {
    if (!settings?.discounts || !selectedDate) return null;
    return settings.discounts.find(d => {
      if (!d.isActive) return false;
      if (d.startDate && selectedDate < d.startDate) return false;
      if (d.endDate && selectedDate > d.endDate) return false;
      return true;
    }) || null;
  }, [settings?.discounts, selectedDate]);

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
  const subtotalPrice = calculateEstimatedTotal();

  const discountAmount = React.useMemo(() => {
    if (!activeDiscountRule || subtotalPrice <= 0) return 0;
    if (activeDiscountRule.type === 'percentage') {
      return Math.round((subtotalPrice * Number(activeDiscountRule.value)) / 100);
    } else {
      return Math.min(subtotalPrice, Number(activeDiscountRule.value));
    }
  }, [activeDiscountRule, subtotalPrice]);

  const totalPrice = Math.max(0, subtotalPrice - discountAmount);

  const handleDateChange = (dateStr) => {
    setSelectedDate(dateStr);
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
    if (!selectedGroundId) {
      toast.error('Please select an active arena/court first.');
      return;
    }
    if (selectedSlots.length === 0) {
      toast.error('Please select at least one time slot.');
      return;
    }

    const sorted = [...selectedSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));
    const startTime = sorted[0].startTime;
    const endTime = sorted[sorted.length - 1].endTime;

    const bookingPayload = {
      ...formData,
      sport: selectedSport,
      bookingDate: selectedDate,
      startTime,
      endTime,
      duration,
      groundId: Number(selectedGroundId),
    };

    createBookingMutation.mutate(bookingPayload, {
      onSuccess: (data) => {
        if (data.paymentRequired) {
          setPendingPaymentData(data);
          reset();
          setSelectedSlots([]);
        } else {
          toast.success('Court successfully booked!');
          setConfirmedBooking(data.booking || data);
          reset();
          setSelectedSlots([]);
        }
      },
      onError: (err) => {
        toast.error(err.response?.data?.message || 'Conflict detected. Try another slot.');
      },
    });
  };

  const activeGrounds = grounds?.filter(g => g.isActive) || [];
  const selectedGroundObj = grounds?.find(g => g.id.toString() === selectedGroundId);
  const selectedSport = selectedGroundObj?.sport || 'Football';

  const hasMultipleArenas = activeGrounds.length > 1;
  const dateStepNumber = hasMultipleArenas ? 2 : 1;
  const slotsStepNumber = hasMultipleArenas ? 3 : 2;
  const checkoutStepNumber = hasMultipleArenas ? 4 : 3;

  if (confirmedBooking) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center mx-auto mb-6">
          <ShieldCheck className="w-8 h-8 text-emerald-500" />
        </div>
        <h1 className="text-3xl font-extrabold text-zinc-900 dark:text-white mb-2">
          Booking Confirmed!
        </h1>
        <p className="text-zinc-550 dark:text-zinc-400 mb-8 text-sm">
          Thank you for reserving {settings?.businessName || 'Apex Arena'}. Show this ID at check-in.
        </p>

        <Card className="mb-8 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-800">
          <CardContent className="space-y-4 pt-6 text-left">
            <div className="flex justify-between items-center border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <span className="text-zinc-500 text-sm font-bold">Booking ID</span>
              <span className="font-extrabold text-purple-600 dark:text-purple-400 tracking-wider">
                {confirmedBooking.bookingId}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Player Name</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {confirmedBooking.customerName}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Sport & Arena</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200 flex items-center gap-1.5">
                {confirmedBooking.sport} &bull; {selectedGroundObj?.name || 'Main Arena'}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Date</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
                {formatDateDMY(confirmedBooking.bookingDate)}
              </span>
            </div>
            <div className="flex justify-between items-center text-sm">
              <span className="text-zinc-500">Time Selected</span>
              <span className="font-semibold text-zinc-850 dark:text-zinc-200">
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
                  <li key={idx} className="flex gap-2.5 text-xs text-zinc-650 dark:text-zinc-455">
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

  return (
    <div className="max-w-6xl mx-auto px-4 py-16 text-left animate-fade-in">
      <h1 className="text-4xl font-black tracking-tight text-zinc-900 dark:text-white mb-2 text-center">
        Reserve The <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">Arena</span>
      </h1>
      <p className="text-zinc-550 dark:text-zinc-400 mb-10 text-center max-w-md mx-auto text-xs font-medium">
        Pick your schedule and check out. Simple and collision-proof.
      </p>

      {/* STEP 1: Select Arena (Only rendered if multiple arenas exist) */}
      {hasMultipleArenas && (
        <div className="mb-8 text-center max-w-3xl mx-auto">
          <label className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest block mb-3 flex items-center justify-center gap-1.5">
            <Trophy className="w-3.5 h-3.5" /> Step 1: Choose Playing Arena
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {activeGrounds.map((g) => {
              const isSelected = selectedGroundId === g.id.toString();
              let sportIcon = '⚽';
              if (g.sport?.toLowerCase().includes('cricket')) sportIcon = '🏏';
              else if (g.sport?.toLowerCase().includes('badminton')) sportIcon = '🏸';
              else if (g.sport?.toLowerCase().includes('basketball')) sportIcon = '🏀';
              else if (g.sport?.toLowerCase().includes('tennis')) sportIcon = '🎾';

              return (
                <div
                  key={g.id}
                  onClick={() => {
                    setSelectedGroundId(g.id.toString());
                    setSelectedSlots([]);
                  }}
                  className={`p-3.5 rounded-2xl text-left cursor-pointer transition-all duration-200 select-none border flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-600/5 dark:bg-purple-950/20 border-purple-600 dark:border-purple-500 shadow-md shadow-purple-500/10 ring-1 ring-purple-600'
                      : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-300 dark:hover:border-purple-800'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-lg shrink-0">{sportIcon}</span>
                      <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white truncate">
                        {g.name}
                      </h3>
                    </div>
                    {isSelected ? (
                      <CheckCircle2 className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                    ) : (
                      <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-650 dark:text-purple-400 border border-purple-500/20 font-mono shrink-0">
                        {g.sport}
                      </span>
                    )}
                  </div>
                  {g.description && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-2 line-clamp-1 font-medium">
                      {g.description}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Date & Slots Grid */}
      {selectedGroundId && (
        <div className={`grid grid-cols-1 lg:grid-cols-12 gap-8 items-start ${hasMultipleArenas ? 'pt-6 border-t border-zinc-150 dark:border-zinc-900/60' : ''}`}>
          {/* Left Column: Calendar & Time Slots */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <CalendarIcon className="w-5 h-5 text-purple-650" />
                  Step {dateStepNumber}: Select Booking Date
                </h3>
                <p className="text-xs text-zinc-450 mt-1">Select your booking day.</p>
              </div>
              <DatePicker
                min={getLocalDateString()}
                value={selectedDate}
                onChange={handleDateChange}
                groundId={selectedGroundId}
                className="w-full"
              />
            </div>

            <div className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Clock className="w-5 h-5 text-indigo-600" />
                    Step {slotsStepNumber}: Select Slots
                  </h3>
                  <p className="text-xs text-zinc-450 mt-1">Pick contiguous available time frames.</p>
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
                ) : !slotData?.slots || slotData.slots.length === 0 ? (
                  <div className="p-8 text-center text-zinc-550 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl font-semibold">
                    No active scheduling slots are set up for this date yet. Please check again later.
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Time Slots Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {slotData.slots.map((slot) => {
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
              {!isAuthenticated ? (
                <div className="glass-card p-8 rounded-2xl shadow-sm space-y-4 text-center border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/10">
                  <Ban className="w-10 h-10 text-rose-500 mx-auto" />
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-zinc-900 dark:text-white">Authentication Required</h3>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-xs mx-auto leading-relaxed">
                      You need to verify your phone number to reserve court slot bookings.
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={() => navigate('/login', { state: { from: { pathname: '/booking' } } })}
                    className="w-full font-bold mt-2 cursor-pointer border-none bg-purple-600 hover:bg-purple-750 text-white"
                  >
                    Verify Phone & Proceed
                  </Button>
                </div>
              ) : (
                <div className="glass-card p-6 rounded-2xl shadow-sm space-y-4">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-pink-500" />
                      Step {checkoutStepNumber}: Checkout Contact Info
                    </h3>
                    <p className="text-xs text-zinc-450 mt-1">Provide customer contact details.</p>
                  </div>
                  <div className="space-y-4">
                    <Input
                      label="Full Name"
                      placeholder="ADIL HUSSAIN"
                      error={errors.customerName?.message}
                      {...register('customerName')}
                    />
                    <Input
                      label="Phone Number"
                      placeholder="01711223344"
                      error={errors.phone?.message}
                      {...register('phone')}
                      disabled
                    />
                    <Input
                      label="Email (Optional)"
                      placeholder="adil@gmail.com"
                      error={errors.email?.message}
                      {...register('email')}
                    />
                    <div className="grid grid-cols-1 gap-4">
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
              )}

              <div className="glass-card p-6 rounded-2xl shadow-sm border-t-4 border-t-purple-650 space-y-4">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-zinc-650 dark:text-zinc-400" />
                  <h3 className="text-md font-bold text-zinc-850 dark:text-zinc-205">Booking Summary</h3>
                </div>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Date Selected</span>
                    <span className="font-semibold text-zinc-850 dark:text-zinc-200">{formatDateDMY(selectedDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Selected Arena</span>
                    <span className="font-extrabold text-indigo-600 dark:text-indigo-400">
                      {selectedGroundObj?.name || 'Main Arena'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Time Slots</span>
                    <span className="font-bold text-purple-650 dark:text-purple-400">
                      {selectedSlots.length > 0
                        ? `${format12Hour(selectedSlots[0].startTime)} - ${format12Hour(selectedSlots[selectedSlots.length - 1].endTime)} (${duration} hr)`
                        : 'None Selected'}
                    </span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="pt-2 border-t border-dashed border-zinc-200 dark:border-zinc-800">
                       <div className="flex justify-between items-center text-xs text-zinc-500 dark:text-zinc-400 mb-1">
                          <span>Original Subtotal:</span>
                          <span className="font-bold font-mono text-zinc-700 dark:text-zinc-300">৳{subtotalPrice}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs text-emerald-600 dark:text-emerald-400 font-extrabold bg-emerald-500/10 p-2 rounded-lg">
                          <span>🎉 {activeDiscountRule?.name}</span>
                          <span>-৳{discountAmount}</span>
                        </div>
                    </div>
                  )}

                  <div className="flex justify-between border-t border-dashed border-zinc-200 dark:border-zinc-800 pt-3 text-base">
                    <span className="font-extrabold text-zinc-900 dark:text-white">Estimated Total</span>
                    <span className="font-extrabold text-2xl text-purple-655 dark:text-purple-400">৳{totalPrice}</span>
                  </div>
                </div>
                <div className="pt-2">
                  <Button
                    type="submit"
                    disabled={createBookingMutation.isPending || selectedSlots.length === 0}
                    className="w-full font-bold cursor-pointer"
                  >
                    {createBookingMutation.isPending ? 'Processing Booking...' : 'Submit Booking Reservation'}
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Online Payment Gateway Selection & Verification Dialog Modal */}
      {pendingPaymentData && (
        <Dialog
          isOpen={!!pendingPaymentData}
          onClose={() => setPendingPaymentData(null)}
          title="💳 Complete Online Payment to Confirm Booking"
          className="max-w-lg"
        >
          <div className="space-y-4 pt-3 text-left">
            {/* Price & Deposit Summary */}
            <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-500 dark:text-zinc-400 font-bold">Total Booking Price:</span>
                <span className="font-extrabold text-zinc-900 dark:text-white font-mono text-sm">৳{pendingPaymentData.booking?.price}</span>
              </div>
              <div className="flex justify-between items-center text-xs border-t border-purple-500/10 pt-2">
                <span className="text-emerald-600 dark:text-emerald-400 font-extrabold uppercase">Required Advance Now:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400 font-mono text-base">৳{pendingPaymentData.payableAmount}</span>
              </div>
              {pendingPaymentData.dueAmount > 0 && (
                <div className="flex justify-between items-center text-xs border-t border-purple-500/10 pt-2">
                  <span className="text-amber-600 dark:text-amber-400 font-bold">Remaining Balance Due at Venue:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">৳{pendingPaymentData.dueAmount}</span>
                </div>
              )}
            </div>

            {/* Select Gateway */}
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-500">Select Payment Gateway:</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedGateway('bkash')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedGateway === 'bkash'
                      ? 'bg-pink-600 text-white border-pink-600 shadow-md scale-[1.02]'
                      : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800 hover:border-pink-300'
                  }`}
                >
                  <span className="font-black text-sm">🌸 bKash Merchant</span>
                  <span className="text-[10px] opacity-80 font-semibold">bKash App / TrxID Verification</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedGateway('sslcommerz')}
                  className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedGateway === 'sslcommerz'
                      ? 'bg-cyan-600 text-white border-cyan-600 shadow-md scale-[1.02]'
                      : 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white border-zinc-200 dark:border-zinc-800 hover:border-cyan-300'
                  }`}
                >
                  <span className="font-black text-sm">🔒 SSLCommerz</span>
                  <span className="text-[10px] opacity-80 font-semibold">Cards / MFS / Net Banking</span>
                </button>
              </div>
            </div>

            {/* bKash Merchant Gateway View */}
            {selectedGateway === 'bkash' && (
              <div className="p-5 rounded-2xl bg-pink-500/10 border border-pink-500/20 space-y-4">
                <div className="flex items-center justify-between border-b border-pink-500/20 pb-3">
                  <span className="font-black text-sm text-pink-700 dark:text-pink-300 flex items-center gap-1.5">
                    🌸 bKash Merchant Payment Gateway
                  </span>
                  <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-pink-600 text-white">
                    Official Checkout API
                  </span>
                </div>

                <p className="text-xs text-pink-950 dark:text-pink-200 font-semibold leading-relaxed">
                  You will be redirected to the official bKash Merchant Tokenized Gateway portal to securely complete your <strong>৳{pendingPaymentData.payableAmount}</strong> payment using your bKash Mobile Wallet (bKash Number, OTP, PIN). No manual Transaction ID typing required.
                </p>

                <Button
                  type="button"
                  onClick={handleInitiateBkashMerchantPayment}
                  disabled={isVerifyingPayment}
                  className="w-full bg-pink-600 hover:bg-pink-700 text-white font-bold py-3 text-sm shadow-md"
                >
                  {isVerifyingPayment ? 'Connecting to bKash Gateway...' : 'Proceed to bKash Merchant Checkout →'}
                </Button>
              </div>
            )}

            {/* SSLCommerz Payment View */}
            {selectedGateway === 'sslcommerz' && (
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 space-y-4">
                <p className="text-xs text-cyan-900 dark:text-cyan-200 font-semibold leading-relaxed">
                  You will be redirected to the secure SSLCommerz payment portal to complete <strong>৳{pendingPaymentData.payableAmount}</strong> payment using Visa, Mastercard, AMEX, bKash, Nagad, Rocket, or Internet Banking.
                </p>
                <Button
                  type="button"
                  onClick={handleSSLCommerzPayment}
                  disabled={isVerifyingPayment}
                  className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 text-sm shadow-md"
                >
                  {isVerifyingPayment ? 'Connecting to SSLCommerz...' : 'Proceed to SSLCommerz Checkout →'}
                </Button>
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
};
