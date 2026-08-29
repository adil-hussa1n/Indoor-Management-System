// ── Migration 003: Business profile parity fields on `settings` ──
// Adds the registration/legal, structured-address, multi-channel-contact,
// media-metadata, and per-day-hours fields that business_backend's
// info_profile app and restaurant_backend's mirror of it both carry, so
// Indoor's Settings model has field-level parity (see model-factory.js's
// Settings definition for the matching column additions).

export default {
  async up(queryInterface, Sequelize) {
    const table = 'settings';

    await queryInterface.addColumn(table, 'businessAddress', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn(table, 'contactMethods', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: JSON.stringify([]),
    });
    await queryInterface.addColumn(table, 'registrationNo', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'taxId', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'establishedDate', {
      type: Sequelize.DATEONLY,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'employeeRange', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'website', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn(table, 'currency', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'BDT',
    });
    await queryInterface.addColumn(table, 'timezone', {
      type: Sequelize.STRING,
      allowNull: true,
      defaultValue: 'Asia/Dhaka',
    });
    await queryInterface.addColumn(table, 'logoMeta', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn(table, 'heroBannerMeta', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });
    await queryInterface.addColumn(table, 'businessHoursDetailed', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: null,
    });

    console.log('✅ settings: added business profile parity columns (address, contact methods, registration/legal, currency/timezone, media metadata, per-day hours)');
  },
};
