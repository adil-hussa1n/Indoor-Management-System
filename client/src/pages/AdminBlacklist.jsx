import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { DatePicker } from '../components/ui/DatePicker';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Trash2, ShieldAlert, Plus, Search, Calendar, Ban } from 'lucide-react';

export const AdminBlacklist = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [phone, setPhone] = useState('');
  const [reason, setReason] = useState('');
  const [blockDuration, setBlockDuration] = useState('permanent'); // "permanent" | "temporary"
  const [expiresAt, setExpiresAt] = useState('');
  const [search, setSearch] = useState('');

  const [blockedCustomers, setBlockedCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchBlockedCustomers = async () => {
    try {
      const res = await API.get('/blocked-customers');
      if (res.data.success) {
        setBlockedCustomers(res.data.blockedCustomers);
      }
    } catch (error) {
      toast.error('Failed to load blacklist.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBlockedCustomers();
  }, []);

  const handleBlock = async (e) => {
    e.preventDefault();
    if (!phone) {
      toast.error('Phone number is required.');
      return;
    }

    if (blockDuration === 'temporary' && !expiresAt) {
      toast.error('Please specify an expiration date for temporary blocks.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        phone: phone.trim(),
        reason: reason.trim() || null,
        isPermanent: blockDuration === 'permanent',
        expiresAt: blockDuration === 'temporary' ? new Date(expiresAt).toISOString() : null,
      };

      const res = await API.post('/blocked-customers', payload);
      if (res.data.success) {
        toast.success(`Phone number ${phone} successfully blocked!`);
        setPhone('');
        setReason('');
        setExpiresAt('');
        setBlockDuration('permanent');
        fetchBlockedCustomers();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to block customer.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnblock = async (id, phoneNum) => {
    const isConfirmed = await confirm({
      title: 'Unblock Customer?',
      message: `Are you sure you want to unblock phone number "${phoneNum}"? They will be allowed to make bookings immediately.`,
      confirmText: 'Unblock Customer',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        const res = await API.delete(`/blocked-customers/${id}`);
        if (res.data.success) {
          toast.success(`Successfully unblocked ${phoneNum}.`);
          fetchBlockedCustomers();
        }
      } catch (error) {
        toast.error('Unblocking failed.');
      }
    }
  };

  const filteredBlocked = blockedCustomers.filter((item) => {
    return item.phone.toLowerCase().includes(search.toLowerCase());
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start text-left animate-fade-in">
      {/* Block customer form card */}
      <div className="lg:col-span-4 glass-card p-6 rounded-3xl shadow-sm space-y-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
        <form onSubmit={handleBlock}>
          <div className="mb-4">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <Ban className="w-5 h-5 text-rose-500" />
              Blacklist Customer
            </h3>
            <p className="text-xs text-zinc-400 mt-1">Suspend customer bookings by phone number.</p>
          </div>
          <div className="space-y-4">
            <Input
              label="Customer Phone Number"
              placeholder="e.g. +88017XXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />

            <Select
              label="Block Duration"
              value={blockDuration}
              onChange={(e) => setBlockDuration(e.target.value)}
              placeholder=""
              options={[
                { value: 'permanent', label: 'Permanent Block' },
                { value: 'temporary', label: 'Temporary Block' },
              ]}
            />

            {blockDuration === 'temporary' && (
              <DatePicker
                label="Expiration Date & Time"
                value={expiresAt}
                onChange={setExpiresAt}
                showTimeSelect
              />
            )}

            <Input
              label="Reason for Block (Optional)"
              placeholder="e.g. Repeated no-shows or bad conduct"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />

            <Button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 font-bold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer shadow-lg shadow-rose-600/10 border-none"
            >
              {submitting ? 'Blocking...' : 'Add to Blacklist'}
            </Button>
          </div>
        </form>
      </div>

      {/* Blacklisted Numbers list */}
      <div className="lg:col-span-8 glass-card rounded-3xl shadow-sm border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-850 dark:text-zinc-200 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              Active Blacklist Entries
            </h3>
            <p className="text-xs text-zinc-450 mt-1">Customers below will be blocked from booking slots.</p>
          </div>
          <div className="w-full sm:w-64 relative">
            <Input
              placeholder="Search by phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-10"
            />
            <Search className="w-4 h-4 text-zinc-400 absolute right-3 top-3" />
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <Loader size="medium" className="py-12" />
          ) : filteredBlocked.length === 0 ? (
            <div className="text-zinc-400 py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col items-center justify-center gap-3">
              <ShieldAlert className="w-10 h-10 text-zinc-300 dark:text-zinc-700" />
              <p className="font-semibold text-sm">Blacklist is currently empty.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Phone Number</th>
                    <th className="pb-3">Type</th>
                    <th className="pb-3">Details / Expiry</th>
                    <th className="pb-3">Reason</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {filteredBlocked.map((item) => (
                    <tr key={item._id} className="border-b border-zinc-100 dark:border-zinc-900/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/10 transition-colors">
                      <td className="py-4 font-extrabold text-zinc-900 dark:text-white">
                        {item.phone}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          item.isPermanent
                            ? 'bg-red-500/10 text-red-500 border border-red-500/20'
                            : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                        }`}>
                          {item.isPermanent ? 'Permanent' : 'Temporary'}
                        </span>
                      </td>
                      <td className="py-4 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {item.isPermanent ? (
                          <span className="italic text-zinc-400">Indefinite suspension</span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5" />
                            Expires: {formatDate(item.expiresAt)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 max-w-[200px] truncate text-xs text-zinc-600 dark:text-zinc-400 font-medium" title={item.reason}>
                        {item.reason || <span className="italic text-zinc-400">No reason specified</span>}
                      </td>
                      <td className="py-4 text-right">
                        <button
                          onClick={() => handleUnblock(item._id, item.phone)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="Unblock customer"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminBlacklist;
