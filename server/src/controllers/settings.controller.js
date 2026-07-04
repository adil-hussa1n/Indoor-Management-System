import settingsRepository from '../repositories/settings.repository.js';
import { uploadToCloudinary } from '../utils/cloudinary.js';

export const getSettings = async (req, res, next) => {
  try {
    const settings = await settingsRepository.getOrCreate();
    const plain = settings.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, settings: plain });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const settings = await settingsRepository.getOrCreate();
    const body = { ...req.body };

    // Process file uploads
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const logoUrl = await uploadToCloudinary(req.files.logo[0].buffer, 'settings-logo', req.files.logo[0].mimetype);
        body.logo = logoUrl;
      }
      if (req.files.heroBanner && req.files.heroBanner[0]) {
        const bannerUrl = await uploadToCloudinary(req.files.heroBanner[0].buffer, 'settings-banner', req.files.heroBanner[0].mimetype);
        body.heroBanner = bannerUrl;
      }
    }

    // Parse stringified JSON fields
    const jsonFields = ['businessHours', 'pricing', 'socialLinks', 'seo', 'availableSports', 'holidays', 'maintenanceDays', 'weekendDays', 'hero', 'rules'];
    for (const field of jsonFields) {
      if (body[field]) {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          // Keep as is if parsing fails
        }
      }
    }

    // Handle boolean fields sent as strings from FormData
    if (body.enableDarkMode !== undefined) {
      body.enableDarkMode = body.enableDarkMode === 'true' || body.enableDarkMode === true;
    }

    await settings.update(body);

    const io = req.app.get('io');
    if (io) {
      io.emit('settings-updated');
    }

    const plain = settings.toJSON();
    plain._id = plain.id;
    res.status(200).json({ success: true, settings: plain });
  } catch (error) {
    next(error);
  }
};

export const getPublicInfo = async (req, res, next) => {
  try {
    const settings = await settingsRepository.getOrCreate();
    const publicSettings = {
      businessName: settings.businessName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      contactAddress: settings.contactAddress,
      businessHours: settings.businessHours,
      pricing: settings.pricing,
      socialLinks: settings.socialLinks,
      seo: settings.seo,
      googleMapUrl: settings.googleMapUrl,
      availableSports: settings.availableSports,
      logo: settings.logo,
      heroBanner: settings.heroBanner,
      weekendDays: settings.weekendDays,
      hero: settings.hero,
      theme: settings.theme,
      enableDarkMode: settings.enableDarkMode,
      rules: settings.rules,
    };
    res.status(200).json({ success: true, settings: publicSettings });
  } catch (error) {
    next(error);
  }
};
