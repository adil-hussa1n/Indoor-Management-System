import { uploadToCloudinary } from '../utils/cloudinary.js';
import { createAuditLog } from '../utils/auditLogger.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';

export const getSettings = async (req, res, next) => {
  try {
    const { settingsRepo } = req.repos;
    const settings = await settingsRepo.getOrCreate();
    const plain = settings.toJSON();
    plain._id = plain.id;

    // Attach subscription status metadata from tenant context
    const tenant = req.business;
    if (tenant) {
      const now = new Date();
      const expiry = tenant.subscriptionExpiresAt ? new Date(tenant.subscriptionExpiresAt) : null;
      let isExpired = false;
      let isGracePeriod = false;
      let graceDaysRemaining = 7;
      let daysUntilExpiry = null;

      if (expiry) {
        const graceCutoff = new Date(expiry.getTime() + 7 * 24 * 60 * 60 * 1000);
        isExpired = now > expiry;
        isGracePeriod = isExpired && now <= graceCutoff;
        if (isGracePeriod) {
          const msLeft = graceCutoff.getTime() - now.getTime();
          graceDaysRemaining = Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
        } else if (!isExpired) {
          const msUntil = expiry.getTime() - now.getTime();
          daysUntilExpiry = Math.max(0, Math.ceil(msUntil / (1000 * 60 * 60 * 24)));
        }
      }

      const sp = tenant.subscriptionPlan || '1_month';
      let planName = '1 Month Subscription Plan';
      if (sp === 'free_trial' || sp === '7_days_trial' || sp === 'trial' || tenant.plan === 'free') planName = '7 Days Free Trial';
      else if (sp === '1_month') planName = '1 Month Subscription Plan';
      else if (sp === '3_months') planName = '3 Month Subscription Plan';
      else if (sp === '6_months') planName = '6 Month Subscription Plan';
      else if (sp === '1_year') planName = '1 Year Subscription Plan';
      else if (sp === 'custom' || sp === 'custom_date') planName = 'Custom Date Range Plan';
      else planName = sp;

      let history = [];
      try {
        if (SubscriptionHistory && tenant.id) {
          const rawHistory = await SubscriptionHistory.findAll({
            where: { tenantId: tenant.id },
            order: [['createdAt', 'DESC']],
            limit: 50,
          });
          history = rawHistory.map(h => {
            const item = h.toJSON ? h.toJSON() : { ...h };
            if (item.plan === '7_days_trial' || item.plan === 'free_trial' || item.plan === 'trial' || Number(item.amount) === 0) {
              item.planName = '7 Days Free Trial';
            }
            return item;
          });
        }
      } catch (hErr) {
        // Fallback if table is empty
      }

      plain.subscriptionStatus = {
        tier: tenant.plan || 'pro',
        subscriptionPlan: sp,
        planName,
        price: Number(tenant.subscriptionPrice || 0),
        paymentStatus: tenant.paymentStatus || 'paid',
        expiresAt: tenant.subscriptionExpiresAt,
        isExpired,
        isGracePeriod,
        graceDaysRemaining,
        daysUntilExpiry,
        allowPaymentGateway: tenant.allowPaymentGateway !== false,
      };
      plain.allowPaymentGateway = tenant.allowPaymentGateway !== false;
      plain.subscriptionHistory = history;
    }

    res.status(200).json({ success: true, settings: plain });
  } catch (error) {
    next(error);
  }
};

export const updateSettings = async (req, res, next) => {
  try {
    const { settingsRepo } = req.repos;
    const settings = await settingsRepo.getOrCreate();
    const body = { ...req.body };

    // Process file uploads
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        const file = req.files.logo[0];
        body.logo = await uploadToCloudinary(file.buffer, 'settings-logo', file.mimetype);
        body.logoMeta = { filename: file.originalname, size: file.size, mimeType: file.mimetype };
      }
      if (req.files.heroBanner && req.files.heroBanner[0]) {
        const file = req.files.heroBanner[0];
        body.heroBanner = await uploadToCloudinary(file.buffer, 'settings-banner', file.mimetype);
        body.heroBannerMeta = { filename: file.originalname, size: file.size, mimeType: file.mimetype };
      }
    }

    // Parse stringified JSON fields
    const jsonFields = ['businessHours', 'businessHoursDetailed', 'businessAddress', 'contactMethods', 'logoMeta', 'heroBannerMeta', 'pricing', 'socialLinks', 'seo', 'availableSports', 'holidays', 'maintenanceDays', 'weekendDays', 'hero', 'rules', 'theme', 'paymentConfig', 'discounts', 'maintenanceMode'];
    for (const field of jsonFields) {
      if (body[field]) {
        try {
          if (typeof body[field] === 'string') {
            body[field] = JSON.parse(body[field]);
          }
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

    await createAuditLog(req, {
      action: 'UPDATE_SETTINGS',
      category: 'settings',
      entity: 'Settings',
      entityId: settings.id,
      description: `Updated business settings and system configuration`,
      newValue: body,
    });

    const io = req.app.get('io');
    if (io) {
      io.emit('settings-updated');
    }

    const plain = settings.toJSON();
    plain._id = plain.id;
    if (typeof plain.paymentConfig === 'string') {
      try { plain.paymentConfig = JSON.parse(plain.paymentConfig); } catch (e) {}
    }
    if (typeof plain.discounts === 'string') {
      try { plain.discounts = JSON.parse(plain.discounts); } catch (e) {}
    }
    if (typeof plain.maintenanceMode === 'string') {
      try { plain.maintenanceMode = JSON.parse(plain.maintenanceMode); } catch (e) {}
    }

    res.status(200).json({ success: true, settings: plain });
  } catch (error) {
    next(error);
  }
};

export const getPublicInfo = async (req, res, next) => {
  try {
    const { settingsRepo } = req.repos;
    const settings = await settingsRepo.getOrCreate();
    let pConfig = settings.paymentConfig || { enabled: false };
    if (typeof pConfig === 'string') {
      try { pConfig = JSON.parse(pConfig); } catch (e) { pConfig = { enabled: false }; }
    }
    let discounts = settings.discounts || [];
    if (typeof discounts === 'string') {
      try { discounts = JSON.parse(discounts); } catch (e) { discounts = []; }
    }
    let maintenanceMode = settings.maintenanceMode || { enabled: false };
    if (typeof maintenanceMode === 'string') {
      try { maintenanceMode = JSON.parse(maintenanceMode); } catch (e) { maintenanceMode = { enabled: false }; }
    }

    const publicSettings = {
      businessName: settings.businessName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      contactAddress: settings.contactAddress,
      businessAddress: settings.businessAddress,
      contactMethods: settings.contactMethods,
      registrationNo: settings.registrationNo,
      taxId: settings.taxId,
      establishedDate: settings.establishedDate,
      employeeRange: settings.employeeRange,
      website: settings.website,
      currency: settings.currency,
      timezone: settings.timezone,
      businessHours: settings.businessHours,
      businessHoursDetailed: settings.businessHoursDetailed,
      logoMeta: settings.logoMeta,
      heroBannerMeta: settings.heroBannerMeta,
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
      paymentConfig: pConfig,
      discounts,
      maintenanceMode,
      allowPaymentGateway: req.business ? req.business.allowPaymentGateway !== false : true,
    };
    res.status(200).json({ success: true, settings: publicSettings });
  } catch (error) {
    next(error);
  }
};
