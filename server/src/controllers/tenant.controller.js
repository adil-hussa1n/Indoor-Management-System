import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Tenant, SuperAdmin, SubscriptionHistory } from '../models/master/index.js';
import { masterSequelize } from '../config/master-db.js';
import { getTenantConnection, removeTenantConnection } from '../config/sequelize.js';
import { createModels } from '../models/model-factory.js';
import { clearTenantCache } from '../middlewares/tenant.js';

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

    const admin = await SuperAdmin.findOne({ where: { username } });
    if (!admin || !(await bcrypt.compare(password, admin.password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: admin.id, type: 'superadmin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      success: true,
      token,
      admin: { id: admin.id, username: admin.username, role: admin.role },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new tenant (business)
 * POST /api/master/tenants
 * Body: { slug, businessName, adminUsername, adminPassword, adminEmail, adminPhone, plan }
 */
export const createTenant = async (req, res, next) => {
  let createdTenant = null;
  let dbCreated = false;
  let dbName = null;
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

    // Validate required fields
    if (!slug || !businessName || !adminUsername || !adminPassword) {
      return res.status(400).json({
        success: false,
        message: 'slug, businessName, adminUsername, and adminPassword are required',
      });
    }

    // Validate slug format
    if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(slug)) {
      return res.status(400).json({
        success: false,
        message: 'Slug must be lowercase alphanumeric with optional hyphens (valid subdomain)',
      });
    }

    // Check if slug already exists
    const existing = await Tenant.findOne({ where: { slug } });
    if (existing) {
      return res.status(409).json({ success: false, message: `Tenant with slug "${slug}" already exists` });
    }

    dbName = `db_${slug.replace(/-/g, '_')}`;

    // Defense-in-depth: validate dbName contains only safe characters before raw SQL
    if (!/^[a-z0-9_]+$/.test(dbName)) {
      return res.status(400).json({
        success: false,
        message: 'Generated database name contains invalid characters.',
      });
    }

    // 1. Create the tenant database
    await masterSequelize.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\`;`);
    dbCreated = true;
    console.log(`Created database: ${dbName}`);

    const initialPrice = subscriptionPrice !== undefined ? Number(subscriptionPrice) : 0;
    const initialStatus = paymentStatus || 'paid';
    const totalRev = initialStatus === 'paid' ? initialPrice : 0;

    // 2. Register tenant in master DB
    createdTenant = await Tenant.create({
      slug,
      businessName,
      dbName,
      adminEmail: adminEmail || null,
      adminPhone: adminPhone || null,
      plan: plan || 'pro',
      subscriptionExpiresAt: subscriptionExpiresAt || null,
      subscriptionPrice: initialPrice,
      subscriptionPlan: subscriptionPlan || '1_month',
      totalRevenueCollected: totalRev,
      paymentStatus: initialStatus,
      lastPaymentDate: initialStatus === 'paid' ? new Date() : null,
    });

    // 3. Initialize tenant database (create all tables)
    const tenantDb = getTenantConnection(dbName);
    const models = createModels(tenantDb);
    await models.syncDatabase();

    // 4. Create the tenant's admin account
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await models.Admin.create({
      username: adminUsername,
      password: hashedPassword,
      role: 'admin',
    });

    // 5. Create default settings
    await models.Settings.create({
      businessName,
      contactEmail: adminEmail || 'info@example.com',
      contactPhone: adminPhone || '+880-1234-567890',
    });

    // 6. Record Initial Subscription History
    try {
      const sp = createdTenant.subscriptionPlan || '1_month';
      let planName = '1 Month Subscription Plan';
      if (sp === 'free_trial' || sp === '7_days_trial' || sp === 'trial' || createdTenant.plan === 'free') planName = '7 Days Free Trial';
      else if (sp === '1_month') planName = '1 Month Subscription Plan';
      else if (sp === '3_months') planName = '3 Month Subscription Plan';
      else if (sp === '6_months') planName = '6 Month Subscription Plan';
      else if (sp === '1_year') planName = '1 Year Subscription Plan';
      else if (sp === 'custom' || sp === 'custom_date') planName = 'Custom Date Range Plan';

      await SubscriptionHistory.create({
        tenantId: createdTenant.id,
        tenantSlug: createdTenant.slug,
        plan: sp,
        planName,
        amount: initialPrice,
        paymentStatus: initialStatus,
        startDate: new Date(),
        expiryDate: subscriptionExpiresAt || null,
        notes: 'Initial tenant provisioned & plan activated',
      });
    } catch (hErr) {
      console.error('Subscription history record error:', hErr.message);
    }

    res.status(201).json({
      success: true,
      message: `Tenant "${slug}" created successfully`,
      tenant: {
        id: createdTenant.id,
        slug: createdTenant.slug,
        businessName: createdTenant.businessName,
        dbName: createdTenant.dbName,
        plan: createdTenant.plan,
        isActive: createdTenant.isActive,
      },
    });
  } catch (error) {
    console.error('Tenant provisioning failed. Starting cleanup...', error);
    
    // Clean up master Tenant record
    if (createdTenant) {
      try {
        await Tenant.destroy({ where: { id: createdTenant.id } });
        console.log(`Successfully cleaned up Tenant record for: ${createdTenant.slug}`);
      } catch (cleanupErr) {
        console.error('Failed to clean up Tenant record:', cleanupErr.message);
      }
    }
    
    // Clean up created database
    if (dbCreated && dbName) {
      try {
        await removeTenantConnection(dbName);
        await masterSequelize.query(`DROP DATABASE IF EXISTS \`${dbName}\`;`);
        console.log(`Successfully dropped database: ${dbName}`);
      } catch (cleanupErr) {
        console.error('Failed to drop database during cleanup:', cleanupErr.message);
      }
    }

    next(error);
  }
};

