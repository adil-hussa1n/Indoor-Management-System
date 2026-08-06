import { Op } from 'sequelize';
import { createAuditLog } from '../utils/auditLogger.js';

// Get all grounds/arenas
export const getGrounds = async (req, res, next) => {
  try {
    const { groundRepo } = req.repos;
    const grounds = await groundRepo.findAll({}, { order: [['order', 'ASC'], ['id', 'ASC']] });
    res.status(200).json({ success: true, grounds });
  } catch (error) {
    next(error);
  }
};

// Create a new ground
export const createGround = async (req, res, next) => {
  try {
    const { groundRepo } = req.repos;
    const { name, sport, isActive, description, order } = req.body;

    if (!name || !sport) {
      return res.status(400).json({ success: false, message: 'Name and sport classification are required.' });
    }

    const ground = await groundRepo.create({
      name,
      sport,
      isActive: isActive !== undefined ? isActive : true,
      description: description || '',
      order: order !== undefined ? Number(order) : 0,
    });

    createAuditLog(req, {
      action: 'CREATE_GROUND',
      category: 'arenas',
      entity: 'Ground',
      entityId: ground.id,
      description: `Created new arena ground '${ground.name}' (${ground.sport})`,
      newValue: ground.toJSON ? ground.toJSON() : ground,
    }).catch(err => console.error(err));

    res.status(201).json({ success: true, ground });
  } catch (error) {
    next(error);
  }
};

// Update an existing ground
export const updateGround = async (req, res, next) => {
  try {
    const { groundRepo } = req.repos;
    const { id } = req.params;
    const { name, sport, isActive, description, order } = req.body;

    const ground = await groundRepo.findById(id);
    if (!ground) {
      return res.status(404).json({ success: false, message: 'Arena/ground not found.' });
    }

    const oldValues = ground.toJSON ? ground.toJSON() : ground;

    const updatedData = {};
    if (name !== undefined) updatedData.name = name;
    if (sport !== undefined) updatedData.sport = sport;
    if (isActive !== undefined) updatedData.isActive = isActive;
    if (description !== undefined) updatedData.description = description;
    if (order !== undefined) updatedData.order = Number(order);

    await groundRepo.update(id, updatedData);
    const updated = await groundRepo.findById(id);

    createAuditLog(req, {
      action: 'UPDATE_GROUND',
      category: 'arenas',
      entity: 'Ground',
      entityId: updated.id,
      description: `Updated arena ground '${updated.name}' details`,
      oldValue: oldValues,
      newValue: updated.toJSON ? updated.toJSON() : updated,
    }).catch(err => console.error(err));

    res.status(200).json({ success: true, ground: updated });
  } catch (error) {
    next(error);
  }
};

// Reorder grounds bulk endpoint
export const reorderGrounds = async (req, res, next) => {
  try {
    const { groundRepo } = req.repos;
    const { groundIds } = req.body;

    if (!Array.isArray(groundIds)) {
      return res.status(400).json({ success: false, message: 'groundIds must be an array of IDs.' });
    }

    for (let index = 0; index < groundIds.length; index++) {
      const id = groundIds[index];
      await groundRepo.update(id, { order: index });
    }

    const grounds = await groundRepo.findAll({}, { order: [['order', 'ASC'], ['id', 'ASC']] });
    res.status(200).json({ success: true, grounds });
  } catch (error) {
    next(error);
  }
};

// Wipe & deprovision a ground (if no bookings are currently scheduled)
export const deleteGround = async (req, res, next) => {
  try {
    const { groundRepo, bookingRepo } = req.repos;
    const { id } = req.params;

    const ground = await groundRepo.findById(id);
    if (!ground) {
      return res.status(404).json({ success: false, message: 'Arena/ground not found.' });
    }

    // Safety check: verify no active bookings are scheduled on this ground
    const activeBookings = await bookingRepo.countAll({ groundId: id });
    if (activeBookings > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete ground '${ground.name}' because it has ${activeBookings} existing booking record(s).`,
      });
    }

    const oldValues = ground.toJSON ? ground.toJSON() : ground;
    await groundRepo.delete(id);

    createAuditLog(req, {
      action: 'DELETE_GROUND',
      category: 'arenas',
      entity: 'Ground',
      entityId: Number(id),
      description: `Deleted arena ground '${ground.name}'`,
      oldValue: oldValues,
    }).catch(err => console.error(err));

    res.status(200).json({ success: true, message: `Ground '${ground.name}' deleted successfully.` });
  } catch (error) {
    next(error);
  }
};
