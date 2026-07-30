import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MASTER_API } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Globe, Plus, ToggleLeft, ToggleRight, Trash2, Shield, LogOut, CheckCircle, XCircle, Edit } from 'lucide-react';
import { Dialog } from '../components/ui/Dialog';

export const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();

  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [businessEmail, setBusinessEmail] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [subDuration, setSubDuration] = useState('1month');
  const [customExpiry, setCustomExpiry] = useState('');

  // Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCustomDomain, setEditCustomDomain] = useState('');
  const [editSMS, setEditSMS] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [updating, setUpdating] = useState(false);

  const checkAuth = () => {
    if (!localStorage.getItem('superAdminToken')) {
      navigate('/superadmin/login', { replace: true });
    }
  };

  const fetchTenants = async () => {
    try {
      const res = await MASTER_API.get('/tenants');
      if (res.data.success) {
        setTenants(res.data.tenants);
      }
    } catch (e) {
      toast.error('Failed to load tenants. Please login again.');
      logout();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
    fetchTenants();
  }, []);

  // Set page title and favicon on mount
  useEffect(() => {
    document.title = 'Super Admin | Darun Tech Private Limited';
    
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.getElementsByTagName('head')[0].appendChild(link);
    }
    const originalFavicon = link.href;
    link.href = '/daruntech-logo.png';
    link.setAttribute('type', 'image/png');

    return () => {
      // Revert favicon on unmount
      link.href = originalFavicon;
    };
  }, []);

  const handleCreateTenant = async (e) => {
    e.preventDefault();
    if (!name || !slug || !adminUsername || !adminPassword) {
      toast.error('Required fields are missing.');
      return;
    }

    let calculatedExpiry = null;
    const now = new Date();
    if (subDuration === '1month') {
      now.setMonth(now.getMonth() + 1);
      calculatedExpiry = now.toISOString();
    } else if (subDuration === '3months') {
      now.setMonth(now.getMonth() + 3);
      calculatedExpiry = now.toISOString();
    } else if (subDuration === '6months') {
      now.setMonth(now.getMonth() + 6);
      calculatedExpiry = now.toISOString();
    } else if (subDuration === '1year') {
      now.setFullYear(now.getFullYear() + 1);
      calculatedExpiry = now.toISOString();
    } else if (subDuration === 'custom' && customExpiry) {
      calculatedExpiry = new Date(customExpiry).toISOString();
    }

    setCreating(true);
    try {
      const res = await MASTER_API.post('/tenants', {
        businessName: name,
        slug: slug.toLowerCase().replace(/[^a-z0-9]/g, ''), // clean slug format
        plan: 'pro',
        adminUsername,
        adminPassword,
        adminEmail: businessEmail,
        adminPhone: businessPhone,
        subscriptionExpiresAt: calculatedExpiry,
      });

      if (res.data.success) {
        toast.success('New client tenant provisioned successfully!');
        setIsModalOpen(false);
        setName('');
        setSlug('');
        setAdminUsername('admin');
        setAdminPassword('');
        setBusinessEmail('');
        setBusinessPhone('');
        setSubDuration('1month');
        setCustomExpiry('');
        fetchTenants();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Provisioning failed. Subdomain might be taken.');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (tenant) => {
    try {
      const res = await MASTER_API.patch(`/tenants/${tenant.id}`, {
        isActive: !tenant.isActive,
      });
      if (res.data.success) {
        toast.success(`Tenant ${tenant.businessName} status updated!`);
        fetchTenants();
      }
    } catch (e) {
      toast.error('Status modification failed.');
    }
  };

  const handleDeleteTenant = async (tenant) => {
    const isConfirmed = await confirm({
      title: 'Deprovision Tenant Database?',
      message: `Are you sure you want to permanently delete tenant "${tenant.businessName}" (${tenant.slug})? All databases, slot configuration, settings and bookings will be wiped.`,
      confirmText: 'Deprovision Client',
      cancelText: 'Cancel',
      type: 'danger',
    });

    if (isConfirmed) {
      try {
        const res = await MASTER_API.delete(`/tenants/${tenant.id}`);
        if (res.data.success) {
          toast.success(`Deprovisioned tenant "${tenant.businessName}" successfully.`);
          fetchTenants();
        }
      } catch (e) {
        toast.error('Failed to delete tenant.');
      }
    }
  };

  const openEditModal = (tenant) => {
    setEditingTenant(tenant);
    setEditName(tenant.businessName || '');
    setEditCustomDomain(tenant.customDomain || '');
    setEditExpiryDate(tenant.subscriptionExpiresAt ? tenant.subscriptionExpiresAt.substring(0, 10) : '');
    setEditSMS('');
    setEditAdminUsername('');
    setEditAdminPassword('');
    
    // Load full details (with SMS credentials)
    MASTER_API.get(`/tenants/${tenant.id}`)
      .then((res) => {
        if (res.data.success && res.data.tenant) {
          const creds = res.data.tenant.smsCredentials;
          setEditSMS(creds ? JSON.stringify(creds, null, 2) : '');
        }
      })
      .catch(() => {
        toast.error('Failed to load full credentials.');
      });

    setIsEditModalOpen(true);
  };

  const extendSubscription = (months) => {
    const baseDate = editExpiryDate ? new Date(editExpiryDate) : new Date();
    const startingDate = baseDate < new Date() ? new Date() : baseDate;
    startingDate.setMonth(startingDate.getMonth() + months);
    const newExpiryString = startingDate.toISOString().substring(0, 10);
    setEditExpiryDate(newExpiryString);
    toast.success(`Extended subscription by ${months} month(s). New expiry: ${newExpiryString}`);
  };

  const handleUpdateTenant = async (e) => {
    e.preventDefault();
    if (!editName) {
      toast.error('Business name is required.');
      return;
    }

    let parsedSMS = null;
    if (editSMS.trim()) {
      try {
        parsedSMS = JSON.parse(editSMS);
      } catch (err) {
        toast.error('SMS Credentials must be valid JSON.');
        return;
      }
    }

    setUpdating(true);
    try {
      const payload = {
        businessName: editName,
        plan: 'pro',
        customDomain: editCustomDomain || null,
        smsCredentials: parsedSMS,
        subscriptionExpiresAt: editExpiryDate || null,
      };

      if (editAdminUsername.trim()) {
        payload.adminUsername = editAdminUsername.trim();
      }
      if (editAdminPassword.trim()) {
        payload.adminPassword = editAdminPassword.trim();
      }

      const res = await MASTER_API.patch(`/tenants/${editingTenant.id}`, payload);

      if (res.data.success) {
        toast.success(`Business "${editName}" updated successfully!`);
        setIsEditModalOpen(false);
        fetchTenants();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Update failed.');
    } finally {
      setUpdating(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('superAdminToken');
    navigate('/superadmin/login', { replace: true });
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-[85vh] flex flex-col gap-6 text-left">
      {/* Top Banner bar */}
      <div className="relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gradient-to-r from-zinc-900 via-zinc-900 to-purple-950/40 text-white p-6 rounded-3xl shadow-xl border border-zinc-800">
        <div className="absolute inset-0 bg-grid-white/[0.02] -z-10" />
        <div className="flex items-center gap-4">
          <div className="p-2.5 bg-zinc-800 rounded-2xl border border-zinc-700/50">
            <img src="/daruntech-logo.png" alt="Darun Tech Logo" className="w-10 h-10 object-contain animate-none" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black tracking-tight text-white">Super Admin Operations</h1>
              <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase bg-purple-500/10 text-purple-450 border border-purple-500/20 rounded-full">
                Darun Tech
              </span>
            </div>
            <p className="text-xs text-zinc-400 font-medium">
              Controlled & Managed by <span className="font-bold text-purple-400">Darun Tech Private Limited</span>
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1.5 font-bold shadow-lg shadow-purple-500/10 cursor-pointer">
            <Plus className="w-4 h-4" /> Provision New Client
          </Button>
          <Button variant="secondary" onClick={logout} className="flex items-center gap-1.5 font-bold cursor-pointer">
            <LogOut className="w-4 h-4" /> Exit
          </Button>
        </div>
      </div>

      {/* Tenants list table */}
      <Card className="glass-card hover-glow border border-zinc-200/50 dark:border-zinc-800">
        <CardHeader>
          <CardTitle>Client Subdomain Deployments</CardTitle>
          <CardDescription>View status, subdomains, and database contexts.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-12"><Loader size="lg" /></div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-12 text-zinc-500 font-medium">
              No clients provisioned yet. Click "Provision New Client" above to get started.
            </div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[750px]">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800 text-zinc-400 text-xs font-bold uppercase tracking-wider">
                    <th className="pb-3">Client Name</th>
                    <th className="pb-3">Subdomain Slug</th>
                    <th className="pb-3">Database Context</th>
                    <th className="pb-3">Subscription Status</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {tenants.map((t) => (
                    <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-900 hover:bg-zinc-550/5 transition-colors">
                      <td className="py-4 font-bold text-zinc-900 dark:text-white">{t.businessName}</td>
                      <td className="py-4 font-mono text-purple-650 dark:text-purple-400 font-semibold">
                        {t.slug}.daruntech.com
                      </td>
                      <td className="py-4 font-mono text-zinc-500 dark:text-zinc-400 text-xs">{t.dbName || `db_${t.slug}`}</td>
                      <td className="py-4">
                        {t.subscriptionExpiresAt ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs font-semibold ${
                              new Date(t.subscriptionExpiresAt) < new Date() ? 'text-rose-500' : 'text-zinc-900 dark:text-zinc-200'
                            }`}>
                              {new Date(t.subscriptionExpiresAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${
                              new Date(t.subscriptionExpiresAt) < new Date() ? 'text-rose-500' : 'text-emerald-500'
                            }`}>
                              {new Date(t.subscriptionExpiresAt) < new Date() ? 'Expired' : 'Active'}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-400 text-xs italic">Unlimited / Lifetime</span>
                        )}
                      </td>
                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                          t.isActive ? 'text-emerald-500' : 'text-rose-500'
                        }`}>
                          {t.isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                          {t.isActive ? 'Active' : 'Suspended'}
                        </span>
                      </td>
                      <td className="py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleToggleStatus(t)}
                            className="p-1.5 text-zinc-450 hover:text-indigo-650 transition-colors"
                            title={t.isActive ? 'Suspend client access' : 'Activate client access'}
                          >
                            {t.isActive ? <ToggleRight className="w-6 h-6 text-indigo-500" /> : <ToggleLeft className="w-6 h-6 text-zinc-400" />}
                          </button>
                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1.5 text-zinc-400 hover:text-indigo-650 transition-colors"
                            title="Edit Client Settings"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTenant(t)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                            title="Wipe & Deprovision Client"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Provision Tenant Modal Dialog */}
      {isModalOpen && (
        <Dialog
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title="Provision New Client Tenant Database"
          className="max-w-xl"
        >
          <form onSubmit={handleCreateTenant} className="space-y-4 pt-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Client / Business Name"
                placeholder="e.g. Apex Arena"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  // Auto slugify
                  setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                }}
                required
              />
              <Input
                label="Subdomain Slug (Unique)"
                placeholder="e.g. apexarena"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Business Phone"
                placeholder="e.g. 017..."
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
              />
              <Input
                label="Business Contact Email"
                type="email"
                placeholder="e.g. client@business.com"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Select
                label="Subscription Duration"
                value={subDuration}
                onChange={(e) => setSubDuration(e.target.value)}
                options={[
                  { value: '1month', label: '1 Month' },
                  { value: '3months', label: '3 Months' },
                  { value: '6months', label: '6 Months' },
                  { value: '1year', label: '1 Year' },
                  { value: 'custom', label: 'Custom Date' },
                ]}
              />
              {subDuration === 'custom' ? (
                <Input
                  label="Subscription Expiry Date"
                  type="date"
                  value={customExpiry}
                  onChange={(e) => setCustomExpiry(e.target.value)}
                  required
                />
              ) : (
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider block">Calculated Expiry</label>
                  <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900/60 p-3 rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    {(() => {
                      const now = new Date();
                      if (subDuration === '1month') now.setMonth(now.getMonth() + 1);
                      else if (subDuration === '3months') now.setMonth(now.getMonth() + 3);
                      else if (subDuration === '6months') now.setMonth(now.getMonth() + 6);
                      else if (subDuration === '1year') now.setFullYear(now.getFullYear() + 1);
                      return now.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 bg-zinc-550/5 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                🔑 Seed Tenant Admin Credentials
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="Admin Username"
                  placeholder="admin"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  required
                />
                <Input
                  label="Admin Password"
                  type="password"
                  placeholder="Set password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? 'Provisioning...' : 'Provision Tenant'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}

      {/* Edit Tenant Modal Dialog */}
      {isEditModalOpen && editingTenant && (
        <Dialog
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title={`Edit Client: ${editingTenant.businessName}`}
          className="max-w-xl"
        >
          <form onSubmit={handleUpdateTenant} className="space-y-4 pt-4 text-left">
            <Input
              label="Client / Business Name"
              placeholder="e.g. Apex Arena"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />

            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Custom Domain (Optional)"
                placeholder="e.g. booking.clientdomain.com"
                value={editCustomDomain}
                onChange={(e) => setEditCustomDomain(e.target.value)}
              />
              <Input
                label="Subscription Expiry Date"
                type="date"
                value={editExpiryDate}
                onChange={(e) => setEditExpiryDate(e.target.value)}
              />
            </div>

            {/* Change Admin Credentials Section */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
              <span className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider block">
                🔑 Edit Administrator Credentials
              </span>
              <div className="grid grid-cols-2 gap-4">
                <Input
                  label="New Admin Username (Optional)"
                  placeholder="Leave blank to keep current"
                  value={editAdminUsername}
                  onChange={(e) => setEditAdminUsername(e.target.value)}
                />
                <Input
                  label="New Admin Password (Optional)"
                  type="password"
                  placeholder="Leave blank to keep current"
                  value={editAdminPassword}
                  onChange={(e) => setEditAdminPassword(e.target.value)}
                />
              </div>
            </div>

            {/* Received Payment Option / Instant Extension */}
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/20 rounded-2xl border border-indigo-150 dark:border-indigo-900/60 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
                  💳 Received Payment / Extend Subscription
                </span>
                <span className="text-[10px] text-zinc-500 font-medium">Click a button to extend</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => extendSubscription(1)}
                  className="px-3 py-1.5 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  +1 Month
                </button>
                <button
                  type="button"
                  onClick={() => extendSubscription(3)}
                  className="px-3 py-1.5 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  +3 Months
                </button>
                <button
                  type="button"
                  onClick={() => extendSubscription(6)}
                  className="px-3 py-1.5 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  +6 Months
                </button>
                <button
                  type="button"
                  onClick={() => extendSubscription(12)}
                  className="px-3 py-1.5 bg-indigo-650 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm"
                >
                  +1 Year
                </button>
                <button
                  type="button"
                  onClick={() => setEditExpiryDate('')}
                  className="px-3 py-1.5 bg-zinc-650 dark:bg-zinc-800 text-white font-bold text-xs rounded-xl hover:bg-zinc-700 dark:hover:bg-zinc-700 transition-colors shadow-sm"
                >
                  Set Lifetime
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-550 dark:text-zinc-400 uppercase tracking-wider block">
                SMS Credentials (JSON format)
              </label>
              <textarea
                className="w-full h-32 p-3 font-mono text-xs rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-transparent focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder='e.g. { "provider": "SSLWireless", "apiKey": "..." }'
                value={editSMS}
                onChange={(e) => setEditSMS(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="secondary" onClick={() => setIsEditModalOpen(false)} disabled={updating}>
                Cancel
              </Button>
              <Button type="submit" disabled={updating}>
                {updating ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
