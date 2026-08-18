import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAdminSettings, useUpdateSettings, usePublicGallery } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { DatePicker } from '../components/ui/DatePicker';
import { useToast } from '../components/ui/Toast';
import { Save, Plus, Trash2, HelpCircle, CreditCard, Check, Sparkles } from 'lucide-react';
import { AdminAuditLogsTab } from '../components/AdminAuditLogsTab';
import { AdminStaffTab } from '../components/AdminStaffTab';

const compressImageIfNeeded = (file, maxSizeMB = 8, maxWidthOrHeight = 4096) => {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      return resolve(file);
    }
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB <= maxSizeMB) {
      return resolve(file);
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidthOrHeight || height > maxWidthOrHeight) {
          if (width > height) {
            height = Math.round((height * maxWidthOrHeight) / width);
            width = maxWidthOrHeight;
          } else {
            width = Math.round((width * maxWidthOrHeight) / height);
            height = maxWidthOrHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile.size < file.size ? compressedFile : file);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
};

const formatDateDMY = (dateStr) => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export const AdminSettings = () => {
  const toast = useToast();
  const { data: settings, isLoading, refetch } = useAdminSettings();
  const updateSettingsMutation = useUpdateSettings();
  const { data: galleryImages } = usePublicGallery();
  const gallery360Images = galleryImages?.filter(img => img.is360) || [];

  const [newSport, setNewSport] = useState('');
  const [newHoliday, setNewHoliday] = useState('');
  const [holidayMode, setHolidayMode] = useState('single');
  const [holidayStart, setHolidayStart] = useState('');
  const [holidayEnd, setHolidayEnd] = useState('');

  const [newMaintenance, setNewMaintenance] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState('single');
  const [maintenanceStart, setMaintenanceStart] = useState('');
  const [maintenanceEnd, setMaintenanceEnd] = useState('');

  const [newPaymentMethod, setNewPaymentMethod] = useState('');
  const [editingPaymentIndex, setEditingPaymentIndex] = useState(null);
  const [editingPaymentText, setEditingPaymentText] = useState('');
  const [newRule, setNewRule] = useState('');
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'general');

  // Discount form state
  const [discName, setDiscName] = useState('');
  const [discType, setDiscType] = useState('percentage');
  const [discValue, setDiscValue] = useState('');
  const [discStart, setDiscStart] = useState('');
  const [discEnd, setDiscEnd] = useState('');

  const [formData, setFormData] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

  const handleLogoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImageIfNeeded(file);
      setLogoFile(compressed);
      
      const previewUrl = URL.createObjectURL(compressed);
      setFormData(prev => ({ ...prev, logo: previewUrl }));
    }
  };

  const handleBannerChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const compressed = await compressImageIfNeeded(file);
      setBannerFile(compressed);
      
      const previewUrl = URL.createObjectURL(compressed);
      setFormData(prev => ({ ...prev, heroBanner: previewUrl }));
    }
  };

  // Initialize form state once loaded
  React.useEffect(() => {
    if (settings) {
      setFormData({
        businessName: settings.businessName || '',
        contactEmail: settings.contactEmail || '',
        contactPhone: settings.contactPhone || '',
        contactAddress: settings.contactAddress || '',
        logo: settings.logo || '',
        heroBanner: settings.heroBanner || '',
        googleMapUrl: settings.googleMapUrl || '',
        theme: settings.theme || 'default',
        enableDarkMode: settings.enableDarkMode ?? true,
        rules: settings.rules || [],
        discounts: settings.discounts || [],
        maintenanceMode: (typeof settings.maintenanceMode === 'string'
          ? (() => { try { return JSON.parse(settings.maintenanceMode); } catch (e) { return null; } })()
          : settings.maintenanceMode) || {
          enabled: false,
          message: '⚠️ Online booking is temporarily paused for scheduled system maintenance. Please contact venue management for manual reservations.',
          until: '',
          disabledBy: 'admin',
        },
        businessHours: {
          weekday: settings.businessHours?.weekday || '08:00 AM - 10:00 PM',
          weekend: settings.businessHours?.weekend || '09:00 AM - 11:00 PM',
          dayShift: settings.businessHours?.dayShift || '06:00 AM - 04:00 PM',
          nightShift: settings.businessHours?.nightShift || '04:00 PM - 02:00 AM',
        },
        weekendDays: settings.weekendDays || [5],
        pricing: {
          weekdayDay: settings.pricing?.weekdayDay ?? 1500,
          weekdayNight: settings.pricing?.weekdayNight ?? 1500,
          weekendDay: settings.pricing?.weekendDay ?? 1500,
          weekendNight: settings.pricing?.weekendNight ?? 1500,
          holidayDay: settings.pricing?.holidayDay ?? 1500,
          holidayNight: settings.pricing?.holidayNight ?? 1500,
        },
        seo: {
          title: settings.seo?.title || '',
          description: settings.seo?.description || '',
          keywords: settings.seo?.keywords || '',
        },
        socialLinks: {
          facebook: settings.socialLinks?.facebook || '',
          instagram: settings.socialLinks?.instagram || '',
          twitter: settings.socialLinks?.twitter || '',
          whatsapp: settings.socialLinks?.whatsapp || '',
        },
        hero: {
          tagline: settings.hero?.tagline || '⚡ Premium Indoor Court',
          title1: settings.hero?.title1 || 'Experience Sports',
          title2: settings.hero?.title2 || 'Like Never Before',
          description: settings.hero?.description || 'Book our state-of-the-art climate-controlled indoor arena. Designed for futsal, basketball, badminton, and more. Clean, professional, and ready.',
          mediaType: settings.hero?.mediaType || 'image',
          autoPlay360: settings.hero?.autoPlay360 ?? true,
          useGlassBg: settings.hero?.useGlassBg ?? true,
          darkenOverlay: settings.hero?.darkenOverlay ?? false,
          blurBackground: settings.hero?.blurBackground ?? false,
          zoomAnimation: settings.hero?.zoomAnimation ?? false,
          overlayStyle: settings.hero?.overlayStyle || 'dark',
          showParticles: settings.hero?.showParticles ?? true,
          titleGradient: settings.hero?.titleGradient || 'purple-pink',
          cardStyle: settings.hero?.cardStyle || 'glass-xl',
          primaryCtaText: settings.hero?.primaryCtaText || 'Book Court Now',
          primaryCtaLink: settings.hero?.primaryCtaLink || '/booking',
          secondaryCtaText: settings.hero?.secondaryCtaText || 'Explore Arena',
          secondaryCtaLink: settings.hero?.secondaryCtaLink || '/about',
          stats: settings.hero?.stats || {
            stat1Val: 'FIFA/FIBA',
            stat1Label: 'Standard Court',
            stat2Val: 'Roof',
            stat2Label: 'Weather Protected',
            stat3Val: 'Natural',
            stat3Label: 'Air Ventilation',
            stat4Val: '24/7',
            stat4Label: 'CCTV & Security',
          },
        },
        paymentConfig: (typeof settings.paymentConfig === 'string'
          ? (() => { try { return JSON.parse(settings.paymentConfig); } catch (e) { return null; } })()
          : settings.paymentConfig) || {
          enabled: false,
          type: 'full',
          partialType: 'percentage',
          partialPercentage: 50,
          partialFixedAmount: 500,
          gateways: {
            bkash: {
              enabled: true,
              accountType: 'Personal',
              merchantNumber: '',
              appKey: '',
              appSecret: '',
              username: '',
              password: '',
              isLive: false,
            },
            sslcommerz: {
              enabled: true,
              storeId: '',
              storePassword: '',
              isLive: false,
            }
          }
        },
      });
    }
  }, [settings]);

  const handleChange = (section, field, value) => {
    setFormData((prev) => {
      if (section) {
        return {
          ...prev,
          [section]: {
            ...prev[section],
            [field]: value,
          },
        };
      }
      return {
        ...prev,
        [field]: value,
      };
    });
  };

  const updatePaymentConfig = (patch) => {
    setFormData((prev) => {
      let current = prev?.paymentConfig;
      if (typeof current === 'string') {
        try { current = JSON.parse(current); } catch (e) { current = {}; }
      }
      current = current || {};

      const defaults = {
        enabled: false,
        type: 'full',
        partialType: 'percentage',
        partialPercentage: 50,
        partialFixedAmount: 500,
        gateways: {
          bkash: { enabled: true, accountType: 'Personal', merchantNumber: '', appKey: '', appSecret: '', username: '', password: '', isLive: false },
          sslcommerz: { enabled: true, storeId: '', storePassword: '', isLive: false },
        },
      };

      const merged = {
        ...defaults,
        ...current,
        gateways: {
          ...defaults.gateways,
          ...(current.gateways || {}),
        },
      };

      const updated = typeof patch === 'function' ? patch(merged) : { ...merged, ...patch };

      return {
        ...prev,
        paymentConfig: updated,
      };
    });
  };

  const handleAddDiscountRule = () => {
    if (!discName || !discValue || !discStart || !discEnd) {
      toast.error('Please fill in all discount fields.');
      return;
    }
    const newRuleObj = {
      id: Date.now().toString(),
      name: discName,
      type: discType,
      value: Number(discValue),
      startDate: discStart,
      endDate: discEnd,
      isActive: true,
    };
    setFormData(prev => ({
      ...prev,
      discounts: [...(prev.discounts || []), newRuleObj],
    }));
    setDiscName('');
    setDiscValue('');
    setDiscStart('');
    setDiscEnd('');
    toast.success('Discount rule added! Click "Save Configuration" to save.');
  };

  const handleToggleDiscount = (id) => {
    setFormData(prev => ({
      ...prev,
      discounts: (prev.discounts || []).map(d => d.id === id ? { ...d, isActive: !d.isActive } : d),
    }));
  };

  const handleDeleteDiscount = (id) => {
    setFormData(prev => ({
      ...prev,
      discounts: (prev.discounts || []).filter(d => d.id !== id),
    }));
    toast.success('Discount rule removed.');
  };

  const handleSave = (e) => {
    e.preventDefault();
    const data = new FormData();
    if (logoFile) {
      data.append('logo', logoFile);
    } else {
      data.append('logo', formData.logo || '');
    }
    if (bannerFile) {
      data.append('heroBanner', bannerFile);
    } else {
      data.append('heroBanner', formData.heroBanner || '');
    }

    data.append('businessName', formData.businessName);
    data.append('contactEmail', formData.contactEmail);
    data.append('contactPhone', formData.contactPhone);
    data.append('contactAddress', formData.contactAddress);
    data.append('googleMapUrl', formData.googleMapUrl);
    data.append('theme', formData.theme);
    data.append('enableDarkMode', formData.enableDarkMode);

    data.append('businessHours', JSON.stringify(formData.businessHours));
    data.append('pricing', JSON.stringify(formData.pricing));
    data.append('seo', JSON.stringify(formData.seo));
    data.append('weekendDays', JSON.stringify(formData.weekendDays));
    data.append('socialLinks', JSON.stringify(formData.socialLinks));
    data.append('hero', JSON.stringify(formData.hero));
    data.append('rules', JSON.stringify(formData.rules));
    data.append('paymentConfig', JSON.stringify(formData.paymentConfig));
    data.append('discounts', JSON.stringify(formData.discounts || []));
    data.append('maintenanceMode', JSON.stringify(formData.maintenanceMode));

    updateSettingsMutation.mutate(data, {
      onSuccess: () => {
        toast.success('Settings updated successfully!');
        setLogoFile(null);
        setBannerFile(null);
        refetch();
      },
      onError: () => {
        toast.error('Failed to save settings');
      },
    });
  };

  const handleAddSport = () => {
    if (!newSport) return;
    const updatedSports = [...(settings.availableSports || []), newSport];
    updateSettingsMutation.mutate(
      { availableSports: updatedSports },
      {
        onSuccess: () => {
          toast.success('Sport added');
          setNewSport('');
          refetch();
        },
      }
    );
  };

  const handleDeleteSport = (sport) => {
    const updatedSports = (settings.availableSports || []).filter((s) => s !== sport);
    updateSettingsMutation.mutate(
      { availableSports: updatedSports },
      {
        onSuccess: () => {
          toast.success('Sport removed');
          refetch();
        },
      }
    );
  };

  const getDatesInRange = (startDateStr, endDateStr) => {
    const dates = [];
    let current = new Date(startDateStr);
    const end = new Date(endDateStr);
    while (current <= end) {
      dates.push(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const formatDateDMY = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleAddHoliday = () => {
    let toAdd = [];
    if (holidayMode === 'single') {
      if (!newHoliday) return;
      toAdd = [newHoliday];
    } else {
      if (!holidayStart || !holidayEnd) {
        toast.error('Please specify start and end dates');
        return;
      }
      if (holidayStart > holidayEnd) {
        toast.error('Start date cannot be after end date');
        return;
      }
      toAdd = getDatesInRange(holidayStart, holidayEnd);
    }

    const currentHolidays = settings.holidays || [];
    const merged = Array.from(new Set([...currentHolidays, ...toAdd]));

    updateSettingsMutation.mutate(
      { holidays: merged },
      {
        onSuccess: () => {
          toast.success('Holiday blockout date(s) added');
          setNewHoliday('');
          setHolidayStart('');
          setHolidayEnd('');
          refetch();
        },
      }
    );
  };

  const handleDeleteHoliday = (date) => {
    const updatedHolidays = (settings.holidays || []).filter((d) => d !== date);
    updateSettingsMutation.mutate(
      { holidays: updatedHolidays },
      {
        onSuccess: () => {
          toast.success('Holiday blockout date removed');
          refetch();
        },
      }
    );
  };

  const handleAddMaintenance = () => {
    let toAdd = [];
    if (maintenanceMode === 'single') {
      if (!newMaintenance) return;
      toAdd = [newMaintenance];
    } else {
      if (!maintenanceStart || !maintenanceEnd) {
        toast.error('Please specify start and end dates');
        return;
      }
      if (maintenanceStart > maintenanceEnd) {
        toast.error('Start date cannot be after end date');
        return;
      }
      toAdd = getDatesInRange(maintenanceStart, maintenanceEnd);
    }

    const currentMaint = settings.maintenanceDays || [];
    const merged = Array.from(new Set([...currentMaint, ...toAdd]));

    updateSettingsMutation.mutate(
      { maintenanceDays: merged },
      {
        onSuccess: () => {
          toast.success('Maintenance date(s) blocked');
          setNewMaintenance('');
          setMaintenanceStart('');
          setMaintenanceEnd('');
          refetch();
        },
      }
    );
  };

  const handleDeleteMaintenance = (date) => {
    const updatedMaint = (settings.maintenanceDays || []).filter((d) => d !== date);
    updateSettingsMutation.mutate(
      { maintenanceDays: updatedMaint },
      {
        onSuccess: () => {
          toast.success('Maintenance blocked date removed');
          refetch();
        },
      }
    );
  };  if (isLoading || !formData) return <Loader size="large" className="py-20" />;

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto animate-fade-in">
      <form onSubmit={handleSave} className="space-y-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Admin Settings</h1>
        <p className="text-sm text-zinc-400">Configure your website theme, business details, pricing structure, and court schedules.</p>
      </div>

      {/* Tab Controls & Save Button */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-855 pb-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: 'general', label: '🌐 Branding & Media' },
            { id: 'hero', label: '✨ Hero Section' },
            { id: 'pricing', label: '৳ Hours & Pricing' },
            { id: 'discounts', label: '🏷️ Online Discounts' },
            { id: 'payment', label: '💳 Payment System & Gateways' },
            { id: 'court', label: '⚙️ Court & Rules' },
            { id: 'integrations', label: '🔗 SEO & Links' },
            { id: 'staff', label: '👥 Staff & Managers' },
            { id: 'subscription', label: '💳 Subscription & License' },
            { id: 'audit_logs', label: '📜 System Audit Logs' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-purple-650 text-white shadow-md shadow-purple-500/20'
                  : 'text-zinc-650 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab !== 'audit_logs' && activeTab !== 'subscription' && activeTab !== 'staff' && (
          <Button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="px-5 py-2.5 font-bold shadow-md shadow-purple-500/10 active:scale-[0.98] shrink-0 animate-glow"
          >
            {updateSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        )}
      </div>

        {/* Tab 1: General & Media */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            {/* 🚨 Emergency Maintenance & System Pause Card */}
            <div className={`glass-card p-6 rounded-3xl shadow-md transition-all space-y-4 border ${
              formData.maintenanceMode?.enabled
                ? 'bg-rose-500/10 dark:bg-rose-955/20 border-rose-500/30'
                : 'border-zinc-200/80 dark:border-zinc-800'
            }`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-150 dark:border-zinc-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                      🚨 Emergency Online Booking Control & System Pause
                    </h3>
                    {formData.maintenanceMode?.enabled && (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-500 text-white animate-pulse">
                        ONLINE BOOKING PAUSED ⏸️
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-zinc-400 mt-1">
                    Instantly pause public online slot bookings during venue maintenance, power outages, or emergency closures.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({
                      ...prev,
                      maintenanceMode: {
                        ...prev.maintenanceMode,
                        enabled: !prev.maintenanceMode?.enabled,
                        disabledBy: 'admin',
                      }
                    }));
                  }}
                  className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md cursor-pointer shrink-0 ${
                    formData.maintenanceMode?.enabled
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
                      : 'bg-rose-600 hover:bg-rose-700 text-white shadow-rose-500/20'
                  }`}
                >
                  {formData.maintenanceMode?.enabled ? '▶️ Resume Online Booking' : '⏸️ Temporary Pause Booking'}
                </button>
              </div>

              {formData.maintenanceMode?.enabled && (
                <div className="space-y-4 pt-1 animate-fade-in">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                        Custom Highlighted Alert Message (Shown to Customers)
                      </label>
                      <textarea
                        rows="2"
                        value={formData.maintenanceMode?.message || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({
                            ...prev,
                            maintenanceMode: { ...prev.maintenanceMode, message: val }
                          }));
                        }}
                        placeholder="e.g. ⚠️ Online booking is temporarily paused for scheduled maintenance. Please call +8801712345678 for manual bookings."
                        className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider block">
                        Optional Timer / Auto-Resume Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.maintenanceMode?.until ? new Date(formData.maintenanceMode.until).toISOString().slice(0, 16) : ''}
                        onChange={(e) => {
                          const val = e.target.value ? new Date(e.target.value).toISOString() : null;
                          setFormData(prev => ({
                            ...prev,
                            maintenanceMode: { ...prev.maintenanceMode, until: val }
                          }));
                        }}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-zinc-950 text-xs font-semibold text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                      />
                      <p className="text-[10px] text-zinc-400 font-medium">
                        Leave blank to keep paused manually, or pick a date & time when online booking should automatically resume.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Core Details */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Branding Details</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure business name, logo, contact coordinates, and layout styling.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
                  <Input
                    label="Business Name"
                    value={formData.businessName}
                    onChange={(e) => handleChange(null, 'businessName', e.target.value)}
                  />
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Website Color Theme</label>
                    <select
                      value={formData.theme}
                      onChange={(e) => handleChange(null, 'theme', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200 cursor-pointer"
                    >
                      <option value="default">🔮 Default Theme (Purple & Indigo Glass)</option>
                      <option value="green">🌿 Emerald Green Theme (Green Primary & White Background)</option>
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-455 uppercase tracking-wider">Dark Mode Setting</label>
                    <div className="flex items-center justify-between px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 h-[42px] cursor-pointer" onClick={() => handleChange(null, 'enableDarkMode', !formData.enableDarkMode)}>
                      <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Enable Dark Mode</span>
                      <button
                        type="button"
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          formData.enableDarkMode ? 'bg-purple-650' : 'bg-zinc-200 dark:bg-zinc-800'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                            formData.enableDarkMode ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Contact Email"
                    value={formData.contactEmail}
                    onChange={(e) => handleChange(null, 'contactEmail', e.target.value)}
                  />
                  <Input
                    label="Contact Phone"
                    value={formData.contactPhone}
                    onChange={(e) => handleChange(null, 'contactPhone', e.target.value)}
                  />
                  <Input
                    label="Physical Address"
                    value={formData.contactAddress}
                    onChange={(e) => handleChange(null, 'contactAddress', e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Media Uploads */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Media Elements</h3>
                <p className="text-xs text-zinc-400 mt-1">Logo image files and background hero configurations.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-450 uppercase tracking-wider">Logo Image</label>
                    {formData.logo ? (
                      <div className="relative group w-24 h-24 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-2 mb-2 flex items-center justify-center">
                        <img src={formData.logo} alt="Logo preview" className="w-full h-full object-contain" />
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, logo: '' }));
                            setLogoFile(null);
                          }}
                          className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-1.5 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer text-xs font-bold"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 mb-2 flex flex-col items-center justify-center text-zinc-400 text-xs gap-1">
                        <span>No Logo</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoChange}
                      className="text-xs text-zinc-500 w-full cursor-pointer file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-500/10 file:text-purple-600 hover:file:bg-purple-500/20 file:cursor-pointer cursor-pointer"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-450 uppercase tracking-wider">Hero Banner Media File (Image or Video)</label>
                    {formData.heroBanner ? (
                      <div className="relative group w-44 h-24 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 mb-2">
                        {formData.heroBanner.includes('data:video/') || formData.heroBanner.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                          <video src={formData.heroBanner} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={formData.heroBanner} alt="Banner preview" className="w-full h-full object-cover" />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData(prev => ({ ...prev, heroBanner: '' }));
                            setBannerFile(null);
                          }}
                          className="absolute inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center gap-1.5 text-white opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer text-xs font-bold"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" /> Remove
                        </button>
                      </div>
                    ) : (
                      <div className="w-44 h-24 rounded-2xl border border-dashed border-zinc-300 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20 mb-2 flex flex-col items-center justify-center text-zinc-400 text-xs gap-1">
                        <span>No Banner</span>
                      </div>
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      onChange={handleBannerChange}
                      className="text-xs text-zinc-500 w-full cursor-pointer file:mr-2 file:py-1 file:px-2.5 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-purple-500/10 file:text-purple-600 hover:file:bg-purple-500/20 file:cursor-pointer cursor-pointer"
                    />
                    {formData.hero.mediaType === '360' && gallery360Images.length > 0 && (
                      <div className="mt-3">
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Or Select Existing 360° Gallery Image</label>
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              setFormData(prev => ({ ...prev, heroBanner: e.target.value }));
                              setBannerFile(null);
                            }
                          }}
                          value={gallery360Images.some(img => img.imageUrl === formData.heroBanner) ? formData.heroBanner : ""}
                          className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-655 transition-all duration-200 cursor-pointer"
                        >
                          <option value="">-- Choose from Gallery --</option>
                          {gallery360Images.map((img, idx) => (
                            <option key={img._id || idx} value={img.imageUrl}>
                              360° Image #{idx + 1} ({img.imageUrl.substring(img.imageUrl.lastIndexOf('/') + 1)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <div className="flex flex-col gap-1.5 text-left">
                    <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Hero Banner Media Type</label>
                    <select
                      value={formData.hero.mediaType}
                      onChange={(e) => handleChange('hero', 'mediaType', e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-655 transition-all duration-200 cursor-pointer"
                    >
                      <option value="image">🖼️ Image</option>
                      <option value="video">🎬 Video</option>
                      <option value="360">🌐 360° Panorama</option>
                    </select>
                  </div>
                  {formData.hero.mediaType === '360' && (
                    <div className="flex items-center gap-3 pt-6">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.hero.autoPlay360}
                          onChange={(e) => handleChange('hero', 'autoPlay360', e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-600 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600" />
                      </label>
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Auto-Rotate 360°</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hero.useGlassBg}
                        onChange={(e) => handleChange('hero', 'useGlassBg', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-650 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-650" />
                    </label>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Frosted Glass Text Container</span>
                      <span className="text-[10px] text-zinc-405">Adds a liquid-glass card behind hero texts to improve readability.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hero.darkenOverlay}
                        onChange={(e) => handleChange('hero', 'darkenOverlay', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-650 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-650" />
                    </label>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Darken Background Overlay</span>
                      <span className="text-[10px] text-zinc-405">Dims the background banner to make white text pop out.</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hero.blurBackground}
                        onChange={(e) => handleChange('hero', 'blurBackground', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-650 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-650" />
                    </label>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Blur Background Media</span>
                      <span className="text-[10px] text-zinc-405">Adds a beautiful soft-focus blur filter to the background media.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.hero.zoomAnimation}
                        onChange={(e) => handleChange('hero', 'zoomAnimation', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-650 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-650" />
                    </label>
                    <div className="flex flex-col text-left">
                      <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Zoom/Scale Animation (Ken Burns)</span>
                      <span className="text-[10px] text-zinc-405">Applies a slow, premium pulsing scale animation to image banners.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Hero Section Settings */}
        {activeTab === 'hero' && (
          <div className="space-y-6 animate-fade-in">
            {/* Visual Overlay & Effects Settings */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Hero Visual Effects & Styling</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure background dimming, particle lighting, and glassmorphic card effects.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Hero Overlay Color Tint</label>
                  <select
                    value={formData.hero.overlayStyle || 'dark'}
                    onChange={(e) => handleChange('hero', 'overlayStyle', e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200 cursor-pointer"
                  >
                    <option value="dark">🌑 Dark Charcoal (Deep Contrast)</option>
                    <option value="purple">🔮 Royal Purple & Indigo Glow</option>
                    <option value="midnight">🌊 Deep Midnight Blue</option>
                    <option value="emerald">🌿 Emerald Forest Green</option>
                    <option value="rose">🍷 Sunset Rose & Crimson</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 pt-6">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.hero.showParticles !== false}
                      onChange={(e) => handleChange('hero', 'showParticles', e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-zinc-200 dark:bg-zinc-800 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-650 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-650" />
                  </label>
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Floating Light Particles</span>
                    <span className="text-[10px] text-zinc-400">Adds ambient floating light orbs behind hero text.</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Headline Highlight Gradient</label>
                  <select
                    value={formData.hero.titleGradient || 'purple-pink'}
                    onChange={(e) => handleChange('hero', 'titleGradient', e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200 cursor-pointer"
                  >
                    <option value="purple-pink">🔮 Purple ➔ Pink ➔ Indigo (Vibrant Glass)</option>
                    <option value="cyan-blue">💎 Electric Cyan ➔ Sky Blue ➔ Indigo</option>
                    <option value="emerald-gold">🌿 Emerald ➔ Teal ➔ Warm Gold</option>
                    <option value="sunset-orange">🌅 Sunset Red ➔ Crimson ➔ Bright Orange</option>
                    <option value="neon-green">⚡ Neon Lime ➔ Emerald ➔ Cyan Cyberpunk</option>
                  </select>
                </div>

                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Hero Card Preset Style</label>
                  <select
                    value={formData.hero.cardStyle || 'glass-xl'}
                    onChange={(e) => handleChange('hero', 'cardStyle', e.target.value)}
                    className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200 cursor-pointer"
                  >
                    <option value="glass-xl">💎 Liquid Glassmorphism (Frosted Glow)</option>
                    <option value="cyber-neon">⚡ Cyber Neon Accent (Glowing Edge)</option>
                    <option value="minimal-dark">🖤 Minimalist Obsidian Dark</option>
                    <option value="clean-border">⬜ Clean White Border</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Hero Text Content */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Hero Titles & Copy</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure landing headlines, descriptions, and action callouts.</p>
              </div>
              <div className="space-y-4">
                <Input
                  label="Mini Tagline Header"
                  value={formData.hero.tagline}
                  onChange={(e) => handleChange('hero', 'tagline', e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Headline Title Line 1"
                    value={formData.hero.title1}
                    onChange={(e) => handleChange('hero', 'title1', e.target.value)}
                  />
                  <Input
                    label="Headline Title Line 2 (Highlighted Gradient)"
                    value={formData.hero.title2}
                    onChange={(e) => handleChange('hero', 'title2', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Hero Description Text</label>
                  <textarea
                    value={formData.hero.description}
                    onChange={(e) => handleChange('hero', 'description', e.target.value)}
                    className="flex min-h-[100px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white placeholder-zinc-450 focus:outline-none focus:ring-2 focus:ring-purple-655 transition-all duration-200"
                    rows={4}
                  />
                </div>
              </div>
            </div>

            {/* CTA Buttons & Links Editor */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Call To Action Buttons</h3>
                <p className="text-xs text-zinc-400 mt-1">Customize button labels and destination page links on the homepage hero.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Primary Button Text"
                    value={formData.hero.primaryCtaText || 'Book Court Now'}
                    onChange={(e) => handleChange('hero', 'primaryCtaText', e.target.value)}
                    placeholder="e.g. Book Court Now ➔"
                  />
                  <Input
                    label="Primary Button Target Link"
                    value={formData.hero.primaryCtaLink || '/booking'}
                    onChange={(e) => handleChange('hero', 'primaryCtaLink', e.target.value)}
                    placeholder="e.g. /booking"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Secondary Button Text"
                    value={formData.hero.secondaryCtaText || 'Explore Arena'}
                    onChange={(e) => handleChange('hero', 'secondaryCtaText', e.target.value)}
                    placeholder="e.g. Explore Arena"
                  />
                  <Input
                    label="Secondary Button Target Link"
                    value={formData.hero.secondaryCtaLink || '/about'}
                    onChange={(e) => handleChange('hero', 'secondaryCtaLink', e.target.value)}
                    placeholder="e.g. /about"
                  />
                </div>
              </div>
            </div>
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Real-time Hero Counter Badges</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure feature callout values and labels displayed in the stats bar below the hero section.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Stat #1 Highlight Value"
                    value={formData.hero.stats?.stat1Val || 'FIFA/FIBA'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat1Val: val }
                        }
                      }));
                    }}
                    placeholder="e.g. Roof"
                  />
                  <Input
                    label="Stat #1 Label"
                    value={formData.hero.stats?.stat1Label || 'Standard Court'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat1Label: val }
                        }
                      }));
                    }}
                    placeholder="e.g. Weather Protected"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Stat #2 Highlight Value"
                    value={formData.hero.stats?.stat2Val || 'Roof'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat2Val: val }
                        }
                      }));
                    }}
                    placeholder="e.g. Roof"
                  />
                  <Input
                    label="Stat #2 Label"
                    value={formData.hero.stats?.stat2Label || 'Weather Protected'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat2Label: val }
                        }
                      }));
                    }}
                    placeholder="e.g. Protected Court"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Stat #3 Highlight Value"
                    value={formData.hero.stats?.stat3Val || 'Natural'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat3Val: val }
                        }
                      }));
                    }}
                    placeholder="e.g. Natural"
                  />
                  <Input
                    label="Stat #3 Label"
                    value={formData.hero.stats?.stat3Label || 'Air Ventilation'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat3Label: val }
                        }
                      }));
                    }}
                    placeholder="e.g. Air Ventilation"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Stat #4 Highlight Value"
                    value={formData.hero.stats?.stat4Val || '24/7'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat4Val: val }
                        }
                      }));
                    }}
                    placeholder="e.g. 24/7"
                  />
                  <Input
                    label="Stat #4 Label"
                    value={formData.hero.stats?.stat4Label || 'CCTV & Security'}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFormData(prev => ({
                        ...prev,
                        hero: {
                          ...prev.hero,
                          stats: { ...(prev.hero.stats || {}), stat4Label: val }
                        }
                      }));
                    }}
                    placeholder="e.g. CCTV & Security"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Hours & Pricing */}
        {activeTab === 'pricing' && (
          <div className="space-y-6 animate-fade-in">
            {/* Hours */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Operational Schedules</h3>
                <p className="text-xs text-zinc-400 mt-1">Manage weekly opening slots and operational weekend days.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Weekday Hours"
                    value={formData.businessHours.weekday}
                    onChange={(e) => handleChange('businessHours', 'weekday', e.target.value)}
                    placeholder="e.g. 08:00 AM - 10:00 PM"
                  />
                  <Input
                    label="Weekend Hours"
                    value={formData.businessHours.weekend}
                    onChange={(e) => handleChange('businessHours', 'weekend', e.target.value)}
                    placeholder="e.g. 09:00 AM - 11:00 PM"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Day Shift Hours"
                    value={formData.businessHours.dayShift}
                    onChange={(e) => handleChange('businessHours', 'dayShift', e.target.value)}
                    placeholder="e.g. 06:00 AM - 04:00 PM"
                  />
                  <Input
                    label="Night Shift Hours"
                    value={formData.businessHours.nightShift}
                    onChange={(e) => handleChange('businessHours', 'nightShift', e.target.value)}
                    placeholder="e.g. 04:00 PM - 02:00 AM"
                  />
                </div>
                <div className="flex flex-col gap-2 border-t border-zinc-100 dark:border-zinc-900 pt-4 text-left">
                  <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Configure Weekend Days</label>
                  <div className="flex flex-wrap gap-4 mt-2">
                    {[
                      { id: 0, label: 'Sunday' },
                      { id: 1, label: 'Monday' },
                      { id: 2, label: 'Tuesday' },
                      { id: 3, label: 'Wednesday' },
                      { id: 4, label: 'Thursday' },
                      { id: 5, label: 'Friday' },
                      { id: 6, label: 'Saturday' },
                    ].map((d) => {
                      const isChecked = formData.weekendDays.includes(d.id);
                      return (
                        <label key={d.id} className="flex items-center gap-2 text-sm font-semibold text-zinc-700 dark:text-zinc-350 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              const updated = e.target.checked
                                ? [...formData.weekendDays, d.id]
                                : formData.weekendDays.filter((val) => val !== d.id);
                              handleChange(null, 'weekendDays', updated);
                            }}
                            className="rounded border-zinc-350 text-purple-650 focus:ring-purple-650 w-4 h-4 cursor-pointer"
                          />
                          {d.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Pricing */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Pricing Shifts</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure pricing rates (৳) for different day categories and shifts.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Weekday Day Rate"
                    type="number"
                    value={formData.pricing.weekdayDay}
                    onChange={(e) => handleChange('pricing', 'weekdayDay', Number(e.target.value))}
                  />
                  <Input
                    label="Weekday Night Rate"
                    type="number"
                    value={formData.pricing.weekdayNight}
                    onChange={(e) => handleChange('pricing', 'weekdayNight', Number(e.target.value))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Weekend Day Rate"
                    type="number"
                    value={formData.pricing.weekendDay}
                    onChange={(e) => handleChange('pricing', 'weekendDay', Number(e.target.value))}
                  />
                  <Input
                    label="Weekend Night Rate"
                    type="number"
                    value={formData.pricing.weekendNight}
                    onChange={(e) => handleChange('pricing', 'weekendNight', Number(e.target.value))}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Holiday Day Rate"
                    type="number"
                    value={formData.pricing.holidayDay}
                    onChange={(e) => handleChange('pricing', 'holidayDay', Number(e.target.value))}
                  />
                  <Input
                    label="Holiday Night Rate"
                    type="number"
                    value={formData.pricing.holidayNight}
                    onChange={(e) => handleChange('pricing', 'holidayNight', Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Online Discounts & Special Offers */}
        {activeTab === 'discounts' && (
          <div className="space-y-6 animate-fade-in">
            {/* Discount Rules Creator Card */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-900 pb-4">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    🏷️ Online Automatic Discounts & Offers
                  </h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Configure date-range or single-day promotional discounts. When customers book slots within these dates online, the discount will be automatically applied at checkout!
                  </p>
                </div>
              </div>

              {/* Add Discount Rule Form */}
              <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/10 space-y-4">
                <h4 className="text-xs font-bold text-purple-700 dark:text-purple-300 uppercase tracking-wider">
                  + Create New Promotional Discount Rule
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                      Offer Title / Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Summer Promo 10% Off"
                      value={discName}
                      onChange={(e) => setDiscName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-650"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                      Discount Type
                    </label>
                    <select
                      value={discType}
                      onChange={(e) => setDiscType(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-650"
                    >
                      <option value="percentage">Percentage (%)</option>
                      <option value="fixed">Fixed Amount (৳ BDT)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                      Discount Value
                    </label>
                    <input
                      type="number"
                      placeholder={discType === 'percentage' ? 'e.g. 10 for 10%' : 'e.g. 300 for ৳300'}
                      value={discValue}
                      onChange={(e) => setDiscValue(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-650"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={discStart}
                      onChange={(e) => setDiscStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-650"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider block">
                      End Date
                    </label>
                    <input
                      type="date"
                      value={discEnd}
                      onChange={(e) => setDiscEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-purple-650"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <Button
                    type="button"
                    onClick={handleAddDiscountRule}
                    className="font-bold text-xs py-2 px-5 bg-gradient-to-r from-purple-650 to-indigo-650 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-purple-500/20"
                  >
                    + Add Discount Rule
                  </Button>
                </div>
              </div>

              {/* Active Discount Rules Table */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase text-zinc-700 dark:text-zinc-300 tracking-wider">
                    📋 Active & Configured Online Discounts
                  </h4>
                  <span className="text-[10px] font-bold text-zinc-450">
                    {formData.discounts?.length || 0} Rule(s) Configured
                  </span>
                </div>

                {formData.discounts && formData.discounts.length > 0 ? (
                  <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-500">
                          <th className="py-3 px-4">Offer Name</th>
                          <th className="py-3 px-4">Discount Type & Value</th>
                          <th className="py-3 px-4">Valid Date Range</th>
                          <th className="py-3 px-4">Status</th>
                          <th className="py-3 px-4 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80 font-medium">
                        {formData.discounts.map((rule) => (
                          <tr key={rule.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                            <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                              {rule.name}
                            </td>
                            <td className="py-3 px-4">
                              <span className="font-mono font-extrabold text-purple-650 dark:text-purple-400">
                                {rule.type === 'percentage' ? `${rule.value}% OFF` : `৳${rule.value} Flat OFF`}
                              </span>
                            </td>
                            <td className="py-3 px-4 font-mono text-zinc-600 dark:text-zinc-300">
                              {formatDateDMY(rule.startDate)} &rarr; {formatDateDMY(rule.endDate)}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleDiscount(rule.id)}
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase transition-all ${
                                  rule.isActive
                                    ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 hover:bg-emerald-500/20'
                                    : 'bg-zinc-500/10 text-zinc-450 border border-zinc-500/30 hover:bg-zinc-500/20'
                                }`}
                              >
                                {rule.isActive ? 'Active ⚡' : 'Inactive ⏸️'}
                              </button>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <button
                                type="button"
                                onClick={() => handleDeleteDiscount(rule.id)}
                                className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 font-bold transition-all text-xs"
                                title="Delete Rule"
                              >
                                🗑️ Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-dashed border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-450 font-semibold">
                    No discount rules added yet. Create a rule above to automatically apply discounts on specific dates during customer checkout!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: Court Management & Rules */}
        {activeTab === 'court' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Available Sports */}
              <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Active Sports</h3>
                  <p className="text-xs text-zinc-400 mt-1">Configure available sports disciplines.</p>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Futsal"
                      value={newSport}
                      onChange={(e) => setNewSport(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-purple-655"
                    />
                    <Button onClick={handleAddSport} className="p-2.5 font-bold">Add</Button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {settings.availableSports?.map((sport) => (
                      <div key={sport} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm">
                        <span className="font-semibold text-zinc-850 dark:text-zinc-200">{sport}</span>
                        <button onClick={() => handleDeleteSport(sport)} className="text-zinc-400 hover:text-red-500 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Holidays */}
              <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Holidays</h3>
                  <p className="text-xs text-zinc-400 mt-1">Block court (Holiday rate apply).</p>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4 text-xs font-bold border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setHolidayMode('single')}
                      className={`pb-1 border-b-2 transition-all cursor-pointer ${
                        holidayMode === 'single'
                          ? 'border-purple-650 text-purple-650'
                          : 'border-transparent text-zinc-400 hover:text-zinc-650'
                      }`}
                    >
                      Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setHolidayMode('range')}
                      className={`pb-1 border-b-2 transition-all cursor-pointer ${
                        holidayMode === 'range'
                          ? 'border-purple-650 text-purple-650'
                          : 'border-transparent text-zinc-400 hover:text-zinc-650'
                      }`}
                    >
                      Date Range
                    </button>
                  </div>

                  {holidayMode === 'single' ? (
                    <div className="flex gap-2 items-end w-full">
                      <DatePicker
                        value={newHoliday}
                        onChange={setNewHoliday}
                        className="flex-1"
                      />
                      <Button onClick={handleAddHoliday} className="p-2.5 font-bold h-10 shrink-0">Add</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 text-[10px] text-zinc-450">
                          <span>Start Date</span>
                          <DatePicker
                            value={holidayStart}
                            onChange={setHolidayStart}
                            className="w-full"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-zinc-450">
                          <span>End Date</span>
                          <DatePicker
                            value={holidayEnd}
                            onChange={setHolidayEnd}
                            className="w-full"
                            align="right"
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddHoliday} className="w-full py-2 font-bold">Add Range</Button>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {settings.holidays?.map((date) => (
                      <div key={date} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm">
                        <span className="font-semibold text-zinc-855 dark:text-zinc-200">{formatDateDMY(date)}</span>
                        <button onClick={() => handleDeleteHoliday(date)} className="text-zinc-400 hover:text-red-500 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Maintenance */}
              <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Maintenance Days</h3>
                  <p className="text-xs text-zinc-400 mt-1">Block court completely (Zero slots).</p>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-4 text-xs font-bold border-b border-zinc-100 dark:border-zinc-800 pb-2">
                    <button
                      type="button"
                      onClick={() => setMaintenanceMode('single')}
                      className={`pb-1 border-b-2 transition-all cursor-pointer ${
                        maintenanceMode === 'single'
                          ? 'border-purple-650 text-purple-650'
                          : 'border-transparent text-zinc-400 hover:text-zinc-655'
                      }`}
                    >
                      Single Day
                    </button>
                    <button
                      type="button"
                      onClick={() => setMaintenanceMode('range')}
                      className={`pb-1 border-b-2 transition-all cursor-pointer ${
                        maintenanceMode === 'range'
                          ? 'border-purple-650 text-purple-650'
                          : 'border-transparent text-zinc-400 hover:text-zinc-655'
                      }`}
                    >
                      Date Range
                    </button>
                  </div>

                  {maintenanceMode === 'single' ? (
                    <div className="flex gap-2 items-end w-full">
                      <DatePicker
                        value={newMaintenance}
                        onChange={setNewMaintenance}
                        className="flex-1"
                      />
                      <Button onClick={handleAddMaintenance} className="p-2.5 font-bold h-10 shrink-0">Add</Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="flex flex-col gap-1 text-[10px] text-zinc-450">
                          <span>Start Date</span>
                          <DatePicker
                            value={maintenanceStart}
                            onChange={setMaintenanceStart}
                            className="w-full"
                          />
                        </div>
                        <div className="flex flex-col gap-1 text-[10px] text-zinc-450">
                          <span>End Date</span>
                          <DatePicker
                            value={maintenanceEnd}
                            onChange={setMaintenanceEnd}
                            className="w-full"
                            align="right"
                          />
                        </div>
                      </div>
                      <Button onClick={handleAddMaintenance} className="w-full py-2 font-bold">Add Range</Button>
                    </div>
                  )}

                  <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
                    {settings.maintenanceDays?.map((date) => (
                      <div key={date} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm">
                        <span className="font-semibold text-zinc-855 dark:text-zinc-200">{formatDateDMY(date)}</span>
                        <button onClick={() => handleDeleteMaintenance(date)} className="text-zinc-400 hover:text-red-500 cursor-pointer">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

              {/* Rules & Regulations */}
              <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
                <div>
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white">Rules & Regulations</h3>
                  <p className="text-xs text-zinc-400 mt-1">Manage court rules shown to users after booking.</p>
                </div>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Add a new rule..."
                      value={newRule}
                      onChange={(e) => setNewRule(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-purple-655"
                    />
                    <Button
                      onClick={() => {
                        if (!newRule.trim()) return;
                        setFormData(prev => ({ ...prev, rules: [...(prev.rules || []), newRule.trim()] }));
                        setNewRule('');
                      }}
                      className="p-2.5 font-bold"
                    >
                      Add
                    </Button>
                  </div>
                  <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar">
                    {(formData?.rules || []).map((rule, idx) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm">
                        <span className="text-xs font-bold text-zinc-450 dark:text-zinc-500 w-5">{idx + 1}</span>
                        <input
                          type="text"
                          value={rule}
                          onChange={(e) => {
                            const updatedRules = [...formData.rules];
                            updatedRules[idx] = e.target.value;
                            setFormData(prev => ({ ...prev, rules: updatedRules }));
                          }}
                          className="flex-1 bg-transparent border-0 focus:ring-0 text-zinc-800 dark:text-zinc-250 text-xs p-0 focus:outline-none"
                        />
                        <button
                          onClick={() => {
                            const updatedRules = formData.rules.filter((_, i) => i !== idx);
                            setFormData(prev => ({ ...prev, rules: updatedRules }));
                          }}
                          className="text-zinc-400 hover:text-red-500 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: SEO, Socials & Integrations */}
        {activeTab === 'integrations' && (
          <div className="space-y-6 animate-fade-in">
            {/* Map & SEO */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Map & SEO Settings</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure search visibility and embed maps.</p>
              </div>
              <div className="space-y-4">
                <Input
                  label="Google Map Embedded Link URL"
                  value={formData.googleMapUrl}
                  onChange={(e) => handleChange(null, 'googleMapUrl', e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Meta Page Title"
                    value={formData.seo.title}
                    onChange={(e) => handleChange('seo', 'title', e.target.value)}
                  />
                  <Input
                    label="Meta Keywords"
                    value={formData.seo.keywords}
                    onChange={(e) => handleChange('seo', 'keywords', e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-left border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Meta Page Description</label>
                  <textarea
                    value={formData.seo.description}
                    onChange={(e) => handleChange('seo', 'description', e.target.value)}
                    className="flex min-h-[80px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-450 focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200"
                    rows={3}
                  />
                </div>
              </div>
            </div>

            {/* Social Links */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Social Media Links</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure external footer social link channels.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Facebook Page URL"
                    value={formData.socialLinks.facebook}
                    onChange={(e) => handleChange('socialLinks', 'facebook', e.target.value)}
                  />
                  <Input
                    label="Instagram Profile URL"
                    value={formData.socialLinks.instagram}
                    onChange={(e) => handleChange('socialLinks', 'instagram', e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
                  <Input
                    label="Twitter Account URL"
                    value={formData.socialLinks.twitter}
                    onChange={(e) => handleChange('socialLinks', 'twitter', e.target.value)}
                  />
                  <Input
                    label="WhatsApp Chat Link"
                    value={formData.socialLinks.whatsapp}
                    onChange={(e) => handleChange('socialLinks', 'whatsapp', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: Payment System & Gateways */}
        {activeTab === 'payment' && (
          <div className="space-y-6 animate-fade-in">
            {settings?.allowPaymentGateway === false ? (
              <div className="glass-card p-8 md:p-12 rounded-[2.5rem] border border-purple-500/30 bg-gradient-to-br from-purple-950/20 via-zinc-900/40 to-indigo-950/20 shadow-2xl space-y-6 text-center">
                <div className="w-16 h-16 rounded-2xl bg-purple-600/20 border border-purple-500/40 flex items-center justify-center mx-auto text-purple-400">
                  <CreditCard className="w-8 h-8 animate-pulse" />
                </div>

                <div className="max-w-xl mx-auto space-y-3">
                  <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-black uppercase tracking-widest bg-purple-500/20 text-purple-300 border border-purple-400/30">
                    ⚡ Future Upgrade
                  </span>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                    Automated Online Payment Gateway Integration
                  </h3>
                  <p className="text-sm text-zinc-300 leading-relaxed font-medium">
                    Automated online payment gateway processing (bKash Merchant Pay, Nagad API, SSLCommerz, Visa & Mastercard) is scheduled for a future system update.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 text-left max-w-lg mx-auto space-y-3">
                  <div className="font-bold text-xs text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> Next-Gen Gateway Capabilities Coming in Future Upgrade:
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-zinc-300 font-medium">
                    <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-purple-400 shrink-0" /> bKash & Nagad Merchant Pay</li>
                    <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-purple-400 shrink-0" /> Instant TrxID Verification</li>
                    <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-purple-400 shrink-0" /> Auto-Settlement & Advance Lock</li>
                    <li className="flex items-center gap-1.5"><Check className="w-4 h-4 text-purple-400 shrink-0" /> Instant Digital Receipts</li>
                  </ul>
                </div>
              </div>
            ) : null}

            {settings?.allowPaymentGateway !== false && (
              <div className="glass-card p-6 rounded-3xl shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-extrabold text-zinc-900 dark:text-white flex items-center gap-2">
                        💳 Online Payment System Master Switch
                      </h3>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                        🔒 Future Upgrade
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Toggle online payment collection for customer court bookings. This feature is coming in a future upgrade.
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-not-allowed opacity-60 shrink-0" title="Future Upgrade">
                    <input
                      type="checkbox"
                      disabled={true}
                      checked={false}
                      onChange={() => {}}
                      className="sr-only peer"
                    />
                    <div className="w-14 h-7 bg-zinc-200 peer-focus:outline-none rounded-full peer dark:bg-zinc-800 after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all dark:after:border-zinc-600"></div>
                  </label>
                </div>

                <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-xs font-semibold text-purple-700 dark:text-purple-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>
                    ⚡ <strong>Future Upgrade:</strong> Automated bKash Merchant Pay, Nagad API & SSLCommerz online payment gateways are scheduled for a future update.
                  </span>
                </div>

                {formData?.paymentConfig?.enabled ? (
                <div className="space-y-6">
                  {/* Payment Type: Full vs Partial */}
                  <div className="p-4 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-4">
                    <h4 className="text-xs font-black uppercase text-purple-650 dark:text-purple-400 tracking-wider">
                      💰 Payment Collection Mode
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <label
                        onClick={() => updatePaymentConfig(c => ({ ...c, type: 'full' }))}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          formData?.paymentConfig?.type === 'full'
                            ? 'bg-purple-650 text-white border-purple-650 shadow-md'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          checked={formData?.paymentConfig?.type === 'full'}
                          onChange={() => {}}
                          className="mt-1 accent-white"
                        />
                        <div>
                          <span className="text-sm font-extrabold block">Full Payment (100%)</span>
                          <span className={`text-xs block mt-1 ${formData?.paymentConfig?.type === 'full' ? 'text-purple-100' : 'text-zinc-500'}`}>
                            Collect 100% full booking price online before slot confirmation.
                          </span>
                        </div>
                      </label>

                      <label
                        onClick={() => updatePaymentConfig(c => ({ ...c, type: 'partial' }))}
                        className={`p-4 rounded-2xl border cursor-pointer transition-all flex items-start gap-3 ${
                          formData?.paymentConfig?.type === 'partial'
                            ? 'bg-purple-650 text-white border-purple-650 shadow-md'
                            : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white hover:border-purple-300'
                        }`}
                      >
                        <input
                          type="radio"
                          name="paymentType"
                          checked={formData?.paymentConfig?.type === 'partial'}
                          onChange={() => {}}
                          className="mt-1 accent-white"
                        />
                        <div>
                          <span className="text-sm font-extrabold block">Partial / Advance Deposit</span>
                          <span className={`text-xs block mt-1 ${formData?.paymentConfig?.type === 'partial' ? 'text-purple-100' : 'text-zinc-500'}`}>
                            Require partial deposit online; customer pays remaining balance at venue.
                          </span>
                        </div>
                      </label>
                    </div>

                    {formData?.paymentConfig?.type === 'partial' && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-purple-500/10">
                        <Select
                          label="Advance Deposit Method"
                          value={formData?.paymentConfig?.partialType || 'percentage'}
                          onChange={(e) => updatePaymentConfig(c => ({ ...c, partialType: e.target.value }))}
                          options={[
                            { value: 'percentage', label: 'Percentage (%) of Total Price' },
                            { value: 'fixed', label: 'Fixed Amount (৳) Deposit' },
                          ]}
                        />
                        {formData?.paymentConfig?.partialType === 'percentage' ? (
                          <Input
                            label="Advance Percentage (%)"
                            type="number"
                            value={formData?.paymentConfig?.partialPercentage || 50}
                            onChange={(e) => updatePaymentConfig(c => ({ ...c, partialPercentage: Number(e.target.value) }))}
                            placeholder="50"
                          />
                        ) : (
                          <Input
                            label="Fixed Advance Amount (৳)"
                            type="number"
                            value={formData?.paymentConfig?.partialFixedAmount || 500}
                            onChange={(e) => updatePaymentConfig(c => ({ ...c, partialFixedAmount: Number(e.target.value) }))}
                            placeholder="500"
                          />
                        )}
                      </div>
                    )}
                  </div>

                  {/* bKash Merchant Gateway Settings */}
                  <div className="p-5 rounded-2xl bg-pink-500/5 dark:bg-pink-950/20 border border-pink-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-pink-600 dark:text-pink-400 tracking-wider flex items-center gap-2">
                        🌸 bKash Merchant Payment Gateway & API Credentials
                      </h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData?.paymentConfig?.gateways?.bkash?.enabled ?? true}
                          onChange={(e) => updatePaymentConfig(c => ({
                            ...c,
                            gateways: {
                              ...(c.gateways || {}),
                              bkash: { ...(c.gateways?.bkash || {}), enabled: e.target.checked },
                            },
                          }))}
                          className="w-4 h-4 accent-pink-600 rounded"
                        />
                        <span className="text-xs font-bold text-pink-600 dark:text-pink-400">Enable bKash Gateway</span>
                      </label>
                    </div>

                    {formData?.paymentConfig?.gateways?.bkash?.enabled !== false && (
                      <div className="space-y-4 pt-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <Input
                            label="bKash Merchant Receiver Phone Number"
                            placeholder="e.g. 01712345678"
                            value={formData?.paymentConfig?.gateways?.bkash?.merchantNumber || ''}
                            onChange={(e) => updatePaymentConfig(c => ({
                              ...c,
                              gateways: {
                                ...(c.gateways || {}),
                                bkash: { ...(c.gateways?.bkash || {}), merchantNumber: e.target.value },
                              },
                            }))}
                          />
                          <div className="flex flex-col justify-end pb-1 text-xs text-pink-700 dark:text-pink-300 font-bold">
                            🌸 bKash Tokenized Merchant Payment Gateway (Official API Redirect)
                          </div>
                        </div>

                        {/* bKash Merchant API Credentials */}
                        <div className="p-4 rounded-xl bg-pink-500/10 border border-pink-500/20 space-y-3">
                          <h5 className="text-xs font-black uppercase text-pink-700 dark:text-pink-300">
                            🔐 bKash Merchant API Integration Credentials
                          </h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Input
                              label="bKash App Key"
                              placeholder="App Key from bKash Developer Portal"
                              value={formData?.paymentConfig?.gateways?.bkash?.appKey || ''}
                              onChange={(e) => updatePaymentConfig(c => ({
                                ...c,
                                gateways: {
                                  ...(c.gateways || {}),
                                  bkash: { ...(c.gateways?.bkash || {}), appKey: e.target.value },
                                },
                              }))}
                            />
                            <Input
                              label="bKash App Secret"
                              type="password"
                              placeholder="App Secret Secret"
                              value={formData?.paymentConfig?.gateways?.bkash?.appSecret || ''}
                              onChange={(e) => updatePaymentConfig(c => ({
                                ...c,
                                gateways: {
                                  ...(c.gateways || {}),
                                  bkash: { ...(c.gateways?.bkash || {}), appSecret: e.target.value },
                                },
                              }))}
                            />
                            <Input
                              label="bKash API Username"
                              placeholder="API Username"
                              value={formData?.paymentConfig?.gateways?.bkash?.username || ''}
                              onChange={(e) => updatePaymentConfig(c => ({
                                ...c,
                                gateways: {
                                  ...(c.gateways || {}),
                                  bkash: { ...(c.gateways?.bkash || {}), username: e.target.value },
                                },
                              }))}
                            />
                            <Input
                              label="bKash API Password"
                              type="password"
                              placeholder="API Password"
                              value={formData?.paymentConfig?.gateways?.bkash?.password || ''}
                              onChange={(e) => updatePaymentConfig(c => ({
                                ...c,
                                gateways: {
                                  ...(c.gateways || {}),
                                  bkash: { ...(c.gateways?.bkash || {}), password: e.target.value },
                                },
                              }))}
                            />
                          </div>
                          <div className="flex items-center gap-3 pt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={formData?.paymentConfig?.gateways?.bkash?.isLive || false}
                                onChange={(e) => updatePaymentConfig(c => ({
                                  ...c,
                                  gateways: {
                                    ...(c.gateways || {}),
                                    bkash: { ...(c.gateways?.bkash || {}), isLive: e.target.checked },
                                  },
                                }))}
                                className="w-4 h-4 accent-pink-600 rounded"
                              />
                              <span className="text-xs font-bold text-pink-900 dark:text-pink-200">Live Production Mode (Uncheck for Sandbox Test Mode)</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* SSLCommerz Payment Gateway Settings */}
                  <div className="p-5 rounded-2xl bg-cyan-500/5 dark:bg-cyan-950/20 border border-cyan-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-cyan-600 dark:text-cyan-400 tracking-wider flex items-center gap-2">
                        🔒 SSLCommerz Online Checkout (Cards / Net Banking / MFS)
                      </h4>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData?.paymentConfig?.gateways?.sslcommerz?.enabled ?? true}
                          onChange={(e) => updatePaymentConfig(c => ({
                            ...c,
                            gateways: {
                              ...(c.gateways || {}),
                              sslcommerz: { ...(c.gateways?.sslcommerz || {}), enabled: e.target.checked },
                            },
                          }))}
                          className="w-4 h-4 accent-cyan-600 rounded"
                        />
                        <span className="text-xs font-bold text-cyan-600 dark:text-cyan-400">Enable SSLCommerz</span>
                      </label>
                    </div>

                    {formData?.paymentConfig?.gateways?.sslcommerz?.enabled !== false && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                        <Input
                          label="SSLCommerz Store ID"
                          placeholder="e.g. indoor_arena_live"
                          value={formData?.paymentConfig?.gateways?.sslcommerz?.storeId || ''}
                          onChange={(e) => updatePaymentConfig(c => ({
                            ...c,
                            gateways: {
                              ...(c.gateways || {}),
                              sslcommerz: { ...(c.gateways?.sslcommerz || {}), storeId: e.target.value },
                            },
                          }))}
                        />
                        <Input
                          label="SSLCommerz Store Password"
                          type="password"
                          placeholder="Store Secret Password"
                          value={formData?.paymentConfig?.gateways?.sslcommerz?.storePassword || ''}
                          onChange={(e) => updatePaymentConfig(c => ({
                            ...c,
                            gateways: {
                              ...(c.gateways || {}),
                              sslcommerz: { ...(c.gateways?.sslcommerz || {}), storePassword: e.target.value },
                            },
                          }))}
                        />
                        <div className="col-span-1 sm:col-span-2 flex items-center gap-3 pt-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData?.paymentConfig?.gateways?.sslcommerz?.isLive || false}
                              onChange={(e) => updatePaymentConfig(c => ({
                                ...c,
                                gateways: {
                                  ...(c.gateways || {}),
                                  sslcommerz: { ...(c.gateways?.sslcommerz || {}), isLive: e.target.checked },
                                },
                              }))}
                              className="w-4 h-4 accent-cyan-600 rounded"
                            />
                            <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">Live Production Mode (Uncheck for Sandbox Test Mode)</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
            )}

            {/* Printable Invoice & Signature Customization */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-6">
              <div className="p-5 rounded-2xl bg-purple-500/5 dark:bg-purple-950/20 border border-purple-500/20 space-y-4">
                <h4 className="text-xs font-black uppercase text-purple-650 dark:text-purple-400 tracking-wider flex items-center gap-2">
                  📜 Printable Tax Invoice & Authorized Signature Settings
                </h4>

                    <div className="space-y-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300">
                          Invoice Footer Terms & Rules (Shown at bottom of printed receipt)
                        </label>
                        <textarea
                          rows={3}
                          className="w-full px-3 py-2 text-xs font-medium rounded-xl border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-purple-650"
                          placeholder="e.g. 1. Please present invoice at check-in&#10;2. Proper sports shoes required&#10;3. Non-refundable"
                          value={formData?.paymentConfig?.invoiceTerms ?? '1. Please present this invoice at venue check-in.\n2. Proper sports gear and non-marking shoes required.\n3. Non-refundable unless cancelled 24 hours prior.'}
                          onChange={(e) => updatePaymentConfig(c => ({ ...c, invoiceTerms: e.target.value }))}
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <Input
                          label="Authorized Signatory Name"
                          placeholder="e.g. ADIL HUSSAIN"
                          value={formData?.paymentConfig?.authorizedSignatoryName ?? 'Authorized Signature'}
                          onChange={(e) => updatePaymentConfig(c => ({ ...c, authorizedSignatoryName: e.target.value }))}
                        />
                        <Input
                          label="Signatory Title / Designation"
                          placeholder="e.g. Venue Manager / Managing Director"
                          value={formData?.paymentConfig?.authorizedSignatoryTitle ?? 'Authorized Signatory'}
                          onChange={(e) => updatePaymentConfig(c => ({ ...c, authorizedSignatoryTitle: e.target.value }))}
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-extrabold text-zinc-700 dark:text-zinc-300 block">
                          Authorized Signature PNG Image (Upload File or Enter Image URL)
                        </label>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                          <label className="px-4 py-2.5 rounded-xl bg-purple-650 hover:bg-purple-750 text-white font-bold text-xs shadow-md cursor-pointer flex items-center gap-2 transition-all">
                            <span>📁 Upload Signature PNG File</span>
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/webp, image/svg+xml"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  const reader = new FileReader();
                                  reader.onload = (evt) => {
                                    const result = evt.target?.result;
                                    if (result) {
                                      updatePaymentConfig(c => ({ ...c, authorizedSignatureImage: result }));
                                      toast.success('Signature PNG uploaded successfully!');
                                    }
                                  };
                                  reader.readAsDataURL(file);
                                }
                              }}
                            />
                          </label>
                          <span className="text-xs text-zinc-450 font-medium">or paste image URL below</span>
                        </div>

                        <Input
                          placeholder="https://example.com/signature.png or data:image/png;base64,..."
                          value={formData?.paymentConfig?.authorizedSignatureImage || ''}
                          onChange={(e) => updatePaymentConfig(c => ({ ...c, authorizedSignatureImage: e.target.value }))}
                        />

                        {/* Signature Preview */}
                        {formData?.paymentConfig?.authorizedSignatureImage && (
                          <div className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-4 mt-2">
                            <div className="flex items-center gap-3">
                              <span className="text-xs font-bold text-zinc-500">Preview:</span>
                              <img
                                src={formData.paymentConfig.authorizedSignatureImage}
                                alt="Signature Preview"
                                className="h-10 object-contain bg-zinc-100 dark:bg-zinc-950 p-1 rounded-lg border border-zinc-250 dark:border-zinc-800"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => updatePaymentConfig(c => ({ ...c, authorizedSignatureImage: '' }))}
                              className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                            >
                              ✕ Remove Signature
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
            </div>

            {/* Custom Payment Methods Manager */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-6">
              {(() => {
                const defaultMethods = ['Cash', 'bKash Personal / Manual', 'POS / Card', 'Bank Transfer', 'Pay After Match'];
                const currentMethods = formData?.paymentConfig?.customPaymentMethods || defaultMethods;

                const handleAddMethod = () => {
                  if (!newPaymentMethod.trim()) return;
                  const updated = [...currentMethods, newPaymentMethod.trim()];
                  updatePaymentConfig(c => ({ ...c, customPaymentMethods: updated }));
                  setNewPaymentMethod('');
                  toast.success(`Payment option "${newPaymentMethod.trim()}" added!`);
                };

                const handleRemoveMethod = (indexToRemove) => {
                  const updated = currentMethods.filter((_, idx) => idx !== indexToRemove);
                  updatePaymentConfig(c => ({ ...c, customPaymentMethods: updated }));
                  toast.info('Payment option removed.');
                };

                const handleSaveEditMethod = (indexToEdit) => {
                  if (!editingPaymentText.trim()) return;
                  const updated = [...currentMethods];
                  updated[indexToEdit] = editingPaymentText.trim();
                  updatePaymentConfig(c => ({ ...c, customPaymentMethods: updated }));
                  setEditingPaymentIndex(null);
                  setEditingPaymentText('');
                  toast.success('Payment option updated!');
                };

                return (
                  <div className="p-5 rounded-2xl bg-indigo-500/5 dark:bg-indigo-950/20 border border-indigo-500/20 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black uppercase text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-2">
                        💳 Manual & Offline Payment Options (Add, Edit, Remove)
                      </h4>
                    </div>

                    <p className="text-xs text-zinc-500">
                      Configure the payment methods available in the Admin manual booking portal (e.g. Cash, bKash Personal, POS/Card, Bank Transfer, Pay After Match).
                    </p>

                    {/* List of Methods */}
                    <div className="space-y-2">
                      {currentMethods.map((method, idx) => (
                        <div key={idx} className="p-3 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs">
                          {editingPaymentIndex === idx ? (
                            <div className="flex items-center gap-2 flex-1">
                              <input
                                type="text"
                                className="flex-1 px-3 py-1.5 rounded-lg border border-indigo-500 bg-transparent text-xs font-bold text-zinc-900 dark:text-white"
                                value={editingPaymentText}
                                onChange={(e) => setEditingPaymentText(e.target.value)}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveEditMethod(idx)}
                                className="px-3 py-1 rounded-lg bg-indigo-650 text-white font-bold text-xs"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingPaymentIndex(null)}
                                className="px-2 py-1 text-zinc-400 font-semibold"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="font-extrabold text-zinc-800 dark:text-zinc-200 flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                                {method}
                              </span>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingPaymentIndex(idx);
                                    setEditingPaymentText(method);
                                  }}
                                  className="text-xs font-bold text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-950/40 cursor-pointer"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveMethod(idx)}
                                  className="text-xs font-bold text-rose-500 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer"
                                >
                                  🗑️ Remove
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Add New Method Input */}
                    <div className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Add new payment method (e.g. Nagad, Cheque)..."
                        className="flex-1 px-3.5 py-2 text-xs font-semibold rounded-xl border border-zinc-250 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                        value={newPaymentMethod}
                        onChange={(e) => setNewPaymentMethod(e.target.value)}
                      />
                      <Button
                        type="button"
                        onClick={handleAddMethod}
                        className="font-bold text-xs py-2 px-4 bg-indigo-650 hover:bg-indigo-700 text-white"
                      >
                        + Add Payment Option
                      </Button>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab 6: Subscription & Licensing Information */}
        {activeTab === 'subscription' && (() => {
          const sub = settings?.subscriptionStatus;
          return (
            <div className="space-y-6 animate-fade-in">
              {/* Primary Subscription Status Card */}
              <div className="glass-card p-6 rounded-3xl shadow-sm space-y-6 relative overflow-hidden">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-900 pb-4">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-xl font-black text-zinc-900 dark:text-white">
                        Subscription & License Overview
                      </h3>
                      {sub?.isGracePeriod ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500 text-white animate-pulse">
                          In 7-Day Grace Period
                        </span>
                      ) : sub?.isExpired ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-500 border border-rose-500/20">
                          Expired
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          Active License
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 font-medium">
                      Client SaaS multi-tenant software instance details, expiry deadlines, and module capabilities.
                    </p>
                  </div>

                  <a
                    href="https://daruntech.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-black text-xs bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-md shadow-purple-500/20 transition-all cursor-pointer shrink-0"
                  >
                    Contact Darun Tech Private Limited
                  </a>
                </div>

                {/* Data Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                      Active Subscription Package
                    </span>
                    <span className="text-base font-extrabold text-purple-650 dark:text-purple-400">
                      {sub?.planName || '1 Month Subscription Plan'}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-bold uppercase tracking-wider">
                      Tier: {sub?.tier || 'Pro SaaS'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                      Package Price & Billing
                    </span>
                    <span className="text-base font-extrabold text-zinc-900 dark:text-white">
                      ৳{sub?.price !== undefined ? Number(sub.price).toLocaleString() : '0'}
                    </span>
                    <span className={`text-[10px] block mt-0.5 font-extrabold uppercase tracking-wider ${sub?.paymentStatus === 'paid' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      Payment Status: {sub?.paymentStatus || 'Paid'}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                      Subscription Expiry Deadline
                    </span>
                    <span className="text-base font-extrabold text-zinc-900 dark:text-white font-mono">
                      {sub?.expiresAt ? formatDateDMY(sub.expiresAt) : 'Lifetime / No Expiry'}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-bold uppercase tracking-wider">
                      Set by Super Admin
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800">
                    <span className="text-[10px] font-bold text-zinc-450 dark:text-zinc-500 uppercase tracking-wider block mb-1">
                      Current Operational Status
                    </span>
                    <span className="text-base font-extrabold text-zinc-900 dark:text-white">
                      {sub?.isGracePeriod ? (
                        <span className="text-rose-500 font-black flex items-center gap-1">
                          ⚠️ Grace ({sub.graceDaysRemaining}d left)
                        </span>
                      ) : sub?.expiresAt ? (
                        sub.isExpired ? (
                          <span className="text-rose-500">Expired</span>
                        ) : (
                          <span className="text-emerald-500">{sub.daysUntilExpiry} Day(s) Left</span>
                        )
                      ) : (
                        <span className="text-emerald-500">Active</span>
                      )}
                    </span>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 block mt-0.5 font-bold uppercase tracking-wider">
                      Live License Status
                    </span>
                  </div>
                </div>

                {/* Module Capabilities */}
                <div className="border-t border-zinc-100 dark:border-zinc-900 pt-5 space-y-3">
                  <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                    Unlocked System Modules & Capabilities
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {[
                      { label: 'Multi-Ground / Arena Engine', desc: 'Unlimited custom playing courts with position reordering' },
                      { label: 'Realtime Socket.IO Engine', desc: 'Live booking collision prevention & instant updates' },
                      { label: 'Bangladesh SMS Gateway', desc: 'SSLWireless / OTP passwordless customer login' },
                      { label: 'Shift-Based Pricing Grid', desc: '6-tier Day & Night rates for weekends/holidays' },
                      { label: 'Audit Logging & Security', desc: 'Paranoid soft-delete & XSS security guard' },
                      { label: 'Dedicated DB Isolation', desc: 'Separate MySQL database per client tenant' },
                    ].map((feat, idx) => (
                      <div key={idx} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-100 dark:border-zinc-800/80 flex items-start gap-3">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 mt-1 shrink-0 shadow-sm shadow-emerald-500/50" />
                        <div>
                          <span className="text-xs font-extrabold text-zinc-900 dark:text-white block">{feat.label}</span>
                          <span className="text-[10px] text-zinc-450 dark:text-zinc-500 block mt-0.5 font-medium">{feat.desc}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Subscription & Renewal History Section */}
                <div className="border-t border-zinc-100 dark:border-zinc-900 pt-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
                      📜 Subscription Renewal & Billing History
                    </h4>
                    <span className="text-[10px] font-bold text-zinc-400">
                      {settings?.subscriptionHistory?.length || 0} Record(s) Found
                    </span>
                  </div>

                  {settings?.subscriptionHistory && settings.subscriptionHistory.length > 0 ? (
                    <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-zinc-50 dark:bg-zinc-900/60 border-b border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase text-zinc-500 dark:text-zinc-400">
                            <th className="py-2.5 px-3">Date</th>
                            <th className="py-2.5 px-3">Plan / Package</th>
                            <th className="py-2.5 px-3">Amount Paid</th>
                            <th className="py-2.5 px-3">Payment Status</th>
                            <th className="py-2.5 px-3">Expiry Deadline</th>
                            <th className="py-2.5 px-3">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800/60 font-medium">
                          {settings.subscriptionHistory.map((h) => (
                            <tr key={h.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/30">
                              <td className="py-2.5 px-3 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                                {formatDateDMY(h.createdAt)}
                              </td>
                              <td className="py-2.5 px-3 font-extrabold text-purple-650 dark:text-purple-400">
                                {h.planName || h.plan}
                              </td>
                              <td className="py-2.5 px-3 font-bold font-mono text-zinc-900 dark:text-white">
                                ৳{Number(h.amount || 0).toLocaleString()}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase ${
                                  h.paymentStatus === 'paid' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                                }`}>
                                  {h.paymentStatus}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono text-zinc-600 dark:text-zinc-400">
                                {h.expiryDate ? formatDateDMY(h.expiryDate) : 'Lifetime / No Expiry'}
                              </td>
                              <td className="py-2.5 px-3 text-zinc-500 dark:text-zinc-400 text-[11px] truncate max-w-xs">
                                {h.notes || 'Subscription payment'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 font-semibold">
                      Current active plan: <strong className="text-purple-650 dark:text-purple-400">{sub?.planName || 'Pro SaaS'}</strong> (৳{sub?.price || 0}). Additional renewal records will accumulate here upon billing updates.
                    </div>
                  )}
                </div>

                {/* Provider Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-purple-500/10 border border-purple-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div>
                    <h4 className="text-xs font-black uppercase text-purple-650 dark:text-purple-400 tracking-wider">
                      Official Software Provider & License Host
                    </h4>
                    <p className="text-xs text-zinc-650 dark:text-zinc-350 mt-1 font-semibold leading-relaxed">
                      This system is engineered, hosted, and supported by <strong>Darun Tech Private Limited</strong>. Contact Darun Tech to renew, extend, or customize your license.
                    </p>
                  </div>
                  <a
                    href="https://daruntech.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl text-xs font-black bg-white dark:bg-zinc-900 text-purple-650 dark:text-purple-400 border border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950 transition-all shrink-0 shadow-sm"
                  >
                    daruntech.com →
                  </a>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Tab: Staff & Manager Management */}
        {activeTab === 'staff' && <AdminStaffTab />}

        {/* Tab 7: System Audit Logs & Admin Activity History */}
        {activeTab === 'audit_logs' && <AdminAuditLogsTab />}
      </form>
    </div>
  );
};
