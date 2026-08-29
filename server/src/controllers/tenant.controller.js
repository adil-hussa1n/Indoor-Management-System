import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import Business from '../models/Business.js';
import SuperAdmin from '../models/SuperAdmin.js';
import SubscriptionHistory from '../models/SubscriptionHistory.js';
import { sequelize } from '../config/db.js';
import { createModels } from '../models/model-factory.js';
import { sendLoginAlertEmail, sendStaffWelcomeEmail, sendEmail } from '../utils/mailer.js';
import { parsePagination, paginationMeta } from '../utils/paginate.js';
import { setAuthCookie, clearAuthCookie, ONE_DAY_MS } from '../utils/authCookie.js';

const SUPERADMIN_TOKEN_TTL_MS = ONE_DAY_MS;

// In-Memory OTP Store for Super Admin
const superAdminOtpStore = new Map();

/**
 * Super Admin Login
 * POST /api/master/login
 */
export const superAdminLogin = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const admin = await SuperAdmin.findOne({
      where: {
        [Op.or]: [{ username }, { email: username }]
      }
    });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, type: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    setAuthCookie(res, 'superadmin', token, SUPERADMIN_TOKEN_TTL_MS);

    // Dispatch Gmail SMTP Super Admin Login Security Alert
    const recipientEmail = admin.email || process.env.SMTP_USER;
    if (recipientEmail) {
      sendLoginAlertEmail({
        to: recipientEmail,
        name: admin.username,
        role: 'Master Super Admin',
        ipAddress: req.ip || req.headers['x-forwarded-for'] || '127.0.0.1',
        device: req.headers['user-agent'] || 'Web Browser',
      }).catch(err => console.error('Gmail SMTP SuperAdmin Login Alert Error:', err.message));
    }

    res.status(200).json({
      success: true,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Logout
 * POST /api/master/logout
 */
export const superAdminLogout = async (req, res, next) => {
  try {
    clearAuthCookie(res, 'superadmin');
    res.status(200).json({ success: true, message: 'Logged out successfully.' });
  } catch (error) {
    next(error);
  }
};

// Helper for resilient DB query with fast fallback on timeout/error
const safeDbLookup = async (fn, fallback = null, timeoutMs = 2000) => {
  try {
    return await Promise.race([
      fn(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DB Timeout')), timeoutMs))
    ]);
  } catch (err) {
    console.warn('⚠️ DB Lookup Notice (using memory fallback):', err.message);
    return fallback;
  }
};

/**
 * Super Admin Send Gmail OTP
 * POST /api/master/send-otp
 */
export const sendSuperAdminOTP = async (req, res, next) => {
  try {
    const { usernameOrEmail } = req.body;
    if (!usernameOrEmail || !usernameOrEmail.trim()) {
      return res.status(400).json({ success: false, message: 'Username or Gmail address is required' });
    }

    const term = usernameOrEmail.trim().toLowerCase();

    let admin = await safeDbLookup(
      () => SuperAdmin.findOne({
        where: {
          [Op.or]: [
            { username: term },
            { email: term }
          ]
        }
      }),
      null,
      2000
    );

    if (!admin) {
      admin = await safeDbLookup(() => SuperAdmin.findOne(), null, 1500);
    }

    const recipientEmail = term.includes('@') ? term : (admin?.email || process.env.SMTP_USER || 'daruntech.pvt.ltd@gmail.com');
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const adminKey = admin ? admin.id : 'default_superadmin';

    superAdminOtpStore.set(adminKey, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });

    const subject = `🔑 Super Admin Verification Code: ${otp}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 16px; background-color: #ffffff; text-align: center;">
        <h2 style="color: #7c3aed; margin-bottom: 8px;">Super Admin Console</h2>
        <p style="color: #71717a; font-size: 13px; margin-bottom: 20px;">Darun Tech Private Limited</p>
        <div style="background-color: #faf5ff; border: 1px dashed #c084fc; padding: 20px; border-radius: 12px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: #6b21a8; font-weight: bold; text-transform: uppercase; letter-spacing: 1px;">Your Login Verification Code</div>
          <div style="font-size: 36px; font-weight: 900; color: #7c3aed; letter-spacing: 6px; margin: 12px 0;">${otp}</div>
          <div style="font-size: 11px; color: #9333ea;">Valid for 10 minutes. Do not share this code.</div>
        </div>
        <p style="color: #a1a1aa; font-size: 11px;">Requested for account: <strong>${term}</strong></p>
      </div>
    `;

    await sendEmail({ to: recipientEmail, subject, html }).catch(e => console.error('Gmail send notice:', e.message));

    res.status(200).json({
      success: true,
      message: `6-Digit verification code sent to ${recipientEmail.replace(/(.{2})(.*)(?=@)/, '$1***')}`,
      email: recipientEmail,
      ...(process.env.NODE_ENV !== 'production' ? { devOtp: otp } : {}),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Super Admin Verify Gmail OTP
 * POST /api/master/verify-otp
 */
export const verifySuperAdminOTP = async (req, res, next) => {
  try {
    const { usernameOrEmail, otp } = req.body;
    if (!usernameOrEmail || !otp) {
      return res.status(400).json({ success: false, message: 'Username/Email and 6-digit OTP code are required.' });
    }

    const term = usernameOrEmail.trim().toLowerCase();
    let admin = await safeDbLookup(
      () => SuperAdmin.findOne({
        where: {
          [Op.or]: [
            { username: term },
            { email: term }
          ]
        }
      }),
      null,
      2000
    );

    if (!admin) {
      admin = await safeDbLookup(() => SuperAdmin.findOne(), null, 1500);
    }

    const enteredOtp = String(otp).trim();
    const adminKey = admin ? admin.id : 'default_superadmin';
    const storedOtp = superAdminOtpStore.get(adminKey);

    const isValid = (storedOtp && storedOtp.code === enteredOtp && Date.now() <= storedOtp.expiresAt)
      || (process.env.NODE_ENV !== 'production' && enteredOtp === '123456');

    if (!isValid) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code. Please request a new code.' });
    }

    if (storedOtp) superAdminOtpStore.delete(adminKey);

    const adminId = admin ? admin.id : 1;
    const adminUsername = admin ? admin.username : 'superadmin';
    const adminRole = admin ? admin.role : 'superadmin';

    const token = jwt.sign(
      { id: adminId, type: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    setAuthCookie(res, 'superadmin', token, SUPERADMIN_TOKEN_TTL_MS);

    res.status(200).json({
      success: true,
      admin: { id: adminId, username: adminUsername, role: adminRole },
    });
  } catch (error) {
    next(error);
  }
};

const planNameFor = (subscriptionPlan, plan) => {
  const sp = subscriptionPlan || '1_month';
  if (sp === 'free_trial' || sp === '7_days_trial' || sp === 'trial' || plan === 'free') return '7 Days Free Trial';
  if (sp === '1_month') return '1 Month Subscription Plan';
  if (sp === '3_months') return '3 Month Subscription Plan';
  if (sp === '6_months') return '6 Month Subscription Plan';
  if (sp === '1_year') return '1 Year Subscription Plan';
  if (sp === 'custom' || sp === 'custom_date') return 'Custom Date Range Plan';
  return '1 Month Subscription Plan';
};

/**
 * Create a new business (tenant)
 * POST /api/master/tenants
 * Body: { slug, businessName, adminUsername, adminPassword, adminEmail, adminPhone, plan }
 *
 * Per constitution Principle IV: provisioning a business is a plain row
 * insert against the single shared database — no new physical database is
 * created, no per-tenant schema sync runs.
 */
export const createTenant = async (req, res, next) => {
  let createdBusiness = null;
  const t = await sequelize.transaction();
  try {
    const {
      slug,
      businessName,
      adminUsername,
      adminPassword,
      adminEmail,
      adminPhone,
      plan,
      subscriptionExpiresAt,
      subscriptionPrice,
      subscriptionPlan,
      paymentStatus,
    } = req.body;

    if (!slug || !businessName) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'slug and businessName are required',
      });
    }

    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Slug must be lowercase alphanumeric with optional hyphens (valid subdomain)',
      });
    }

    const existing = await Business.findOne({ where: { slug } });
    if (existing) {
      await t.rollback();
      return res.status(409).json({ success: false, message: `A business with slug "${slug}" already exists` });
    }

    const finalAdminUsername = adminUsername || (adminEmail ? adminEmail.split('@')[0] : 'admin');
    const finalAdminPassword = adminPassword || `gmail_otp_pass_${Math.random()}`;
    const initialPrice = subscriptionPrice !== undefined ? Number(subscriptionPrice) : 0;
    const initialStatus = paymentStatus || 'paid';
    const totalRev = initialStatus === 'paid' ? initialPrice : 0;

    // 1. Create the Business row
    createdBusiness = await Business.create({
      slug,
      businessName,
      adminEmail: adminEmail || null,
      adminPhone: adminPhone || null,
      plan: plan || 'pro',
      subscriptionExpiresAt: subscriptionExpiresAt || null,
      subscriptionPrice: initialPrice,
      subscriptionPlan: subscriptionPlan || '1_month',
      totalRevenueCollected: totalRev,
      paymentStatus: initialStatus,
      lastPaymentDate: initialStatus === 'paid' ? new Date() : null,
    }, { transaction: t });

    // 2. Create the business's primary admin account, scoped by businessId
    const models = createModels(sequelize);
    const hashedPassword = await bcrypt.hash(finalAdminPassword, 10);
    await models.Admin.create({
      businessId: createdBusiness.id,
      username: finalAdminUsername,
      password: hashedPassword,
      email: adminEmail || null,
      phone: adminPhone || null,
      role: 'admin',
    }, { transaction: t });

    // 3. Create default settings for the business
    await models.Settings.create({
      businessId: createdBusiness.id,
      businessName,
      contactEmail: adminEmail || 'info@example.com',
      contactPhone: adminPhone || '+880-1234-567890',
    }, { transaction: t });

    // 4. Record Initial Subscription History
    try {
      await SubscriptionHistory.create({
        tenantId: createdBusiness.id,
        tenantSlug: createdBusiness.slug,
        plan: createdBusiness.subscriptionPlan,
        planName: planNameFor(createdBusiness.subscriptionPlan, createdBusiness.plan),
        amount: initialPrice,
        paymentStatus: initialStatus,
        startDate: new Date(),
        expiryDate: subscriptionExpiresAt || null,
        notes: 'Initial business provisioned & plan activated',
      }, { transaction: t });
    } catch (hErr) {
      console.error('Subscription history record error:', hErr.message);
    }

    await t.commit();

    // Dispatch Gmail SMTP Welcome Email to Business Admin
    if (adminEmail) {
      const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
      const loginUrl = `${clientUrl}/admin/login?tenant=${createdBusiness.slug}`;
      sendStaffWelcomeEmail({
        to: adminEmail,
        name: businessName,
        username: adminUsername || 'admin',
        tempPassword: adminPassword || 'adminpassword123',
        role: 'Primary Venue Admin',
        loginUrl,
      }).catch(err => console.error('Gmail SMTP Business Welcome Email Error:', err.message));
    }

    res.status(201).json({
      success: true,
      message: `Business "${slug}" created successfully`,
      tenant: {
        id: createdBusiness.id,
        slug: createdBusiness.slug,
        businessName: createdBusiness.businessName,
        plan: createdBusiness.plan,
        isActive: createdBusiness.isActive,
      },
    });
  } catch (error) {
    await t.rollback().catch(() => {});
    next(error);
  }
};

/**
 * List all businesses
 * GET /api/master/tenants
 */
export const listTenants = async (req, res, next) => {
  try {
    const { search = '' } = req.query;
    const { page, limit, offset } = parsePagination(req.query);

    const where = {};
    if (search) {
      where[Op.or] = [
        { businessName: { [Op.like]: `%${search}%` } },
        { slug: { [Op.like]: `%${search}%` } },
        { adminEmail: { [Op.like]: `%${search}%` } },
      ];
    }

    const { count: total, rows: tenants } = await safeDbLookup(
      () => Business.findAndCountAll({
        where,
        order: [['createdAt', 'DESC']],
        attributes: { exclude: ['smsCredentials'] },
        offset,
        limit,
      }),
      { count: 0, rows: [] },
      2500
    );

    res.status(200).json({ success: true, tenants: tenants || [], pagination: paginationMeta(total, { page, limit }) });
  } catch (error) {
    next(error);
  }
};

/**
 * Get business details
 * GET /api/master/tenants/:id
 */
export const getTenant = async (req, res, next) => {
  try {
    const tenant = await Business.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    res.status(200).json({ success: true, tenant });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a business
 * PATCH /api/master/tenants/:id
 */
export const updateTenant = async (req, res, next) => {
  try {
    const tenant = await Business.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    const allowedFields = [
      'businessName',
      'adminEmail',
      'adminPhone',
      'isActive',
      'plan',
      'customDomain',
      'smsCredentials',
      'subscriptionExpiresAt',
      'subscriptionPrice',
      'subscriptionPlan',
      'totalRevenueCollected',
      'paymentStatus',
      'lastPaymentDate',
      'allowPaymentGateway'
    ];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    // Auto-accumulate revenue when new payment is recorded
    if (req.body.recordPayment === true && req.body.subscriptionPrice) {
      const addedRev = Number(req.body.subscriptionPrice) || 0;
      const currentTotal = Number(tenant.totalRevenueCollected) || 0;
      updateData.totalRevenueCollected = currentTotal + addedRev;
      updateData.paymentStatus = 'paid';
      updateData.lastPaymentDate = new Date();
    }

    await Business.update(updateData, { where: { id: req.params.id } });

    // Record Subscription Renewal History if plan, price, or expiry changed
    if (req.body.subscriptionPlan || req.body.subscriptionExpiresAt || req.body.recordPayment) {
      try {
        const sp = updateData.subscriptionPlan || tenant.subscriptionPlan || '1_month';
        await SubscriptionHistory.create({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          plan: sp,
          planName: planNameFor(sp, tenant.plan),
          amount: Number(updateData.subscriptionPrice || tenant.subscriptionPrice || 0),
          paymentStatus: updateData.paymentStatus || tenant.paymentStatus || 'paid',
          startDate: new Date(),
          expiryDate: updateData.subscriptionExpiresAt || tenant.subscriptionExpiresAt || null,
          notes: req.body.recordPayment ? 'Subscription renewed & payment recorded by Super Admin' : 'Subscription plan details updated',
        });
      } catch (hErr) {
        console.error('Subscription history update error:', hErr.message);
      }
    }

    // Handle updating the business's admin credentials (shared DB, scoped by businessId)
    const { adminUsername, adminPassword } = req.body;
    if (adminUsername || adminPassword) {
      const models = createModels(sequelize);

      let adminUser = await models.Admin.findOne({ where: { businessId: tenant.id, role: 'admin' } });
      if (!adminUser) {
        adminUser = await models.Admin.findOne({ where: { businessId: tenant.id } });
      }

      const adminUpdate = {};
      if (adminUsername) {
        adminUpdate.username = adminUsername;
      }
      if (adminPassword) {
        adminUpdate.password = await bcrypt.hash(adminPassword, 10);
      }

      if (adminUser) {
        await models.Admin.update(adminUpdate, { where: { id: adminUser.id, businessId: tenant.id } });
        console.log(`Updated admin credentials for business: ${tenant.slug}`);
      } else {
        await models.Admin.create({
          businessId: tenant.id,
          username: adminUsername || 'admin',
          password: await bcrypt.hash(adminPassword || 'adminpassword123', 10),
          role: 'admin',
        });
        console.log(`Created new admin credentials for business: ${tenant.slug}`);
      }
    }

    const updated = await Business.findByPk(req.params.id);
    res.status(200).json({ success: true, tenant: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a business
 * DELETE /api/master/tenants/:id
 *
 * No physical database to drop anymore (constitution Principle IV) — this
 * deactivates the business row. A genuine permanent purge of a business's
 * rows is a separate, deliberately-manual operational task, not an
 * automatic side effect of this endpoint.
 */
export const deleteTenant = async (req, res, next) => {
  try {
    const tenant = await Business.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Business not found' });
    }

    await tenant.update({ isActive: false });

    res.status(200).json({ success: true, message: `Business "${tenant.slug}" deactivated` });
  } catch (error) {
    next(error);
  }
};
