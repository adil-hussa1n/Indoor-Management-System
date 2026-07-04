import { DataTypes } from 'sequelize';
import { sequelize } from '../config/sequelize.js';

const Booking = sequelize.define('Booking', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  uuid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    allowNull: false,
    unique: true,
  },
  bookingId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  customerName: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [2, 100],
    },
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [7, 20],
    },
  },
  email: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  sport: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'Football',
  },
  bookingDate: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  startTime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  endTime: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  duration: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  },
  players: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: {
      min: 1,
    },
  },
  price: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled'),
    defaultValue: 'Pending',
    allowNull: false,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'bookings',
  timestamps: true,
  paranoid: true, // Soft delete enabled
  version: true, // Optimistic locking enabled
  indexes: [
    {
      fields: ['bookingDate'],
    },
    {
      fields: ['startTime'],
    },
    {
      fields: ['status'],
    },
    {
      fields: ['phone'],
    },
  ],
});

export default Booking;
