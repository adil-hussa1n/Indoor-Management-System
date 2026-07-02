import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Admin from '../models/Admin.js';
import Slot from '../models/Slot.js';
import Settings from '../models/Settings.js';
import Review from '../models/Review.js';
import Contact from '../models/Contact.js';
import Booking from '../models/Booking.js';

dotenv.config();

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
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/indoor_sports');
    console.log('Connected to MongoDB for seeding...');

    // Clear existing collection except bookings (so we don't wipe user data unnecessarily, but for a clean seed let's clean Slots, Settings, Admin)
    await Admin.deleteMany({});
    await Slot.deleteMany({});
    await Settings.deleteMany({});
    await Review.deleteMany({});
    await Contact.deleteMany({});

    // Seed Admin
    const admin = new Admin({
      username: 'admin',
      password: 'adminpassword123',
    });
    await admin.save();
    console.log('Admin seeded: admin / adminpassword123');

    // Seed Slots
    await Slot.insertMany(defaultSlots);
    console.log('Default slots seeded.');

    // Seed Settings
    await Settings.create({
      businessName: 'Apex Indoor Sports Arena',
      contactEmail: 'info@apexindoorsports.com',
      contactPhone: '+880 1712-345678',
      contactAddress: 'Sector 11, Uttara, Dhaka, Bangladesh',
      hero: {
        tagline: '⚡ Premium Indoor Court',
        title1: 'Experience Sports',
        title2: 'Like Never Before',
        description: 'Book our state-of-the-art climate-controlled indoor arena. Designed for futsal, basketball, badminton, and more. Clean, professional, and ready.',
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
    console.log('Default settings seeded.');

    // Seed Reviews & Contacts
    await Review.insertMany(mockReviews);
    await Contact.insertMany(mockContacts);
    console.log('Mock reviews and contact messages seeded.');

    // Seed some mock bookings to populate dashboard
    await Booking.deleteMany({});
    const year = new Date().getFullYear();
    const todayStr = new Date().toISOString().split('T')[0];

    // Generate dates for some days ago and tomorrow
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
        bookingDate: new Date(todayStr),
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
        bookingDate: new Date(todayStr),
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
        bookingDate: new Date(todayStr),
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
        bookingDate: new Date(yesterdayStr),
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
        bookingDate: new Date(tomorrowStr),
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
        bookingDate: new Date(yesterdayStr),
        startTime: '08:00',
        endTime: '11:00',
        duration: 3,
        players: 16,
        price: 4500,
        status: 'Completed',
      }
    ];
    await Booking.insertMany(mockBookings);
    console.log('Mock bookings seeded.');

    console.log('Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
};

seedDB();
