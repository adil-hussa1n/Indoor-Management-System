import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Inbox, CheckCircle, XCircle, Clock, Calendar, RefreshCw } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';

export const AdminRequests = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  // Rejection dialog states
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [adminNote, setAdminNote] = useState('');

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
  }, []);

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

  return (
    <div className="space-y-6 text-left animate-fade-in">
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
              <table className="w-full text-left border-collapse min-w-[850px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Ref ID</th>
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

                    return (
                      <tr key={req.id} className="border-b border-zinc-100 dark:border-zinc-900/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                        <td className="py-4 font-mono font-bold text-zinc-900 dark:text-white">
                          {req.booking?.bookingId || 'N/A'}
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            req.type === 'cancel'
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
                          <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            req.status === 'approved' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            req.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' :
                            'bg-amber-500/10 text-amber-500 border border-amber-500/20'
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
                            <span className="text-zinc-400 text-xs italic">Processed</span>
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
    </div>
  );
};

export default AdminRequests;
