import { DataTypes } from 'sequelize';
import { sequelize } from '../config/sequelize.js';

const Gallery = sequelize.define('Gallery', {
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
  imageUrl: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  publicId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  is360: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'galleries',
  timestamps: true,
});

export default Gallery;
