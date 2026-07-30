import React, { useState, useEffect } from 'react';
import { useUserAuth } from '../contexts/UserAuthContext';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { User, Calendar, Clock, RefreshCw, XCircle, Info, Edit, Trash2 } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';

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
  const { user, updateProfile, logout } = useUserAuth();
  const toast = useToast();

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
      setNewStartTime(booking.startTime);
      setNewEndTime(booking.endTime);
    }
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!reason) {
      toast.error('Please provide a reason for the request.');
      return;
    }

    setSubmittingRequest(true);
    try {
      const endpoint = `/booking-requests/${selectedBooking.id}/${requestType}`;
      const payload = { reason };
      if (requestType === 'change') {
        payload.newDate = newDate;
        payload.newStartTime = newStartTime;
        payload.newEndTime = newEndTime;
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
                  placeholder="Enter full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <Input
                  label="Email Address"
                  placeholder="Enter email address"
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
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl font-bold">
              <Calendar className="w-5 h-5 text-violet-500" />
              My Booking History
            </CardTitle>
            <CardDescription>View, modify, or cancel your upcoming and past court bookings.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12"><Loader size="lg" /></div>
            ) : bookings.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <Info className="w-8 h-8 text-zinc-400 mx-auto" />
                <p className="text-sm font-medium text-zinc-500">You haven't made any bookings yet.</p>
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
          className="max-w-md"
        >
          <form onSubmit={handleRequestSubmit} className="space-y-4 pt-2 text-left">
            {requestType === 'change' && (
              <div className="space-y-3">
                <Input
                  label="New Date"
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    label="Start Time"
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    required
                  />
                  <Input
                    label="End Time"
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    required
                  />
                </div>
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
