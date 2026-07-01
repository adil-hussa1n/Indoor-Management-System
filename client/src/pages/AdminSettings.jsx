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
        pricing: {
          hourlyRate: settings.pricing?.hourlyRate || 40,
          weekendRate: settings.pricing?.weekendRate || 55,
          holidayRate: settings.pricing?.holidayRate || 65,
        },
        seo: {
          title: settings.seo?.title || '',
          description: settings.seo?.description || '',
          keywords: settings.seo?.keywords || '',
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
    <div className="space-y-8 text-left max-w-5xl mx-auto">
      <form onSubmit={handleSave} className="space-y-8">
        {/* Core details */}
        <Card>
          <CardHeader>
            <CardTitle>Court Business Settings</CardTitle>
            <CardDescription>Core organization details and hours.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-zinc-100 dark:border-zinc-900 pt-4">
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider">Logo Image</label>
                {formData.logo && (
                  <img src={formData.logo} alt="Logo preview" className="w-16 h-16 object-contain rounded-lg border p-1 bg-zinc-50 mb-1" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogoFile(e.target.files[0])}
                  className="text-xs text-zinc-500 w-full"
                />
              </div>
              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-semibold text-zinc-650 dark:text-zinc-400 uppercase tracking-wider">Hero Banner Image</label>
                {formData.heroBanner && (
                  <img src={formData.heroBanner} alt="Banner preview" className="w-24 h-12 object-cover rounded-lg border bg-zinc-50 mb-1" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setBannerFile(e.target.files[0])}
                  className="text-xs text-zinc-500 w-full"
                />
              </div>
            </div>
            <Input
              label="Google Map Embedded Link URL"
              value={formData.googleMapUrl}
              onChange={(e) => handleChange(null, 'googleMapUrl', e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Pricing tier details */}
        <Card>
          <CardHeader>
            <CardTitle>Pricing Rates Configuration</CardTitle>
            <CardDescription>Determine hourly rates charged to players dynamically.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Hourly Regular Rate (৳)"
              type="number"
              value={formData.pricing.hourlyRate}
              onChange={(e) => handleChange('pricing', 'hourlyRate', Number(e.target.value))}
            />
            <Input
              label="Hourly Weekend Rate (৳)"
              type="number"
              value={formData.pricing.weekendRate}
              onChange={(e) => handleChange('pricing', 'weekendRate', Number(e.target.value))}
            />
            <Input
              label="Hourly Holiday Rate (৳)"
              type="number"
              value={formData.pricing.holidayRate}
              onChange={(e) => handleChange('pricing', 'holidayRate', Number(e.target.value))}
            />
          </CardContent>
        </Card>

        {/* SEO Metatags */}
        <Card>
          <CardHeader>
            <CardTitle>SEO Meta Settings</CardTitle>
            <CardDescription>Configure landing search keywords.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>

        {/* Floating Save Button */}
        <div className="flex justify-end sticky bottom-6 z-10">
          <Button type="submit" disabled={updateSettingsMutation.isPending} className="shadow-lg px-8 py-3">
            <Save className="w-5 h-5" /> {updateSettingsMutation.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </form>

      {/* Array configuration sections */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Sports */}
        <Card>
          <CardHeader>
            <CardTitle>Sports List</CardTitle>
            <CardDescription>Sports players can choose from.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="e.g. Squash"
                value={newSport}
                onChange={(e) => setNewSport(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none"
              />
              <Button onClick={handleAddSport} className="p-2.5">Add</Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {settings.availableSports?.map((sport) => (
                <div key={sport} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm">
                  <span className="font-semibold">{sport}</span>
                  <button onClick={() => handleDeleteSport(sport)} className="text-zinc-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Holidays */}
        <Card>
          <CardHeader>
            <CardTitle>Holidays</CardTitle>
            <CardDescription>Block court (Holiday rate apply).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="date"
                value={newHoliday}
                onChange={(e) => setNewHoliday(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none"
              />
              <Button onClick={handleAddHoliday} className="p-2.5">Add</Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {settings.holidays?.map((date) => (
                <div key={date} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm">
                  <span className="font-semibold">{date}</span>
                  <button onClick={() => handleDeleteHoliday(date)} className="text-zinc-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Maintenance */}
        <Card>
          <CardHeader>
            <CardTitle>Maintenance Days</CardTitle>
            <CardDescription>Block court completely (Zero slots).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input
                type="date"
                value={newMaintenance}
                onChange={(e) => setNewMaintenance(e.target.value)}
                className="flex-1 px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-sm focus:outline-none"
              />
              <Button onClick={handleAddMaintenance} className="p-2.5">Add</Button>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto custom-scrollbar">
              {settings.maintenanceDays?.map((date) => (
                <div key={date} className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-900 text-sm">
                  <span className="font-semibold">{date}</span>
                  <button onClick={() => handleDeleteMaintenance(date)} className="text-zinc-400 hover:text-red-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
