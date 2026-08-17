import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Inbox, CheckCircle, XCircle, Clock, Calendar, RefreshCw, ShieldAlert, AlertTriangle, History, Ban, X, Eye, EyeOff, Trash2 } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';
import { useSocket } from '../contexts/SocketContext';

export const AdminRequests = () => {
  const toast = useToast();
  const confirm = useConfirm();
  const socket = useSocket();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Rejection dialog states
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [adminNote, setAdminNote] = useState('');

  // History dialog states
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyUser, setHistoryUser] = useState(null); // { user, phone }
  const [userBookings, setUserBookings] = useState([]);
  const [userRequests, setUserRequests] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyTab, setHistoryTab] = useState('requests'); // "requests" | "bookings"

  const openHistory = async (userRecord, phoneNum) => {
    setHistoryUser({ user: userRecord, phone: phoneNum });
    setHistoryOpen(true);
    setHistoryLoading(true);
    setHistoryTab('requests');
    try {
      // 1. Fetch bookings matching phone
      const bookingsRes = await API.get('/bookings', {
        params: { search: phoneNum, limit: 100 }
      });
      // 2. Fetch requests matching userId
      let requestsRes = { data: { requests: [] } };
      if (userRecord?.id) {
        requestsRes = await API.get('/booking-requests', {
          params: { userId: userRecord.id }
        });
      }

      if (bookingsRes.data.success) {
        setUserBookings(bookingsRes.data.bookings);
      }
      if (requestsRes.data.success) {
        setUserRequests(requestsRes.data.requests);
      }
    } catch (e) {
      toast.error('Failed to load customer history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleBlockFromHistory = async (phoneNum) => {
    const isConfirmed = await confirm({
      title: 'Block Customer?',
      message: `Are you sure you want to suspend phone number "${phoneNum}"? They will be signed out and blocked from booking.`,
      confirmText: 'Block Customer',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        const res = await API.post('/blocked-customers', {
          phone: phoneNum,
          reason: 'Suspicious cancellation/reschedule pattern flagged by admin',
          isPermanent: true,
        });
        if (res.data.success) {
          toast.success(`Successfully blocked ${phoneNum}.`);
          setHistoryOpen(false);
        }
      } catch (error) {
        toast.error(error.response?.data?.message || 'Failed to block customer.');
      }
    }
  };

  const fetchRequests = async () => {
    try {
      const res = await API.get('/booking-requests');
      if (res.data.success) {
        setRequests(res.data.requests);
      }
    } catch (e) {
      toast.error('Failed to load booking requests.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();

    if (socket) {
      const handleNewRequest = () => {
        console.log('Real-time socket update: reloading requests...');
        fetchRequests();
      };

      socket.on('new-booking-request', handleNewRequest);

      return () => {
        socket.off('new-booking-request', handleNewRequest);
      };
    }
  }, [socket]);

  const handleApprove = async (request) => {
    const isConfirmed = await confirm({
      title: request.type === 'cancel' ? 'Approve Cancellation?' : 'Approve Reschedule?',
      message: request.type === 'cancel'
        ? `Are you sure you want to approve cancellation for booking ${request.booking?.bookingId}? This slot will become available for booking immediately.`
        : `Are you sure you want to approve the reschedule to ${request.requestData?.newDate} (${request.requestData?.newStartTime} - ${request.requestData?.newEndTime})?`,
      confirmText: 'Approve Request',
      cancelText: 'Cancel',
      type: 'warning',
    });

    if (!isConfirmed) return;

    setProcessingId(request.id);
    try {
      const res = await API.patch(`/booking-requests/${request.id}`, {
        status: 'approved',
      });
      if (res.data.success) {
        toast.success('Request approved successfully!');
        fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Processing failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const openRejectDialog = (request) => {
    setRejectRequest(request);
    setAdminNote('');
    setRejectOpen(true);
  };

  const handleReject = async (e) => {
    e.preventDefault();
    if (!adminNote.trim()) {
      toast.error('Please specify a reason for rejection.');
      return;
    }

    setProcessingId(rejectRequest.id);
    setRejectOpen(false);
    try {
      const res = await API.patch(`/booking-requests/${rejectRequest.id}`, {
        status: 'rejected',
        adminNote: adminNote.trim(),
      });
      if (res.data.success) {
        toast.success('Request rejected.');
        fetchRequests();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Processing failed.');
    } finally {
      setProcessingId(null);
    }
  };

  const format12Hour = (time24) => {
    if (!time24) return '';
    const [hourStr, minStr] = time24.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    hour = hour ? hour : 12;
    return `${String(hour).padStart(2, '0')}:${minStr} ${ampm}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Suspicious Activity Hiding & Dismissal State
  const [isBannerHidden, setIsBannerHidden] = useState(() => {
    return localStorage.getItem('hide_suspicious_banner') === 'true';
  });

  const [hiddenSuspiciousIds, setHiddenSuspiciousIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('hidden_suspicious_ids') || '[]');
    } catch {
      return [];
    }
  });

  const [dismissedSuspiciousIds, setDismissedSuspiciousIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_suspicious_ids') || '[]');
    } catch {
      return [];
    }
  });

  const toggleHideBanner = (hide) => {
    setIsBannerHidden(hide);
    localStorage.setItem('hide_suspicious_banner', hide ? 'true' : 'false');
    if (hide) toast.success('Suspicious activity warnings hidden.');
    else toast.success('Suspicious activity warnings displayed.');
  };

  const handleHideSingle = (id) => {
    const updated = Array.from(new Set([...hiddenSuspiciousIds, id]));
    setHiddenSuspiciousIds(updated);
    try {
      localStorage.setItem('hidden_suspicious_ids', JSON.stringify(updated));
    } catch (e) {}
    toast.success('Warning message hidden.');
  };

  const handleUnhideAll = () => {
    setHiddenSuspiciousIds([]);
    setIsBannerHidden(false);
    localStorage.removeItem('hidden_suspicious_ids');
    localStorage.setItem('hide_suspicious_banner', 'false');
    toast.success('All hidden warnings unhidden.');
  };

  const handleDismissSingle = (id) => {
    const updated = Array.from(new Set([...dismissedSuspiciousIds, id]));
    setDismissedSuspiciousIds(updated);
    try {
      localStorage.setItem('dismissed_suspicious_ids', JSON.stringify(updated));
    } catch (e) {}
    toast.success('Warning message cleared permanently.');
  };

  const handleDismissAll = () => {
    const activeIds = requests
      .filter((r) => r.isSuspicious && r.status === 'pending')
      .map((r) => r.id);
    const updated = Array.from(new Set([...dismissedSuspiciousIds, ...activeIds]));
    setDismissedSuspiciousIds(updated);
    try {
      localStorage.setItem('dismissed_suspicious_ids', JSON.stringify(updated));
    } catch (e) {}
    toast.success('All warning messages cleared permanently.');
  };

  // Uncleared (not permanently deleted) requests
  const unclearedSuspiciousRequests = requests.filter(
    (r) => r.isSuspicious && r.status === 'pending' && !dismissedSuspiciousIds.includes(r.id)
  );

  // Visible (neither hidden nor deleted) requests
  const visibleSuspiciousRequests = unclearedSuspiciousRequests.filter(
    (r) => !hiddenSuspiciousIds.includes(r.id)
  );

  return (
    <div className="space-y-6 text-left animate-fade-in">
      {/* Suspicious Activity Alerts Bar */}
      {unclearedSuspiciousRequests.length > 0 && (
        isBannerHidden || visibleSuspiciousRequests.length === 0 ? (
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-amber-800 dark:text-amber-300">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>⚠️ {unclearedSuspiciousRequests.length} Suspicious Activity Warning(s) Currently Hidden</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleUnhideAll}
                className="text-xs font-bold py-1 px-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-900 dark:text-amber-200 cursor-pointer rounded-xl flex items-center gap-1.5"
              >
                <Eye className="w-3.5 h-3.5" /> Show Warnings
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={handleDismissAll}
                className="text-xs font-bold py-1 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 cursor-pointer rounded-xl flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" /> Clear All
              </Button>
            </div>
          </div>
        ) : (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-red-500/10 via-amber-500/5 to-transparent border-l-4 border-l-rose-500 border border-y-red-500/20 border-r-red-500/10 shadow-[0_4px_20px_rgba(239,68,68,0.08)] dark:shadow-[0_4px_30px_rgba(239,68,68,0.15)] text-left space-y-4 animate-pulse-slow">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-xl bg-rose-500/20 dark:bg-rose-500/30 text-rose-600 dark:text-rose-450 mt-0.5 shrink-0">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-extrabold text-rose-700 dark:text-rose-400 tracking-tight">
                      Critical Warning: Suspicious Activity Detected
                    </h4>
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                      High Risk ({visibleSuspiciousRequests.length})
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-semibold">
                    The system flagged automated or high-frequency cancellation/reschedule patterns. Review customer activity logs before taking action.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => toggleHideBanner(true)}
                  className="text-xs font-bold py-1.5 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer rounded-xl flex items-center gap-1.5"
                  title="Hide entire warning banner"
                >
                  <EyeOff className="w-3.5 h-3.5" /> Hide Banner
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={handleDismissAll}
                  className="text-xs font-bold py-1.5 px-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/20 cursor-pointer rounded-xl flex items-center gap-1.5"
                  title="Clear all warnings permanently"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Clear All
                </Button>
              </div>
            </div>

            <div className="grid gap-2.5 pl-0 sm:pl-12">
              {visibleSuspiciousRequests.map((r) => {
                const phoneNum = r.user?.phone || r.booking?.phone;
                return (
                  <div
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl bg-white/80 dark:bg-zinc-900/90 border border-rose-500/20 dark:border-rose-500/30 hover:border-rose-500/40 shadow-sm transition-all duration-200"
                  >
                    <div className="space-y-1.5 max-w-[60%]">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-zinc-900 dark:text-zinc-100 text-sm">
                          {r.user?.name || r.booking?.customerName || 'Walk-in Customer'}
                        </span>
                        <span className="font-mono text-zinc-500 dark:text-zinc-450 bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 rounded text-[11px] font-bold">
                          {phoneNum}
                        </span>
                      </div>
                      <div className="flex items-start gap-1.5 text-xs text-rose-600 dark:text-rose-400 font-bold bg-rose-500/5 dark:bg-rose-500/10 px-2.5 py-1.5 rounded-lg border border-rose-500/10">
                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                        <span>Reason: {r.suspiciousReason}</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => openHistory(r.user, phoneNum)}
                        className="text-xs font-bold py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-850 dark:text-zinc-200 border-none cursor-pointer rounded-lg shadow-sm"
                      >
                        Inspect History
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleBlockFromHistory(phoneNum)}
                        className="text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white border-none py-1.5 px-3 cursor-pointer rounded-lg shadow-sm shadow-rose-600/20 hover:shadow-rose-600/30"
                      >
                        Block Customer
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleHideSingle(r.id)}
                        className="text-xs font-bold py-1.5 px-2.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 cursor-pointer rounded-lg transition-colors flex items-center gap-1"
                        title="Hide this single warning"
                      >
                        <EyeOff className="w-3.5 h-3.5" /> Hide
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => handleDismissSingle(r.id)}
                        className="text-xs font-bold py-1.5 px-2.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-pointer rounded-lg transition-colors flex items-center gap-1"
                        title="Clear / Delete this warning"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Clear
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )
      )}

      <Card className="glass-card border border-zinc-200/50 dark:border-zinc-800 bg-white dark:bg-zinc-950">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-xl font-bold">
            <Inbox className="w-6 h-6 text-purple-650" />
            Customer Booking Requests
          </CardTitle>
          <CardDescription>
            Approve or reject customer requests for booking rescheduling and cancellations. Approved changes are applied automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-16"><Loader size="medium" /></div>
          ) : requests.length === 0 ? (
            <div className="text-zinc-400 py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3">
              <Inbox className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
              <p className="font-semibold text-sm">No customer requests found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[950px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Ref ID</th>
                    <th className="pb-3">Customer</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Current Details</th>
                    <th className="pb-3">Proposed Changes</th>
                    <th className="pb-3">Customer Note</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {requests.map((req) => {
                    const isPending = req.status === 'pending';
                    const data = req.requestData || {};
                    const phoneNum = req.user?.phone || req.booking?.phone;

                    return (
                      <tr key={req.id} className="border-b border-zinc-100 dark:border-zinc-900/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                        <td className="py-4 font-mono font-bold text-zinc-900 dark:text-white">
                          {req.booking?.bookingId || 'N/A'}
                        </td>
                        <td className="py-4 text-left">
                          <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5">
                            {req.user?.name || req.booking?.customerName || 'Walk-in'}
                            {req.isSuspicious && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-500 border border-amber-500/20 animate-pulse" title={req.suspiciousReason}>
                                ⚠️ Flagged
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-zinc-400 font-medium flex items-center gap-2 mt-0.5">
                            <span>{phoneNum}</span>
                            <button
                              onClick={() => openHistory(req.user, phoneNum)}
                              className="text-purple-650 hover:text-purple-750 dark:text-purple-400 dark:hover:text-purple-300 font-bold underline text-[10px] p-0 border-0 bg-transparent cursor-pointer"
                            >
                              View History
                            </button>
                          </div>
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${req.type === 'cancel'
                              ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
                            }`}>
                            {req.type === 'cancel' ? 'Cancellation' : 'Reschedule'}
                          </span>
                        </td>
                        <td className="py-4 text-xs font-medium text-zinc-650 dark:text-zinc-400 space-y-0.5">
                          <div>Date: {req.booking?.bookingDate}</div>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {format12Hour(req.booking?.startTime)} - {format12Hour(req.booking?.endTime)}
                          </div>
                        </td>
                        <td className="py-4 text-xs font-semibold text-zinc-900 dark:text-white space-y-0.5">
                          {req.type === 'cancel' ? (
                            <span className="text-rose-500 font-bold">Release Booking Slot</span>
                          ) : (
                            <div className="space-y-0.5">
                              <div className="text-purple-650 dark:text-purple-400">Date: {data.newDate}</div>
                              <div className="flex items-center gap-1 text-purple-650 dark:text-purple-400">
                                <Clock className="w-3.5 h-3.5" />
                                {format12Hour(data.newStartTime)} - {format12Hour(data.newEndTime)}
                              </div>
                            </div>
                          )}
                        </td>
                        <td className="py-4 max-w-[200px] truncate text-xs text-zinc-500 dark:text-zinc-400 font-medium" title={data.reason}>
                          {data.reason || <span className="italic text-zinc-400">No reason specified</span>}
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                              req.status === 'rejected' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
                                'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}>
                            {req.status}
                          </span>
                          {req.status === 'rejected' && req.adminNote && (
                            <span className="block text-[10px] text-zinc-400 mt-1 italic">
                              Note: {req.adminNote}
                            </span>
                          )}
                        </td>
                        <td className="py-4 text-right">
                          {isPending ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                disabled={processingId === req.id}
                                onClick={() => handleApprove(req)}
                                className="flex items-center gap-1 font-bold shadow-sm cursor-pointer"
                              >
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="secondary"
                                disabled={processingId === req.id}
                                onClick={() => openRejectDialog(req)}
                                className="flex items-center gap-1 font-bold cursor-pointer"
                              >
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end">
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                                <CheckCircle className="w-3.5 h-3.5 text-zinc-400 dark:text-zinc-500" /> Processed
                              </span>
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

      {/* Reject Reason input dialog */}
      {rejectOpen && (
        <Dialog
          isOpen={rejectOpen}
          onClose={() => setRejectOpen(false)}
          title="Reject Request"
          className="max-w-md"
        >
          <form onSubmit={handleReject} className="space-y-4 pt-2 text-left">
            <Input
              label="Rejection Reason"
              placeholder="e.g. This slot is already reserved or unavailable."
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              required
            />
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="secondary" onClick={() => setRejectOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-rose-600 hover:bg-rose-700 text-white border-none">
                Submit Rejection
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* User History inspection dialog */}
      {historyOpen && (
        <Dialog
          isOpen={historyOpen}
          onClose={() => setHistoryOpen(false)}
          title={`Activity History: ${historyUser?.phone}`}
          className="max-w-4xl"
        >
          <div className="space-y-4 pt-2 text-left">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">
                  Customer Profile
                </h3>
                <p className="text-xs text-zinc-500">
                  Inspecting overall records, reschedules, and cancellations.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => handleBlockFromHistory(historyUser?.phone)}
                className="bg-rose-650 hover:bg-rose-700 text-white border-none flex items-center gap-1.5 font-bold cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5" />
                Suspend/Block Customer
              </Button>
            </div>

            {/* Quick Stat badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-850">
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Total Bookings</div>
                <div className="text-lg font-black text-zinc-800 dark:text-zinc-100">{userBookings.length}</div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-850">
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Completed</div>
                <div className="text-lg font-black text-emerald-600 dark:text-emerald-500">
                  {userBookings.filter(b => b.status === 'Completed').length}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-850">
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Cancellations</div>
                <div className="text-lg font-black text-rose-500 dark:text-rose-500">
                  {userBookings.filter(b => b.status === 'Cancelled').length}
                </div>
              </div>
              <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200/50 dark:border-zinc-850">
                <div className="text-[10px] uppercase font-bold tracking-wider text-zinc-400">Flagged Requests</div>
                <div className="text-lg font-black text-amber-500 dark:text-amber-500">
                  {userRequests.filter(r => r.isSuspicious).length}
                </div>
              </div>
            </div>

            {/* Tab selection */}
            <div className="flex gap-2 border-b border-zinc-150 dark:border-zinc-800 pb-1">
              <button
                onClick={() => setHistoryTab('requests')}
                className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 bg-transparent border-0 cursor-pointer ${historyTab === 'requests'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
              >
                Reschedule & Cancel Requests ({userRequests.length})
              </button>
              <button
                onClick={() => setHistoryTab('bookings')}
                className={`pb-2 px-3 text-xs font-bold transition-all border-b-2 bg-transparent border-0 cursor-pointer ${historyTab === 'bookings'
                    ? 'border-purple-600 text-purple-600 dark:text-purple-400 dark:border-purple-400'
                    : 'border-transparent text-zinc-400 hover:text-zinc-600'
                  }`}
              >
                Booking History ({userBookings.length})
              </button>
            </div>

            {/* Tab content */}
            {historyLoading ? (
              <div className="flex justify-center py-8"><Loader size="small" /></div>
            ) : historyTab === 'requests' ? (
              <div className="max-h-[300px] overflow-y-auto border border-zinc-150 dark:border-zinc-850 rounded-xl">
                {userRequests.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8 italic">No request history found.</p>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase">
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Type</th>
                        <th className="p-3.5">Suspicious?</th>
                        <th className="p-3.5">Reason/Note</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userRequests.map((ur) => (
                        <tr key={ur.id} className="border-b border-zinc-100 dark:border-zinc-900/40">
                          <td className="p-3.5 font-medium text-zinc-900 dark:text-white">
                            {formatDate(ur.createdAt)}
                          </td>
                          <td className="p-3.5 font-bold uppercase">
                            {ur.type}
                          </td>
                          <td className="p-3.5">
                            {ur.isSuspicious ? (
                              <span className="text-amber-500 font-bold">⚠️ Flagged</span>
                            ) : (
                              <span className="text-zinc-400">No</span>
                            )}
                          </td>
                          <td className="p-3.5 text-zinc-500 dark:text-zinc-400 font-medium">
                            {ur.isSuspicious ? ur.suspiciousReason : (ur.requestData?.reason || 'N/A')}
                          </td>
                          <td className="p-3.5 uppercase font-bold text-zinc-650 dark:text-zinc-350">
                            {ur.status}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto border border-zinc-150 dark:border-zinc-850 rounded-xl">
                {userBookings.length === 0 ? (
                  <p className="text-xs text-zinc-400 text-center py-8 italic">No booking history found.</p>
                ) : (
                  <table className="w-full text-xs text-left">
                    <thead>
                      <tr className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 text-zinc-400 font-bold uppercase">
                        <th className="p-3.5">Date</th>
                        <th className="p-3.5">Sport</th>
                        <th className="p-3.5">Time</th>
                        <th className="p-3.5">Price</th>
                        <th className="p-3.5">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {userBookings.map((ub) => (
                        <tr key={ub.id} className="border-b border-zinc-100 dark:border-zinc-900/40">
                          <td className="p-3.5 font-medium text-zinc-900 dark:text-white">
                            {ub.bookingDate}
                          </td>
                          <td className="p-3.5 font-semibold">
                            {ub.sport}
                          </td>
                          <td className="p-3.5 text-zinc-500 dark:text-zinc-400">
                            {format12Hour(ub.startTime)} - {format12Hour(ub.endTime)}
                          </td>
                          <td className="p-3.5 font-mono text-zinc-700 dark:text-zinc-300">
                            ৳{ub.price}
                          </td>
                          <td className="p-3.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${ub.status === 'Cancelled' ? 'bg-rose-500/10 text-rose-500' :
                                ub.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-500' :
                                  'bg-amber-500/10 text-amber-500'
                              }`}>
                              {ub.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button onClick={() => setHistoryOpen(false)}>
                Close History
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
};

export default AdminRequests;
