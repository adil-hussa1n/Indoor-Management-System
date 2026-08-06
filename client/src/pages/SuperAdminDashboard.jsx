import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { MASTER_API } from '../services/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { useConfirm } from '../contexts/ConfirmContext';
import { Globe, Plus, ToggleLeft, ToggleRight, Trash2, Shield, LogOut, CheckCircle, XCircle, Edit, DollarSign, TrendingUp, PieChart, Calendar, Search, Download, ExternalLink, Sparkles, Clock, Gift, Sun, Moon, Percent, Tag, Settings } from 'lucide-react';
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
  const [subPrice, setSubPrice] = useState('2000');
  const [subPlan, setSubPlan] = useState('1_month');
  const [paymentStatus, setPaymentStatus] = useState('paid');

  // Edit states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState(null);
  const [editName, setEditName] = useState('');
  const [editCustomDomain, setEditCustomDomain] = useState('');
  const [editSMS, setEditSMS] = useState('');
  const [editExpiryDate, setEditExpiryDate] = useState('');
  const [editAdminUsername, setEditAdminUsername] = useState('');
  const [editAdminPassword, setEditAdminPassword] = useState('');
  const [editSubPrice, setEditSubPrice] = useState('2000');
  const [editSubPlan, setEditSubPlan] = useState('1_month');
  const [editPaymentStatus, setEditPaymentStatus] = useState('paid');
  const [recordPayment, setRecordPayment] = useState(false);
  const [updating, setUpdating] = useState(false);

  // Theme state
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('superAdminTheme') || 'dark');
  const toggleTheme = () => {
    const next = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(next);
    localStorage.setItem('superAdminTheme', next);
    toast.success(`Switched to ${next === 'dark' ? 'Dark Mode 🌙' : 'Light Mode ☀️'}`);
  };

  // Global Subscription Pricing Configuration States
  const defaultPrices = {
    trial: 0,
    month1: 2000,
    months3: 5500,
    months6: 10000,
    year1: 18000,
    lifetime: 100000,
  };

  const [planPrices, setPlanPrices] = useState(() => {
    const saved = localStorage.getItem('superAdminPlanPrices');
    return saved ? JSON.parse(saved) : defaultPrices;
  });

  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false);
  const [tempPrices, setTempPrices] = useState(planPrices);

  const savePlanPrices = (e) => {
    e.preventDefault();
    setPlanPrices(tempPrices);
    localStorage.setItem('superAdminPlanPrices', JSON.stringify(tempPrices));
    toast.success('Global subscription plan pricing updated successfully!');
    setIsPricingModalOpen(false);
  };

  // Discount options states for Provisioning & Renewal Modals
  const [discountType, setDiscountType] = useState('none'); // 'none', 'percent', 'flat'
  const [discountVal, setDiscountVal] = useState('0');

  const [editDiscountType, setEditDiscountType] = useState('none');
  const [editDiscountVal, setEditDiscountVal] = useState('0');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Super Admin Emergency Online Booking Pause Modal States
  const [isSuperMaintOpen, setIsSuperMaintOpen] = useState(false);
  const [superMaintTenant, setSuperMaintTenant] = useState(null);
  const [superMaintEnabled, setSuperMaintEnabled] = useState(false);
  const [superMaintMessage, setSuperMaintMessage] = useState('');
  const [superMaintUntil, setSuperMaintUntil] = useState('');
  const [superMaintSaving, setSuperMaintSaving] = useState(false);

  const openSuperMaintModal = async (tenant) => {
    setSuperMaintTenant(tenant);
    setIsSuperMaintOpen(true);
    try {
      const res = await API.get('/info', { headers: { 'X-Tenant-Slug': tenant.slug } });
      if (res.data.success && res.data.settings?.maintenanceMode) {
        const m = res.data.settings.maintenanceMode;
        setSuperMaintEnabled(!!m.enabled);
        setSuperMaintMessage(m.message || '⚠️ Online booking is temporarily paused for scheduled system maintenance.');
        setSuperMaintUntil(m.until ? new Date(m.until).toISOString().slice(0, 16) : '');
      } else {
        setSuperMaintEnabled(false);
        setSuperMaintMessage('⚠️ Online booking is temporarily paused for scheduled system maintenance.');
        setSuperMaintUntil('');
      }
    } catch (e) {
      setSuperMaintEnabled(false);
      setSuperMaintMessage('⚠️ Online booking is temporarily paused for scheduled system maintenance.');
      setSuperMaintUntil('');
    }
  };

  const handleSaveSuperMaint = async (e) => {
    e.preventDefault();
    if (!superMaintTenant) return;
    setSuperMaintSaving(true);
    try {
      const payload = {
        maintenanceMode: {
          enabled: superMaintEnabled,
          message: superMaintMessage,
          until: superMaintUntil ? new Date(superMaintUntil).toISOString() : null,
          disabledBy: 'superadmin',
        }
      };
      await API.patch('/settings', payload, { headers: { 'X-Tenant-Slug': superMaintTenant.slug } });
      toast.success(`Updated Emergency Online Booking Control for "${superMaintTenant.businessName}"`);
      setIsSuperMaintOpen(false);
    } catch (err) {
      toast.error('Failed to update maintenance mode settings.');
    } finally {
      setSuperMaintSaving(false);
    }
  };

  const exportCSVReport = () => {
    if (!tenants || tenants.length === 0) {
      toast.error('No tenant data available to export.');
      return;
    }
    const headers = ['Business Name', 'Subdomain Slug', 'Custom Domain', 'Admin Email', 'Admin Phone', 'Plan Tier', 'Subscription Fee (BDT)', 'Total Profit Collected (BDT)', 'Expiry Date', 'Status'];
    const rows = tenants.map(t => [
      `"${t.businessName}"`,
      `"${t.slug}"`,
      `"${t.customDomain || ''}"`,
      `"${t.adminEmail || ''}"`,
      `"${t.adminPhone || ''}"`,
      `"${t.subscriptionPlan || '1_month'}"`,
      t.subscriptionPrice || 0,
      t.totalRevenueCollected || 0,
      `"${t.subscriptionExpiresAt ? t.subscriptionExpiresAt.substring(0, 10) : 'Lifetime'}"`,
      `"${t.isActive ? (t.subscriptionExpiresAt && new Date(t.subscriptionExpiresAt) < new Date() ? 'Expired' : 'Active') : 'Suspended'}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daruntech_financial_report_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Financial report exported to CSV!');
  };

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

  useEffect(() => {
    if (themeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [themeMode]);

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
    if (subPlan === '7_days_trial') {
      now.setDate(now.getDate() + 7);
      calculatedExpiry = now.toISOString();
    } else if (subPlan === '1_month') {
      now.setMonth(now.getMonth() + 1);
      calculatedExpiry = now.toISOString();
    } else if (subPlan === '3_months') {
      now.setMonth(now.getMonth() + 3);
      calculatedExpiry = now.toISOString();
    } else if (subPlan === '6_months') {
      now.setMonth(now.getMonth() + 6);
      calculatedExpiry = now.toISOString();
    } else if (subPlan === '1_year') {
      now.setFullYear(now.getFullYear() + 1);
      calculatedExpiry = now.toISOString();
    } else if (subPlan === 'custom_date' && customExpiry) {
      calculatedExpiry = new Date(customExpiry).toISOString();
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
        subscriptionExpiresAt: subPlan === 'lifetime' ? null : calculatedExpiry,
        subscriptionPrice: Number(subPrice) || 0,
        subscriptionPlan: subPlan,
        paymentStatus,
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
        setSubPrice('5000');
        setSubPlan('1_month');
        setPaymentStatus('paid');
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
    setEditSubPrice(tenant.subscriptionPrice || '5000');
    setEditSubPlan(tenant.subscriptionPlan || '1_month');
    setEditPaymentStatus(tenant.paymentStatus || 'paid');
    setRecordPayment(false);

    // Load full details (with SMS credentials)
    MASTER_API.get(`/tenants/${tenant.id}`)
      .then((res) => {
        if (res.data.success && res.data.tenant) {
          const creds = res.data.tenant.smsCredentials;
          setEditSMS(creds ? JSON.stringify(creds, null, 2) : '');
          if (res.data.tenant.subscriptionPrice) setEditSubPrice(res.data.tenant.subscriptionPrice);
          if (res.data.tenant.subscriptionPlan) setEditSubPlan(res.data.tenant.subscriptionPlan);
          if (res.data.tenant.paymentStatus) setEditPaymentStatus(res.data.tenant.paymentStatus);
        }
      })
      .catch(() => {
        toast.error('Failed to load full credentials.');
      });

    setIsEditModalOpen(true);
  };

  const calculateFinalPrice = (basePrice, dType, dVal) => {
    const base = Number(basePrice) || 0;
    if (dType === 'percent') {
      const pct = Math.min(100, Math.max(0, Number(dVal) || 0));
      return Math.max(0, base - (base * pct) / 100);
    }
    if (dType === 'flat') {
      const flat = Math.max(0, Number(dVal) || 0);
      return Math.max(0, base - flat);
    }
    return base;
  };

  const extendSubscription = (months, rawFee) => {
    const baseDate = editExpiryDate ? new Date(editExpiryDate) : new Date();
    const startingDate = baseDate < new Date() ? new Date() : baseDate;
    startingDate.setMonth(startingDate.getMonth() + months);
    const newExpiryString = startingDate.toISOString().substring(0, 10);
    setEditExpiryDate(newExpiryString);
    setRecordPayment(true);

    const finalFee = calculateFinalPrice(rawFee, editDiscountType, editDiscountVal);
    setEditSubPrice(finalFee.toString());
    const planKey = months === 1 ? '1_month' : months === 3 ? '3_months' : months === 6 ? '6_months' : '1_year';
    setEditSubPlan(planKey);
    toast.success(`Extended by ${months} month(s). Renewal payment: ৳${finalFee.toLocaleString()}`);
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
        subscriptionPrice: Number(editSubPrice) || 0,
        subscriptionPlan: editSubPlan,
        paymentStatus: editPaymentStatus,
        recordPayment,
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

  const totalDeployments = tenants.length;
  const activeDeployments = tenants.filter(t => t.isActive && (!t.subscriptionExpiresAt || new Date(t.subscriptionExpiresAt) >= new Date())).length;
  const expiredDeployments = tenants.filter(t => !t.isActive || (t.subscriptionExpiresAt && new Date(t.subscriptionExpiresAt) < new Date())).length;
  const lifetimeDeployments = tenants.filter(t => !t.subscriptionExpiresAt || t.subscriptionPlan === 'lifetime').length;

  const planTrial = tenants.filter(t => t.subscriptionPlan === '7_days_trial');
  const plan1Month = tenants.filter(t => t.subscriptionPlan === '1_month' || (!t.subscriptionPlan && t.subscriptionExpiresAt));
  const plan3Months = tenants.filter(t => t.subscriptionPlan === '3_months');
  const plan6Months = tenants.filter(t => t.subscriptionPlan === '6_months');
  const plan1Year = tenants.filter(t => t.subscriptionPlan === '1_year');
  const planCustom = tenants.filter(t => t.subscriptionPlan === 'custom_date');
  const planLifetime = tenants.filter(t => t.subscriptionPlan === 'lifetime' || !t.subscriptionExpiresAt);

  const totalRevenue = tenants.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const pendingRevenueAmount = tenants.filter(t => t.paymentStatus === 'pending').reduce((acc, t) => acc + (Number(t.subscriptionPrice) || 0), 0);
  const pendingInvoices = tenants.filter(t => t.paymentStatus === 'pending').length;

  const revTrial = planTrial.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const rev1Month = plan1Month.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const rev3Months = plan3Months.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const rev6Months = plan6Months.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const rev1Year = plan1Year.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const revCustom = planCustom.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);
  const revLifetime = planLifetime.reduce((acc, t) => acc + (Number(t.totalRevenueCollected) || 0), 0);

  const filteredTenants = tenants.filter((t) => {
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      (t.businessName && t.businessName.toLowerCase().includes(query)) ||
      (t.slug && t.slug.toLowerCase().includes(query)) ||
      (t.adminEmail && t.adminEmail.toLowerCase().includes(query)) ||
      (t.adminPhone && t.adminPhone.toLowerCase().includes(query)) ||
      (t.customDomain && t.customDomain.toLowerCase().includes(query));

    const isExpired = t.subscriptionExpiresAt && new Date(t.subscriptionExpiresAt) < new Date();
    const isTrialing = t.subscriptionPlan === '7_days_trial';

    let matchesStatus = true;
    if (statusFilter === 'active') matchesStatus = t.isActive && !isExpired && !isTrialing;
    else if (statusFilter === 'trial') matchesStatus = isTrialing && t.isActive && !isExpired;
    else if (statusFilter === 'expired') matchesStatus = isExpired || !t.isActive;
    else if (statusFilter === 'lifetime') matchesStatus = !t.subscriptionExpiresAt || t.subscriptionPlan === 'lifetime';

    return matchesQuery && matchesStatus;
  });

  return (
    <div className={`min-h-screen p-4 md:p-8 space-y-6 text-left relative overflow-hidden font-sans transition-colors duration-300 ${themeMode === 'dark' ? 'bg-zinc-950 text-zinc-100' : 'bg-slate-50 text-slate-900'
      }`}>
      {/* Ambient Background Orbs */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />
      <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none -z-10" />

      {/* Master Control Header */}
      <div className={`relative p-6 md:p-8 rounded-[2.5rem] border backdrop-blur-2xl shadow-2xl space-y-6 transition-all ${themeMode === 'dark'
        ? 'bg-gradient-to-r from-zinc-900/90 via-zinc-900/60 to-purple-950/40 border-purple-500/20 text-white'
        : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-purple-500/10 rounded-3xl border border-purple-500/30 shadow-inner">
              <img src="/daruntech-logo.png" alt="Darun Tech Logo" className="w-11 h-11 object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className={`text-2xl md:text-3xl font-black tracking-tight ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'
                  }`}>
                  Indoor Sports Management System — Administration Portal
                </h1>
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 rounded-full flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />Central Administration
                </span>
              </div>
              <div className={`text-xs md:text-sm font-medium mt-1.5 space-y-0.5 ${themeMode === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                <div>Centralized management and oversight of your multi-tenant indoor sports business platform</div>
                <div><strong className="text-purple-600 dark:text-purple-400 font-bold">Built, Operated & Managed by Darun Tech Private Limited</strong></div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            {/* Theme Toggle Button */}
            <Button
              onClick={toggleTheme}
              variant="secondary"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold cursor-pointer rounded-2xl border transition-all ${themeMode === 'dark'
                ? 'bg-zinc-900 text-amber-400 border-zinc-700/80 hover:bg-zinc-800'
                : 'bg-slate-100 text-slate-800 border-slate-300 hover:bg-slate-200'
                }`}
            >
              {themeMode === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-600" />}
              {themeMode === 'dark' ? 'White Mode ☀️' : 'Dark Mode 🌙'}
            </Button>

            {/* Global Pricing Config Button */}
            <Button
              onClick={() => {
                setTempPrices(planPrices);
                setIsPricingModalOpen(true);
              }}
              variant="secondary"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold cursor-pointer rounded-2xl border transition-all ${themeMode === 'dark'
                ? 'bg-zinc-900 text-purple-400 border-zinc-700/80 hover:bg-zinc-800'
                : 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100'
                }`}
            >
              <Settings className="w-4 h-4 text-purple-500" /> Pricing Config
            </Button>

            <Button
              onClick={exportCSVReport}
              variant="secondary"
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold cursor-pointer rounded-2xl border transition-all ${themeMode === 'dark'
                ? 'bg-zinc-900 border-zinc-700/80 text-zinc-200 hover:bg-zinc-800'
                : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200'
                }`}
            >
              <Download className="w-4 h-4 text-emerald-500" /> Export CSV
            </Button>

            <Button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-xl shadow-purple-500/20 cursor-pointer rounded-2xl"
            >
              <Plus className="w-4 h-4" /> Provision Client
            </Button>

            <Button
              onClick={logout}
              variant="secondary"
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 font-bold bg-rose-500/10 border border-rose-500/20 text-rose-500 hover:bg-rose-500/20 cursor-pointer rounded-2xl"
            >
              <LogOut className="w-4 h-4" /> Exit
            </Button>
          </div>
        </div>

        {/* Quick Metrics Cards */}
        <div className={`grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4 border-t ${themeMode === 'dark' ? 'border-zinc-800/80' : 'border-slate-200'
          }`}>
          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-zinc-900/80 border-zinc-800/80' : 'bg-slate-100/80 border-slate-200'
            }`}>
            <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-400 uppercase tracking-widest block">Total Clients</span>
            <span className="text-2xl font-black text-purple-600 dark:text-white mt-1 block">{totalDeployments}</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-zinc-900/80 border-zinc-800/80' : 'bg-slate-100/80 border-slate-200'
            }`}>
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest block">Active Sites</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{activeDeployments}</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-zinc-900/80 border-zinc-800/80' : 'bg-slate-100/80 border-slate-200'
            }`}>
            <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-widest block flex items-center gap-1">
              <Gift className="w-3 h-3 text-cyan-500" /> 7-Day Free Trial
            </span>
            <span className="text-2xl font-black text-cyan-600 dark:text-cyan-400 mt-1 block">{planTrial.length}</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-zinc-900/80 border-zinc-800/80' : 'bg-slate-100/80 border-slate-200'
            }`}>
            <span className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-widest block">Suspended / Expired</span>
            <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{expiredDeployments}</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-zinc-900/80 border-zinc-800/80' : 'bg-slate-100/80 border-slate-200'
            }`}>
            <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-widest block">Lifetime Plans</span>
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1 block">{lifetimeDeployments}</span>
          </div>
        </div>
      </div>

      {/* Financial Revenue & Profit Analytics Dashboard Card */}
      <div className={`p-6 md:p-8 rounded-[2.5rem] border backdrop-blur-2xl shadow-2xl space-y-6 transition-all ${themeMode === 'dark'
        ? 'bg-gradient-to-br from-zinc-900/90 via-zinc-900/60 to-purple-950/40 border-purple-500/20 text-white'
        : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}>
        <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-5 ${themeMode === 'dark' ? 'border-zinc-800/80' : 'border-slate-200'
          }`}>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-black flex items-center gap-2">
                Financial Profit Analytics & Revenue Tiers
              </h2>
              <p className={`text-xs font-medium ${themeMode === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
                Live platform earnings by plan tier duration and pending client invoices.
              </p>
            </div>
          </div>

          <div className="text-right bg-emerald-500/10 border border-emerald-500/30 px-5 py-2.5 rounded-2xl">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block">Total Revenue Collected</span>
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              ৳ {totalRevenue.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Multi-Tier Profit Breakdown Grid (6 Tiers) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-purple-500/10 border-purple-500/30' : 'bg-purple-50 border-purple-200'
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${themeMode === 'dark' ? 'text-purple-400' : 'text-purple-800'
              }`}>1-Month Plan</span>
            <span className={`text-lg font-black block mt-1 font-mono ${themeMode === 'dark' ? 'text-purple-300' : 'text-purple-900'
              }`}>৳ {rev1Month.toLocaleString()}</span>
            <span className={`text-[10px] font-semibold block mt-0.5 ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
              }`}>{plan1Month.length} Client(s)</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-indigo-500/10 border-indigo-500/30' : 'bg-indigo-50 border-indigo-200'
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${themeMode === 'dark' ? 'text-indigo-400' : 'text-indigo-800'
              }`}>3-Month Plan</span>
            <span className={`text-lg font-black block mt-1 font-mono ${themeMode === 'dark' ? 'text-indigo-300' : 'text-indigo-900'
              }`}>৳ {rev3Months.toLocaleString()}</span>
            <span className={`text-[10px] font-semibold block mt-0.5 ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
              }`}>{plan3Months.length} Client(s)</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-blue-500/10 border-blue-500/30' : 'bg-blue-50 border-blue-200'
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${themeMode === 'dark' ? 'text-blue-400' : 'text-blue-800'
              }`}>6-Month Plan</span>
            <span className={`text-lg font-black block mt-1 font-mono ${themeMode === 'dark' ? 'text-blue-300' : 'text-blue-900'
              }`}>৳ {rev6Months.toLocaleString()}</span>
            <span className={`text-[10px] font-semibold block mt-0.5 ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
              }`}>{plan6Months.length} Client(s)</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-amber-50 border-amber-200'
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${themeMode === 'dark' ? 'text-amber-400' : 'text-amber-800'
              }`}>1-Year Plan</span>
            <span className={`text-lg font-black block mt-1 font-mono ${themeMode === 'dark' ? 'text-amber-300' : 'text-amber-900'
              }`}>৳ {rev1Year.toLocaleString()}</span>
            <span className={`text-[10px] font-semibold block mt-0.5 ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
              }`}>{plan1Year.length} Client(s)</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-cyan-500/10 border-cyan-500/30' : 'bg-cyan-50 border-cyan-200'
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block flex items-center gap-1 ${themeMode === 'dark' ? 'text-cyan-400' : 'text-cyan-800'
              }`}>
              📅 Custom Plan
            </span>
            <span className={`text-lg font-black block mt-1 font-mono ${themeMode === 'dark' ? 'text-cyan-300' : 'text-cyan-900'
              }`}>৳ {revCustom.toLocaleString()}</span>
            <span className={`text-[10px] font-semibold block mt-0.5 ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
              }`}>{planCustom.length} Client(s)</span>
          </div>

          <div className={`p-4 rounded-2xl border transition-colors ${themeMode === 'dark' ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200'
            }`}>
            <span className={`text-[10px] font-black uppercase tracking-wider block ${themeMode === 'dark' ? 'text-emerald-400' : 'text-emerald-800'
              }`}>Lifetime License</span>
            <span className={`text-lg font-black block mt-1 font-mono ${themeMode === 'dark' ? 'text-emerald-300' : 'text-emerald-900'
              }`}>৳ {revLifetime.toLocaleString()}</span>
            <span className={`text-[10px] font-semibold block mt-0.5 ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
              }`}>{planLifetime.length} Client(s)</span>
          </div>
        </div>

        {/* Pending Invoice Warning Notice */}
        {pendingInvoices > 0 && (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 flex items-center justify-between gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>Pending Invoices: <strong>{pendingInvoices} client(s)</strong> awaiting payment collection.</span>
            </div>
            <span className="font-mono text-amber-600 dark:text-amber-400 font-bold text-sm">Total Pending: ৳ {pendingRevenueAmount.toLocaleString()}</span>
          </div>
        )}
      </div>

      {/* Tenants Registry Section with Search & Filters */}
      <div className={`p-6 md:p-8 rounded-[2.5rem] border backdrop-blur-2xl shadow-2xl space-y-6 transition-all ${themeMode === 'dark'
        ? 'bg-zinc-900/60 border-zinc-800/80 text-white'
        : 'bg-white border-slate-200 text-slate-900 shadow-xl'
        }`}>
        <div className={`flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b pb-5 ${themeMode === 'dark' ? 'border-zinc-800' : 'border-slate-200'
          }`}>
          <div>
            <h2 className="text-xl font-black flex items-center gap-2">
              Client Subdomain Deployments
            </h2>
            <p className={`text-xs font-medium mt-0.5 ${themeMode === 'dark' ? 'text-zinc-400' : 'text-slate-500'}`}>
              Live directory of all client database contexts, custom domains, and renewal dates.
            </p>
          </div>

          {/* Search Bar & Status Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search business, slug, phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`w-full pl-9 pr-4 py-2 text-xs font-medium rounded-2xl focus:outline-none focus:border-purple-500/60 border ${themeMode === 'dark'
                  ? 'bg-zinc-950 border-zinc-800 text-white placeholder-zinc-500'
                  : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                  }`}
              />
            </div>

            <div className={`flex p-1 rounded-2xl border text-xs w-full sm:w-auto overflow-x-auto ${themeMode === 'dark' ? 'bg-zinc-950 border-zinc-800' : 'bg-slate-100 border-slate-200'
              }`}>
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${statusFilter === 'all' ? 'bg-purple-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
              >
                All ({tenants.length})
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${statusFilter === 'active' ? 'bg-emerald-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
              >
                Active ({activeDeployments})
              </button>
              <button
                onClick={() => setStatusFilter('trial')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors flex items-center gap-1 ${statusFilter === 'trial' ? 'bg-cyan-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
              >
                🎁 Trial ({planTrial.length})
              </button>
              <button
                onClick={() => setStatusFilter('expired')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${statusFilter === 'expired' ? 'bg-rose-600 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
              >
                Expired ({expiredDeployments})
              </button>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="flex justify-center py-16"><Loader size="lg" /></div>
        ) : filteredTenants.length === 0 ? (
          <div className="text-center py-16 text-zinc-500 font-semibold text-sm">
            No matching client tenants found.
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className={`border-b text-[10px] font-extrabold uppercase tracking-widest ${themeMode === 'dark' ? 'border-zinc-800 text-zinc-400' : 'border-slate-200 text-slate-500'
                  }`}>
                  <th className="pb-3 px-3">Client / Business</th>
                  <th className="pb-3">Subdomain Slug</th>
                  <th className="pb-3">Plan & Billing</th>
                  <th className="pb-3">Profit Collected</th>
                  <th className="pb-3">Subscription Expiry</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right pr-3">Actions</th>
                </tr>
              </thead>
              <tbody className={`text-sm divide-y ${themeMode === 'dark' ? 'divide-zinc-800/60' : 'divide-slate-200'
                }`}>
                {filteredTenants.map((t) => {
                  const isExpired = t.subscriptionExpiresAt && new Date(t.subscriptionExpiresAt) < new Date();
                  const isTrial = t.subscriptionPlan === '7_days_trial';

                  let daysRemaining = null;
                  if (t.subscriptionExpiresAt) {
                    const diffTime = new Date(t.subscriptionExpiresAt) - new Date();
                    daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  }

                  return (
                    <tr key={t.id} className={`transition-colors ${themeMode === 'dark' ? 'hover:bg-zinc-800/40' : 'hover:bg-slate-50'
                      }`}>
                      <td className="py-4 px-3 font-bold">
                        <span className={`block ${themeMode === 'dark' ? 'text-white' : 'text-slate-900'}`}>{t.businessName}</span>
                        {t.customDomain && (
                          <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 text-[9px] font-bold rounded-lg border font-mono ${themeMode === 'dark' ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30' : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                            }`}>
                            {t.customDomain}
                          </span>
                        )}
                      </td>

                      <td className={`py-4 font-mono font-semibold text-xs ${themeMode === 'dark' ? 'text-purple-300' : 'text-purple-700'
                        }`}>
                        {t.slug}.daruntech.com
                      </td>

                      <td className="py-4 font-semibold text-xs">
                        {isTrial ? (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border flex items-center gap-1 w-fit ${themeMode === 'dark' ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' : 'bg-cyan-50 text-cyan-800 border-cyan-200'
                            }`}>
                            <Gift className="w-3 h-3" /> 7-Day Free Trial
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase border block w-fit ${themeMode === 'dark' ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' : 'bg-purple-50 text-purple-800 border-purple-200'
                            }`}>
                            {t.subscriptionPlan ? t.subscriptionPlan.replace('_', ' ') : '1 Month'}
                          </span>
                        )}
                        <span className={`text-[11px] font-bold block mt-1 font-mono ${themeMode === 'dark' ? 'text-zinc-300' : 'text-slate-600'
                          }`}>
                          ৳ {Number(t.subscriptionPrice || 0).toLocaleString()} / cycle
                        </span>
                      </td>

                      <td className={`py-4 font-mono text-xs font-bold ${themeMode === 'dark' ? 'text-emerald-400' : 'text-emerald-700'
                        }`}>
                        ৳ {Number(t.totalRevenueCollected || 0).toLocaleString()}
                        {t.paymentStatus === 'pending' && (
                          <span className={`ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-extrabold uppercase ${themeMode === 'dark' ? 'bg-amber-500/20 text-amber-300' : 'bg-amber-100 text-amber-800'
                            }`}>
                            Pending
                          </span>
                        )}
                      </td>

                      <td className="py-4">
                        {t.subscriptionExpiresAt ? (
                          <div className="flex flex-col gap-0.5">
                            <span className={`text-xs font-bold ${isExpired ? 'text-rose-500' : themeMode === 'dark' ? 'text-zinc-200' : 'text-slate-800'
                              }`}>
                              {new Date(t.subscriptionExpiresAt).toLocaleDateString(undefined, {
                                year: 'numeric',
                                month: 'short',
                                day: 'numeric',
                              })}
                            </span>
                            <span className={`text-[9px] font-extrabold uppercase tracking-wider ${isExpired ? 'text-rose-500' : isTrial ? (themeMode === 'dark' ? 'text-cyan-300' : 'text-cyan-700') : (themeMode === 'dark' ? 'text-emerald-400' : 'text-emerald-700')
                              }`}>
                              {isExpired
                                ? 'Expired'
                                : isTrial
                                  ? `${daysRemaining} Days Trial Left`
                                  : `${daysRemaining} Days Remaining`}
                            </span>
                          </div>
                        ) : (
                          <span className={`px-2.5 py-0.5 text-[10px] font-bold border rounded-full ${themeMode === 'dark' ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}>
                            Lifetime / Pro
                          </span>
                        )}
                      </td>

                      <td className="py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${t.isActive && !isExpired
                          ? themeMode === 'dark' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : themeMode === 'dark' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30' : 'bg-rose-50 text-rose-800 border-rose-200'
                          }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${t.isActive && !isExpired ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {t.isActive && !isExpired ? 'Active' : t.isActive ? 'Expired' : 'Suspended'}
                        </span>
                      </td>

                      <td className="py-4 text-right pr-3">
                        <div className="flex justify-end items-center gap-1.5">
                          {/* Launch Console Button */}
                          <a
                            href={`/admin?tenant=${t.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-300 hover:bg-purple-500/20 border border-purple-500/30 rounded-xl flex items-center gap-1 transition-colors"
                            title="Open Tenant Admin Portal"
                          >
                            Launch <ExternalLink className="w-3 h-3" />
                          </a>

                          <button
                            onClick={() => handleToggleStatus(t)}
                            className="p-1.5 text-zinc-400 hover:text-purple-600 transition-colors"
                            title={t.isActive ? 'Suspend client access' : 'Activate client access'}
                          >
                            {t.isActive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-zinc-400" />}
                          </button>

                          <button
                            onClick={() => openSuperMaintModal(t)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                            title="🚨 Emergency Online Booking Control & System Pause"
                          >
                            <ShieldAlert className="w-4 h-4 text-rose-500 hover:text-rose-600" />
                          </button>

                          <button
                            onClick={() => openEditModal(t)}
                            className="p-1.5 text-zinc-400 hover:text-indigo-600 transition-colors"
                            title="Edit Client Settings"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDeleteTenant(t)}
                            className="p-1.5 text-zinc-400 hover:text-rose-600 transition-colors"
                            title="Wipe & Deprovision Client"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Global Subscription Pricing Config Modal */}
      {isPricingModalOpen && (
        <Dialog
          isOpen={isPricingModalOpen}
          onClose={() => setIsPricingModalOpen(false)}
          title="⚙️ Configure Subscription Plan Pricing & Rates"
          className="max-w-md"
        >
          <form onSubmit={savePlanPrices} className="space-y-4 pt-4 text-left">
            <p className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
              Set default pricing rates for client subscriptions. Quick renewal buttons will dynamically use these rates.
            </p>
            <div className="space-y-3">
              <Input
                label="1-Month Plan Rate (৳)"
                type="number"
                value={tempPrices.month1}
                onChange={(e) => setTempPrices({ ...tempPrices, month1: Number(e.target.value) })}
                required
              />
              <Input
                label="3-Month Plan Rate (৳)"
                type="number"
                value={tempPrices.months3}
                onChange={(e) => setTempPrices({ ...tempPrices, months3: Number(e.target.value) })}
                required
              />
              <Input
                label="6-Month Plan Rate (৳)"
                type="number"
                value={tempPrices.months6}
                onChange={(e) => setTempPrices({ ...tempPrices, months6: Number(e.target.value) })}
                required
              />
              <Input
                label="1-Year Plan Rate (৳)"
                type="number"
                value={tempPrices.year1}
                onChange={(e) => setTempPrices({ ...tempPrices, year1: Number(e.target.value) })}
                required
              />
              <Input
                label="Lifetime License Rate (৳)"
                type="number"
                value={tempPrices.lifetime}
                onChange={(e) => setTempPrices({ ...tempPrices, lifetime: Number(e.target.value) })}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200 dark:border-zinc-800">
              <Button type="button" variant="secondary" onClick={() => setIsPricingModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Save Pricing Config
              </Button>
            </div>
          </form>
        </Dialog>
      )}

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

            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/20 space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <DollarSign className="w-4 h-4" /> Subscription Payment & Financial Inputs
              </h4>
              <div className="grid grid-cols-3 gap-3">
                <Select
                  label="Plan Tier"
                  value={subPlan}
                  onChange={(e) => {
                    const chosenPlan = e.target.value;
                    setSubPlan(chosenPlan);
                    if (chosenPlan === '7_days_trial') {
                      setSubPrice('0');
                      setPaymentStatus('paid');
                    } else if (chosenPlan === '1_month') {
                      setSubPrice(calculateFinalPrice(planPrices.month1, discountType, discountVal).toString());
                    } else if (chosenPlan === '3_months') {
                      setSubPrice(calculateFinalPrice(planPrices.months3, discountType, discountVal).toString());
                    } else if (chosenPlan === '6_months') {
                      setSubPrice(calculateFinalPrice(planPrices.months6, discountType, discountVal).toString());
                    } else if (chosenPlan === '1_year') {
                      setSubPrice(calculateFinalPrice(planPrices.year1, discountType, discountVal).toString());
                    } else if (chosenPlan === 'lifetime') {
                      setSubPrice(calculateFinalPrice(planPrices.lifetime, discountType, discountVal).toString());
                    }
                  }}
                  options={[
                    { value: '1_month', label: `1 Month (৳${planPrices.month1.toLocaleString()})` },
                    { value: '3_months', label: `3 Months (৳${planPrices.months3.toLocaleString()})` },
                    { value: '6_months', label: `6 Months (৳${planPrices.months6.toLocaleString()})` },
                    { value: '1_year', label: `1 Year (৳${planPrices.year1.toLocaleString()})` },
                    { value: 'lifetime', label: `Lifetime (৳${planPrices.lifetime.toLocaleString()})` },
                    { value: 'custom_date', label: '📅 Custom Expiry Date' },
                    { value: '7_days_trial', label: '🎁 7-Day Free Trial (৳0)' },
                  ]}
                />

                <Select
                  label="Discount Option"
                  value={discountType}
                  onChange={(e) => {
                    const dt = e.target.value;
                    setDiscountType(dt);
                    let base = planPrices.month1;
                    if (subPlan === '3_months') base = planPrices.months3;
                    else if (subPlan === '6_months') base = planPrices.months6;
                    else if (subPlan === '1_year') base = planPrices.year1;
                    else if (subPlan === 'lifetime') base = planPrices.lifetime;
                    else if (subPlan === '7_days_trial') base = 0;
                    setSubPrice(calculateFinalPrice(base, dt, discountVal).toString());
                  }}
                  options={[
                    { value: 'none', label: 'No Discount' },
                    { value: 'percent', label: 'Percentage (%) Discount' },
                    { value: 'flat', label: 'Flat Amount (৳) Discount' },
                  ]}
                />

                {discountType !== 'none' ? (
                  <Input
                    label={discountType === 'percent' ? 'Discount Value (%)' : 'Discount Value (৳)'}
                    type="number"
                    value={discountVal}
                    onChange={(e) => {
                      const dv = e.target.value;
                      setDiscountVal(dv);
                      let base = planPrices.month1;
                      if (subPlan === '3_months') base = planPrices.months3;
                      else if (subPlan === '6_months') base = planPrices.months6;
                      else if (subPlan === '1_year') base = planPrices.year1;
                      else if (subPlan === 'lifetime') base = planPrices.lifetime;
                      else if (subPlan === '7_days_trial') base = 0;
                      setSubPrice(calculateFinalPrice(base, discountType, dv).toString());
                    }}
                  />
                ) : (
                  <Select
                    label="Payment Status"
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value)}
                    options={[
                      { value: 'paid', label: 'Paid' },
                      { value: 'pending', label: 'Pending' },
                    ]}
                  />
                )}
              </div>

              {subPlan === 'custom_date' && (
                <div className="p-3.5 bg-purple-500/10 rounded-2xl border border-purple-500/30 space-y-3 mt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="📅 Custom Expiry Date"
                      type="date"
                      value={customExpiry}
                      onChange={(e) => setCustomExpiry(e.target.value)}
                      required
                    />
                    <Input
                      label="💰 Custom Subscription Fee (৳)"
                      type="number"
                      placeholder="e.g. 7500"
                      value={subPrice}
                      onChange={(e) => setSubPrice(e.target.value)}
                      required
                    />
                  </div>
                  <p className="text-[10px] text-purple-600 dark:text-purple-300 font-semibold">
                    Set any custom end date and custom subscription price for this client.
                  </p>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-emerald-500/10">
                <span className="text-zinc-500 dark:text-zinc-400">Net Final Price Collected:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">৳ {Number(subPrice).toLocaleString()}</span>
              </div>
            </div>

            <div className="p-4 bg-zinc-500/5 dark:bg-zinc-900/40 rounded-2xl border border-zinc-200 dark:border-zinc-800 space-y-3">
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
              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
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
            <div className="p-4 bg-emerald-500/5 dark:bg-emerald-950/20 rounded-2xl border border-emerald-500/20 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4" /> Renewal Payment & Profit Entry
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recordPayment}
                    onChange={(e) => setRecordPayment(e.target.checked)}
                    className="w-4 h-4 accent-emerald-500 rounded"
                  />
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Record New Revenue</span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Select
                  label="Plan Tier"
                  value={editSubPlan}
                  onChange={(e) => {
                    const chosenPlan = e.target.value;
                    setEditSubPlan(chosenPlan);
                    let base = planPrices.month1;
                    if (chosenPlan === '3_months') base = planPrices.months3;
                    else if (chosenPlan === '6_months') base = planPrices.months6;
                    else if (chosenPlan === '1_year') base = planPrices.year1;
                    else if (chosenPlan === 'lifetime') base = planPrices.lifetime;
                    else if (chosenPlan === '7_days_trial') base = 0;
                    setEditSubPrice(calculateFinalPrice(base, editDiscountType, editDiscountVal).toString());
                  }}
                  options={[
                    { value: '1_month', label: `1 Month (৳${planPrices.month1.toLocaleString()})` },
                    { value: '3_months', label: `3 Months (৳${planPrices.months3.toLocaleString()})` },
                    { value: '6_months', label: `6 Months (৳${planPrices.months6.toLocaleString()})` },
                    { value: '1_year', label: `1 Year (৳${planPrices.year1.toLocaleString()})` },
                    { value: 'lifetime', label: `Lifetime (৳${planPrices.lifetime.toLocaleString()})` },
                    { value: 'custom_date', label: '📅 Custom Expiry Date' },
                    { value: '7_days_trial', label: '🎁 7-Day Free Trial (৳0)' },
                  ]}
                />

                <Select
                  label="Discount Option"
                  value={editDiscountType}
                  onChange={(e) => {
                    const dt = e.target.value;
                    setEditDiscountType(dt);
                    let base = planPrices.month1;
                    if (editSubPlan === '3_months') base = planPrices.months3;
                    else if (editSubPlan === '6_months') base = planPrices.months6;
                    else if (editSubPlan === '1_year') base = planPrices.year1;
                    else if (editSubPlan === 'lifetime') base = planPrices.lifetime;
                    else if (editSubPlan === '7_days_trial') base = 0;
                    setEditSubPrice(calculateFinalPrice(base, dt, editDiscountVal).toString());
                  }}
                  options={[
                    { value: 'none', label: 'No Discount' },
                    { value: 'percent', label: 'Percentage (%) Discount' },
                    { value: 'flat', label: 'Flat Amount (৳) Discount' },
                  ]}
                />

                <Select
                  label="Payment Status"
                  value={editPaymentStatus}
                  onChange={(e) => setEditPaymentStatus(e.target.value)}
                  options={[
                    { value: 'paid', label: 'Paid' },
                    { value: 'pending', label: 'Pending' },
                  ]}
                />
              </div>

              {editDiscountType !== 'none' && (
                <div className="pt-1">
                  <Input
                    label={editDiscountType === 'percent' ? 'Discount Value (%)' : 'Discount Value (৳)'}
                    type="number"
                    value={editDiscountVal}
                    onChange={(e) => {
                      const dv = e.target.value;
                      setDiscountVal(dv);
                      let base = planPrices.month1;
                      if (editSubPlan === '3_months') base = planPrices.months3;
                      else if (editSubPlan === '6_months') base = planPrices.months6;
                      else if (editSubPlan === '1_year') base = planPrices.year1;
                      else if (editSubPlan === 'lifetime') base = planPrices.lifetime;
                      else if (editSubPlan === '7_days_trial') base = 0;
                      setEditSubPrice(calculateFinalPrice(base, editDiscountType, dv).toString());
                    }}
                  />
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold pt-2 border-t border-emerald-500/10">
                <span className="text-zinc-500 dark:text-zinc-400">Net Final Price Collected:</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono text-sm">৳ {Number(editSubPrice).toLocaleString()}</span>
              </div>

              {/* QUICK EXTEND & RECORD FEE (Matching reference image) */}
              <div className="space-y-2 pt-2 border-t border-emerald-500/10">
                <span className="text-[10px] font-black text-zinc-500 dark:text-zinc-400 uppercase tracking-widest block">
                  QUICK EXTEND & RECORD FEE:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      now.setDate(now.getDate() + 7);
                      setEditExpiryDate(now.toISOString().substring(0, 10));
                      setEditSubPlan('7_days_trial');
                      setEditSubPrice('0');
                      setRecordPayment(false);
                      toast.success('Applied 7-Day Free Trial Plan (৳0 Free)!');
                    }}
                    className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-2xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
                  >
                    🎁 7-Day Trial (Free)
                  </button>

                  <button
                    type="button"
                    onClick={() => extendSubscription(1, planPrices.month1)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition-all shadow-md cursor-pointer"
                  >
                    +1 Month (৳{planPrices.month1.toLocaleString()})
                  </button>

                  <button
                    type="button"
                    onClick={() => extendSubscription(3, planPrices.months3)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition-all shadow-md cursor-pointer"
                  >
                    +3 Months (৳{planPrices.months3.toLocaleString()})
                  </button>

                  <button
                    type="button"
                    onClick={() => extendSubscription(6, planPrices.months6)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition-all shadow-md cursor-pointer"
                  >
                    +6 Months (৳{planPrices.months6.toLocaleString()})
                  </button>

                  <button
                    type="button"
                    onClick={() => extendSubscription(12, planPrices.year1)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl transition-all shadow-md cursor-pointer"
                  >
                    +1 Year (৳{planPrices.year1.toLocaleString()})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setEditExpiryDate('');
                      setEditSubPlan('lifetime');
                      setRecordPayment(true);
                      const finalFee = calculateFinalPrice(planPrices.lifetime, editDiscountType, editDiscountVal);
                      setEditSubPrice(finalFee.toString());
                      toast.success(`Set Lifetime Plan (৳${finalFee.toLocaleString()})`);
                    }}
                    className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-2xl transition-all shadow-md cursor-pointer"
                  >
                    Lifetime (৳{planPrices.lifetime.toLocaleString()})
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const today = new Date().toISOString().substring(0, 10);
                      if (!editExpiryDate) setEditExpiryDate(today);
                      setEditSubPlan('custom_date');
                      setRecordPayment(true);
                      toast.success('Selected Custom Date & Custom Pricing! Set date below.');
                    }}
                    className={`px-3.5 py-2 font-black text-xs rounded-2xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer ${editSubPlan === 'custom_date' ? 'bg-indigo-700 text-white ring-2 ring-indigo-400' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      }`}
                  >
                    📅 Custom Date & Price
                  </button>
                </div>
              </div>

              {editSubPlan === 'custom_date' && (
                <div className="p-4 bg-indigo-500/10 rounded-2xl border border-indigo-500/30 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                      📅 Set Custom Expiry Date
                    </span>
                    <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">
                      Pick any date for client subscription
                    </span>
                  </div>
                  <Input
                    label="Subscription Expiry Date"
                    type="date"
                    value={editExpiryDate}
                    onChange={(e) => setEditExpiryDate(e.target.value)}
                  />
                  <p className="text-[11px] font-medium text-indigo-600 dark:text-indigo-300">
                    💡 You can also edit the <strong>Renewal Amount (৳)</strong> above for custom pricing.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
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

      {/* Super Admin Emergency Online Booking Control Modal */}
      {isSuperMaintOpen && superMaintTenant && (
        <Dialog
          isOpen={isSuperMaintOpen}
          onClose={() => setIsSuperMaintOpen(false)}
          title={`🚨 Emergency Online Booking Control — ${superMaintTenant.businessName}`}
          className="max-w-lg"
        >
          <form onSubmit={handleSaveSuperMaint} className="space-y-4 pt-4 text-left">
            <div className={`p-4 rounded-2xl border space-y-3 ${
              superMaintEnabled ? 'bg-rose-500/10 border-rose-500/30' : 'bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800'
            }`}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Online Booking Status
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  superMaintEnabled ? 'bg-rose-500 text-white animate-pulse' : 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                }`}>
                  {superMaintEnabled ? 'PAUSED ⏸️' : 'ACTIVE ▶️'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSuperMaintEnabled(!superMaintEnabled)}
                className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer ${
                  superMaintEnabled
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                    : 'bg-rose-600 hover:bg-rose-700 text-white'
                }`}
              >
                {superMaintEnabled ? '▶️ Resume Online Booking for Client' : '⏸️ Emergency Pause Online Booking'}
              </button>
            </div>

            {superMaintEnabled && (
              <div className="space-y-4 pt-1 animate-fade-in">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                    Custom Highlighted Alert Message (Shown on Booking Page)
                  </label>
                  <textarea
                    rows="3"
                    value={superMaintMessage}
                    onChange={(e) => setSuperMaintMessage(e.target.value)}
                    placeholder="e.g. ⚠️ Online booking is temporarily paused for scheduled maintenance. Please contact venue management for manual reservations."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                    Optional Timer / Auto-Resume Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={superMaintUntil}
                    onChange={(e) => setSuperMaintUntil(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                  <p className="text-[10px] text-zinc-400 font-medium">
                    Leave blank to remain paused until manually resumed, or set a date/time for automatic reopening.
                  </p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-900">
              <Button type="button" variant="secondary" onClick={() => setIsSuperMaintOpen(false)} disabled={superMaintSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={superMaintSaving}>
                {superMaintSaving ? 'Saving...' : 'Save Emergency Controls'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
};

export default SuperAdminDashboard;
