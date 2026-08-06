import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import { useGrounds } from '../hooks/useApi';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useSocket } from '../contexts/SocketContext';
import { User, Calendar, Clock, RefreshCw, XCircle, Info, Edit, Trash2, Ban, FileText, ChevronLeft, ChevronRight, Trophy, ShieldCheck, MapPin, CreditCard, Layers, DollarSign, ArrowRightLeft, CheckCircle2 } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';
import { DatePicker } from '../components/ui/DatePicker';

const format12Hour = (time24) => {
  if (!time24) return '';
  const [hourStr, minStr] = time24.split(':');
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12;
  return `${String(hour).padStart(2, '0')}:${minStr} ${ampm}`;
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

const getLocalDateString = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const UserDashboard = () => {
  const navigate = useNavigate();
  const { user, updateProfile, logout, loading: authLoading } = useUserAuth();
  const toast = useToast();
  const { data: grounds } = useGrounds();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  
  // Pagination state (5 bookings per page)
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  // Profile edit fields
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');

  // Request states
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [requestType, setRequestType] = useState(''); // 'change' or 'cancel'
  const [dialogOpen, setDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  
  // New slot changes
  const [newDate, setNewDate] = useState('');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Live slot states for rescheduling
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [selectedRescheduleSlots, setSelectedRescheduleSlots] = useState([]);
  const [rescheduleGroundId, setRescheduleGroundId] = useState('');

  // Fetch available slots when reschedule date or ground changes
  useEffect(() => {
    if (dialogOpen && requestType === 'change' && newDate) {
      const loadSlots = async () => {
        setSlotsLoading(true);
        setSelectedRescheduleSlots([]);
        try {
          const gId = rescheduleGroundId || selectedBooking?.groundId;
          const url = gId
            ? `/available-slots?date=${newDate}&groundId=${gId}`
            : `/available-slots?date=${newDate}`;
          const res = await API.get(url);
          setRescheduleSlots(res.data.slots || []);
          setIsBlocked(res.data.isBlocked || false);
          setBlockedReason(res.data.reason || '');
        } catch (e) {
          console.error("Failed to load slots", e);
          toast.error("Failed to load available slots for the selected date.");
        } finally {
          setSlotsLoading(false);
        }
      };
      loadSlots();
    }
  }, [newDate, rescheduleGroundId, dialogOpen, requestType, selectedBooking]);

  const requiredSlotCount = selectedBooking?.duration || 1;

  const handleRescheduleSlotClick = (slot) => {
    if (!slot.isAvailable) return;

    if (requiredSlotCount === 1) {
      setSelectedRescheduleSlots([slot]);
      return;
    }

    const exists = selectedRescheduleSlots.some((s) => s.id === slot.id);
    let newSelection = [];

    if (exists) {
      newSelection = selectedRescheduleSlots.filter((s) => s.id !== slot.id);
    } else {
      if (selectedRescheduleSlots.length >= requiredSlotCount) {
        newSelection = [slot];
      } else {
        newSelection = [...selectedRescheduleSlots, slot];
      }
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
      setSelectedRescheduleSlots(newSelection);
    } else {
      setSelectedRescheduleSlots([slot]);
      toast.info(`Selected slots must be contiguous (${requiredSlotCount} consecutive slots required).`);
    }
  };

  const socket = useSocket();

  const fetchBookings = async () => {
    try {
      const res = await API.get('/user/my-bookings');
      if (res.data.success) {
        setBookings(res.data.bookings || []);
      }
    } catch (e) {
      toast.error('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  // ── Real-time socket listeners for admin actions ──
  useEffect(() => {
    if (!socket || !user) return;

    const handleRequestUpdated = (data) => {
      if (data.userId !== user.id) return;
      const ref = data.bookingId || '';
      if (data.status === 'approved') {
        const actionText = data.type === 'cancel' ? 'cancellation' : 'reschedule';
        toast.success(`Your ${actionText} request for booking ${ref} has been approved! ✅`);
      } else if (data.status === 'rejected') {
        const actionText = data.type === 'cancel' ? 'cancellation' : 'reschedule';
        const noteText = data.adminNote ? ` Reason: ${data.adminNote}` : '';
        toast.error(`Your ${actionText} request for booking ${ref} was rejected.${noteText}`);
      }
      fetchBookings();
    };

    const handleBookingUpdated = (bookingData) => {
      if (bookingData.userId !== user.id) return;
      if (bookingData.status === 'Confirmed') {
        toast.success(`Your booking ${bookingData.bookingId} has been confirmed! 🎉`);
      } else if (bookingData.status === 'Cancelled') {
        toast.error(`Your booking ${bookingData.bookingId} has been cancelled. ❌`);
      }
      fetchBookings();
    };

    socket.on('booking-request-updated', handleRequestUpdated);
    socket.on('user-booking-updated', handleBookingUpdated);

    return () => {
      socket.off('booking-request-updated', handleRequestUpdated);
      socket.off('user-booking-updated', handleBookingUpdated);
    };
  }, [socket, user]);

  // Sync profile fields when user loads or updates
  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await updateProfile({ name, email });
      if (res?.success) {
        toast.success('Profile details updated successfully!');
        setEditingProfile(false);
      } else {
        toast.error(res?.message || 'Failed to update profile.');
      }
    } catch (e) {
      toast.error('Failed to update profile.');
    }
  };

  const openRequestDialog = (booking, type) => {
    setSelectedBooking(booking);
    setRequestType(type);
    setReason('');
    setSelectedRescheduleSlots([]);
    setRescheduleGroundId(booking.groundId ? booking.groundId.toString() : '');
    // Auto-select today or tomorrow as the reschedule date
    if (type === 'change') {
      const todayStr = getLocalDateString();
      setNewDate(todayStr);
    } else {
      setNewDate('');
    }
    setDialogOpen(true);
  };

  // Calculate reschedule price summary
  const rescheduleTotal = selectedRescheduleSlots.reduce((sum, s) => sum + (s.price || 0), 0);
  const originalPrice = selectedBooking?.price || 0;
  const priceDiff = rescheduleTotal - originalPrice;

  // Get the selected ground's name for display
  const rescheduleGroundName = grounds?.find(g => g.id.toString() === rescheduleGroundId)?.name || 'Arena';

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!selectedBooking) return;

    if (requestType === 'change') {
      if (!newDate) {
        toast.error('Please select a new reschedule date.');
        return;
      }
      if (selectedRescheduleSlots.length !== requiredSlotCount) {
        toast.error(`Your original booking is for ${requiredSlotCount} slot${requiredSlotCount > 1 ? 's' : ''}. You must select exactly ${requiredSlotCount} slot${requiredSlotCount > 1 ? 's' : ''} to reschedule.`);
        return;
      }
    }

    setSubmittingRequest(true);
    try {
      const sorted = [...selectedRescheduleSlots].sort((a, b) => a.startTime.localeCompare(b.startTime));

      if (requestType === 'change') {
        const payload = {
          newDate,
          newStartTime: sorted[0].startTime,
          newEndTime: sorted[sorted.length - 1].endTime,
          newGroundId: rescheduleGroundId ? Number(rescheduleGroundId) : undefined,
          reason,
        };
        const res = await API.post(`/booking-requests/${selectedBooking.id}/change`, payload);
        if (res.data.success) {
          toast.success('Reschedule request submitted to Admin!');
          setDialogOpen(false);
          fetchBookings();
        }
      } else {
        const payload = { reason };
        const res = await API.post(`/booking-requests/${selectedBooking.id}/cancel`, payload);
        if (res.data.success) {
          toast.success('Cancellation request submitted to Admin!');
          setDialogOpen(false);
          fetchBookings();
        }
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Pagination calculation
  const totalPages = Math.max(1, Math.ceil(bookings.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentBookings = bookings.slice(startIndex, startIndex + itemsPerPage);

  const activeBookingsCount = bookings.filter(b => ['Confirmed', 'Pending'].includes(b.status)).length;

  return (
    <div className="max-w-full px-4 sm:px-8 lg:px-12 py-10 text-left animate-fade-in space-y-8">
      
      {/* Header Banner */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl border border-zinc-200/50 dark:border-zinc-800 bg-gradient-to-r from-purple-600/10 via-indigo-600/5 to-transparent flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-600 text-white">
              Customer Portal
            </span>
            <span className="text-xs text-zinc-500 font-medium font-mono">
              Account ID: #{user?.id || '---'}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
            Welcome Back, <span className="bg-gradient-to-r from-purple-600 to-indigo-600 bg-clip-text text-transparent">{user?.name || 'Player'}</span> 👋
          </h1>
          <p className="text-xs text-zinc-500 font-medium max-w-lg">
            Manage your profile, view tax invoice receipts, track upcoming matches, or request rescheduling.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button
            onClick={() => navigate('/booking')}
            className="w-full sm:w-auto font-extrabold flex items-center justify-center gap-2 bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white shadow-lg shadow-purple-500/20 py-3 px-6 rounded-2xl text-xs uppercase tracking-wider transition-all duration-300"
          >
            <Trophy className="w-4 h-4" /> Book Playing Arena
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Left Column: User Profile Card */}
        <Card className="glass-card lg:col-span-1 border border-zinc-200/50 dark:border-zinc-800 shadow-sm rounded-3xl">
          <CardHeader className="pb-4 border-b border-zinc-150 dark:border-zinc-850">
            <CardTitle className="flex items-center gap-2 text-base font-extrabold text-zinc-900 dark:text-white">
              <User className="w-4.5 h-4.5 text-purple-600" />
              Customer Profile
            </CardTitle>
            <CardDescription className="text-xs">Your registered details and quick stats</CardDescription>
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center text-white font-black text-xl shadow-md shadow-purple-500/20">
                {(user?.name || 'P')[0].toUpperCase()}
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                  {user?.name || 'Not set'}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {formatPhoneDisplay(user?.phone || '')}
                </p>
                <p className="text-[11px] text-purple-650 dark:text-purple-400 font-medium truncate">
                  {user?.email || 'No email associated'}
                </p>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 space-y-1">
                <span className="text-[10px] font-extrabold text-purple-600 dark:text-purple-400 uppercase tracking-wider block">
                  Total Bookings
                </span>
                <span className="text-xl font-black text-zinc-900 dark:text-white">
                  {bookings.length}
                </span>
              </div>
              <div className="p-3.5 rounded-2xl bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500/10 space-y-1">
                <span className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
                  Active Matches
                </span>
                <span className="text-xl font-black text-zinc-900 dark:text-white">
                  {activeBookingsCount}
                </span>
              </div>
            </div>

            {!editingProfile ? (
              <div className="flex gap-2 pt-2">
                <Button size="sm" variant="outline" className="flex-1 font-bold text-xs" onClick={() => setEditingProfile(true)}>
                  <Edit className="w-3.5 h-3.5 mr-1" /> Edit Profile
                </Button>
                <Button size="sm" variant="secondary" className="font-bold text-xs" onClick={logout}>
                  Sign Out
                </Button>
              </div>
            ) : (
              <form onSubmit={handleProfileUpdate} className="space-y-4 pt-2 border-t border-zinc-150 dark:border-zinc-850">
                <Input
                  label="Full Name"
                  placeholder="ADIL HUSSAIN"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Email Address"
                  placeholder="adil@gmail.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <div className="flex gap-2 pt-2">
                  <Button type="submit" size="sm" className="flex-1 font-bold">Save Changes</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingProfile(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Right Column: Bookings History Datatable (Wide 3-column span) */}
        <Card className="glass-card lg:col-span-3 border border-zinc-200/50 dark:border-zinc-800 shadow-sm rounded-3xl">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-150 dark:border-zinc-850">
            <div>
              <CardTitle className="flex items-center gap-2 text-base font-extrabold text-zinc-900 dark:text-white">
                <Calendar className="w-4.5 h-4.5 text-purple-600" />
                My Court Reservations
              </CardTitle>
              <CardDescription className="text-xs">
                View tax invoice receipts, reschedule, or cancel court bookings (Showing 5 per page)
              </CardDescription>
            </div>

            {bookings.length > 0 && (
              <div className="text-xs font-mono font-bold text-zinc-400">
                Total: {bookings.length} reservation{bookings.length > 1 ? 's' : ''}
              </div>
            )}
          </CardHeader>

          <CardContent className="pt-6 space-y-6">
            {loading ? (
              <div className="flex justify-center py-16"><Loader size="lg" /></div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-16 space-y-4">
                <div className="p-4 bg-purple-500/10 text-purple-600 rounded-2xl w-fit mx-auto">
                  <Calendar className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200">You haven't made any court bookings yet.</p>
                  <p className="text-xs text-zinc-500 font-medium">Reserve your court session to start playing!</p>
                </div>
                <Button
                  onClick={() => navigate('/booking')}
                  className="font-bold bg-purple-650 hover:bg-purple-700 text-white px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                >
                  Book Your First Court
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                
                {/* Compact Datatable */}
                <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-zinc-100/80 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 text-zinc-500 font-extrabold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">Ref ID</th>
                        <th className="py-2.5 px-3">Date & Time</th>
                        <th className="py-2.5 px-3">Arena</th>
                        <th className="py-2.5 px-3">Amount & Payment</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-150 dark:divide-zinc-850 font-medium">
                      {currentBookings.map((booking) => {
                        const isActive = ['Pending', 'Confirmed'].includes(booking.status);
                        const hasRequest = booking.requests && booking.requests.some(r => r.status === 'pending');

                        return (
                          <tr key={booking.id} className="hover:bg-purple-500/5 transition-colors">
                            
                            {/* Ref ID */}
                            <td className="py-2.5 px-3 font-mono font-bold text-purple-650 dark:text-purple-400 whitespace-nowrap">
                              #{booking.bookingId}
                            </td>

                            {/* Date / Time */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-zinc-900 dark:text-white">
                                {booking.bookingDate}
                              </div>
                              <div className="text-[10px] text-zinc-500 font-medium">
                                {format12Hour(booking.startTime)} - {format12Hour(booking.endTime)}
                              </div>
                            </td>

                            {/* Sport & Ground */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="font-bold text-zinc-900 dark:text-white">
                                {booking.ground?.name || 'Main Arena'}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {booking.sport}
                              </div>
                            </td>

                            {/* Payment Status & Details */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-zinc-900 dark:text-white text-xs">
                                  ৳{booking.price}
                                </span>
                                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  booking.paymentStatus === 'paid'
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400'
                                    : booking.paymentStatus === 'partial'
                                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400'
                                    : booking.paymentStatus === 'refunded'
                                    ? 'bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400'
                                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400'
                                }`}>
                                  {booking.paymentStatus === 'paid' ? 'PAID' : booking.paymentStatus === 'partial' ? 'DEPOSIT' : booking.paymentStatus === 'refunded' ? 'REFUNDED' : 'UNPAID'}
                                </span>
                              </div>
                              {booking.dueAmount > 0 && (
                                <div className="text-[9px] text-amber-600 dark:text-amber-400 font-mono font-semibold">
                                  Due: ৳{booking.dueAmount}
                                </div>
                              )}
                            </td>

                            {/* Booking Status */}
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                                booking.status === 'Confirmed'
                                  ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                  : booking.status === 'Pending'
                                  ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                  : booking.status === 'Cancelled'
                                  ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                  : 'bg-blue-500/10 text-blue-600 dark:text-blue-400'
                              }`}>
                                {booking.status}
                              </span>
                              {hasRequest && (
                                <span className="block text-[9px] text-purple-650 font-bold mt-0.5 animate-pulse">
                                  Request Pending
                                </span>
                              )}
                            </td>

                            {/* Actions Column */}
                            <td className="py-2.5 px-3 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5">
                                
                                {/* View / Download Invoice Button */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => navigate(`/booking/success?bookingId=${booking.bookingId || booking.id}`)}
                                  className="text-[10px] font-bold py-1 px-2 flex items-center gap-1 border-purple-500/30 text-purple-650 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                                >
                                  <FileText className="w-3 h-3" /> Invoice
                                </Button>

                                {isActive && !hasRequest && (
                                  <>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => openRequestDialog(booking, 'change')}
                                      className="text-[10px] font-bold py-1 px-2 flex items-center gap-1"
                                    >
                                      <RefreshCw className="w-3 h-3" /> Reschedule
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="danger-outline"
                                      onClick={() => openRequestDialog(booking, 'cancel')}
                                      className="text-[10px] font-bold py-1 px-2 flex items-center gap-1"
                                    >
                                      <XCircle className="w-3 h-3" /> Cancel
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* 5-Item Pagination Controls */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 text-xs font-semibold text-zinc-500 border-t border-zinc-150 dark:border-zinc-850">
                  <div>
                    Showing <strong className="text-zinc-900 dark:text-white font-mono">{startIndex + 1}</strong> to <strong className="text-zinc-900 dark:text-white font-mono">{Math.min(startIndex + itemsPerPage, bookings.length)}</strong> of <strong className="text-zinc-900 dark:text-white font-mono">{bookings.length}</strong> bookings
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      className="font-bold text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" /> Previous
                    </Button>

                    <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-850 text-zinc-800 dark:text-zinc-200 rounded-lg text-xs font-mono font-bold">
                      Page {currentPage} of {totalPages}
                    </span>

                    <Button
                      size="sm"
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      className="font-bold text-xs py-1.5 px-3 flex items-center gap-1 disabled:opacity-40"
                    >
                      Next <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* Reschedule / Cancellation Dialog */}
      {dialogOpen && (
        <Dialog
          isOpen={dialogOpen}
          onClose={() => setDialogOpen(false)}
          title={requestType === 'change' ? `🔄 Reschedule Booking - #${selectedBooking?.bookingId}` : `❌ Cancel Booking - #${selectedBooking?.bookingId}`}
          className={requestType === 'change' ? "max-w-3xl" : "max-w-md"}
        >
          <form onSubmit={handleRequestSubmit} className="space-y-5 pt-2 text-left">
            {/* Original Booking Reference Card */}
            {selectedBooking && (
              <div className="p-3.5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-1.5 text-xs font-semibold">
                <div className="flex justify-between items-center text-purple-700 dark:text-purple-300 font-extrabold uppercase text-[10px] tracking-wider">
                  <span>Current Reservation Details</span>
                  <span className="font-mono">#{selectedBooking.bookingId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-zinc-700 dark:text-zinc-300">
                  <div>
                    <span className="text-zinc-450 block text-[10px]">Date:</span>
                    <span className="font-bold">{selectedBooking.bookingDate}</span>
                  </div>
                  <div>
                    <span className="text-zinc-450 block text-[10px]">Time:</span>
                    <span className="font-bold">{format12Hour(selectedBooking.startTime)} - {format12Hour(selectedBooking.endTime)}</span>
                  </div>
                  <div>
                    <span className="text-zinc-450 block text-[10px]">Arena:</span>
                    <span className="font-bold">{selectedBooking.ground?.name || 'Main Arena'}</span>
                  </div>
                  <div>
                    <span className="text-zinc-450 block text-[10px]">Price:</span>
                    <span className="font-mono font-black text-purple-650 dark:text-purple-400">৳{selectedBooking.price}</span>
                  </div>
                </div>
              </div>
            )}

            {requestType === 'change' && (
              <div className="space-y-5">
                {/* Arena Selection Chips / Cards */}
                {grounds && grounds.length > 1 && (
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Layers className="w-3.5 h-3.5 text-purple-650" /> Select Target Arena / Court
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {grounds.map((g) => {
                        const isSelected = rescheduleGroundId === g.id.toString();
                        let sportIcon = '⚽';
                        if (g.sport?.toLowerCase().includes('cricket')) sportIcon = '🏏';
                        else if (g.sport?.toLowerCase().includes('badminton')) sportIcon = '🏸';

                        return (
                          <div
                            key={g.id}
                            onClick={() => setRescheduleGroundId(g.id.toString())}
                            className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center justify-between select-none ${
                              isSelected
                                ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/20 ring-1 ring-purple-500'
                                : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-300'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span>{sportIcon}</span>
                              <span className="truncate">{g.name}</span>
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded uppercase font-mono shrink-0 ${
                              isSelected ? 'bg-purple-500/30 text-white' : 'bg-purple-500/10 text-purple-650 dark:text-purple-400'
                            }`}>
                              {g.sport}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Reschedule Date Selection */}
                <div>
                  <DatePicker
                    label="Select New Reschedule Date"
                    min={new Date().toISOString().split('T')[0]}
                    value={newDate}
                    onChange={(dateStr) => setNewDate(dateStr)}
                    groundId={rescheduleGroundId}
                    required
                  />
                </div>

                {/* Available Slots Section */}
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" /> Choose Available Slots for {rescheduleGroundName}
                    </label>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                        selectedRescheduleSlots.length === requiredSlotCount
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                      }`}>
                        Must Select Exactly {requiredSlotCount} Slot{requiredSlotCount > 1 ? 's' : ''} ({selectedRescheduleSlots.length}/{requiredSlotCount})
                      </span>
                    </div>
                  </div>

                  {slotsLoading ? (
                    <div className="flex justify-center py-8"><Loader size="medium" /></div>
                  ) : isBlocked ? (
                    <div className="p-4 text-center text-rose-500 border border-rose-200/50 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 rounded-xl font-bold text-xs">
                      ⚠️ Venue is Closed on this day ({blockedReason || 'Maintenance/Holiday'})
                    </div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div className="p-4 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs font-semibold">
                      No active slots configured for this day.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-56 overflow-y-auto custom-scrollbar p-1">
                      {rescheduleSlots.map((slot) => {
                        const isSelected = selectedRescheduleSlots.some((s) => s.id === slot.id);
                        return (
                          <div
                            key={slot.id}
                            onClick={() => handleRescheduleSlotClick(slot)}
                            className={`p-2.5 rounded-xl border font-bold text-xs transition-all duration-200 flex flex-col items-center justify-center gap-1 select-none ${
                              !slot.isAvailable
                                ? 'bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/30 text-rose-850 dark:text-rose-455 cursor-not-allowed opacity-75'
                                : isSelected
                                ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/25 cursor-pointer ring-2 ring-purple-400'
                                : 'bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-350 cursor-pointer'
                            }`}
                          >
                            <span className="text-xs font-extrabold">{format12Hour(slot.startTime)} - {format12Hour(slot.endTime)}</span>
                            <div className="flex items-center gap-1">
                              <span className={`text-[9px] px-1.5 py-0.2 rounded-full uppercase tracking-wider font-bold ${
                                !slot.isAvailable
                                  ? 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400'
                                  : isSelected
                                  ? 'bg-purple-500/30 text-white'
                                  : 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-400'
                              }`}>
                                {slot.isAvailable ? (slot.rateType === 'night' ? 'Night Shift' : 'Day Shift') : 'Booked'}
                              </span>
                              {slot.isAvailable && slot.price && (
                                <span className={`text-[10px] font-mono font-black ${isSelected ? 'text-amber-300' : 'text-purple-650 dark:text-purple-400'}`}>
                                  ৳{slot.price}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Reschedule Summary & Price Comparison Box */}
                {selectedRescheduleSlots.length > 0 && (
                  <div className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20 border border-purple-200 dark:border-purple-900/40 p-4 rounded-2xl text-xs space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold text-purple-800 dark:text-purple-300 uppercase tracking-wider text-[10px] flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-purple-650" /> New Schedule Target
                      </span>
                      <span className="font-bold text-zinc-600 dark:text-zinc-300">
                        {rescheduleGroundName} &bull; {newDate}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300 pt-1 border-t border-purple-200/60 dark:border-purple-900/40">
                      <span>Time Range ({selectedRescheduleSlots.length} hr):</span>
                      <span className="font-bold text-zinc-900 dark:text-white font-mono">
                        {format12Hour(selectedRescheduleSlots[0].startTime)} - {format12Hour(selectedRescheduleSlots[selectedRescheduleSlots.length - 1].endTime)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      <span>New Total Estimated Price:</span>
                      <span className="font-mono font-extrabold text-purple-700 dark:text-purple-300 text-sm">
                        ৳{rescheduleTotal}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-purple-200/60 dark:border-purple-900/40">
                      <span className="text-zinc-500">Price Adjustment:</span>
                      <span className={`font-mono ${priceDiff > 0 ? 'text-amber-600 dark:text-amber-400' : priceDiff < 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-600 dark:text-zinc-400'}`}>
                        {priceDiff > 0 ? `+৳${priceDiff} (Additional Due)` : priceDiff < 0 ? `-৳${Math.abs(priceDiff)} (Refund / Credit)` : 'No Price Change (৳0)'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <Input
              label="Reason / Note"
              placeholder={requestType === 'change' ? 'Explain why you need to reschedule' : 'Explain why you need to cancel'}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
            />

            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={submittingRequest} className="font-bold text-xs py-2.5 px-5">
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submittingRequest || (requestType === 'change' && selectedRescheduleSlots.length !== requiredSlotCount)}
                className="bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white font-extrabold text-xs uppercase tracking-wider py-2.5 px-6 rounded-xl shadow-md shadow-purple-500/20 disabled:opacity-50"
              >
                {submittingRequest ? 'Submitting...' : requestType === 'change' ? 'Submit Reschedule Request 🔄' : 'Submit Cancellation Request ❌'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default UserDashboard;
