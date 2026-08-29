import { Op } from 'sequelize';
import { createAuditLog } from '../utils/auditLogger.js';
import { assertSameBusiness } from '../utils/validateSameBusiness.js';

// ── Category Handlers ──

export const getCategories = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { type } = req.query;
    const where = {};
    if (type && ['investment', 'expense'].includes(type)) {
      where.type = type;
    }
    const categories = await financeRepo.findAllCategories(where);
    res.status(200).json({ success: true, categories });
  } catch (error) {
    next(error);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { name, type, description } = req.body;

    if (!name || !type || !['investment', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Category name and valid type (investment or expense) are required.',
      });
    }

    const category = await financeRepo.createCategory({
      name: name.trim(),
      type,
      description: description ? description.trim() : null,
    });

    await createAuditLog(req, {
      action: 'CREATE_FINANCE_CATEGORY',
      category: 'finance',
      entity: 'FinanceCategory',
      entityId: category.id,
      description: `Created ${type} category "${category.name}"`,
      newValue: category.toJSON(),
    });

    res.status(201).json({ success: true, category });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { id } = req.params;
    const { name, type, description } = req.body;

    const category = await financeRepo.findCategoryById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    const updateData = {};
    if (name) updateData.name = name.trim();
    if (type && ['investment', 'expense'].includes(type)) updateData.type = type;
    if (description !== undefined) updateData.description = description ? description.trim() : null;

    await financeRepo.updateCategory(id, updateData);
    const updated = await financeRepo.findCategoryById(id);

    await createAuditLog(req, {
      action: 'UPDATE_FINANCE_CATEGORY',
      category: 'finance',
      entity: 'FinanceCategory',
      entityId: category.id,
      description: `Updated category "${updated.name}"`,
      oldValue: category.toJSON(),
      newValue: updated.toJSON(),
    });

    res.status(200).json({ success: true, category: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { id } = req.params;

    const category = await financeRepo.findCategoryById(id);
    if (!category) {
      return res.status(404).json({ success: false, message: 'Category not found.' });
    }

    // Check if entries depend on this category
    const entries = await financeRepo.findAllEntries({ categoryId: id }, { limit: 1 });
    if (entries && entries.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete category "${category.name}" because financial entries are linked to it. Delete or reassign those entries first.`,
      });
    }

    await financeRepo.deleteCategory(id);

    await createAuditLog(req, {
      action: 'DELETE_FINANCE_CATEGORY',
      category: 'finance',
      entity: 'FinanceCategory',
      entityId: category.id,
      description: `Deleted category "${category.name}"`,
      oldValue: category.toJSON(),
    });

    res.status(200).json({ success: true, message: 'Category deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ── Financial Entry Handlers ──

export const getEntries = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { type, categoryId, groundId, startDate, endDate, search } = req.query;

    const where = {};
    if (type && ['investment', 'expense'].includes(type)) {
      where.type = type;
    }
    if (categoryId) {
      where.categoryId = categoryId;
    }
    if (groundId) {
      if (groundId === 'general') {
        where.groundId = null;
      } else if (groundId !== 'all') {
        where.groundId = Number(groundId);
      }
    }
    if (startDate && endDate) {
      where.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      where.date = { [Op.gte]: startDate };
    } else if (endDate) {
      where.date = { [Op.lte]: endDate };
    }

    if (search) {
      const q = `%${search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: q } },
        { description: { [Op.like]: q } },
        { referenceNo: { [Op.like]: q } },
        { paymentMethod: { [Op.like]: q } },
      ];
    }

    const entries = await financeRepo.findAllEntries(where);
    res.status(200).json({ success: true, entries });
  } catch (error) {
    next(error);
  }
};

export const createEntry = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { type, categoryId, groundId, amount, date, paymentMethod, title, description, referenceNo } = req.body;

    if (!type || !['investment', 'expense'].includes(type)) {
      return res.status(400).json({ success: false, message: 'Valid type (investment or expense) is required.' });
    }
    if (!categoryId) {
      return res.status(400).json({ success: false, message: 'Category selection is required.' });
    }
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: 'Title / Description is required.' });
    }
    if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
      return res.status(400).json({ success: false, message: 'A valid positive amount is required.' });
    }
    if (!date) {
      return res.status(400).json({ success: false, message: 'Transaction date is required.' });
    }

    // Cross-business FK integrity (constitution Principle III): categoryId
    // and groundId (when supplied) must belong to this business.
    await assertSameBusiness(req.models.FinanceCategory, categoryId, req.businessId, 'categoryId');
    if (groundId) {
      await assertSameBusiness(req.models.Ground, groundId, req.businessId, 'groundId');
    }

    const entry = await financeRepo.createEntry({
      type,
      categoryId: Number(categoryId),
      groundId: groundId ? Number(groundId) : null,
      amount: Number(amount),
      date,
      paymentMethod: paymentMethod || 'Cash',
      title: title.trim(),
      description: description ? description.trim() : null,
      referenceNo: referenceNo ? referenceNo.trim() : null,
    });

    const fullEntry = await financeRepo.findEntryById(entry.id);

    await createAuditLog(req, {
      action: `CREATE_${type.toUpperCase()}_ENTRY`,
      category: 'finance',
      entity: 'FinanceEntry',
      entityId: entry.id,
      description: `Recorded ${type} entry "${entry.title}" for ৳${entry.amount}`,
      newValue: fullEntry.toJSON(),
    });

    res.status(201).json({ success: true, entry: fullEntry });
  } catch (error) {
    next(error);
  }
};

