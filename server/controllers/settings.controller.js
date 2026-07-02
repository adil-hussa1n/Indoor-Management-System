import Settings from '../models/Settings.js';
import { v2 as cloudinary } from 'cloudinary';

// Helper for Cloudinary dynamic config & upload
const uploadToCloudinary = async (fileBuffer, folder) => {
  if (
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_CLOUD_NAME !== 'mock'
  ) {
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { folder },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(fileBuffer);
    });
    return result.secure_url;
  } else {
    // Local Base64 fallback
    return `data:image/png;base64,${fileBuffer.toString('base64')}`;
  }
};

export const getSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    // 1. Process logo & banner file uploads
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const logoUrl = await uploadToCloudinary(req.files.logo[0].buffer, 'settings-logo');
        settings.logo = logoUrl;
      }
      if (req.files.heroBanner && req.files.heroBanner[0]) {
        const bannerUrl = await uploadToCloudinary(req.files.heroBanner[0].buffer, 'settings-banner');
        settings.heroBanner = bannerUrl;
      }
    }

    // 2. Parse stringified JSON fields (sent via multipart/form-data)
    const body = { ...req.body };
    const jsonFields = ['businessHours', 'pricing', 'socialLinks', 'seo', 'availableSports', 'holidays', 'maintenanceDays', 'weekendDays'];
    for (const field of jsonFields) {
      if (body[field]) {
        try {
          body[field] = JSON.parse(body[field]);
        } catch (e) {
          // Keep as is if parsing fails (for flat fields or already parsed values)
        }
      }
    }

    Object.assign(settings, body);
    await settings.save();

    res.status(200).json({ success: true, settings });
  } catch (error) {
    next(error);
  }
};

export const getPublicInfo = async (req, res, next) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    // Only return public-facing data
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
    };
    res.status(200).json({ success: true, settings: publicSettings });
  } catch (error) {
    next(error);
  }
};
