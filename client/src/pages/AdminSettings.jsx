import React, { useState } from 'react';
import { useAdminSettings, useUpdateSettings } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { Save, Plus, Trash2, HelpCircle } from 'lucide-react';

export const AdminSettings = () => {
  const toast = useToast();
  const { data: settings, isLoading, refetch } = useAdminSettings();
  const updateSettingsMutation = useUpdateSettings();

  const [newSport, setNewSport] = useState('');
  const [newHoliday, setNewHoliday] = useState('');
  const [newMaintenance, setNewMaintenance] = useState('');

  const [formData, setFormData] = useState(null);
  const [logoFile, setLogoFile] = useState(null);
  const [bannerFile, setBannerFile] = useState(null);

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
        businessHours: {
          weekday: settings.businessHours?.weekday || '08:00 - 22:00',
          weekend: settings.businessHours?.weekend || '09:00 - 23:00',
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

  const handleSave = (e) => {
    e.preventDefault();
    const data = new FormData();
    if (logoFile) {
      data.append('logo', logoFile);
    }
    if (bannerFile) {
      data.append('heroBanner', bannerFile);
    }

    data.append('businessName', formData.businessName);
    data.append('contactEmail', formData.contactEmail);
    data.append('contactPhone', formData.contactPhone);
    data.append('contactAddress', formData.contactAddress);
    data.append('googleMapUrl', formData.googleMapUrl);

    data.append('businessHours', JSON.stringify(formData.businessHours));
    data.append('pricing', JSON.stringify(formData.pricing));
    data.append('seo', JSON.stringify(formData.seo));
    data.append('weekendDays', JSON.stringify(formData.weekendDays));
    data.append('socialLinks', JSON.stringify(formData.socialLinks));
    data.append('hero', JSON.stringify(formData.hero));

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

  const handleAddHoliday = () => {
    if (!newHoliday) return;
    const updatedHolidays = [...(settings.holidays || []), newHoliday];
    updateSettingsMutation.mutate(
      { holidays: updatedHolidays },
      {
        onSuccess: () => {
          toast.success('Holiday blockout date added');
          setNewHoliday('');
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
    if (!newMaintenance) return;
    const updatedMaint = [...(settings.maintenanceDays || []), newMaintenance];
    updateSettingsMutation.mutate(
      { maintenanceDays: updatedMaint },
      {
        onSuccess: () => {
          toast.success('Maintenance date blocked');
          setNewMaintenance('');
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
  };

  if (isLoading || !formData) return <Loader size="large" className="py-20" />;

  return (
    <div className="space-y-8 text-left max-w-5xl mx-auto animate-fade-in">
      <form onSubmit={handleSave} className="space-y-8">
        {/* Core details */}
        <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Court Business Settings</h3>
            <p className="text-xs text-zinc-400 mt-1">Core organization details and hours.</p>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Business Name"
                value={formData.businessName}
                onChange={(e) => handleChange(null, 'businessName', e.target.value)}
              />
              <Input
                label="Contact Email"
                value={formData.contactEmail}
                onChange={(e) => handleChange(null, 'contactEmail', e.target.value)}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
              <Input
                label="Weekday Hours"
                value={formData.businessHours.weekday}
                onChange={(e) => handleChange('businessHours', 'weekday', e.target.value)}
              />
              <Input
                label="Weekend Hours"
                value={formData.businessHours.weekend}
                onChange={(e) => handleChange('businessHours', 'weekend', e.target.value)}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-450 uppercase tracking-wider">Logo Image</label>
                {formData.logo && (
                  <img src={formData.logo} alt="Logo preview" className="w-16 h-16 object-contain rounded-lg border p-1 bg-zinc-50 mb-1" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files[0])}
                  className="text-xs text-zinc-500 w-full cursor-pointer"
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-zinc-655 dark:text-zinc-450 uppercase tracking-wider">Hero Banner Media File (Image or Video)</label>
                {formData.heroBanner && (
                  formData.heroBanner.includes('data:video/') || formData.heroBanner.match(/\.(mp4|webm|ogg|mov)$/i) ? (
                    <video src={formData.heroBanner} className="w-24 h-12 object-cover rounded-lg border bg-zinc-50 mb-1" muted playsInline />
                  ) : (
                    <img src={formData.heroBanner} alt="Banner preview" className="w-24 h-12 object-cover rounded-lg border bg-zinc-50 mb-1" />
                  )
                )}
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={(e) => setBannerFile(e.target.files[0])}
                  className="text-xs text-zinc-500 w-full cursor-pointer"
                />
              </div>
            </div>
            <Input
              label="Google Map Embedded Link URL"
              value={formData.googleMapUrl}
              onChange={(e) => handleChange(null, 'googleMapUrl', e.target.value)}
            />
          </div>
        </div>

        {/* Pricing tier details */}
        <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Pricing Rates Configuration (BDT)</h3>
            <p className="text-xs text-zinc-400 mt-1">Determine hourly rates charged to players dynamically for Day and Night shifts.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Input
              label="Weekday Day Shift Rate (৳)"
              type="number"
              value={formData.pricing.weekdayDay}
              onChange={(e) => handleChange('pricing', 'weekdayDay', Number(e.target.value))}
            />
            <Input
              label="Weekday Night Shift Rate (৳)"
              type="number"
              value={formData.pricing.weekdayNight}
              onChange={(e) => handleChange('pricing', 'weekdayNight', Number(e.target.value))}
            />
            <Input
              label="Weekend Day Shift Rate (৳)"
              type="number"
              value={formData.pricing.weekendDay}
              onChange={(e) => handleChange('pricing', 'weekendDay', Number(e.target.value))}
            />
            <Input
              label="Weekend Night Shift Rate (৳)"
              type="number"
              value={formData.pricing.weekendNight}
              onChange={(e) => handleChange('pricing', 'weekendNight', Number(e.target.value))}
            />
            <Input
              label="Holiday Day Shift Rate (৳)"
              type="number"
              value={formData.pricing.holidayDay}
              onChange={(e) => handleChange('pricing', 'holidayDay', Number(e.target.value))}
            />
            <Input
              label="Holiday Night Shift Rate (৳)"
              type="number"
              value={formData.pricing.holidayNight}
              onChange={(e) => handleChange('pricing', 'holidayNight', Number(e.target.value))}
            />
          </div>
        </div>

        {/* Social Media Links */}
        <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Social Media Links</h3>
            <p className="text-xs text-zinc-400 mt-1">Configure external business handles.</p>
          </div>
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
            <Input
              label="Twitter Profile URL"
              value={formData.socialLinks.twitter}
              onChange={(e) => handleChange('socialLinks', 'twitter', e.target.value)}
            />
            <Input
              label="WhatsApp Link URL"
              value={formData.socialLinks.whatsapp}
              onChange={(e) => handleChange('socialLinks', 'whatsapp', e.target.value)}
            />
          </div>
        </div>

        {/* Hero Section Content */}
        <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">Hero Section Content</h3>
            <p className="text-xs text-zinc-400 mt-1">Configure homepage hero banner texts.</p>
          </div>
          <div className="space-y-4">
            <Input
              label="Hero Subtitle / Tagline"
              value={formData.hero.tagline}
              onChange={(e) => handleChange('hero', 'tagline', e.target.value)}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Hero Title Line 1"
                value={formData.hero.title1}
                onChange={(e) => handleChange('hero', 'title1', e.target.value)}
              />
              <Input
                label="Hero Title Line 2"
                value={formData.hero.title2}
                onChange={(e) => handleChange('hero', 'title2', e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5 text-left">
              <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Hero Description</label>
              <textarea
                value={formData.hero.description}
                onChange={(e) => handleChange('hero', 'description', e.target.value)}
                className="flex min-h-[80px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-sm text-zinc-900 dark:text-white placeholder-zinc-450 focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-450 uppercase tracking-wider">Hero Banner Media Type</label>
                <select
                  value={formData.hero.mediaType}
                  onChange={(e) => handleChange('hero', 'mediaType', e.target.value)}
                  className="w-full rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2.5 text-sm text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-650 transition-all duration-200 cursor-pointer"
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
          </div>
        </div>

        {/* SEO Metatags */}
        <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">SEO Meta Settings</h3>
            <p className="text-xs text-zinc-400 mt-1">Configure landing search keywords.</p>
          </div>
          <div className="space-y-4">
            <Input
              label="Meta Page Title"
              value={formData.seo.title}
              onChange={(e) => handleChange('seo', 'title', e.target.value)}
            />
            <Input
              label="Meta Description"
              value={formData.seo.description}
              onChange={(e) => handleChange('seo', 'description', e.target.value)}
            />
            <Input
              label="Search Keywords (comma separated)"
              value={formData.seo.keywords}
              onChange={(e) => handleChange('seo', 'keywords', e.target.value)}
            />
          </div>
        </div>

        {/* Floating Save Button */}
        <div className="flex justify-end sticky bottom-6 z-10">
          <Button type="submit" disabled={updateSettingsMutation.isPending} className="shadow-lg shadow-purple-500/10 px-8 py-3 font-bold">
            <Save className="w-5 h-5" /> {updateSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </form>

      {/* Array configuration sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sports */}
        <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
          <div>
            <h3 className="text-base font-bold text-zinc-900 dark:text-white">Sports List</h3>
            <p className="text-xs text-zinc-400 mt-1">Sports players can choose.</p>
          </div>
          <div className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Squash"
                value={newSport}
                onChange={(e) => setNewSport(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-purple-650"
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
            <div className="flex gap-2">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-purple-655"
              />
              <Button onClick={handleAddHoliday} className="p-2.5 font-bold">Add</Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {settings.holidays?.map((date) => (
                <div key={date} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm">
                  <span className="font-semibold text-zinc-850 dark:text-zinc-200">{date}</span>
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
            <div className="flex gap-2">
              <input
                type="date"
                value={newMaintenance}
                onChange={(e) => setNewMaintenance(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none focus:ring-1 focus:ring-purple-655"
              />
              <Button onClick={handleAddMaintenance} className="p-2.5 font-bold">Add</Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {settings.maintenanceDays?.map((date) => (
                <div key={date} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-100 dark:border-zinc-800 text-sm">
                  <span className="font-semibold text-zinc-850 dark:text-zinc-200">{date}</span>
                  <button onClick={() => handleDeleteMaintenance(date)} className="text-zinc-400 hover:text-red-500 cursor-pointer">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
