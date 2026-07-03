import React, { useState } from 'react';
import { useAdminSettings, useUpdateSettings, usePublicGallery } from '../hooks/useApi';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Loader } from '../components/ui/Loader';
import { useToast } from '../components/ui/Toast';
import { Save, Plus, Trash2, HelpCircle } from 'lucide-react';

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

export const AdminSettings = () => {
  const toast = useToast();
  const { data: settings, isLoading, refetch } = useAdminSettings();
  const updateSettingsMutation = useUpdateSettings();
  const { data: galleryImages } = usePublicGallery();
  const gallery360Images = galleryImages?.filter(img => img.is360) || [];

  const [newSport, setNewSport] = useState('');
  const [newHoliday, setNewHoliday] = useState('');
  const [newMaintenance, setNewMaintenance] = useState('');
  const [newRule, setNewRule] = useState('');
  const [activeTab, setActiveTab] = useState('general');

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
        rules: settings.rules || [],
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
          useGlassBg: settings.hero?.useGlassBg ?? false,
          darkenOverlay: settings.hero?.darkenOverlay ?? false,
          blurBackground: settings.hero?.blurBackground ?? false,
          zoomAnimation: settings.hero?.zoomAnimation ?? false,
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

    data.append('businessHours', JSON.stringify(formData.businessHours));
    data.append('pricing', JSON.stringify(formData.pricing));
    data.append('seo', JSON.stringify(formData.seo));
    data.append('weekendDays', JSON.stringify(formData.weekendDays));
    data.append('socialLinks', JSON.stringify(formData.socialLinks));
    data.append('hero', JSON.stringify(formData.hero));
    data.append('rules', JSON.stringify(formData.rules));

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

  if (isLoading || !formData) return <Loader size="large" className="py-20" />;  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto animate-fade-in">
      <div className="flex flex-col gap-1.5">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-white">Admin Settings</h1>
        <p className="text-sm text-zinc-400">Configure your website theme, business details, pricing structure, and court schedules.</p>
      </div>

      {/* Tab Controls */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-850 pb-3">
        {[
          { id: 'general', label: '🌐 Branding & Media' },
          { id: 'hero', label: '✨ Hero Section' },
          { id: 'pricing', label: '৳ Hours & Pricing' },
          { id: 'court', label: '⚙️ Court & Rules' },
          { id: 'integrations', label: '🔗 SEO & Links' },
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

      <form onSubmit={handleSave} className="space-y-8">
        {/* Tab 1: General & Media */}
        {activeTab === 'general' && (
          <div className="space-y-6 animate-fade-in">
            {/* Core Details */}
            <div className="glass-card p-6 rounded-3xl shadow-sm space-y-4">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">Branding Details</h3>
                <p className="text-xs text-zinc-400 mt-1">Configure business name, logo, contact coordinates, and layout styling.</p>
              </div>
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

        {/* Tab 2: Hero Text Content */}
        {activeTab === 'hero' && (
          <div className="space-y-6 animate-fade-in">
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
                    label="Headline Title Line 2"
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
                        <span className="font-semibold text-zinc-855 dark:text-zinc-200">{date}</span>
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
                        <span className="font-semibold text-zinc-855 dark:text-zinc-200">{date}</span>
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

        {/* Global Action Bar */}
        <div className="flex justify-end pt-4 border-t border-zinc-200 dark:border-zinc-800/80">
          <Button
            type="submit"
            disabled={updateSettingsMutation.isPending}
            className="px-6 py-2.5 font-bold shadow-md shadow-purple-500/10 active:scale-[0.98]"
          >
            {updateSettingsMutation.isPending ? 'Saving Settings...' : 'Save Settings Configuration'}
          </Button>
        </div>
      </form>
    </div>
  );
};
