import React, { useState, useEffect } from 'react';
import API from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Dialog } from '../components/ui/Dialog';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import {
  Users,
  Shield,
  ShieldCheck,
  UserPlus,
  Edit,
  Trash2,
  Lock,
  CheckCircle2,
  XCircle,
  Calendar,
  Inbox,
  DollarSign,
  Layers,
  Settings,
  Mail,
  FileText,
  KeyRound,
  UserCheck,
} from 'lucide-react';

const PERMISSION_KEYS = [
  { key: 'bookings', label: 'Bookings & Slots', icon: Calendar, description: 'View, create, edit, and cancel court reservations.' },
  { key: 'requests', label: 'Reschedule & Cancel Requests', icon: Inbox, description: 'Review and approve/reject customer change requests.' },
  { key: 'finances', label: 'Investments & Expenses', icon: DollarSign, description: 'View financial entries, revenue metrics, and log expenses.' },
  { key: 'grounds', label: 'Arenas & Playing Courts', icon: Layers, description: 'Manage court details, sports, and hourly rates.' },
  { key: 'settings', label: 'Business Settings', icon: Settings, description: 'Configure operating hours, site details, and system config.' },
  { key: 'messages', label: 'Inbox & Feedback', icon: Mail, description: 'View customer contact inquiries and manage reviews.' },
  { key: 'auditLogs', label: 'System Audit Logs', icon: FileText, description: 'Inspect system security and operational activity logs.' },
];

const PRESETS = {
  frontDesk: {
    label: 'Front Desk Operator',
    permissions: { bookings: true, requests: true, finances: false, grounds: true, settings: false, messages: true, auditLogs: false },
  },
  financeManager: {
    label: 'Finance Manager',
    permissions: { bookings: false, requests: false, finances: true, grounds: false, settings: false, messages: false, auditLogs: true },
  },
  fullManager: {
    label: 'Full Operational Manager',
    permissions: { bookings: true, requests: true, finances: true, grounds: true, settings: false, messages: true, auditLogs: true },
  },
};

