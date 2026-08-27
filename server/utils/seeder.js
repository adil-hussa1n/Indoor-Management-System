import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sequelize } from '../src/config/db.js';
import Business from '../src/models/Business.js';
import SuperAdmin from '../src/models/SuperAdmin.js';
import { createModels } from '../src/models/model-factory.js';

const defaultSlots = [
  { startTime: '08:00', endTime: '09:00', rateType: 'day' },
  { startTime: '09:00', endTime: '10:00', rateType: 'day' },
  { startTime: '10:00', endTime: '11:00', rateType: 'day' },
  { startTime: '11:00', endTime: '12:00', rateType: 'day' },
  { startTime: '12:00', endTime: '13:00', rateType: 'day' },
  { startTime: '13:00', endTime: '14:00', rateType: 'day' },
  { startTime: '14:00', endTime: '15:00', rateType: 'day' },
  { startTime: '15:00', endTime: '16:00', rateType: 'day' },
  { startTime: '16:00', endTime: '17:00', rateType: 'day' },
  { startTime: '17:00', endTime: '18:00', rateType: 'night' },
  { startTime: '18:00', endTime: '19:00', rateType: 'night' },
  { startTime: '19:00', endTime: '20:00', rateType: 'night' },
  { startTime: '20:00', endTime: '21:00', rateType: 'night' },
  { startTime: '21:00', endTime: '22:00', rateType: 'night' },
];

const mockReviews = [
  { customerName: 'John Doe', rating: 5, comment: 'Amazing facility! The court is clean, booking is seamless, and prices are fair.', isApproved: true, isFeatured: true },
  { customerName: 'Sarah Jenkins', rating: 4, comment: 'Great place to play futsal with friends. Lighting is perfect.', isApproved: true, isFeatured: true },
  { customerName: 'Mike Ross', rating: 5, comment: 'Extremely professional dashboard. Booking via mobile took me less than a minute!', isApproved: true, isFeatured: false },
  { customerName: 'Tariq Islam', rating: 5, comment: 'Best indoor playground in Dhaka! Highly recommended for weekend sessions.', isApproved: true, isFeatured: true },
  { customerName: 'Sania Mirza', rating: 4, comment: 'Clean court, cooperative staff, and very easy online slot booking experience.', isApproved: true, isFeatured: false },
];

const mockContacts = [
  { name: 'David Miller', email: 'david@example.com', message: 'Do you offer seasonal passes or discounts for regular bookings?', isRead: false },
  { name: 'Emily Watson', email: 'emily@example.com', message: 'I would like to host a corporate event next month. Can we book the entire day?', isRead: true, replyStatus: 'Replied' },
  { name: 'Sajid Khan', email: 'sajid@example.com', message: 'Is there a parking space available for cars?', isRead: false },
];