export const updateEntry = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { id } = req.params;
    const { type, categoryId, groundId, amount, date, paymentMethod, title, description, referenceNo } = req.body;

    const entry = await financeRepo.findEntryById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Financial entry not found.' });
    }

    const updateData = {};
    if (type && ['investment', 'expense'].includes(type)) updateData.type = type;
    if (categoryId) {
      await assertSameBusiness(req.models.FinanceCategory, categoryId, req.businessId, 'categoryId');
      updateData.categoryId = Number(categoryId);
    }
    if (groundId !== undefined) {
      if (groundId) {
        await assertSameBusiness(req.models.Ground, groundId, req.businessId, 'groundId');
      }
      updateData.groundId = groundId ? Number(groundId) : null;
    }
    if (amount !== undefined && !isNaN(Number(amount))) updateData.amount = Number(amount);
    if (date) updateData.date = date;
    if (paymentMethod) updateData.paymentMethod = paymentMethod;
    if (title) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description ? description.trim() : null;
    if (referenceNo !== undefined) updateData.referenceNo = referenceNo ? referenceNo.trim() : null;

    await financeRepo.updateEntry(id, updateData);
    const updated = await financeRepo.findEntryById(id);

    await createAuditLog(req, {
      action: 'UPDATE_FINANCE_ENTRY',
      category: 'finance',
      entity: 'FinanceEntry',
      entityId: entry.id,
      description: `Updated ${entry.type} entry "${updated.title}"`,
      oldValue: entry.toJSON(),
      newValue: updated.toJSON(),
    });

    res.status(200).json({ success: true, entry: updated });
  } catch (error) {
    next(error);
  }
};

export const deleteEntry = async (req, res, next) => {
  try {
    const { financeRepo } = req.repos;
    const { id } = req.params;

    const entry = await financeRepo.findEntryById(id);
    if (!entry) {
      return res.status(404).json({ success: false, message: 'Financial entry not found.' });
    }

    await financeRepo.deleteEntry(id);

    await createAuditLog(req, {
      action: 'DELETE_FINANCE_ENTRY',
      category: 'finance',
      entity: 'FinanceEntry',
      entityId: entry.id,
      description: `Deleted ${entry.type} entry "${entry.title}" (৳${entry.amount})`,
      oldValue: entry.toJSON(),
    });

    res.status(200).json({ success: true, message: 'Entry deleted successfully.' });
  } catch (error) {
    next(error);
  }
};

// ── Financial Overview Summary ──

export const getFinancialSummary = async (req, res, next) => {
  try {
    const { financeRepo, bookingRepo } = req.repos;
    const { groundId } = req.query;

    const finWhere = {};
    const bookingWhere = { status: { [Op.in]: ['Confirmed', 'Paid', 'Completed'] } };

    if (groundId) {
      if (groundId === 'general') {
        finWhere.groundId = null;
      } else if (groundId !== 'all') {
        finWhere.groundId = Number(groundId);
        bookingWhere.groundId = Number(groundId);
      }
    }

    const totalInvestments = await financeRepo.sumEntries('investment', finWhere);
    const totalExpenses = await financeRepo.sumEntries('expense', finWhere);
    const totalBookingRevenue = await bookingRepo.sumPrice(bookingWhere);

    const netFinanceBalance = totalInvestments - totalExpenses;
    const netOperatingProfit = totalBookingRevenue + totalInvestments - totalExpenses;

    const categories = await financeRepo.findAllCategories();
    const recentEntries = await financeRepo.findAllEntries(finWhere, { limit: 10 });

    res.status(200).json({
      success: true,
      summary: {
        totalBookingRevenue,
        totalInvestments,
        totalExpenses,
        netFinanceBalance,
        netOperatingProfit,
        categoriesCount: categories.length,
        recentEntries,
      },
    });
  } catch (error) {
    next(error);
  }
};
