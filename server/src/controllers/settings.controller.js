import { uploadToCloudinary } from '../utils/cloudinary.js';
import { createAuditLog } from '../utils/auditLogger.js';
import { SubscriptionHistory } from '../models/master/index.js';

export const getSettings = async (req, res, next) => {
  try {
    const { settingsRepo } = req.repos;
    const settings = await settingsRepo.getOrCreate();
    const plain = settings.toJSON();
    plain._id = plain.id;

    // Attach subscription status metadata from tenant context
    const tenant = req.tenant;
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
      };
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
        const logoUrl = await uploadToCloudinary(req.files.logo[0].buffer, 'settings-logo', req.files.logo[0].mimetype);
        body.logo = logoUrl;
      }
      if (req.files.heroBanner && req.files.heroBanner[0]) {
        const bannerUrl = await uploadToCloudinary(req.files.heroBanner[0].buffer, 'settings-banner', req.files.heroBanner[0].mimetype);
        body.heroBanner = bannerUrl;
      }
    }

    // Parse stringified JSON fields
    const jsonFields = ['businessHours', 'pricing', 'socialLinks', 'seo', 'availableSports', 'holidays', 'maintenanceDays', 'weekendDays', 'hero', 'rules', 'theme', 'paymentConfig', 'discounts'];
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
      paymentConfig: pConfig,
      discounts,
    };
    res.status(200).json({ success: true, settings: publicSettings });
  } catch (error) {
    next(error);
  }
};
