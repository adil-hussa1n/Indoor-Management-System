import mongoose from 'mongoose';

const settingsSchema = new mongoose.Schema(
  {
    logo: {
      type: String,
      default: '',
    },
    heroBanner: {
      type: String,
      default: '',
    },
    hero: {
      tagline: { type: String, default: '⚡ Premium Indoor Court' },
      title1: { type: String, default: 'Experience Sports' },
      title2: { type: String, default: 'Like Never Before' },
      description: { type: String, default: 'Book our state-of-the-art climate-controlled indoor arena. Designed for futsal, basketball, badminton, and more. Clean, professional, and ready.' },
      mediaType: { type: String, enum: ['image', 'video', '360'], default: 'image' },
      autoPlay360: { type: Boolean, default: true },
      useGlassBg: { type: Boolean, default: false },
      darkenOverlay: { type: Boolean, default: false },
      blurBackground: { type: Boolean, default: false },
      zoomAnimation: { type: Boolean, default: false },
    },
    businessName: {
      type: String,
      default: 'Apex Indoor Sports Arena',
    },
    contactEmail: {
      type: String,
      default: 'info@apexindoorsports.com',
    },
    contactPhone: {
      type: String,
      default: '+880 1712-345678',
    },
    contactAddress: {
      type: String,
      default: 'Sector 11, Uttara, Dhaka, Bangladesh',
    },
    businessHours: {
      weekday: { type: String, default: '08:00 - 22:00' },
      weekend: { type: String, default: '09:00 - 23:00' },
    },
    pricing: {
      weekdayDay: { type: Number, default: 1200 },
      weekdayNight: { type: Number, default: 1400 },
      weekendDay: { type: Number, default: 1700 },
      weekendNight: { type: Number, default: 1800 },
      holidayDay: { type: Number, default: 2000 },
      holidayNight: { type: Number, default: 2200 },
    },
    weekendDays: {
      type: [Number],
      default: [5],
    },
    socialLinks: {
      facebook: { type: String, default: 'https://facebook.com' },
      instagram: { type: String, default: 'https://instagram.com' },
      twitter: { type: String, default: 'https://twitter.com' },
      whatsapp: { type: String, default: 'https://wa.me/15551234567' },
    },
    seo: {
      title: { type: String, default: 'Apex Indoor Sports Booking' },
      description: { type: String, default: 'Book the premium indoor playground for your favorite sports.' },
      keywords: { type: String, default: 'sports, indoor, booking, arena, basketball, soccer' },
    },
    googleMapUrl: {
      type: String,
      default: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3350.53696803273!2d-96.80415392348507!3d32.784651373660596!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x864e9921e1e07567%3A0xc3cf9c9bfd4db459!2sDallas%20Downtown!5e0!3m2!1sen!2sus!4v1700000000000!5m2!1sen!2sus',
    },
    holidays: {
      type: [String], // Array of "YYYY-MM-DD"
      default: [],
    },
    maintenanceDays: {
      type: [String], // Array of "YYYY-MM-DD"
      default: [],
    },
    availableSports: {
      type: [String],
      default: ['Futsal', 'Basketball', 'Badminton', 'Volleyball'],
    },
    theme: {
      type: String,
      enum: ['default', 'green'],
      default: 'default',
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', settingsSchema);
export default Settings;