const seedDB = async () => {
  try {
    console.log('--- STARTING DATABASE SEEDING (shared database) ---');

    await sequelize.authenticate();
    const models = createModels(sequelize);
    await models.syncDatabase();

    // Clear tables (dev-only destructive reset)
    console.log('Clearing tables...');
    await SuperAdmin.destroy({ where: {}, truncate: true });
    await models.BookingStatusHistory.destroy({ where: {}, force: true });
    await models.Booking.destroy({ where: {}, force: true });
    await models.Contact.destroy({ where: {}, force: true });
    await models.Review.destroy({ where: {}, force: true });
    await models.Slot.destroy({ where: {}, force: true });
    await models.Gallery.destroy({ where: {}, force: true });
    await models.Settings.destroy({ where: {}, force: true });
    await models.Admin.destroy({ where: {}, force: true });
    await Business.destroy({ where: {}, truncate: true, cascade: true });

    // Seed Super Admin
    const superAdminPassword = await bcrypt.hash('superadminpassword123', 10);
    await SuperAdmin.create({
      username: 'superadmin',
      password: superAdminPassword,
      email: 'superadmin@daruntech.com',
    });
    console.log('✅ Super Admin seeded: superadmin / superadminpassword123');

    // Provision default demo business: apexarena (a Business row, not a new database)
    const slug = 'apexarena';
    console.log(`\n--- PROVISIONING BUSINESS: ${slug} ---`);

    const business = await Business.create({
      slug,
      businessName: 'Apex Indoor Sports Arena',
      adminEmail: 'admin@apexarena.com',
      adminPhone: '+880 1712-345678',
      plan: 'pro',
    });
    console.log(`✅ Business row created (id=${business.id})`);

    const businessId = business.id;

    // Seed Business Admin (admin / adminpassword123)
    const adminPassword = await bcrypt.hash('adminpassword123', 10);
    await models.Admin.create({
      businessId,
      username: 'admin',
      password: adminPassword,
      role: 'admin',
    });
    console.log('✅ Business Admin seeded: admin / adminpassword123');

    // Seed default ground
    const ground = await models.Ground.create({
      businessId,
      name: 'Main Arena',
      sport: 'Football',
      isActive: true,
    });

    // Seed Default 360° image
    await models.Gallery.create({
      businessId,
      imageUrl: 'https://pannellum.org/images/alma.jpg',
      is360: true,
      mediaType: 'panorama',
    });
    console.log('✅ Default 360° gallery image seeded');

    // Seed Slots
    await models.Slot.bulkCreate(defaultSlots.map((s) => ({ ...s, businessId, groundId: ground.id })));
    console.log('✅ Default slots seeded');

    // Seed Settings
    await models.Settings.create({
      businessId,
      businessName: 'Apex Indoor Sports Arena',
      contactEmail: 'info@apexindoorsports.com',
      contactPhone: '+880 1712-345678',
      contactAddress: 'Sector 11, Uttara, Dhaka, Bangladesh',
      hero: {
        mediaType: 'panorama',
        autoRotate360: true,
        overlayTitle: 'Apex Arena Uttara',
        overlaySubtitle: 'Book the premium court in Dhaka',
      },
      pricing: {
        weekdayDay: 1200,
        weekdayNight: 1400,
        weekendDay: 1700,
        weekendNight: 1800,
        holidayDay: 2000,
        holidayNight: 2200,
      }
    });
    console.log('✅ Default Settings seeded');

    // Seed Reviews and Contacts
    await models.Review.bulkCreate(mockReviews.map((r) => ({ ...r, businessId })));
    await models.Contact.bulkCreate(mockContacts.map((c) => ({ ...c, businessId })));
    console.log('✅ Mock reviews and contacts seeded');

    // Seed Bookings
    const year = new Date().getFullYear();
    const todayStr = new Date().toISOString().split('T')[0];

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const mockBookings = [
      {
        bookingId: `IND-${year}-0001`,
        customerName: 'Alice Green',
        phone: '555-0199',
        email: 'alice@example.com',
        sport: 'Basketball',
        bookingDate: todayStr,
        startTime: '10:00',
        endTime: '11:00',
        duration: 1,
        players: 10,
        price: 1500,
        status: 'Confirmed',
      },
      {
        bookingId: `IND-${year}-0002`,
        customerName: 'Robert Vance',
        phone: '555-0245',
        email: 'robert@example.com',
        sport: 'Futsal',
        bookingDate: todayStr,
        startTime: '18:00',
        endTime: '20:00',
        duration: 2,
        players: 12,
        price: 3000,
        status: 'Confirmed',
      },
      {
        bookingId: `IND-${year}-0003`,
        customerName: 'Charlie Brown',
        phone: '555-0312',
        email: 'charlie@example.com',
        sport: 'Badminton',
        bookingDate: todayStr,
        startTime: '14:00',
        endTime: '15:00',
        duration: 1,
        players: 4,
        price: 1500,
        status: 'Pending',
      },
      {
        bookingId: `IND-${year}-0004`,
        customerName: 'Kazi Nabil',
        phone: '555-0455',
        email: 'nabil@example.com',
        sport: 'Cricket',
        bookingDate: yesterdayStr,
        startTime: '16:00',
        endTime: '19:00',
        duration: 3,
        players: 14,
        price: 4500,
        status: 'Completed',
      },
      {
        bookingId: `IND-${year}-0005`,
        customerName: 'Fahim Anjum',
        phone: '555-0678',
        email: 'fahim@example.com',
        sport: 'Futsal',
        bookingDate: tomorrowStr,
        startTime: '09:00',
        endTime: '10:00',
        duration: 1,
        players: 10,
        price: 1500,
        status: 'Confirmed',
      },
      {
        bookingId: `IND-${year}-0006`,
        customerName: 'Zayed Khan',
        phone: '555-0789',
        email: 'zayed@example.com',
        sport: 'Cricket',
        bookingDate: yesterdayStr,
        startTime: '08:00',
        endTime: '11:00',
        duration: 3,
        players: 16,
        price: 4500,
        status: 'Completed',
      }
    ];

    const bookings = await models.Booking.bulkCreate(mockBookings.map((b) => ({ ...b, businessId, groundId: ground.id })));

    // Seed status histories
    const histories = bookings.map(b => ({
      businessId,
      bookingId: b.id,
      previousStatus: null,
      newStatus: b.status,
      changedBy: 'system',
      reason: 'Seeded booking',
    }));
    await models.BookingStatusHistory.bulkCreate(histories);
    console.log('✅ Mock bookings and status histories seeded');

    console.log('\n--- SEEDING COMPLETED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
