import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Tenant, SuperAdmin } from '../models/master/index.js';
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
    const { slug, businessName, adminUsername, adminPassword, adminEmail, adminPhone, plan, subscriptionExpiresAt } = req.body;

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

    // 2. Register tenant in master DB
    createdTenant = await Tenant.create({
      slug,
      businessName,
      dbName,
      adminEmail: adminEmail || null,
      adminPhone: adminPhone || null,
      plan: plan || 'free',
      subscriptionExpiresAt: subscriptionExpiresAt || null,
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

    const allowedFields = ['businessName', 'adminEmail', 'adminPhone', 'isActive', 'plan', 'customDomain', 'smsCredentials', 'subscriptionExpiresAt'];
    const updateData = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updateData[field] = req.body[field];
      }
    }

    await Tenant.update(updateData, { where: { id: req.params.id } });

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