/**
 * List all tenants
 * GET /api/master/tenants
 */
export const listTenants = async (req, res, next) => {
  try {
    const tenants = await Tenant.findAll({
      order: [['createdAt', 'DESC']],
      attributes: { exclude: ['smsCredentials'] },
    });

    res.status(200).json({ success: true, tenants });
  } catch (error) {
    next(error);
  }
};

/**
 * Get tenant details
 * GET /api/master/tenants/:id
 */
export const getTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    res.status(200).json({ success: true, tenant });
  } catch (error) {
    next(error);
  }
};

/**
 * Update a tenant
 * PATCH /api/master/tenants/:id
 */
export const updateTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
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
      'lastPaymentDate'
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

    await Tenant.update(updateData, { where: { id: req.params.id } });

    // Record Subscription Renewal History if plan, price, or expiry changed
    if (req.body.subscriptionPlan || req.body.subscriptionExpiresAt || req.body.recordPayment) {
      try {
        const sp = updateData.subscriptionPlan || tenant.subscriptionPlan || '1_month';
        let planName = '1 Month Subscription Plan';
        if (sp === 'free_trial' || sp === '7_days_trial' || sp === 'trial' || tenant.plan === 'free') planName = '7 Days Free Trial';
        else if (sp === '1_month') planName = '1 Month Subscription Plan';
        else if (sp === '3_months') planName = '3 Month Subscription Plan';
        else if (sp === '6_months') planName = '6 Month Subscription Plan';
        else if (sp === '1_year') planName = '1 Year Subscription Plan';
        else if (sp === 'custom' || sp === 'custom_date') planName = 'Custom Date Range Plan';

        await SubscriptionHistory.create({
          tenantId: tenant.id,
          tenantSlug: tenant.slug,
          plan: sp,
          planName,
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

    // Handle updating tenant admin credentials inside the tenant's isolated DB
    const { adminUsername, adminPassword } = req.body;
    if (adminUsername || adminPassword) {
      const tenantDb = getTenantConnection(tenant.dbName);
      const models = createModels(tenantDb);
      
      let adminUser = await models.Admin.findOne({ where: { role: 'admin' } });
      if (!adminUser) {
        adminUser = await models.Admin.findOne();
      }

      const adminUpdate = {};
      if (adminUsername) {
        adminUpdate.username = adminUsername;
      }
      if (adminPassword) {
        adminUpdate.password = await bcrypt.hash(adminPassword, 10);
      }

      if (adminUser) {
        await models.Admin.update(adminUpdate, { where: { id: adminUser.id } });
        console.log(`Updated admin credentials for tenant database: ${tenant.dbName}`);
      } else {
        await models.Admin.create({
          username: adminUsername || 'admin',
          password: await bcrypt.hash(adminPassword || 'adminpassword123', 10),
          role: 'admin',
        });
        console.log(`Created new admin credentials for tenant database: ${tenant.dbName}`);
      }
    }

    // Clear tenant cache so changes take effect immediately
    clearTenantCache(tenant.slug);

    const updated = await Tenant.findByPk(req.params.id);
    res.status(200).json({ success: true, tenant: updated });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a tenant (and its database)
 * DELETE /api/master/tenants/:id
 */
export const deleteTenant = async (req, res, next) => {
  try {
    const tenant = await Tenant.findByPk(req.params.id);
    if (!tenant) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }

    // Close and remove cached connection
    await removeTenantConnection(tenant.dbName);
    clearTenantCache(tenant.slug);

    // Drop the tenant's database
    await masterSequelize.query(`DROP DATABASE IF EXISTS \`${tenant.dbName}\`;`);
    console.log(`Dropped database: ${tenant.dbName}`);

    // Delete tenant record
    await Tenant.destroy({ where: { id: req.params.id } });

    res.status(200).json({ success: true, message: `Tenant "${tenant.slug}" deleted` });
  } catch (error) {
    next(error);
  }
};
