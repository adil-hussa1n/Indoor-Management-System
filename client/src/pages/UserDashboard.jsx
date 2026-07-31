import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserAuth } from '../contexts/UserAuthContext';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useSocket } from '../contexts/SocketContext';
import { User, Calendar, Clock, RefreshCw, XCircle, Info, Edit, Trash2, Ban } from 'lucide-react';
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

export const UserDashboard = () => {
  const navigate = useNavigate();
  const { user, updateProfile, logout, loading: authLoading } = useUserAuth();
  const toast = useToast();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login');
    }
  }, [user, authLoading, navigate]);

  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  
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
  const [newStartTime, setNewStartTime] = useState('09:00');
  const [newEndTime, setNewEndTime] = useState('10:00');
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Live slot states for rescheduling
  const [rescheduleSlots, setRescheduleSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockedReason, setBlockedReason] = useState('');
  const [selectedRescheduleSlots, setSelectedRescheduleSlots] = useState([]);

  // Fetch available slots when reschedule date changes
  useEffect(() => {
    if (dialogOpen && requestType === 'change' && newDate) {
      const loadSlots = async () => {
        setSlotsLoading(true);
        setSelectedRescheduleSlots([]);
        try {
          const res = await API.get(`/available-slots?date=${newDate}`);
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
  }, [newDate, dialogOpen, requestType]);

  const handleRescheduleSlotClick = (slot) => {
    if (!slot.isAvailable) return;

    const exists = selectedRescheduleSlots.some((s) => s.id === slot.id);
    let newSelection = [];

    if (exists) {
      newSelection = selectedRescheduleSlots.filter((s) => s.id !== slot.id);
    } else {
      newSelection = [...selectedRescheduleSlots, slot];
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
      toast.info('Selected slots must be contiguous.');
    }
  };

  const socket = useSocket();

  const fetchBookings = async () => {
    try {
      const res = await API.get('/user/my-bookings');
      if (res.data.success) {
        setBookings(res.data.bookings);
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
      // Only show notification to the user who owns this request
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
      // Refresh bookings to show updated status
      fetchBookings();
    };

    const handleBookingUpdated = (bookingData) => {
      // Check if this booking belongs to the logged-in user
      if (bookingData.userId !== user.id) return;

      if (bookingData.status === 'Confirmed') {
        toast.success(`Your booking ${bookingData.bookingId} has been confirmed! 🎉`);
      } else if (bookingData.status === 'Cancelled') {
        toast.error(`Your booking ${bookingData.bookingId} has been cancelled. ❌`);
      } else if (bookingData.status === 'Completed') {
        toast.success(`Your booking ${bookingData.bookingId} is completed! Hope you had a great game! ⚽`);
      } else if (bookingData.status === 'Pending') {
        toast.info(`Your booking ${bookingData.bookingId} is now pending approval.`);
      } else {
        toast.info(`Your booking ${bookingData.bookingId} status was updated to ${bookingData.status}.`);
      }
      fetchBookings();
    };

    socket.on('booking-request-updated', handleRequestUpdated);
    socket.on('booking-updated', handleBookingUpdated);

    return () => {
      socket.off('booking-request-updated', handleRequestUpdated);
      socket.off('booking-updated', handleBookingUpdated);
    };
  }, [socket, user]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await updateProfile(name, email);
    setLoading(false);
    if (res.success) {
      toast.success('Profile updated successfully!');
      setEditingProfile(false);
    } else {
      toast.error(res.message);
    }
  };

  const openRequestDialog = (booking, type) => {
    setSelectedBooking(booking);
    setRequestType(type);
    setDialogOpen(true);
    setReason('');
    if (type === 'change') {
      setNewDate(booking.bookingDate);
      setSelectedRescheduleSlots([]);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please provide a reason for the request.');
      return;
    }

    if (requestType === 'change' && selectedRescheduleSlots.length === 0) {
      toast.error('Please select at least one time slot.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const endpoint = `/booking-requests/${selectedBooking.id}/${requestType}`;
      const payload = { reason };
      if (requestType === 'change') {
        payload.newDate = newDate;
        payload.newStartTime = selectedRescheduleSlots[0].startTime;
        payload.newEndTime = selectedRescheduleSlots[selectedRescheduleSlots.length - 1].endTime;
      }

      const res = await API.post(endpoint, payload);
      if (res.data.success) {
        toast.success(res.data.message || 'Request submitted successfully!');
        setDialogOpen(false);
        fetchBookings(); // refresh
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-[80vh] flex flex-col gap-8">
      {/* Upper Grid - Profile + Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        
        {/* Profile Card */}
        <Card className="glass-card hover-glow md:col-span-1 border border-zinc-200/50 dark:border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <User className="w-5 h-5 text-violet-500" />
              My Profile
            </CardTitle>
            <CardDescription>Manage your customer login profile details.</CardDescription>
          </CardHeader>
          <CardContent>
            {!editingProfile ? (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Full Name</label>
                  <p className="font-semibold text-zinc-900 dark:text-white">{user?.name || 'Not set'}</p>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Phone Number</label>
                  <p className="font-semibold text-zinc-900 dark:text-white font-mono">{user?.phone}</p>
                </div>
                <div>
                  <label className="text-xs text-zinc-400 dark:text-zinc-500 font-medium">Email Address</label>
                  <p className="font-semibold text-zinc-900 dark:text-white">{user?.email || 'Not set'}</p>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" onClick={() => { setName(user?.name || ''); setEmail(user?.email || ''); setEditingProfile(true); }}>
                    Edit Profile
                  </Button>
                  <Button size="sm" variant="secondary" onClick={logout}>
                    Sign Out
                  </Button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleUpdateProfile} className="space-y-4">
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
                  <Button type="submit" size="sm">Save Changes</Button>
                  <Button type="button" size="sm" variant="secondary" onClick={() => setEditingProfile(false)}>Cancel</Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>

        {/* Dashboard Main Stats/History */}
        <Card className="glass-card hover-glow md:col-span-2 border border-zinc-200/50 dark:border-zinc-800">
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-4 pb-4 border-b border-zinc-100 dark:border-zinc-900/50">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-bold">
                <Calendar className="w-5 h-5 text-violet-500" />
                My Booking History
              </CardTitle>
              <CardDescription className="mt-1">View, modify, or cancel your upcoming and past court bookings.</CardDescription>
            </div>
            <Button
              onClick={() => navigate('/booking')}
              className="font-bold flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg py-2.5 px-4 rounded-xl text-xs uppercase tracking-wider transition-all duration-300"
            >
              <Calendar className="w-3.5 h-3.5" />
              Book Court
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="flex justify-center py-12"><Loader size="lg" /></div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 space-y-4">
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800/40 rounded-full w-fit mx-auto">
                  <Calendar className="w-8 h-8 text-zinc-450 dark:text-zinc-550" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-zinc-800 dark:text-zinc-200">You haven't made any bookings yet.</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-405 font-semibold">Start playing by reserving your court today!</p>
                </div>
                <Button
                  onClick={() => navigate('/booking')}
                  className="font-bold bg-gradient-to-r from-violet-600 to-indigo-650 hover:from-violet-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all duration-300 px-6 py-2.5 rounded-xl text-xs uppercase tracking-wider"
                >
                  Book Your First Court
                </Button>
              </div>
            ) : (
              <div className="space-y-4 overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-semibold">
                      <th className="pb-3">Ref ID</th>
                      <th className="pb-3">Date / Time</th>
                      <th className="pb-3">Sport</th>
                      <th className="pb-3">Price</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookings.map((booking) => {
                      const isActive = ['Pending', 'Confirmed'].includes(booking.status);
                      const hasRequest = booking.requests && booking.requests.some(r => r.status === 'pending');

                      return (
                        <tr key={booking.id} className="border-b border-zinc-100 dark:border-zinc-900 text-sm hover:bg-zinc-500/5 transition-colors">
                          <td className="py-3.5 font-mono font-bold text-zinc-900 dark:text-white">{booking.bookingId}</td>
                          <td className="py-3.5">
                            <div className="font-semibold text-zinc-800 dark:text-zinc-200">{booking.bookingDate}</div>
                            <div className="text-xs text-zinc-400 dark:text-zinc-500 flex items-center gap-1.5 mt-0.5">
                              <Clock className="w-3.5 h-3.5" />
                              {format12Hour(booking.startTime)} - {format12Hour(booking.endTime)}
                            </div>
                          </td>
                          <td className="py-3.5 font-medium">{booking.sport}</td>
                          <td className="py-3.5 font-semibold text-zinc-900 dark:text-white">৳ {booking.price}</td>
                          <td className="py-3.5">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              booking.status === 'Confirmed' ? 'bg-emerald-500/10 text-emerald-500' :
                              booking.status === 'Pending' ? 'bg-amber-500/10 text-amber-500' :
                              booking.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500' :
                              'bg-blue-500/10 text-blue-500'
                            }`}>
                              {booking.status}
                            </span>
                            {hasRequest && (
                              <span className="block text-[10px] text-violet-500 font-bold mt-1 animate-pulse">
                                Request Pending
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 text-right">
                            {isActive && !hasRequest && (
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openRequestDialog(booking, 'change')}>
                                  <RefreshCw className="w-3.5 h-3.5" />
                                  Reschedule
                                </Button>
                                <Button size="sm" variant="danger-outline" onClick={() => openRequestDialog(booking, 'cancel')}>
                                  <XCircle className="w-3.5 h-3.5" />
                                  Cancel
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
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
          title={requestType === 'change' ? 'Request Booking Reschedule' : 'Request Booking Cancellation'}
          className={requestType === 'change' ? "max-w-2xl" : "max-w-md"}
        >
          <form onSubmit={handleRequestSubmit} className="space-y-4 pt-2 text-left">
            {requestType === 'change' && (
              <div className="space-y-4">
                <div>
                  <DatePicker
                    label="Select New Date"
                    min={new Date().toISOString().split('T')[0]}
                    value={newDate}
                    onChange={(dateStr) => setNewDate(dateStr)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-400 uppercase tracking-wider block">
                    Choose Available Time Slots
                  </label>

                  {slotsLoading ? (
                    <div className="flex justify-center py-8"><Loader size="medium" /></div>
                  ) : isBlocked ? (
                    <div className="p-4 text-center text-rose-500 border border-rose-200/50 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/40 rounded-xl font-bold text-xs">
                      ⚠️ Venue is Closed on this day ({blockedReason || 'Maintenance/Holiday'})
                    </div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div className="p-4 text-center text-zinc-400 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl text-xs">
                      No active slots configured for this day.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto custom-scrollbar p-1">
                      {rescheduleSlots.map((slot) => {
                        const isSelected = selectedRescheduleSlots.some((s) => s.id === slot.id);
                        return (
                          <div
                            key={slot.id}
                            onClick={() => handleRescheduleSlotClick(slot)}
                            className={`p-3 rounded-xl border font-bold text-xs transition-all duration-200 flex flex-col items-center justify-center gap-1 select-none ${
                              !slot.isAvailable
                                ? 'bg-rose-50/20 dark:bg-rose-950/5 border-rose-200/50 dark:border-rose-900/30 text-rose-850 dark:text-rose-455 cursor-not-allowed opacity-80'
                                : isSelected
                                ? 'bg-purple-650 border-purple-650 text-white shadow-md shadow-purple-500/25 cursor-pointer'
                                : 'bg-white hover:bg-zinc-50 dark:bg-zinc-900 dark:hover:bg-zinc-850 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-350 cursor-pointer'
                            }`}
                          >
                            <span className="text-sm font-extrabold">{format12Hour(slot.startTime)}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full uppercase tracking-wider font-bold ${
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
                  )}
                </div>

                {selectedRescheduleSlots.length > 0 && (
                  <div className="bg-purple-50 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/40 p-3.5 rounded-xl text-xs space-y-1">
                    <span className="font-bold text-purple-700 dark:text-purple-400">Selected Reschedule Target:</span>
                    <div className="text-zinc-650 dark:text-zinc-300 font-semibold flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-purple-650" />
                      {format12Hour(selectedRescheduleSlots[0].startTime)} - {format12Hour(selectedRescheduleSlots[selectedRescheduleSlots.length - 1].endTime)} ({selectedRescheduleSlots.length} hr)
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

            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={submittingRequest}>
                Close
              </Button>
              <Button type="submit" disabled={submittingRequest}>
                {submittingRequest ? 'Submitting...' : 'Submit Request'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default UserDashboard;