export const AdminStaff = () => {
  const toast = useToast();
  const confirm = useConfirm();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form State
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('manager');
  const [permissions, setPermissions] = useState({
    bookings: true,
    requests: true,
    finances: false,
    grounds: true,
    settings: false,
    messages: true,
    auditLogs: false,
  });

  const fetchStaff = async () => {
    try {
      setLoading(true);
      const res = await API.get('/auth/staff');
      if (res.data.success) {
        setStaff(res.data.staff || []);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to fetch staff members.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const openCreateModal = () => {
    setEditingStaff(null);
    setUsername('');
    setName('');
    setEmail('');
    setPhone('');
    setPassword('');
    setRole('manager');
    setPermissions(PRESETS.frontDesk.permissions);
    setIsModalOpen(true);
  };

  const openEditModal = (member) => {
    setEditingStaff(member);
    setUsername(member.username);
    setName(member.name || '');
    setEmail(member.email || '');
    setPhone(member.phone || '');
    setPassword(''); // leave blank if unchanged
    setRole(member.role || 'manager');
    setPermissions(
      member.permissions || {
        bookings: true,
        requests: true,
        finances: false,
        grounds: true,
        settings: false,
        messages: true,
        auditLogs: false,
      }
    );
    setIsModalOpen(true);
  };

  const handleTogglePermission = (key) => {
    setPermissions((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleApplyPreset = (presetKey) => {
    if (PRESETS[presetKey]) {
      setPermissions(PRESETS[presetKey].permissions);
      toast.info(`Applied "${PRESETS[presetKey].label}" permission preset`);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) {
      return toast.error('Username is required.');
    }
    if (!editingStaff && (!password || password.length < 6)) {
      return toast.error('Password must be at least 6 characters.');
    }

    try {
      setSaving(true);
      const payload = {
        username: username.trim(),
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        role,
        permissions,
      };
      if (password) {
        payload.password = password;
      }

      if (editingStaff) {
        await API.patch(`/auth/staff/${editingStaff.id}`, payload);
        toast.success('Staff manager account updated!');
      } else {
        await API.post('/auth/staff', payload);
        toast.success('New manager account created successfully!');
      }

      setIsModalOpen(false);
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save staff member.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (member) => {
    const isConfirmed = await confirm({
      title: 'Remove Staff Account?',
      message: `Are you sure you want to delete staff account "${member.username}" (${member.name})? They will immediately lose access to the admin portal.`,
      confirmText: 'Delete Account',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        await API.delete(`/auth/staff/${member.id}`);
        toast.success('Staff account deleted.');
        fetchStaff();
      } catch (err) {
        toast.error(err.response?.data?.message || 'Failed to delete staff account.');
      }
    }
  };

  return (
    <div className="space-y-6 text-left animate-fade-in pb-12">
      {/* Top Header Card */}
      <div className="glass-card p-6 rounded-3xl shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-zinc-900 dark:text-white flex items-center gap-2">
            <Users className="w-7 h-7 text-purple-650" />
            Staff & Manager Management
          </h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
            Create manager accounts and set granular feature access restrictions for your business operations.
          </p>
        </div>

        <Button onClick={openCreateModal} className="flex items-center gap-1.5 font-bold shadow-md cursor-pointer">
          <UserPlus className="w-4 h-4" /> Add New Manager
        </Button>
      </div>

      {/* Staff Members List */}
      {loading ? (
        <Loader size="medium" className="py-12" />
      ) : staff.length === 0 ? (
        <Card className="p-12 text-center text-zinc-400">
          <Shield className="w-12 h-12 mx-auto text-zinc-300 dark:text-zinc-700" />
          <p className="font-semibold text-sm mt-3">No staff accounts found.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {staff.map((member) => {
            const isOwner = member.role === 'admin';
            const permObj = member.permissions || {};

            return (
              <Card
                key={member.id}
                className={`overflow-hidden transition-all border ${
                  isOwner
                    ? 'border-purple-500/30 bg-purple-500/5 dark:bg-purple-950/10'
                    : 'border-zinc-200/80 dark:border-zinc-800'
                }`}
              >
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-bold text-lg ${
                        isOwner ? 'bg-purple-600 text-white shadow-md shadow-purple-500/20' : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}>
                        {member.name ? member.name.charAt(0).toUpperCase() : member.username.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-base text-zinc-900 dark:text-white">
                            {member.name || member.username}
                          </h3>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isOwner
                              ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                              : 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                          }`}>
                            {isOwner ? '👑 Business Owner' : '🛡️ Staff Manager'}
                          </span>
                        </div>
                        <p className="text-xs font-mono text-zinc-500 dark:text-zinc-400 mt-0.5">
                          @{member.username} {member.phone ? `| 📞 ${member.phone}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditModal(member)}
                        className="p-2 rounded-xl text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-500/10 transition-all cursor-pointer"
                        title="Edit Permissions & Profile"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {!isOwner && (
                        <button
                          onClick={() => handleDelete(member)}
                          className="p-2 rounded-xl text-zinc-400 hover:text-rose-600 hover:bg-rose-500/10 transition-all cursor-pointer"
                          title="Remove Manager"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0 space-y-3">
                  <div className="border-t border-zinc-150 dark:border-zinc-800 pt-3">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-zinc-400 mb-2">
                      Feature Access Permissions:
                    </p>

                    {isOwner ? (
                      <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        Full Unrestricted Access (Primary Business Owner)
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        {PERMISSION_KEYS.map((p) => {
                          const IconComp = p.icon;
                          const isAllowed = permObj[p.key] === true;

                          return (
                            <div
                              key={p.key}
                              className={`p-2 rounded-xl border flex items-center gap-2 text-xs font-semibold transition-all ${
                                isAllowed
                                  ? 'bg-emerald-500/5 dark:bg-emerald-950/20 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200/60 dark:border-zinc-800 text-zinc-400 opacity-60'
                              }`}
                            >
                              <IconComp className={`w-3.5 h-3.5 ${isAllowed ? 'text-emerald-500' : 'text-zinc-400'}`} />
                              <span className="truncate">{p.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create / Edit Manager Modal */}
      {isModalOpen && (
        <Dialog
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={editingStaff ? (editingStaff.role === 'admin' ? '👑 Edit Business Owner Profile' : '🛡️ Edit Staff Manager') : '✨ Create New Manager'}
          className="max-w-3xl sm:max-w-3xl"
        >
          <form onSubmit={handleSubmit} className="space-y-5 text-left pt-2">
            {/* Primary Business Owner Protection Banner */}
            {editingStaff?.role === 'admin' && (
              <div className="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 text-amber-800 dark:text-amber-300 space-y-1 text-xs">
                <div className="flex items-center gap-2 font-black text-sm text-amber-700 dark:text-amber-400">
                  <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  Primary Business Owner Credentials Protected
                </div>
                <p className="font-medium">
                  Primary Business Owner username and account password cannot be modified from this menu to protect system access.
                </p>
                <p className="font-extrabold text-purple-650 dark:text-purple-400 pt-1">
                  Need to change owner ID or password? Please contact{' '}
                  <a href="https://daruntech.com" target="_blank" rel="noreferrer" className="underline hover:text-purple-750 font-bold">
                    Darun Tech Private Limited
                  </a>.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Username <span className="text-rose-500">*</span>
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. manager_jahid"
                  disabled={!!editingStaff} // username fixed on edit
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Full Name
                </label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jahid Hassan"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jahid@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                  Phone Number
                </label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01700000000"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                {editingStaff?.role === 'admin'
                  ? 'Account Password (Protected)'
                  : editingStaff
                  ? 'New Password (leave blank to keep current)'
                  : 'Account Password *'}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  editingStaff?.role === 'admin'
                    ? 'Contact Darun Tech Private Limited to change owner password'
                    : editingStaff
                    ? '••••••••'
                    : 'Minimum 6 characters'
                }
                disabled={editingStaff?.role === 'admin'}
                required={!editingStaff}
              />
            </div>

            {/* Role & Quick Presets (For Managers) */}
            {editingStaff?.role !== 'admin' && (
              <div className="space-y-3 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                    Apply Role Permission Presets:
                  </label>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(PRESETS).map(([pKey, pVal]) => (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => handleApplyPreset(pKey)}
                      className="px-3 py-1.5 rounded-xl border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all cursor-pointer"
                    >
                      ⚡ {pVal.label}
                    </button>
                  ))}
                </div>

                {/* Granular Permission Toggles */}
                <div className="space-y-2 pt-2">
                  <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Granular Access Permissions:
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[320px] overflow-y-auto pr-1">
                    {PERMISSION_KEYS.map((p) => {
                      const IconComp = p.icon;
                      const isChecked = permissions[p.key] === true;

                      return (
                        <div
                          key={p.key}
                          onClick={() => handleTogglePermission(p.key)}
                          className={`p-3.5 rounded-2xl border flex items-center justify-between cursor-pointer transition-all hover:border-purple-400/50 ${
                            isChecked
                              ? 'bg-purple-500/5 dark:bg-purple-950/30 border-purple-500/30 shadow-xs'
                              : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200/80 dark:border-zinc-800/80 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0 pr-2">
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                              isChecked ? 'bg-purple-600 text-white shadow-sm shadow-purple-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'
                            }`}>
                              <IconComp className="w-4.5 h-4.5" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-xs text-zinc-900 dark:text-white truncate">{p.label}</p>
                              <p className="text-[10px] text-zinc-400 line-clamp-1">{p.description}</p>
                            </div>
                          </div>

                          <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition-all shrink-0 ${
                            isChecked ? 'bg-purple-600 border-purple-600 text-white' : 'border-zinc-300 dark:border-zinc-700'
                          }`}>
                            {isChecked && <CheckCircle2 className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-150 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="font-bold">
                {saving ? 'Saving...' : editingStaff ? 'Save Changes' : 'Create Manager Account'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default AdminStaff;
